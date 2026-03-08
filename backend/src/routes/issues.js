const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const { verifyToken, requireRole, requireApproved } = require('../middleware/auth');

const router = express.Router();

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
 * GET /api/issues
 * Returns all issues ordered by createdAt desc
 * Optional query: ?department=TNEB, ?status=PENDING, ?myIssues=true
 */
router.get('/', verifyToken, requireApproved, async (req, res) => {
    try {
        let query = supabaseAdmin
            .from('issues')
            .select('*')
            .order('created_at', { ascending: false });

        if (req.query.department) {
            query = query.eq('department', req.query.department);
        }
        if (req.query.status) {
            query = query.eq('status', req.query.status);
        }
        if (req.query.myIssues === 'true') {
            query = query.eq('reported_by_id', req.userId);
        } else if (req.query.excludeMine === 'true') {
            query = query.neq('reported_by_id', req.userId);
        }

        const { data, error } = await query;
        if (error) throw error;

        return res.json({ issues: data });
    } catch (err) {
        console.error('Get issues error:', err);
        return res.status(500).json({ error: 'Failed to fetch issues.' });
    }
});


/**
 * POST /api/issues
 * Create a new civic issue (USER role)
 */
router.post('/', verifyToken, requireApproved, requireRole('USER'), async (req, res) => {
    const { title, description, category, latitude, longitude, locationName, imageUrl } = req.body;

    if (!title || !description || !category) {
        return res.status(400).json({ error: 'title, description, and category are required.' });
    }

    const department = CATEGORY_DEPT_MAP[category];
    if (!department) {
        return res.status(400).json({ error: 'Invalid category.' });
    }

    try {
        const { data, error } = await supabaseAdmin
            .from('issues')
            .insert({
                title,
                description,
                category,
                department,
                latitude: latitude || null,
                longitude: longitude || null,
                location_name: locationName || null,
                image_url: imageUrl || null,
                status: 'PENDING',
                priority_score: 0,
                supports_count: 0,
                reported_by_id: req.userId,
                reported_by_name: req.user.name,
            })
            .select()
            .single();

        if (error) throw error;

        return res.status(201).json({ message: 'Issue reported successfully.', issue: data });
    } catch (err) {
        console.error('Create issue error:', err);
        return res.status(500).json({ error: 'Failed to create issue.' });
    }
});

/**
 * PUT /api/issues/:id/status
 * Update issue status (Department / Collector / Admin)
 */
router.put('/:id/status', verifyToken, requireApproved,
    requireRole('MADURAI_CORPORATION', 'TNEB', 'POLICE', 'FIRE_STATION', 'COLLECTOR', 'ADMIN'),
    async (req, res) => {
        const { id } = req.params;
        const { status, completionImageUrl } = req.body;

        const validStatuses = ['PENDING', 'IN_PROGRESS', 'COMPLETED'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status.' });
        }

        try {
            // Department users can only update their own department's issues
            if (!['COLLECTOR', 'ADMIN'].includes(req.user.role)) {
                const { data: issue } = await supabaseAdmin
                    .from('issues').select('department').eq('id', id).single();
                if (issue && issue.department !== req.user.role) {
                    return res.status(403).json({ error: 'Cannot update issues from another department.' });
                }
            }

            const updateData = {
                status,
                updated_at: new Date().toISOString(),
            };
            if (completionImageUrl) updateData.completion_image_url = completionImageUrl;

            const { data, error } = await supabaseAdmin
                .from('issues')
                .update(updateData)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;

            return res.json({ message: 'Status updated.', issue: data });
        } catch (err) {
            console.error('Update status error:', err);
            return res.status(500).json({ error: 'Failed to update issue status.' });
        }
    }
);

/**
 * POST /api/issues/:id/support
 * Toggle support — adds if not yet, removes if already supported.
 * Requires `issue_supports` table in Supabase (see supabase-schema.sql).
 */
router.post('/:id/support', verifyToken, requireApproved, async (req, res) => {
    const { id } = req.params;
    const userId = req.userId;

    try {
        // Check if user already supported this issue — MUST handle error
        const { data: existing, error: checkError } = await supabaseAdmin
            .from('issue_supports')
            .select('issue_id')
            .eq('issue_id', id)
            .eq('user_id', userId)
            .maybeSingle();

        if (checkError) throw checkError; // throws if table doesn't exist

        const { data: issue } = await supabaseAdmin
            .from('issues').select('supports_count').eq('id', id).single();
        if (!issue) return res.status(404).json({ error: 'Issue not found.' });

        let newCount;
        let supported;

        if (existing) {
            // Remove support
            const { error: delError } = await supabaseAdmin
                .from('issue_supports')
                .delete()
                .eq('issue_id', id)
                .eq('user_id', userId);
            if (delError) throw delError;
            newCount = Math.max(0, (issue.supports_count || 0) - 1);
            supported = false;
        } else {
            // Add support
            const { error: insError } = await supabaseAdmin
                .from('issue_supports')
                .insert({ issue_id: id, user_id: userId });
            if (insError) throw insError;
            newCount = (issue.supports_count || 0) + 1;
            supported = true;
        }

        const { data, error } = await supabaseAdmin
            .from('issues')
            .update({ supports_count: newCount, updated_at: new Date().toISOString() })
            .eq('id', id).select().single();

        if (error) throw error;

        return res.json({
            message: supported ? 'Support added.' : 'Support removed.',
            supportsCount: data.supports_count,
            supported,
        });
    } catch (err) {
        console.error('Support toggle error:', err.message);
        if (err.message?.includes('issue_supports')) {
            return res.status(500).json({ error: 'Support table missing. Please run the Supabase schema SQL to create issue_supports table.' });
        }
        return res.status(500).json({ error: 'Failed to toggle support.' });
    }
});

/**
 * DELETE /api/issues/:id
 * Delete an issue (ADMIN only)
 */
router.delete('/:id', verifyToken, requireApproved, requireRole('ADMIN'), async (req, res) => {
    const { id } = req.params;
    try {
        const { error } = await supabaseAdmin.from('issues').delete().eq('id', id);
        if (error) throw error;
        return res.json({ message: 'Issue deleted.' });
    } catch (err) {
        console.error('Delete issue error:', err);
        return res.status(500).json({ error: 'Failed to delete issue.' });
    }
});

/**
 * GET /api/issues/my-supports
 * Returns issue IDs that the current user has supported
 */
router.get('/my-supports', verifyToken, requireApproved, async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('issue_supports')
            .select('issue_id')
            .eq('user_id', req.userId);
        if (error) throw error;
        return res.json({ supportedIds: (data || []).map(r => r.issue_id) });
    } catch (err) {
        console.error('My supports error:', err);
        return res.status(500).json({ error: 'Failed to fetch supports.' });
    }
});

module.exports = router;
