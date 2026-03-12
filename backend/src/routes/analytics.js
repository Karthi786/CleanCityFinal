const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const { verifyToken, requireApproved } = require('../middleware/auth');

const router = express.Router();

const DEPARTMENTS = ['MADURAI_CORPORATION', 'TNEB', 'POLICE', 'FIRE_STATION'];
const DEPT_LABELS = {
    MADURAI_CORPORATION: 'Madurai Corp.',
    TNEB: 'TNEB',
    POLICE: 'Police',
    FIRE_STATION: 'Fire Station',
};
const CATEGORIES = ['Waste', 'Water', 'Roads', 'Electricity', 'Law & Order', 'Fire'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * GET /api/analytics/stats?department=X
 * Summary stats: total, pending, in_progress, completed, resolution_rate
 */
router.get('/stats', verifyToken, requireApproved, async (req, res) => {
    try {
        let query = supabaseAdmin.from('issues').select('status, department');
        if (req.query.department) {
            query = query.eq('department', req.query.department);
        }
        const { data, error } = await query;
        if (error) throw error;

        const total = data.length;
        const pending = data.filter(i => i.status === 'PENDING').length;
        const inProgress = data.filter(i => i.status === 'IN_PROGRESS').length;
        const completed = data.filter(i => i.status === 'COMPLETED').length;
        const resolutionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

        return res.json({ total, pending, inProgress, completed, resolutionRate });
    } catch (err) {
        console.error('Analytics stats error:', err);
        return res.status(500).json({ error: 'Failed to fetch stats.' });
    }
});

/**
 * GET /api/analytics/by-category?department=X
 * Complaint count per category
 */
router.get('/by-category', verifyToken, requireApproved, async (req, res) => {
    try {
        let query = supabaseAdmin.from('issues').select('category, department');
        if (req.query.department) {
            query = query.eq('department', req.query.department);
        }
        const { data, error } = await query;
        if (error) throw error;

        const counts = {};
        CATEGORIES.forEach(c => { counts[c] = 0; });
        data.forEach(i => {
            if (counts[i.category] !== undefined) counts[i.category]++;
            else counts[i.category] = (counts[i.category] || 0) + 1;
        });

        const categories = Object.keys(counts);
        const values = categories.map(c => counts[c]);

        return res.json({ categories, values });
    } catch (err) {
        console.error('Analytics by-category error:', err);
        return res.status(500).json({ error: 'Failed to fetch category data.' });
    }
});

/**
 * GET /api/analytics/by-department
 * Complaint counts per department (all statuses)
 */
router.get('/by-department', verifyToken, requireApproved, async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('issues')
            .select('department, status');
        if (error) throw error;

        const result = DEPARTMENTS.map(dept => {
            const issues = data.filter(i => i.department === dept);
            return {
                department: dept,
                label: DEPT_LABELS[dept],
                total: issues.length,
                pending: issues.filter(i => i.status === 'PENDING').length,
                inProgress: issues.filter(i => i.status === 'IN_PROGRESS').length,
                completed: issues.filter(i => i.status === 'COMPLETED').length,
            };
        });

        return res.json({ departments: result });
    } catch (err) {
        console.error('Analytics by-department error:', err);
        return res.status(500).json({ error: 'Failed to fetch department data.' });
    }
});

/**
 * GET /api/analytics/monthly?department=X&months=6
 * Monthly complaint counts for the last N months
 */
router.get('/monthly', verifyToken, requireApproved, async (req, res) => {
    try {
        const monthsBack = parseInt(req.query.months || '6', 10);
        const now = new Date();
        const since = new Date(now.getFullYear(), now.getMonth() - (monthsBack - 1), 1);

        let query = supabaseAdmin
            .from('issues')
            .select('created_at, status, department')
            .gte('created_at', since.toISOString());

        if (req.query.department) {
            query = query.eq('department', req.query.department);
        }

        const { data, error } = await query;
        if (error) throw error;

        // Build month buckets
        const months = [];
        const totalCounts = [];
        const resolvedCounts = [];

        for (let i = monthsBack - 1; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            months.push(MONTH_NAMES[d.getMonth()] + ' ' + d.getFullYear().toString().slice(2));

            const monthData = data.filter(issue => {
                const issueDate = new Date(issue.created_at);
                return issueDate.getFullYear() === d.getFullYear() && issueDate.getMonth() === d.getMonth();
            });

            totalCounts.push(monthData.length);
            resolvedCounts.push(monthData.filter(i => i.status === 'COMPLETED').length);
        }

        return res.json({ months, totalCounts, resolvedCounts });
    } catch (err) {
        console.error('Analytics monthly error:', err);
        return res.status(500).json({ error: 'Failed to fetch monthly data.' });
    }
});

/**
 * GET /api/analytics/status-distribution?department=X
 * Pie/donut chart data: pending, inProgress, completed
 */
router.get('/status-distribution', verifyToken, requireApproved, async (req, res) => {
    try {
        let query = supabaseAdmin.from('issues').select('status, department');
        if (req.query.department) {
            query = query.eq('department', req.query.department);
        }
        const { data, error } = await query;
        if (error) throw error;

        const pending = data.filter(i => i.status === 'PENDING').length;
        const inProgress = data.filter(i => i.status === 'IN_PROGRESS').length;
        const completed = data.filter(i => i.status === 'COMPLETED').length;

        return res.json({
            labels: ['Pending', 'In Progress', 'Resolved'],
            values: [pending, inProgress, completed],
        });
    } catch (err) {
        console.error('Analytics status-distribution error:', err);
        return res.status(500).json({ error: 'Failed to fetch status distribution.' });
    }
});

module.exports = router;
