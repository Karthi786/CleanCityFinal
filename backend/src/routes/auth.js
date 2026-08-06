const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { supabase, supabaseAdmin } = require('../config/supabase');
const { verifyToken } = require('../middleware/auth');
const { sendEmail } = require('../utils/emailService');
require('dotenv').config();

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;
const LOGIN_OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Utility: Generate a branded HTML email for Login OTP
 */
function generateLoginOTPEmailTemplate(name, otp) {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin:0;padding:0;background:#f4f5f7;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#f4f5f7;padding:40px 20px;">
            <tr><td align="center">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="480" style="max-width:480px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
                    <tr><td style="background:linear-gradient(135deg,#B00000 0%,#8B0000 50%,#600000 100%);padding:32px 40px;text-align:center;">
                        <h1 style="margin:0;color:#fff;font-size:24px;font-weight:800;">🌿 MakkalKural</h1>
                        <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">Citizen Portal — Login Verification</p>
                    </td></tr>
                    <tr><td style="padding:36px 40px 20px;">
                        <p style="margin:0 0 20px;color:#1a1a2e;font-size:16px;">Hello <strong>${name}</strong>,</p>
                        <p style="margin:0 0 24px;color:#444;font-size:15px;">Use the code below to complete your login. This code will expire in <strong>10 minutes</strong>.</p>
                        <div style="background:linear-gradient(135deg,#fef9f0,#fff5e6);border:2px dashed #B00000;border-radius:14px;padding:28px;text-align:center;margin:0 0 24px;">
                            <p style="margin:0 0 8px;color:#666;font-size:12px;text-transform:uppercase;letter-spacing:2px;font-weight:600;">Your Login Code</p>
                            <p style="margin:0;color:#B00000;font-size:36px;font-weight:800;letter-spacing:8px;font-family:'Courier New',monospace;">${otp}</p>
                        </div>
                        <div style="background:#f8f9fa;border-radius:8px;padding:14px 18px;">
                            <p style="margin:0;color:#6c757d;font-size:12px;">🔒 <strong>Security Notice:</strong> If you did not request this code, please ignore this email or contact support immediately.</p>
                        </div>
                    </td></tr>
                    <tr><td style="padding:20px 40px 32px;border-top:1px solid #eee;">
                        <p style="margin:0 0 4px;color:#888;font-size:13px;">Regards,<br><strong style="color:#B00000;">MakkalKural Security Team</strong></p>
                        <p style="margin:16px 0 0;color:#aaa;font-size:11px;">© ${new Date().getFullYear()} MakkalKural — Tamilnadu District Administration</p>
                    </td></tr>
                </table>
            </td></tr>
        </table>
    </body>
    </html>`;
}

// Category → Department mapping
const CATEGORY_DEPT_MAP = {
    'Waste': 'TAMILNADU_CORPORATION',
    'Water': 'TAMILNADU_CORPORATION',
    'Roads': 'TAMILNADU_CORPORATION',
    'Electricity': 'TNEB',
    'Law & Order': 'POLICE',
};

/**
 * POST /api/auth/register
 */
router.post('/register', async (req, res) => {
    const { name, email, password, role, department, phone_number, district, constituency, profile_photo, description } = req.body;

    if (!name || !email || !password || !role) {
        return res.status(400).json({ error: 'All fields are required.' });
    }

    const validRoles = ['USER', 'TAMILNADU_CORPORATION', 'TNEB', 'POLICE', 'COLLECTOR', 'ADMIN', 'MLA', 'CM', 'COMMISSIONER', 'EMPLOYEE'];
    if (!validRoles.includes(role)) {
        return res.status(400).json({ error: 'Invalid role.' });
    }

    try {
        // Create user in Supabase Auth
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { profile_photo: profile_photo || null }
        });

        if (authError) {
            return res.status(400).json({ error: authError.message });
        }

        const userId = authData.user.id;
        const verificationStatus = role === 'USER' ? 'approved' : 'pending_verification';
        const finalDept = (role !== 'USER' && role !== 'COLLECTOR' && role !== 'ADMIN' && role !== 'MLA' && role !== 'CM' && role !== 'COMMISSIONER') ? role : (department || null);
        // Employees keep their department from the request body; dept_role marks them as EMPLOYEE
        const finalDeptForEmployee = role === 'EMPLOYEE' ? (department || null) : finalDept;
        const deptRole = role === 'EMPLOYEE' ? 'EMPLOYEE' : 'HEAD';

        // Insert into users table
        const { data: userRecord, error: dbError } = await supabaseAdmin
            .from('users')
            .insert({
                id: userId,
                name,
                email,
                role,
                department: finalDeptForEmployee,
                dept_role: deptRole,
                verification_status: verificationStatus,
                phone_number: phone_number || null,
                district: district || null,
                constituency: constituency || null,
                description: description || null
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

        // ── OTP Login Check ──
        // If user opted in to OTP login, send OTP and return a special status
        if (userRecord.otp_login_enabled === true) {
            // Generate OTP
            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            const salt = await bcrypt.genSalt(10);
            const otpHash = await bcrypt.hash(otp, salt);
            const expiresAt = new Date(Date.now() + LOGIN_OTP_EXPIRY_MS);

            // Delete old login OTP session for this email
            await supabaseAdmin.from('otps').delete().eq('email', userRecord.email).eq('type', 'login');

            // Store login OTP
            const { error: otpInsertError } = await supabaseAdmin.from('otps').insert({
                email: userRecord.email,
                otp_hash: otpHash,
                attempts: 0,
                resends: 0,
                registration_data: { name: userRecord.name, type: 'login' },
                expires_at: expiresAt.toISOString(),
                last_resend_at: new Date().toISOString()
            });

            if (otpInsertError) {
                console.error('Login OTP insert error:', otpInsertError);
                return res.status(500).json({ error: 'Failed to send login OTP. Please try again.' });
            }

            // Send OTP email
            const emailBody = generateLoginOTPEmailTemplate(userRecord.name, otp);
            await sendEmail({
                to: userRecord.email,
                subject: 'Your MakkalKural Login Code',
                html: emailBody
            });

            console.log(`[Login OTP] Sent to: ${userRecord.email}`);

            return res.status(202).json({
                status: 'otp_required',
                message: 'A login OTP has been sent to your email.',
                email: userRecord.email
            });
        }

        // Generate JWT (standard login)
        const token = jwt.sign(
            { userId, email: userRecord.email, role: userRecord.role },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        // Determine redirect
        const dashboardPaths = {
            USER: '/citizen-dashboard.html',
            TAMILNADU_CORPORATION: '/department-dashboard.html',
            TNEB: '/department-dashboard.html',
            POLICE: '/department-dashboard.html',
            EMPLOYEE: '/employee-dashboard.html',
            COLLECTOR: '/collector-dashboard.html',
            ADMIN: '/admin-dashboard.html',
            MLA: '/mla-dashboard.html',
            CM: '/cm-dashboard.html',
            COMMISSIONER: '/commissioner-dashboard.html',
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
 * POST /api/auth/verify-login-otp
 * Verifies the login OTP and returns a session JWT
 */
router.post('/verify-login-otp', async (req, res) => {
    const { email, otp } = req.body;

    if (!email || !otp) {
        return res.status(400).json({ error: 'Email and OTP are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otp.toString().trim();

    try {
        const { data: otpRecord, error: fetchError } = await supabaseAdmin
            .from('otps')
            .select('*')
            .eq('email', cleanEmail)
            .maybeSingle();

        if (fetchError || !otpRecord) {
            return res.status(400).json({ error: 'No pending login OTP found. Please try logging in again.' });
        }

        // Expiry check
        if (new Date(otpRecord.expires_at).getTime() < Date.now()) {
            await supabaseAdmin.from('otps').delete().eq('email', cleanEmail);
            return res.status(400).json({ error: 'OTP has expired. Please log in again.' });
        }

        // Attempt limit check
        if (otpRecord.attempts >= 5) {
            return res.status(400).json({ error: 'Too many incorrect attempts. Please log in again.' });
        }

        // Verify OTP
        const isMatch = await bcrypt.compare(cleanOtp, otpRecord.otp_hash);
        if (!isMatch) {
            await supabaseAdmin.from('otps').update({ attempts: otpRecord.attempts + 1 }).eq('email', cleanEmail);
            const remaining = 5 - (otpRecord.attempts + 1);
            return res.status(400).json({
                error: `Invalid OTP. ${remaining > 0 ? `${remaining} attempt(s) remaining.` : 'No attempts remaining.'}`
            });
        }

        // OTP verified — clean up and issue JWT
        await supabaseAdmin.from('otps').delete().eq('email', cleanEmail);

        // Fetch user profile
        const { data: userRecord, error: dbError } = await supabaseAdmin
            .from('users')
            .select('*')
            .eq('email', cleanEmail)
            .single();

        if (dbError || !userRecord) {
            return res.status(404).json({ error: 'User profile not found.' });
        }

        const token = jwt.sign(
            { userId: userRecord.id, email: userRecord.email, role: userRecord.role },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        const dashboardPaths = {
            USER: '/citizen-dashboard.html',
            TAMILNADU_CORPORATION: '/department-dashboard.html',
            TNEB: '/department-dashboard.html',
            POLICE: '/department-dashboard.html',
            EMPLOYEE: '/employee-dashboard.html',
            COLLECTOR: '/collector-dashboard.html',
            ADMIN: '/admin-dashboard.html',
            MLA: '/mla-dashboard.html',
            CM: '/cm-dashboard.html',
            COMMISSIONER: '/commissioner-dashboard.html',
        };

        return res.json({
            message: 'Login successful.',
            token,
            user: userRecord,
            redirect: dashboardPaths[userRecord.role] || '/citizen-dashboard.html',
        });
    } catch (err) {
        console.error('Verify login OTP error:', err);
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
