const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const { verifyToken, requireApproved, requireRole } = require('../middleware/auth');

const router = express.Router();

// All Commissioner routes require authentication, approval, and COMMISSIONER role
router.use(verifyToken, requireApproved, requireRole('COMMISSIONER'));

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const DEPT_LABELS = {
    TAMILNADU_CORPORATION: 'Tamilnadu Corporation',
    TNEB: 'TNEB (Electrical)',
    POLICE: 'Police',
};

const DEPT_ICONS = {
    TAMILNADU_CORPORATION: '🏙️',
    TNEB: '⚡',
    POLICE: '👮',
};

/**
 * Helper: get district from commissioner profile
 */
function getDistrict(req) {
    return req.user.district || null;
}

/**
 * GET /api/commissioner/overview
 * District-wide summary stats
 */
router.get('/overview', async (req, res) => {
    const district = getDistrict(req);
    if (!district) {
        return res.status(400).json({ error: 'Commissioner has no assigned district.' });
    }

    try {
        const { data: issues, error } = await supabaseAdmin
            .from('issues')
            .select('status, department, reporter:users!issues_reported_by_id_fkey(district, constituency)')
            .neq('department', 'FIRE_STATION');

        if (error) throw error;

        // Filter to this district only
        const districtIssues = issues.filter(i => i.reporter?.district === district);

        const total = districtIssues.length;
        const resolved = districtIssues.filter(i => i.status === 'COMPLETED').length;
        const inProgress = districtIssues.filter(i => i.status === 'IN_PROGRESS').length;
        const pending = districtIssues.filter(i => i.status === 'PENDING').length;
        const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

        // Count unique constituencies
        const constituencies = new Set();
        districtIssues.forEach(i => {
            if (i.reporter?.constituency) constituencies.add(i.reporter.constituency);
        });

        return res.json({
            district,
            total,
            resolved,
            inProgress,
            pending,
            resolutionRate,
            totalConstituencies: constituencies.size,
        });
    } catch (err) {
        console.error('Commissioner overview error:', err);
        return res.status(500).json({ error: 'Failed to fetch overview.' });
    }
});

/**
 * GET /api/commissioner/issues
 * All issues in commissioner's district, with filters
 * Query: ?status=PENDING&department=TNEB&category=Waste&dateFrom=2024-01-01&dateTo=2024-12-31
 */
router.get('/issues', async (req, res) => {
    const district = getDistrict(req);
    if (!district) {
        return res.status(400).json({ error: 'Commissioner has no assigned district.' });
    }

    try {
        let query = supabaseAdmin
            .from('issues')
            .select('*, reporter:users!issues_reported_by_id_fkey(name, district, constituency, phone_number)')
            .neq('department', 'FIRE_STATION')
            .order('created_at', { ascending: false });

        if (req.query.status) query = query.eq('status', req.query.status);
        if (req.query.department) query = query.eq('department', req.query.department);
        if (req.query.category) query = query.eq('category', req.query.category);
        if (req.query.dateFrom) query = query.gte('created_at', req.query.dateFrom);
        if (req.query.dateTo) query = query.lte('created_at', req.query.dateTo + 'T23:59:59.999Z');

        let { data, error } = await query;
        if (error) throw error;

        // Filter to commissioner's district
        data = (data || []).filter(i => i.reporter?.district === district);

        // Clean up reporter join
        data = data.map(issue => {
            const { reporter, ...rest } = issue;
            return {
                ...rest,
                reporter_name: reporter?.name,
                reporter_district: reporter?.district,
                reporter_constituency: reporter?.constituency,
                reporter_phone: reporter?.phone_number,
            };
        });

        return res.json({ issues: data, total: data.length });
    } catch (err) {
        console.error('Commissioner issues error:', err);
        return res.status(500).json({ error: 'Failed to fetch issues.' });
    }
});

/**
 * GET /api/commissioner/departments
 * Department performance within commissioner's district
 */
router.get('/departments', async (req, res) => {
    const district = getDistrict(req);
    if (!district) {
        return res.status(400).json({ error: 'Commissioner has no assigned district.' });
    }

    try {
        const { data: issues, error } = await supabaseAdmin
            .from('issues')
            .select('status, department, created_at, updated_at, reporter:users!issues_reported_by_id_fkey(district)')
            .neq('department', 'FIRE_STATION');

        if (error) throw error;

        // Filter to district
        const districtIssues = issues.filter(i => i.reporter?.district === district);

        const deptMap = {};
        districtIssues.forEach(i => {
            const d = i.department;
            if (!d) return;
            if (!deptMap[d]) {
                deptMap[d] = { total: 0, resolved: 0, inProgress: 0, pending: 0, resolutionTimes: [] };
            }
            deptMap[d].total++;
            if (i.status === 'COMPLETED') {
                deptMap[d].resolved++;
                // Calculate resolution time in hours if we have both dates
                if (i.created_at && i.updated_at) {
                    const hours = (new Date(i.updated_at) - new Date(i.created_at)) / (1000 * 60 * 60);
                    if (hours >= 0) deptMap[d].resolutionTimes.push(hours);
                }
            } else if (i.status === 'IN_PROGRESS') {
                deptMap[d].inProgress++;
            } else {
                deptMap[d].pending++;
            }
        });

        const departments = Object.entries(deptMap).map(([key, stats]) => {
            const avgResolutionHours = stats.resolutionTimes.length > 0
                ? Math.round(stats.resolutionTimes.reduce((a, b) => a + b, 0) / stats.resolutionTimes.length)
                : null;
            return {
                key,
                label: DEPT_LABELS[key] || key,
                icon: DEPT_ICONS[key] || '🏛️',
                total: stats.total,
                resolved: stats.resolved,
                inProgress: stats.inProgress,
                pending: stats.pending,
                efficiencyRate: stats.total > 0 ? Math.round((stats.resolved / stats.total) * 100) : 0,
                avgResolutionHours,
            };
        }).sort((a, b) => b.total - a.total);

        return res.json({ departments, district });
    } catch (err) {
        console.error('Commissioner departments error:', err);
        return res.status(500).json({ error: 'Failed to fetch department data.' });
    }
});

/**
 * GET /api/commissioner/heatmap
 * Returns issue coordinates for heatmap
 * Query: ?status=PENDING&department=TNEB&category=Waste
 */
router.get('/heatmap', async (req, res) => {
    const district = getDistrict(req);
    if (!district) {
        return res.status(400).json({ error: 'Commissioner has no assigned district.' });
    }

    try {
        let query = supabaseAdmin
            .from('issues')
            .select('latitude, longitude, status, department, category, reporter:users!issues_reported_by_id_fkey(district)')
            .neq('department', 'FIRE_STATION')
            .not('latitude', 'is', null)
            .not('longitude', 'is', null);

        if (req.query.status) query = query.eq('status', req.query.status);
        if (req.query.department) query = query.eq('department', req.query.department);
        if (req.query.category) query = query.eq('category', req.query.category);

        let { data, error } = await query;
        if (error) throw error;

        // Filter to district
        data = (data || []).filter(i => i.reporter?.district === district);

        const heatPoints = data.map(i => ({
            lat: i.latitude,
            lng: i.longitude,
            status: i.status,
            department: i.department,
            category: i.category,
        }));

        return res.json({ points: heatPoints, total: heatPoints.length });
    } catch (err) {
        console.error('Commissioner heatmap error:', err);
        return res.status(500).json({ error: 'Failed to fetch heatmap data.' });
    }
});

/**
 * GET /api/commissioner/analytics
 * District-wide analytics: by-category, by-department, status distribution
 */
router.get('/analytics', async (req, res) => {
    const district = getDistrict(req);
    if (!district) {
        return res.status(400).json({ error: 'Commissioner has no assigned district.' });
    }

    try {
        const { data: issues, error } = await supabaseAdmin
            .from('issues')
            .select('status, department, category, reporter:users!issues_reported_by_id_fkey(district)')
            .neq('department', 'FIRE_STATION');

        if (error) throw error;

        const districtIssues = issues.filter(i => i.reporter?.district === district);

        // By category
        const catMap = {};
        districtIssues.forEach(i => {
            catMap[i.category] = (catMap[i.category] || 0) + 1;
        });

        // By department
        const deptMap = {};
        districtIssues.forEach(i => {
            if (!i.department) return;
            if (!deptMap[i.department]) deptMap[i.department] = { total: 0, resolved: 0, pending: 0, inProgress: 0 };
            deptMap[i.department].total++;
            if (i.status === 'COMPLETED') deptMap[i.department].resolved++;
            else if (i.status === 'IN_PROGRESS') deptMap[i.department].inProgress++;
            else deptMap[i.department].pending++;
        });

        const byCategory = Object.entries(catMap).map(([name, count]) => ({ name, count }));
        const byDepartment = Object.entries(deptMap).map(([key, s]) => ({
            key,
            label: DEPT_LABELS[key] || key,
            ...s,
            efficiencyRate: s.total > 0 ? Math.round((s.resolved / s.total) * 100) : 0,
        }));

        const total = districtIssues.length;
        const pending = districtIssues.filter(i => i.status === 'PENDING').length;
        const inProgress = districtIssues.filter(i => i.status === 'IN_PROGRESS').length;
        const completed = districtIssues.filter(i => i.status === 'COMPLETED').length;

        return res.json({
            total, pending, inProgress, completed,
            resolutionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
            byCategory,
            byDepartment,
        });
    } catch (err) {
        console.error('Commissioner analytics error:', err);
        return res.status(500).json({ error: 'Failed to fetch analytics.' });
    }
});

/**
 * GET /api/commissioner/monthly?months=6
 * Monthly trend data for the district
 */
router.get('/monthly', async (req, res) => {
    const district = getDistrict(req);
    if (!district) {
        return res.status(400).json({ error: 'Commissioner has no assigned district.' });
    }

    try {
        const monthsBack = parseInt(req.query.months || '6', 10);
        const now = new Date();
        const since = new Date(now.getFullYear(), now.getMonth() - (monthsBack - 1), 1);

        const { data: issues, error } = await supabaseAdmin
            .from('issues')
            .select('created_at, status, reporter:users!issues_reported_by_id_fkey(district)')
            .gte('created_at', since.toISOString())
            .neq('department', 'FIRE_STATION');

        if (error) throw error;

        const districtIssues = issues.filter(i => i.reporter?.district === district);

        const months = [];
        const totalCounts = [];
        const resolvedCounts = [];
        const pendingCounts = [];

        for (let i = monthsBack - 1; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            months.push(MONTH_NAMES[d.getMonth()] + ' ' + d.getFullYear().toString().slice(2));

            const monthData = districtIssues.filter(issue => {
                const id = new Date(issue.created_at);
                return id.getFullYear() === d.getFullYear() && id.getMonth() === d.getMonth();
            });

            totalCounts.push(monthData.length);
            resolvedCounts.push(monthData.filter(i => i.status === 'COMPLETED').length);
            pendingCounts.push(monthData.filter(i => i.status === 'PENDING').length);
        }

        return res.json({ months, totalCounts, resolvedCounts, pendingCounts });
    } catch (err) {
        console.error('Commissioner monthly error:', err);
        return res.status(500).json({ error: 'Failed to fetch monthly data.' });
    }
});

/**
 * GET /api/commissioner/constituencies
 * Constituency-level breakdown for the district
 */
router.get('/constituencies', async (req, res) => {
    const district = getDistrict(req);
    if (!district) {
        return res.status(400).json({ error: 'Commissioner has no assigned district.' });
    }

    try {
        const { data: issues, error } = await supabaseAdmin
            .from('issues')
            .select('status, reporter:users!issues_reported_by_id_fkey(district, constituency)')
            .neq('department', 'FIRE_STATION');

        if (error) throw error;

        const districtIssues = issues.filter(i => i.reporter?.district === district);

        const constMap = {};
        districtIssues.forEach(i => {
            const c = i.reporter?.constituency;
            if (!c) return;
            if (!constMap[c]) constMap[c] = { total: 0, resolved: 0, inProgress: 0, pending: 0 };
            constMap[c].total++;
            if (i.status === 'COMPLETED') constMap[c].resolved++;
            else if (i.status === 'IN_PROGRESS') constMap[c].inProgress++;
            else constMap[c].pending++;
        });

        const constituencies = Object.entries(constMap).map(([name, stats]) => ({
            name,
            total: stats.total,
            resolved: stats.resolved,
            inProgress: stats.inProgress,
            pending: stats.pending,
            resolutionRate: stats.total > 0 ? Math.round((stats.resolved / stats.total) * 100) : 0,
        })).sort((a, b) => b.total - a.total);

        return res.json({ constituencies, district });
    } catch (err) {
        console.error('Commissioner constituencies error:', err);
        return res.status(500).json({ error: 'Failed to fetch constituency data.' });
    }
});

module.exports = router;
