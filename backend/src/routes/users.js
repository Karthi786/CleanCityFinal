const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const { verifyToken, requireRole, requireApproved } = require('../middleware/auth');

const router = express.Router();

const ROLE_LABELS = {
    USER: 'Citizen',
    MADURAI_CORPORATION: 'Madurai Corporation',
    TNEB: 'TNEB (Electrical)',
    POLICE: 'Madurai Police',
    FIRE_STATION: 'Fire Station',
    COLLECTOR: 'District Collector',
    ADMIN: 'System Administrator',
};

/**
 * GET /api/users/pending
 * List all pending verification users (ADMIN only)
 */
router.get('/pending', verifyToken, requireApproved, requireRole('ADMIN'), async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('users')
            .select('*')
            .eq('verification_status', 'pending_verification')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return res.json({ users: data });
    } catch (err) {
        console.error('Get pending users error:', err);
        return res.status(500).json({ error: 'Failed to fetch pending users.' });
    }
});

/**
 * GET /api/users
 * List all users (ADMIN / COLLECTOR)
 */
router.get('/', verifyToken, requireApproved, requireRole('ADMIN', 'COLLECTOR'), async (req, res) => {
    try {
        let query = supabaseAdmin
            .from('users')
            .select('id, name, email, role, department, verification_status, created_at')
            .order('created_at', { ascending: false });

        if (req.query.role) {
            query = query.eq('role', req.query.role);
        }

        const { data, error } = await query;
        if (error) throw error;

        return res.json({ users: data });
    } catch (err) {
        console.error('Get users error:', err);
        return res.status(500).json({ error: 'Failed to fetch users.' });
    }
});

/**
 * GET /api/users/stats
 * Get system stats (ADMIN / COLLECTOR)
 * ⚠️ Must be defined BEFORE /:id routes to avoid Express matching "stats" as an id param
 */
router.get('/stats', verifyToken, requireApproved, requireRole('ADMIN', 'COLLECTOR'), async (req, res) => {
    try {
        const [usersRes, issuesRes, pendingRes] = await Promise.all([
            supabaseAdmin.from('users').select('role, verification_status'),
            supabaseAdmin.from('issues').select('status, department, category'),
            supabaseAdmin.from('users').select('id').eq('verification_status', 'pending_verification'),
        ]);

        if (usersRes.error || issuesRes.error) throw new Error('DB query failed');

        const users = usersRes.data || [];
        const issues = issuesRes.data || [];
        const pending = pendingRes.data || [];

        const stats = {
            totalUsers: users.length,
            citizens: users.filter(u => u.role === 'USER').length,
            pendingApprovals: pending.length,
            totalIssues: issues.length,
            pendingIssues: issues.filter(i => i.status === 'PENDING').length,
            inProgressIssues: issues.filter(i => i.status === 'IN_PROGRESS').length,
            completedIssues: issues.filter(i => i.status === 'COMPLETED').length,
            byDepartment: {},
        };

        // Group by department
        issues.forEach(issue => {
            if (!stats.byDepartment[issue.department]) {
                stats.byDepartment[issue.department] = { total: 0, completed: 0 };
            }
            stats.byDepartment[issue.department].total++;
            if (issue.status === 'COMPLETED') stats.byDepartment[issue.department].completed++;
        });

        return res.json({ stats });
    } catch (err) {
        console.error('Stats error:', err);
        return res.status(500).json({ error: 'Failed to fetch stats.' });
    }
});

/**
 * PUT /api/users/:id/verify
 * Approve or reject a user (ADMIN only)
 */
router.put('/:id/verify', verifyToken, requireApproved, requireRole('ADMIN'), async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ error: 'Status must be "approved" or "rejected".' });
    }

    try {
        const { data, error } = await supabaseAdmin
            .from('users')
            .update({ verification_status: status })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        return res.json({
            message: `User ${status === 'approved' ? 'approved' : 'rejected'} successfully.`,
            user: data,
        });
    } catch (err) {
        console.error('Verify user error:', err);
        return res.status(500).json({ error: 'Failed to update user status.' });
    }
});

module.exports = router;
