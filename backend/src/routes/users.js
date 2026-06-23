const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const { verifyToken, requireRole, requireApproved } = require('../middleware/auth');

const router = express.Router();

const ROLE_LABELS = {
    USER: 'Citizen',
    TAMILNADU_CORPORATION: 'Tamilnadu Corporation',
    TNEB: 'TNEB (Electrical)',
    POLICE: 'Tamilnadu Police',
    COLLECTOR: 'District Collector',
    ADMIN: 'System Administrator',
    MLA: 'Member of Legislative Assembly',
};

/**
 * GET /api/users/me
 * Returns the current authenticated user's full profile including all points columns.
 * Used by the citizen dashboard to refresh stat cards.
 */
router.get('/me', verifyToken, requireApproved, async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('users')
            .select('id, name, email, role, department, total_points, reports_points, campaign_participated_points, campaign_created_points, reports_resolved, reports_count, campaigns_participated, campaigns_organized, verification_status, phone_number, district, constituency, description, profile_image_url')
            .eq('id', req.userId)
            .single();

        if (error || !data) {
            return res.status(404).json({ error: 'User not found.' });
        }

        // Fetch profile photo from auth metadata
        const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(req.userId);
        if (authUser && authUser.user && authUser.user.user_metadata) {
             data.profile_photo = authUser.user.user_metadata.profile_photo || null;
        }

        return res.json({ user: data });
    } catch (err) {
        console.error('GET /users/me error:', err);
        return res.status(500).json({ error: 'Failed to fetch user profile.' });
    }
});

/**
 * PUT /api/users/me
 * Update the current authenticated user's profile details.
 */
router.put('/me', verifyToken, requireApproved, async (req, res) => {
    try {
        const { name, district, constituency, profile_photo, description } = req.body;
        
        // Update users table
        const updatePayload = { name, district, constituency, description };
        if (profile_photo !== undefined) {
            updatePayload.profile_image_url = profile_photo;
        }

        const { data, error } = await supabaseAdmin
            .from('users')
            .update(updatePayload)
            .eq('id', req.userId)
            .select()
            .single();

        if (error) {
            return res.status(500).json({ error: 'Failed to update user profile.' });
        }

        // Update auth metadata
        if (profile_photo !== undefined) {
            await supabaseAdmin.auth.admin.updateUserById(req.userId, {
                user_metadata: { profile_photo }
            });
            data.profile_photo = profile_photo;
            data.profile_image_url = profile_photo;
        } else {
            const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(req.userId);
            if (authUser && authUser.user && authUser.user.user_metadata) {
                 data.profile_photo = authUser.user.user_metadata.profile_photo || null;
            }
        }

        return res.json({ message: 'Profile updated successfully', user: data });
    } catch (err) {
        console.error('PUT /users/me error:', err);
        return res.status(500).json({ error: 'Internal server error.' });
    }
});

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

/**
 * DELETE /api/users/:id
 * Delete a user (ADMIN only)
 */
router.delete('/:id', verifyToken, requireApproved, requireRole('ADMIN'), async (req, res) => {
    const { id } = req.params;
    try {
        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id);
        if (authError && authError.status !== 404) {
            console.error('Failed to delete auth user:', authError);
        }

        const { error: dbError } = await supabaseAdmin
            .from('users')
            .delete()
            .eq('id', id);

        if (dbError) throw dbError;

        return res.json({ message: 'User deleted successfully.' });
    } catch (err) {
        console.error('Delete user error:', err);
        return res.status(500).json({ error: 'Failed to delete user.' });
    }
});

/**
 * GET /api/users/citizen-stats
 * Returns district/constituency problem counts for the logged-in citizen.
 * Used by the new citizen dashboard stat cards.
 */
router.get('/citizen-stats', verifyToken, requireApproved, requireRole('USER'), async (req, res) => {
    try {
        const { district, constituency } = req.user;

        if (!district && !constituency) {
            return res.json({
                districtTotal: 0,
                constituencyTotal: 0,
                districtSolved: 0,
                constituencySolved: 0,
            });
        }

        // Fetch all issues joined with reporter district/constituency
        const { data: allIssues, error } = await supabaseAdmin
            .from('issues')
            .select('status, reporter:users!issues_reported_by_id_fkey(district, constituency)');

        if (error) throw error;

        const issues = allIssues || [];

        // Filter by district
        const districtIssues = district
            ? issues.filter(i => i.reporter && i.reporter.district === district)
            : [];

        // Filter by constituency
        const constituencyIssues = constituency
            ? issues.filter(i => i.reporter && i.reporter.constituency === constituency)
            : [];

        return res.json({
            districtTotal: districtIssues.length,
            constituencyTotal: constituencyIssues.length,
            districtSolved: districtIssues.filter(i => i.status === 'COMPLETED').length,
            constituencySolved: constituencyIssues.filter(i => i.status === 'COMPLETED').length,
        });
    } catch (err) {
        console.error('citizen-stats error:', err);
        return res.status(500).json({ error: 'Failed to fetch citizen stats.' });
    }
});

/**
 * GET /api/users/district-authorities
 * Returns authority users (non-USER, non-ADMIN roles) in the citizen's district,
 * along with their activity stats from the issues table.
 */
router.get('/district-authorities', verifyToken, requireApproved, requireRole('USER'), async (req, res) => {
    try {
        const { district, constituency } = req.user;

        if (!district) {
            return res.json({ authorities: [] });
        }

        const AUTHORITY_ROLES = ['COLLECTOR', 'TAMILNADU_CORPORATION', 'TNEB', 'POLICE', 'MLA'];
        const ROLE_LABELS_LOCAL = {
            COLLECTOR: 'District Collector',
            TAMILNADU_CORPORATION: 'Tamilnadu Corporation',
            TNEB: 'TNEB (Electrical)',
            POLICE: 'Tamilnadu Police',
            MLA: 'Member of Legislative Assembly',
        };
        const DEPT_LABELS_LOCAL = {
            COLLECTOR: 'District Administration',
            TAMILNADU_CORPORATION: 'Municipal Corporation',
            TNEB: 'Tamil Nadu Electricity Board',
            POLICE: 'Law Enforcement',
            MLA: 'Legislative Assembly',
        };

        // Fetch all authority users in this district
        let query = supabaseAdmin
            .from('users')
            .select('id, name, role, department, district, constituency, phone_number, email, created_at, verification_status')
            .eq('district', district)
            .eq('verification_status', 'approved')
            .in('role', AUTHORITY_ROLES);

        const { data: authUsers, error: authErr } = await query;
        if (authErr) throw authErr;

        if (!authUsers || authUsers.length === 0) {
            return res.json({ authorities: [] });
        }

        // Fetch all issues in district to compute per-authority stats
        const { data: allIssues, error: issueErr } = await supabaseAdmin
            .from('issues')
            .select('status, department, updated_at, reporter:users!issues_reported_by_id_fkey(district)')
            .order('updated_at', { ascending: false });

        if (issueErr) throw issueErr;

        const districtIssues = (allIssues || []).filter(i => i.reporter && i.reporter.district === district);

        // Build authority stats by department (role maps to department key)
        const authorities = authUsers.map(auth => {
            // Issues assigned to this authority's department
            const deptIssues = auth.role !== 'COLLECTOR' && auth.role !== 'MLA'
                ? districtIssues.filter(i => i.department === auth.role)
                : districtIssues; // COLLECTOR and MLA oversee all

            const totalAssigned = deptIssues.length;
            const solved = deptIssues.filter(i => i.status === 'COMPLETED').length;
            const pending = deptIssues.filter(i => i.status === 'PENDING').length;
            const inProgress = deptIssues.filter(i => i.status === 'IN_PROGRESS').length;

            // Last activity: most recently updated issue
            const lastIssue = deptIssues.find(i => i.status === 'COMPLETED' || i.status === 'IN_PROGRESS');
            const lastActivity = lastIssue ? lastIssue.updated_at : null;

            // Performance: resolution rate as percentage
            const responseRate = totalAssigned > 0 ? Math.round((solved / totalAssigned) * 100) : 0;

            return {
                id: auth.id,
                name: auth.name,
                role: auth.role,
                designation: ROLE_LABELS_LOCAL[auth.role] || auth.role,
                department: DEPT_LABELS_LOCAL[auth.role] || auth.department || '',
                district: auth.district,
                constituency: auth.constituency || null,
                phone_number: auth.phone_number || null,
                email: auth.email || null,
                stats: {
                    totalAssigned,
                    solved,
                    pending,
                    inProgress,
                    lastActivity,
                    responseRate,
                },
            };
        });

        return res.json({ authorities });
    } catch (err) {
        console.error('district-authorities error:', err);
        return res.status(500).json({ error: 'Failed to fetch district authorities.' });
    }
});

module.exports = router;

