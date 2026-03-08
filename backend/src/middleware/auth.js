const jwt = require('jsonwebtoken');
const { supabaseAdmin } = require('../config/supabase');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Middleware: verify JWT token from Authorization header
 */
const verifyToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.slice(7)
        : null;

    if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.userId;
        req.userRole = decoded.role;
        req.userEmail = decoded.email;

        // Re-fetch latest user data (in case role/status changed)
        const { data: user, error } = await supabaseAdmin
            .from('users')
            .select('*')
            .eq('id', decoded.userId)
            .single();

        if (error || !user) {
            return res.status(401).json({ error: 'User not found.' });
        }

        if (user.verification_status === 'rejected') {
            return res.status(403).json({ error: 'Your account has been rejected.' });
        }

        req.user = user;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token.' });
    }
};

/**
 * Middleware factory: require specific roles
 * Usage: requireRole('ADMIN', 'COLLECTOR')
 */
const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated.' });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: `Access denied. Required roles: ${roles.join(', ')}` });
        }
        next();
    };
};

/**
 * Middleware: user must be approved (not pending)
 */
const requireApproved = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated.' });
    }
    if (req.user.verification_status !== 'approved') {
        return res.status(403).json({ error: 'Account pending approval.' });
    }
    next();
};

module.exports = { verifyToken, requireRole, requireApproved };
