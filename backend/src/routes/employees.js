const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const { verifyToken, requireApproved } = require('../middleware/auth');

const router = express.Router();

// Dept roles that may act as HEAD for employee management
const DEPT_ROLES = ['TAMILNADU_CORPORATION', 'TNEB', 'POLICE'];

/**
 * Helper: assert caller is an approved Department Head or ADMIN
 */
function requireHeadOrAdmin(req, res, next) {
    const { role, dept_role } = req.user;
    const isAdmin = role === 'ADMIN';
    const isHead = DEPT_ROLES.includes(role) && dept_role === 'HEAD';
    if (!isAdmin && !isHead) {
        return res.status(403).json({ error: 'Access denied. Department Head or Admin only.' });
    }
    next();
}

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
// GET /api/employees
// List all employees in the calling Head's department.
// HEAD sees their dept; ADMIN can pass ?department=X or sees all.
// ─────────────────────────────────────────────────────────────────
router.get('/', verifyToken, requireApproved, requireHeadOrAdmin, async (req, res) => {
    try {
        const isAdmin = req.user.role === 'ADMIN';
        const dept = isAdmin ? (req.query.department || null) : req.user.department;

        let query = supabaseAdmin
            .from('users')
            .select('id, name, email, phone_number, department, dept_role, verification_status, created_at, profile_image_url')
            .eq('role', 'EMPLOYEE')
            .order('created_at', { ascending: false });

        if (dept) query = query.eq('department', dept);

        const { data, error } = await query;
        if (error) throw error;

        // Enrich with issue stats
        const employeeIds = (data || []).map(e => e.id);
        let statsMap = {};
        if (employeeIds.length > 0) {
            const { data: issues } = await supabaseAdmin
                .from('issues')
                .select('assigned_employee_id, status')
                .in('assigned_employee_id', employeeIds);

            (issues || []).forEach(iss => {
                if (!statsMap[iss.assigned_employee_id]) {
                    statsMap[iss.assigned_employee_id] = { total: 0, pending: 0, inProgress: 0, completed: 0 };
                }
                statsMap[iss.assigned_employee_id].total++;
                if (iss.status === 'PENDING') statsMap[iss.assigned_employee_id].pending++;
                else if (iss.status === 'IN_PROGRESS') statsMap[iss.assigned_employee_id].inProgress++;
                else if (iss.status === 'COMPLETED') statsMap[iss.assigned_employee_id].completed++;
            });
        }

        const employees = (data || []).map(emp => ({
            ...emp,
            stats: statsMap[emp.id] || { total: 0, pending: 0, inProgress: 0, completed: 0 },
        }));

        return res.json({ employees });
    } catch (err) {
        console.error('GET /employees error:', err);
        return res.status(500).json({ error: 'Failed to fetch employees.' });
    }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/employees/pending
// List pending-verification employees in the Head's department.
// ─────────────────────────────────────────────────────────────────
router.get('/pending', verifyToken, requireApproved, requireHeadOrAdmin, async (req, res) => {
    try {
        const isAdmin = req.user.role === 'ADMIN';
        const dept = isAdmin ? (req.query.department || null) : req.user.department;

        let query = supabaseAdmin
            .from('users')
            .select('id, name, email, phone_number, department, dept_role, verification_status, created_at')
            .eq('role', 'EMPLOYEE')
            .eq('verification_status', 'pending_verification')
            .order('created_at', { ascending: false });

        if (dept) query = query.eq('department', dept);

        const { data, error } = await query;
        if (error) throw error;
        return res.json({ employees: data || [] });
    } catch (err) {
        console.error('GET /employees/pending error:', err);
        return res.status(500).json({ error: 'Failed to fetch pending employees.' });
    }
});

// ─────────────────────────────────────────────────────────────────
// PUT /api/employees/:id/verify
// Approve or reject an employee (HEAD of same dept / ADMIN)
// ─────────────────────────────────────────────────────────────────
router.put('/:id/verify', verifyToken, requireApproved, requireHeadOrAdmin, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ error: 'status must be "approved" or "rejected".' });
    }

    try {
        // Fetch the employee to verify department match (HEAD only)
        const { data: emp, error: fetchErr } = await supabaseAdmin
            .from('users')
            .select('id, role, department, verification_status')
            .eq('id', id)
            .single();

        if (fetchErr || !emp) return res.status(404).json({ error: 'Employee not found.' });
        if (emp.role !== 'EMPLOYEE') return res.status(400).json({ error: 'User is not an employee.' });

        // HEAD can only verify employees in their own department
        if (req.user.role !== 'ADMIN' && emp.department !== req.user.department) {
            return res.status(403).json({ error: 'Cannot verify employees from another department.' });
        }

        const { data, error } = await supabaseAdmin
            .from('users')
            .update({ verification_status: status })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return res.json({ message: `Employee ${status}.`, employee: data });
    } catch (err) {
        console.error('PUT /employees/:id/verify error:', err);
        return res.status(500).json({ error: 'Failed to verify employee.' });
    }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/employees/my-issues
// Issues assigned to the logged-in employee.
// ─────────────────────────────────────────────────────────────────
router.get('/my-issues', verifyToken, requireApproved, requireEmployee, async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('issues')
            .select('*')
            .eq('assigned_employee_id', req.userId)
            .order('assigned_date', { ascending: false, nullsFirst: false });

        if (error) throw error;
        return res.json({ issues: data || [] });
    } catch (err) {
        console.error('GET /employees/my-issues error:', err);
        return res.status(500).json({ error: 'Failed to fetch assigned issues.' });
    }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/employees/my-reviews
// Reviews for issues assigned to the logged-in employee.
// ─────────────────────────────────────────────────────────────────
router.get('/my-reviews', verifyToken, requireApproved, requireEmployee, async (req, res) => {
    try {
        // Fetch issue IDs assigned to this employee that are COMPLETED
        const { data: assignedIssues, error: issErr } = await supabaseAdmin
            .from('issues')
            .select('id, title')
            .eq('assigned_employee_id', req.userId)
            .eq('status', 'COMPLETED');

        if (issErr) throw issErr;
        const ids = (assignedIssues || []).map(i => i.id);
        if (ids.length === 0) return res.json({ reviews: [] });

        const { data, error } = await supabaseAdmin
            .from('issue_reviews')
            .select('*, issues(title)')
            .in('issue_id', ids)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return res.json({ reviews: data || [] });
    } catch (err) {
        console.error('GET /employees/my-reviews error:', err);
        return res.status(500).json({ error: 'Failed to fetch reviews.' });
    }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/employees/performance
// Per-employee stats for the Head's department.
// ─────────────────────────────────────────────────────────────────
router.get('/performance', verifyToken, requireApproved, requireHeadOrAdmin, async (req, res) => {
    try {
        const isAdmin = req.user.role === 'ADMIN';
        const dept = isAdmin ? (req.query.department || null) : req.user.department;

        let empQuery = supabaseAdmin
            .from('users')
            .select('id, name, verification_status')
            .eq('role', 'EMPLOYEE')
            .eq('verification_status', 'approved');
        if (dept) empQuery = empQuery.eq('department', dept);

        const { data: employees, error: empErr } = await empQuery;
        if (empErr) throw empErr;
        if (!employees || employees.length === 0) return res.json({ performance: [] });

        const empIds = employees.map(e => e.id);

        // Issues
        const { data: issues } = await supabaseAdmin
            .from('issues')
            .select('assigned_employee_id, status, assigned_date, updated_at')
            .in('assigned_employee_id', empIds);

        // Reviews
        // Get completed issue IDs for these employees
        const completedIssueIds = (issues || [])
            .filter(i => i.status === 'COMPLETED')
            .map(i => i.id);

        let reviewsMap = {};
        if (completedIssueIds.length > 0) {
            const { data: revData } = await supabaseAdmin
                .from('issue_reviews')
                .select('issue_id, rating');
            (revData || []).forEach(r => {
                if (!reviewsMap[r.issue_id]) reviewsMap[r.issue_id] = [];
                reviewsMap[r.issue_id].push(r.rating);
            });
        }

        // Build per-employee stats
        const performance = employees.map(emp => {
            const empIssues = (issues || []).filter(i => i.assigned_employee_id === emp.id);
            const total = empIssues.length;
            const pending = empIssues.filter(i => i.status === 'PENDING').length;
            const inProgress = empIssues.filter(i => i.status === 'IN_PROGRESS').length;
            const completed = empIssues.filter(i => i.status === 'COMPLETED').length;

            // Average completion time (assigned_date → updated_at for completed issues)
            const completedWithDates = empIssues.filter(i =>
                i.status === 'COMPLETED' && i.assigned_date && i.updated_at
            );
            const avgHrs = completedWithDates.length > 0
                ? Math.round(completedWithDates.reduce((sum, i) => {
                    return sum + (new Date(i.updated_at) - new Date(i.assigned_date)) / 3600000;
                }, 0) / completedWithDates.length)
                : null;

            // Average rating from reviews of completed issues
            const empCompletedIds = empIssues.filter(i => i.status === 'COMPLETED').map(i => i.id);
            const allRatings = empCompletedIds.flatMap(id => reviewsMap[id] || []);
            const avgRating = allRatings.length > 0
                ? (allRatings.reduce((s, r) => s + r, 0) / allRatings.length).toFixed(1)
                : null;

            return { id: emp.id, name: emp.name, total, pending, inProgress, completed, avgHrs, avgRating };
        });

        return res.json({ performance });
    } catch (err) {
        console.error('GET /employees/performance error:', err);
        return res.status(500).json({ error: 'Failed to fetch performance.' });
    }
});

// ─────────────────────────────────────────────────────────────────
// GET /api/employees/completion-requests
// List pending completion requests for the Head's department
// ─────────────────────────────────────────────────────────────────
router.get('/completion-requests', verifyToken, requireApproved, requireHeadOrAdmin, async (req, res) => {
    try {
        const isAdmin = req.user.role === 'ADMIN';
        const dept = isAdmin ? (req.query.department || null) : req.user.department;

        let query = supabaseAdmin
            .from('issues')
            .select(`
                id, title, location_name, status, department,
                completion_status, completion_image_url, completion_submitted_at,
                assigned_employee_id,
                users!issues_assigned_employee_id_fkey (id, name, profile_image_url)
            `)
            .eq('completion_status', 'PENDING_APPROVAL')
            .order('completion_submitted_at', { ascending: false });

        if (dept) query = query.eq('department', dept);

        const { data, error } = await query;
        if (error) throw error;
        
        // Flatten users into assigned_employee
        const requests = (data || []).map(i => {
            const employee = i.users || {};
            delete i.users;
            return {
                ...i,
                assigned_employee: employee
            };
        });

        return res.json({ requests });
    } catch (err) {
        console.error('GET /employees/completion-requests error:', err);
        return res.status(500).json({ error: 'Failed to fetch completion requests.' });
    }
});

// ─────────────────────────────────────────────────────────────────
// PUT /api/employees/completion-requests/:id/review
// Approve or Reject a completion request
// ─────────────────────────────────────────────────────────────────
router.put('/completion-requests/:id/review', verifyToken, requireApproved, requireHeadOrAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { action } = req.body; // 'APPROVE' or 'REJECT'

        if (!['APPROVE', 'REJECT'].includes(action)) {
            return res.status(400).json({ error: 'Action must be APPROVE or REJECT.' });
        }

        const { data: issue, error: fetchErr } = await supabaseAdmin
            .from('issues')
            .select('id, department, completion_status')
            .eq('id', id)
            .single();

        if (fetchErr || !issue) return res.status(404).json({ error: 'Issue not found.' });
        if (issue.completion_status !== 'PENDING_APPROVAL') {
            return res.status(400).json({ error: 'This issue is not pending approval.' });
        }
        
        if (req.user.role !== 'ADMIN' && issue.department !== req.user.department) {
            return res.status(403).json({ error: 'Cannot review requests for another department.' });
        }

        const updates = {
            completion_status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
            updated_at: new Date().toISOString()
        };

        if (action === 'APPROVE') {
            updates.status = 'COMPLETED';
            updates.approved_by = req.userId;
            updates.approved_at = new Date().toISOString();
        } else {
            updates.status = 'IN_PROGRESS';
        }

        const { error: updateErr } = await supabaseAdmin
            .from('issues')
            .update(updates)
            .eq('id', id);

        if (updateErr) throw updateErr;

        return res.json({ message: `Completion request ${action.toLowerCase()}d successfully.` });
    } catch (err) {
        console.error('PUT /employees/completion-requests/:id/review error:', err);
        return res.status(500).json({ error: 'Failed to review completion request.' });
    }
});

// ─────────────────────────────────────────────────────────────────
// DELETE /api/employees/:id
// Remove an employee (disable their account)
// ─────────────────────────────────────────────────────────────────
router.delete('/:id', verifyToken, requireApproved, requireHeadOrAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const { data: emp, error: fetchErr } = await supabaseAdmin
            .from('users')
            .select('id, role, department')
            .eq('id', id)
            .single();

        if (fetchErr || !emp) return res.status(404).json({ error: 'Employee not found.' });
        if (emp.role !== 'EMPLOYEE') return res.status(400).json({ error: 'User is not an employee.' });

        if (req.user.role !== 'ADMIN' && emp.department !== req.user.department) {
            return res.status(403).json({ error: 'Cannot remove employees from another department.' });
        }

        // Safety check: Does the employee have active assignments?
        const { count, error: countErr } = await supabaseAdmin
            .from('issues')
            .select('*', { count: 'exact', head: true })
            .eq('assigned_employee_id', id)
            .neq('status', 'COMPLETED');

        if (countErr) throw countErr;
        
        if (count > 0) {
            return res.status(400).json({ error: `Cannot remove employee. They have ${count} active complaint(s) assigned. Please reassign them first.` });
        }

        // Disable employee by changing status to rejected
        const { error: updateErr } = await supabaseAdmin
            .from('users')
            .update({ verification_status: 'rejected' })
            .eq('id', id);

        if (updateErr) throw updateErr;

        return res.json({ message: 'Employee successfully removed.' });
    } catch (err) {
        console.error('DELETE /employees/:id error:', err);
        return res.status(500).json({ error: 'Failed to remove employee.' });
    }
});

module.exports = router;
