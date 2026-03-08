const express = require('express');
const jwt = require('jsonwebtoken');
const { supabase, supabaseAdmin } = require('../config/supabase');
const { verifyToken } = require('../middleware/auth');
require('dotenv').config();

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

// Category → Department mapping
const CATEGORY_DEPT_MAP = {
    'Waste': 'MADURAI_CORPORATION',
    'Water': 'MADURAI_CORPORATION',
    'Roads': 'MADURAI_CORPORATION',
    'Electricity': 'TNEB',
    'Law & Order': 'POLICE',
    'Fire': 'FIRE_STATION',
};

/**
 * POST /api/auth/register
 */
router.post('/register', async (req, res) => {
    const { name, email, password, role, department } = req.body;

    if (!name || !email || !password || !role) {
        return res.status(400).json({ error: 'All fields are required.' });
    }

    const validRoles = ['USER', 'MADURAI_CORPORATION', 'TNEB', 'POLICE', 'FIRE_STATION', 'COLLECTOR', 'ADMIN'];
    if (!validRoles.includes(role)) {
        return res.status(400).json({ error: 'Invalid role.' });
    }

    try {
        // Create user in Supabase Auth
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
        });

        if (authError) {
            return res.status(400).json({ error: authError.message });
        }

        const userId = authData.user.id;
        const verificationStatus = role === 'USER' ? 'approved' : 'pending_verification';
        const finalDept = (role !== 'USER' && role !== 'COLLECTOR' && role !== 'ADMIN') ? role : (department || null);

        // Insert into users table
        const { data: userRecord, error: dbError } = await supabaseAdmin
            .from('users')
            .insert({
                id: userId,
                name,
                email,
                role,
                department: finalDept,
                verification_status: verificationStatus,
            })
            .select()
            .single();

        if (dbError) {
            // Rollback auth user creation
            await supabaseAdmin.auth.admin.deleteUser(userId);
            return res.status(500).json({ error: 'Failed to create user profile.' });
        }

        // Auto-login for citizens
        if (verificationStatus === 'approved') {
            const token = jwt.sign(
                { userId, email, role },
                JWT_SECRET,
                { expiresIn: '7d' }
            );
            return res.status(201).json({
                message: 'Account created successfully.',
                token,
                user: userRecord,
                redirect: '/citizen-dashboard.html',
            });
        }

        return res.status(201).json({
            message: 'Account created. Pending approval.',
            user: userRecord,
            redirect: '/pending.html',
        });
    } catch (err) {
        console.error('Register error:', err);
        return res.status(500).json({ error: 'Internal server error.' });
    }
});

/**
 * POST /api/auth/login
 */
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
    }

    try {
        // Sign in via Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (authError) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        const userId = authData.user.id;

        // Get user profile
        const { data: userRecord, error: dbError } = await supabaseAdmin
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        if (dbError || !userRecord) {
            return res.status(404).json({ error: 'User profile not found.' });
        }

        if (userRecord.verification_status === 'rejected') {
            return res.status(403).json({ error: 'Your account has been rejected. Please contact support.' });
        }

        if (userRecord.verification_status === 'pending_verification') {
            return res.status(403).json({
                error: 'Account pending approval.',
                redirect: '/pending.html',
                status: 'pending',
            });
        }

        // Generate JWT
        const token = jwt.sign(
            { userId, email: userRecord.email, role: userRecord.role },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        // Determine redirect
        const dashboardPaths = {
            USER: '/citizen-dashboard.html',
            MADURAI_CORPORATION: '/department-dashboard.html',
            TNEB: '/department-dashboard.html',
            POLICE: '/department-dashboard.html',
            FIRE_STATION: '/department-dashboard.html',
            COLLECTOR: '/collector-dashboard.html',
            ADMIN: '/admin-dashboard.html',
        };

        return res.json({
            message: 'Login successful.',
            token,
            user: userRecord,
            redirect: dashboardPaths[userRecord.role] || '/citizen-dashboard.html',
        });
    } catch (err) {
        console.error('Login error:', err);
        return res.status(500).json({ error: 'Internal server error.' });
    }
});

/**
 * GET /api/auth/me
 */
router.get('/me', verifyToken, async (req, res) => {
    return res.json({ user: req.user });
});

/**
 * POST /api/auth/logout
 */
router.post('/logout', verifyToken, async (req, res) => {
    // JWT is stateless - client removes the token
    return res.json({ message: 'Logged out successfully.' });
});

module.exports = router;
