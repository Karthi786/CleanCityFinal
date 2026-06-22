const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const { verifyToken, requireApproved } = require('../middleware/auth');

const router = express.Router();

/**
 * Helper: assert caller is an Employee
 */
function requireEmployee(req, res, next) {
    if (req.user.role !== 'EMPLOYEE') {
        return res.status(403).json({ error: 'Access denied. Employee role required.' });
    }
    next();
}

// ─────────────────────────────────────────────────────────────────
// GET /api/employee/issues
// Fetch only the issues assigned to the logged-in employee.
// ─────────────────────────────────────────────────────────────────
router.get('/issues', verifyToken, requireApproved, requireEmployee, async (req, res) => {
    try {
        console.log(`[Employee API] Fetching issues for employee ${req.userId}`);
        const { data, error } = await supabaseAdmin
            .from('issues')
            .select('*')
            .eq('assigned_employee_id', req.userId)
            .order('assigned_date', { ascending: false, nullsFirst: false });

        if (error) throw error;
        return res.json({ issues: data || [] });
    } catch (err) {
        console.error('GET /employee/issues error:', err);
        return res.status(500).json({ error: 'Failed to fetch assigned issues.' });
    }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/employee/stats
// Fetch stats for dashboard cards of the logged-in employee.
// ─────────────────────────────────────────────────────────────────
router.get('/stats', verifyToken, requireApproved, requireEmployee, async (req, res) => {
    try {
        console.log(`[Employee API] Fetching stats for employee ${req.userId}`);
        const { data, error } = await supabaseAdmin
            .from('issues')
            .select('status')
            .eq('assigned_employee_id', req.userId);

        if (error) throw error;

        const total = (data || []).length;
        const pending = (data || []).filter(i => i.status === 'PENDING').length;
        const inProgress = (data || []).filter(i => i.status === 'IN_PROGRESS').length;
        const completed = (data || []).filter(i => i.status === 'COMPLETED').length;

        return res.json({
            total,
            pending,
            inProgress,
            completed
        });
    } catch (err) {
        console.error('GET /employee/stats error:', err);
        return res.status(500).json({ error: 'Failed to fetch employee stats.' });
    }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/employee/reviews
// Fetch citizen reviews only for completed issues of the logged-in employee.
// ─────────────────────────────────────────────────────────────────
router.get('/reviews', verifyToken, requireApproved, requireEmployee, async (req, res) => {
    try {
        console.log(`[Employee API] Fetching reviews for employee ${req.userId}`);
        // Fetch completed issue IDs assigned to this employee
        const { data: completedIssues, error: issErr } = await supabaseAdmin
            .from('issues')
            .select('id')
            .eq('assigned_employee_id', req.userId)
            .eq('status', 'COMPLETED');

        if (issErr) throw issErr;
        const ids = (completedIssues || []).map(i => i.id);
        if (ids.length === 0) return res.json({ reviews: [] });

        const { data, error } = await supabaseAdmin
            .from('issue_reviews')
            .select('*, issues(title)')
            .in('issue_id', ids)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return res.json({ reviews: data || [] });
    } catch (err) {
        console.error('GET /employee/reviews error:', err);
        return res.status(500).json({ error: 'Failed to fetch reviews.' });
    }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/employee/map
// Fetch locations of issues assigned to this employee.
// ─────────────────────────────────────────────────────────────────
router.get('/map', verifyToken, requireApproved, requireEmployee, async (req, res) => {
    try {
        console.log(`[Employee API] Fetching map locations for employee ${req.userId}`);
        const { data, error } = await supabaseAdmin
            .from('issues')
            .select('id, title, description, latitude, longitude, location_name, status, supports_count, created_at')
            .eq('assigned_employee_id', req.userId)
            .not('latitude', 'is', null)
            .not('longitude', 'is', null);

        if (error) throw error;
        return res.json({ locations: data || [] });
    } catch (err) {
        console.error('GET /employee/map error:', err);
        return res.status(500).json({ error: 'Failed to fetch map locations.' });
    }
});

module.exports = router;
