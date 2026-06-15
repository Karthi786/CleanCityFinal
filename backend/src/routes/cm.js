const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const { verifyToken, requireApproved, requireRole } = require('../middleware/auth');

const router = express.Router();

// All CM routes require authentication, approval, and CM role
router.use(verifyToken, requireApproved, requireRole('CM'));

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const DEPT_LABELS = {
    TAMILNADU_CORPORATION: 'Tamilnadu Corporation',
    TNEB: 'TNEB (Electrical)',
    POLICE: 'Police',
};

/**
 * GET /api/cm/overview
 * State-wide summary: total districts, constituencies, issues, solved, pending, rate
 */
router.get('/overview', async (req, res) => {
    try {
        // Fetch all issues with reporter district/constituency
        const { data: issues, error } = await supabaseAdmin
            .from('issues')
            .select('status, reporter:users!issues_reported_by_id_fkey(district, constituency)')
            .neq('department', 'FIRE_STATION');

        if (error) throw error;

        const total = issues.length;
        const solved = issues.filter(i => i.status === 'COMPLETED').length;
        const inProgress = issues.filter(i => i.status === 'IN_PROGRESS').length;
        const pending = issues.filter(i => i.status === 'PENDING').length;
        const resolutionRate = total > 0 ? Math.round((solved / total) * 100) : 0;

        // Count unique districts and constituencies from issue reporters
        const districts = new Set();
        const constituencies = new Set();
        issues.forEach(i => {
            if (i.reporter) {
                if (i.reporter.district) districts.add(i.reporter.district);
                if (i.reporter.constituency) constituencies.add(i.reporter.constituency);
            }
        });

        return res.json({
            totalDistricts: districts.size,
            totalConstituencies: constituencies.size,
            totalIssues: total,
            solved,
            inProgress,
            pending,
            resolutionRate,
        });
    } catch (err) {
        console.error('CM overview error:', err);
        return res.status(500).json({ error: 'Failed to fetch overview.' });
    }
});

/**
 * GET /api/cm/districts
 * Per-district performance summary
 */
router.get('/districts', async (req, res) => {
    try {
        const { data: issues, error } = await supabaseAdmin
            .from('issues')
            .select('status, department, reporter:users!issues_reported_by_id_fkey(district, constituency)')
            .neq('department', 'FIRE_STATION');

        if (error) throw error;

        // Group by district
        const districtMap = {};
        issues.forEach(i => {
            const district = i.reporter?.district;
            if (!district) return;
            if (!districtMap[district]) {
                districtMap[district] = { total: 0, solved: 0, inProgress: 0, pending: 0, constituencies: new Set(), departments: new Set() };
            }
            districtMap[district].total++;
            if (i.status === 'COMPLETED') districtMap[district].solved++;
            else if (i.status === 'IN_PROGRESS') districtMap[district].inProgress++;
            else districtMap[district].pending++;
            if (i.reporter?.constituency) districtMap[district].constituencies.add(i.reporter.constituency);
            if (i.department) districtMap[district].departments.add(i.department);
        });

        const districts = Object.entries(districtMap).map(([name, stats]) => ({
            name,
            total: stats.total,
            solved: stats.solved,
            inProgress: stats.inProgress,
            pending: stats.pending,
            resolutionRate: stats.total > 0 ? Math.round((stats.solved / stats.total) * 100) : 0,
            constituencyCount: stats.constituencies.size,
            activeDepartments: stats.departments.size,
        })).sort((a, b) => b.total - a.total);

        return res.json({ districts });
    } catch (err) {
        console.error('CM districts error:', err);
        return res.status(500).json({ error: 'Failed to fetch district data.' });
    }
});

/**
 * GET /api/cm/districts/:districtName
 * Detailed district report with constituency breakdown
 */
router.get('/districts/:districtName', async (req, res) => {
    try {
        const districtName = decodeURIComponent(req.params.districtName);

        const { data: issues, error } = await supabaseAdmin
            .from('issues')
            .select('status, department, created_at, reporter:users!issues_reported_by_id_fkey(district, constituency)')
            .neq('department', 'FIRE_STATION');

        if (error) throw error;

        // Filter to this district only
        const districtIssues = issues.filter(i => i.reporter?.district === districtName);

        const total = districtIssues.length;
        const solved = districtIssues.filter(i => i.status === 'COMPLETED').length;
        const inProgress = districtIssues.filter(i => i.status === 'IN_PROGRESS').length;
        const pending = districtIssues.filter(i => i.status === 'PENDING').length;
        const resolutionRate = total > 0 ? Math.round((solved / total) * 100) : 0;

        // Constituency breakdown
        const constMap = {};
        districtIssues.forEach(i => {
            const c = i.reporter?.constituency;
            if (!c) return;
            if (!constMap[c]) constMap[c] = { total: 0, solved: 0, pending: 0, inProgress: 0 };
            constMap[c].total++;
            if (i.status === 'COMPLETED') constMap[c].solved++;
            else if (i.status === 'IN_PROGRESS') constMap[c].inProgress++;
            else constMap[c].pending++;
        });

        const constituencies = Object.entries(constMap).map(([name, stats]) => ({
            name,
            total: stats.total,
            solved: stats.solved,
            inProgress: stats.inProgress,
            pending: stats.pending,
            resolutionRate: stats.total > 0 ? Math.round((stats.solved / stats.total) * 100) : 0,
        })).sort((a, b) => b.total - a.total);

        // Department breakdown for this district
        const deptMap = {};
        districtIssues.forEach(i => {
            const d = i.department;
            if (!d) return;
            if (!deptMap[d]) deptMap[d] = { total: 0, solved: 0, inProgress: 0, pending: 0 };
            deptMap[d].total++;
            if (i.status === 'COMPLETED') deptMap[d].solved++;
            else if (i.status === 'IN_PROGRESS') deptMap[d].inProgress++;
            else deptMap[d].pending++;
        });

        const departments = Object.entries(deptMap).map(([key, stats]) => ({
            key,
            label: DEPT_LABELS[key] || key,
            total: stats.total,
            solved: stats.solved,
            inProgress: stats.inProgress,
            pending: stats.pending,
            efficiencyRate: stats.total > 0 ? Math.round((stats.solved / stats.total) * 100) : 0,
        }));

        return res.json({
            district: districtName,
            total,
            solved,
            inProgress,
            pending,
            resolutionRate,
            constituencyCount: constituencies.length,
            constituencies,
            departments,
        });
    } catch (err) {
        console.error('CM district detail error:', err);
        return res.status(500).json({ error: 'Failed to fetch district details.' });
    }
});

/**
 * GET /api/cm/departments
 * State-wide department performance
 */
router.get('/departments', async (req, res) => {
    try {
        const { data: issues, error } = await supabaseAdmin
            .from('issues')
            .select('status, department, created_at, updated_at')
            .neq('department', 'FIRE_STATION');

        if (error) throw error;

        const deptMap = {};
        issues.forEach(i => {
            const d = i.department;
            if (!d) return;
            if (!deptMap[d]) deptMap[d] = { total: 0, solved: 0, inProgress: 0, pending: 0 };
            deptMap[d].total++;
            if (i.status === 'COMPLETED') deptMap[d].solved++;
            else if (i.status === 'IN_PROGRESS') deptMap[d].inProgress++;
            else deptMap[d].pending++;
        });

        const departments = Object.entries(deptMap).map(([key, stats]) => ({
            key,
            label: DEPT_LABELS[key] || key,
            total: stats.total,
            solved: stats.solved,
            inProgress: stats.inProgress,
            pending: stats.pending,
            efficiencyRate: stats.total > 0 ? Math.round((stats.solved / stats.total) * 100) : 0,
        })).sort((a, b) => b.total - a.total);

        return res.json({ departments });
    } catch (err) {
        console.error('CM departments error:', err);
        return res.status(500).json({ error: 'Failed to fetch department data.' });
    }
});

/**
 * GET /api/cm/monthly?months=12
 * Monthly trend: reports received vs solved
 */
router.get('/monthly', async (req, res) => {
    try {
        const monthsBack = parseInt(req.query.months || '12', 10);
        const now = new Date();
        const since = new Date(now.getFullYear(), now.getMonth() - (monthsBack - 1), 1);

        const { data: issues, error } = await supabaseAdmin
            .from('issues')
            .select('created_at, status')
            .gte('created_at', since.toISOString())
            .neq('department', 'FIRE_STATION');

        if (error) throw error;

        const months = [];
        const totalCounts = [];
        const resolvedCounts = [];
        const pendingCounts = [];

        for (let i = monthsBack - 1; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            months.push(MONTH_NAMES[d.getMonth()] + ' ' + d.getFullYear().toString().slice(2));

            const monthData = issues.filter(issue => {
                const issueDate = new Date(issue.created_at);
                return issueDate.getFullYear() === d.getFullYear() && issueDate.getMonth() === d.getMonth();
            });

            totalCounts.push(monthData.length);
            resolvedCounts.push(monthData.filter(i => i.status === 'COMPLETED').length);
            pendingCounts.push(monthData.filter(i => i.status === 'PENDING').length);
        }

        return res.json({ months, totalCounts, resolvedCounts, pendingCounts });
    } catch (err) {
        console.error('CM monthly error:', err);
        return res.status(500).json({ error: 'Failed to fetch monthly trend data.' });
    }
});

module.exports = router;
