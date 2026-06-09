const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/leaderboard
 * Fetches the top 100 users ordered by total_points DESC.
 */
router.get('/', verifyToken, async (req, res) => {
    try {
        let query = supabaseAdmin
            .from('users')
            .select('id, name, role, district, total_points, reports_points, campaign_participated_points, campaign_created_points, reports_resolved, campaigns_participated, campaigns_organized')
            .eq('role', 'USER')
            .order('total_points', { ascending: false })
            .limit(100);

        if (req.query.district) {
            query = query.eq('district', req.query.district);
        }

        const { data, error } = await query;

        if (error) throw error;

        return res.json({ leaderboard: data });
    } catch (err) {
        console.error('Leaderboard error:', err);
        return res.status(500).json({ error: 'Failed to fetch leaderboard.' });
    }
});

module.exports = router;
