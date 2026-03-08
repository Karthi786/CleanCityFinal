const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const { verifyToken, requireApproved, requireRole } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/reviews
 * ?issueId=X  → reviews for a specific issue
 * ?department=X → reviews for a department's completed issues (dept staff use)
 * (no params) → all reviews (collector / admin)
 */
router.get('/', verifyToken, requireApproved, async (req, res) => {
    try {
        const { department } = req.query;

        if (department) {
            // Get issue IDs for that department first
            const { data: issues, error: issErr } = await supabaseAdmin
                .from('issues')
                .select('id')
                .eq('department', department)
                .eq('status', 'COMPLETED');
            if (issErr) throw issErr;
            const ids = (issues || []).map(i => i.id);
            if (ids.length === 0) return res.json({ reviews: [] });

            const { data, error } = await supabaseAdmin
                .from('issue_reviews')
                .select('*, issues(title, category)')
                .in('issue_id', ids)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return res.json({ reviews: data || [] });
        }

        // All reviews (collector / admin)
        const { data, error } = await supabaseAdmin
            .from('issue_reviews')
            .select('*, issues(title, category, department)')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return res.json({ reviews: data || [] });

    } catch (err) {
        console.error('Get reviews error:', err);
        return res.status(500).json({ error: 'Failed to fetch reviews.' });
    }
});

/**
 * GET /api/reviews/:issueId
 * Fetch all reviews for a specific issue
 */
router.get('/:issueId', verifyToken, requireApproved, async (req, res) => {
    try {
        const { issueId } = req.params;
        const { data, error } = await supabaseAdmin
            .from('issue_reviews')
            .select('*, issues(title)')
            .eq('issue_id', issueId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return res.json({ reviews: data || [] });
    } catch (err) {
        console.error('Get reviews by issue error:', err);
        return res.status(500).json({ error: 'Failed to fetch reviews.' });
    }
});

/**
 * POST /api/reviews
 * Body: { issueId, rating (1-5), comment }
 * Only citizens (USER) can post; issue must be COMPLETED; one review per user per issue.
 */
router.post('/', verifyToken, requireApproved, requireRole('USER'), async (req, res) => {
    const { issueId, rating, comment } = req.body;

    if (!issueId || !rating) {
        return res.status(400).json({ error: 'issueId and rating are required.' });
    }
    if (rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'Rating must be between 1 and 5.' });
    }

    try {
        // Issue must be COMPLETED
        const { data: issue, error: issErr } = await supabaseAdmin
            .from('issues')
            .select('id, status')
            .eq('id', issueId)
            .single();

        if (issErr || !issue) return res.status(404).json({ error: 'Issue not found.' });
        if (issue.status !== 'COMPLETED') {
            return res.status(400).json({ error: 'You can only review completed issues.' });
        }

        // Check if user already reviewed this issue
        const { data: existing } = await supabaseAdmin
            .from('issue_reviews')
            .select('id')
            .eq('issue_id', issueId)
            .eq('user_id', req.userId)
            .maybeSingle();

        if (existing) {
            return res.status(409).json({ error: 'You have already reviewed this issue.' });
        }

        const { data, error } = await supabaseAdmin
            .from('issue_reviews')
            .insert({
                issue_id: issueId,
                user_id: req.userId,
                user_name: req.user.name,
                rating: parseInt(rating),
                comment: comment || null,
            })
            .select()
            .single();

        if (error) throw error;
        return res.status(201).json({ message: 'Review submitted.', review: data });

    } catch (err) {
        console.error('Post review error:', err);
        return res.status(500).json({ error: 'Failed to submit review.' });
    }
});

module.exports = router;
