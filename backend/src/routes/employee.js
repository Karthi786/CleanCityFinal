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
        const employeeUserId = req.userId;
        console.log(`[Employee API] /issues — user.id=${employeeUserId}, user.role=${req.user.role}, user.dept=${req.user.department}`);

        const { data, error } = await supabaseAdmin
            .from('issues')
            .select('*')
            .eq('assigned_employee_id', employeeUserId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[Employee API] DB error fetching issues:', JSON.stringify(error));
            throw error;
        }

        console.log(`[Employee API] Found ${(data || []).length} issues assigned to employee ${employeeUserId}`);
        if (data && data.length > 0) {
            console.log('[Employee API] Sample issue ids:', data.slice(0, 3).map(i => `${i.id} (assigned_to: ${i.assigned_employee_id})`));
        } else {
            console.warn('[Employee API] No issues found. Verify assigned_employee_id column matches user UUID.');
        }

        return res.json({ issues: data || [] });
    } catch (err) {
        console.error('[Employee API] GET /employee/issues error:', err.message, err);
        return res.status(500).json({ error: 'Failed to fetch assigned issues.', detail: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/employee/stats
// Fetch stats for dashboard cards of the logged-in employee.
// ─────────────────────────────────────────────────────────────────
router.get('/stats', verifyToken, requireApproved, requireEmployee, async (req, res) => {
    try {
        const employeeUserId = req.userId;
        console.log(`[Employee API] /stats — employee user.id=${employeeUserId}`);

        const { data, error } = await supabaseAdmin
            .from('issues')
            .select('id, status')
            .eq('assigned_employee_id', employeeUserId);

        if (error) {
            console.error('[Employee API] DB error fetching stats:', JSON.stringify(error));
            throw error;
        }

        const issues = data || [];
        const total = issues.length;
        const pending = issues.filter(i => i.status === 'PENDING').length;
        const inProgress = issues.filter(i => i.status === 'IN_PROGRESS').length;
        const completed = issues.filter(i => i.status === 'COMPLETED').length;

        console.log(`[Employee API] Stats for ${employeeUserId}: total=${total}, pending=${pending}, inProgress=${inProgress}, completed=${completed}`);

        return res.json({ total, pending, inProgress, completed });
    } catch (err) {
        console.error('[Employee API] GET /employee/stats error:', err.message, err);
        return res.status(500).json({ error: 'Failed to fetch employee stats.', detail: err.message });
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

// ─────────────────────────────────────────────────────────────────
// PUT /api/employee/remarks/:id
// Employee updates work remarks on their own assigned issue.
// ─────────────────────────────────────────────────────────────────
router.put('/remarks/:id', verifyToken, requireApproved, requireEmployee, async (req, res) => {
    const { id } = req.params;
    const { workRemarks } = req.body;
    try {
        const employeeUserId = req.userId;
        console.log(`[Employee API] /remarks/${id} — employee ${employeeUserId}`);

        // Verify this issue is actually assigned to this employee
        const { data: issue, error: fetchErr } = await supabaseAdmin
            .from('issues')
            .select('id, assigned_employee_id')
            .eq('id', id)
            .single();

        if (fetchErr || !issue) {
            return res.status(404).json({ error: 'Issue not found.' });
        }
        if (issue.assigned_employee_id !== employeeUserId) {
            return res.status(403).json({ error: 'This issue is not assigned to you.' });
        }

        const { data, error } = await supabaseAdmin
            .from('issues')
            .update({ work_remarks: workRemarks || null, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        console.log(`[Employee API] Remarks saved for issue ${id}`);
        return res.json({ message: 'Work remarks updated.', issue: data });
    } catch (err) {
        console.error('[Employee API] PUT /employee/remarks error:', err.message, err);
        return res.status(500).json({ error: 'Failed to update remarks.', detail: err.message });
    }
});

module.exports = router;
