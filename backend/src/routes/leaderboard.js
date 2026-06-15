const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/leaderboard
 * Fetches the top 100 users ordered by total_points DESC (lifetime leaderboard).
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

/**
 * GET /api/leaderboard/weekly
 * Returns the top 5 citizens for the current ISO week, sorted by weekly_points DESC.
 *
 * Weekly logic:
 *  - We store weekly_points and weekly_points_week (ISO week string e.g. "2026-W24") per user.
 *  - Each time this endpoint is called, we check every USER row:
 *    - If their weekly_points_week matches the current week → use weekly_points.
 *    - Otherwise weekly_points is effectively 0 for display (stale).
 *  - When points are awarded (in issues.js / campaigns.js), the caller should also
 *    increment weekly_points if the week matches, resetting when a new week starts.
 *  - This endpoint just reads and surfaces the top 5 for the current week.
 */
router.get('/weekly', verifyToken, async (req, res) => {
    try {
        // Compute current ISO week string e.g. "2026-W24"
        const now = new Date();
        const jan1 = new Date(now.getFullYear(), 0, 1);
        const weekNumber = Math.ceil(((now - jan1) / 86400000 + jan1.getDay() + 1) / 7);
        const currentWeek = `${now.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;

        // Fetch users with weekly data
        const { data: users, error } = await supabaseAdmin
            .from('users')
            .select('id, name, district, total_points, weekly_points, weekly_points_week')
            .eq('role', 'USER')
            .order('weekly_points', { ascending: false })
            .limit(20); // fetch more and filter

        if (error) {
            // If weekly_points columns don't exist yet, fall back to total_points
            if (error.message && error.message.includes('weekly_points')) {
                const { data: fallback, error: fbErr } = await supabaseAdmin
                    .from('users')
                    .select('id, name, district, total_points')
                    .eq('role', 'USER')
                    .order('total_points', { ascending: false })
                    .limit(5);

                if (fbErr) throw fbErr;
                const top5 = (fallback || []).slice(0, 5).map(u => ({
                    id: u.id,
                    name: u.name,
                    weekly_points: u.total_points || 0,
                }));
                return res.json({ weekly: top5, week: currentWeek });
            }
            throw error;
        }

        // Filter to current week, assign 0 for stale weeks
        const ranked = (users || [])
            .map(u => ({
                id: u.id,
                name: u.name,
                weekly_points: (u.weekly_points_week === currentWeek) ? (u.weekly_points || 0) : 0,
            }))
            .sort((a, b) => b.weekly_points - a.weekly_points)
            .slice(0, 5);

        return res.json({ weekly: ranked, week: currentWeek });
    } catch (err) {
        console.error('Weekly leaderboard error:', err);
        return res.status(500).json({ error: 'Failed to fetch weekly leaderboard.' });
    }
});

module.exports = router;
