const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const { verifyToken, requireApproved } = require('../middleware/auth');

const router = express.Router();

const DEPARTMENTS = ['TAMILNADU_CORPORATION', 'TNEB', 'POLICE'];
const DEPT_LABELS = {
    TAMILNADU_CORPORATION: 'Tamilnadu Corp.',
    TNEB: 'TNEB',
    POLICE: 'Police',
};
const CATEGORIES = ['Waste', 'Water', 'Roads', 'Electricity', 'Law & Order'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * GET /api/analytics/stats?department=X
 * Summary stats: total, pending, in_progress, completed, resolution_rate
 */
router.get('/stats', verifyToken, requireApproved, async (req, res) => {
    try {
        let query = supabaseAdmin.from('issues').select('status, department, reporter:users!issues_reported_by_id_fkey(district, constituency)').neq('department', 'FIRE_STATION');
        if (req.query.department) {
            query = query.eq('department', req.query.department);
        }
        let { data, error } = await query;
        if (error) throw error;

        // Auto-filter for COLLECTOR and MLA
        if (req.user.role === 'COLLECTOR' && req.user.district) {
            data = data.filter(i => i.reporter && i.reporter.district === req.user.district);
        } else if (req.user.role === 'MLA' && req.user.constituency) {
            data = data.filter(i => i.reporter && i.reporter.constituency === req.user.constituency);
        }

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
        let query = supabaseAdmin.from('issues').select('category, department, reporter:users!issues_reported_by_id_fkey(district, constituency)').neq('department', 'FIRE_STATION');
        if (req.query.department) {
            query = query.eq('department', req.query.department);
        }
        let { data, error } = await query;
        if (error) throw error;

        // Auto-filter for COLLECTOR and MLA
        if (req.user.role === 'COLLECTOR' && req.user.district) {
            data = data.filter(i => i.reporter && i.reporter.district === req.user.district);
        } else if (req.user.role === 'MLA' && req.user.constituency) {
            data = data.filter(i => i.reporter && i.reporter.constituency === req.user.constituency);
        }

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
        let { data, error } = await supabaseAdmin
            .from('issues')
            .select('department, status, reporter:users!issues_reported_by_id_fkey(district, constituency)')
            .neq('department', 'FIRE_STATION');
        if (error) throw error;

        // Auto-filter for COLLECTOR and MLA
        if (req.user.role === 'COLLECTOR' && req.user.district) {
            data = data.filter(i => i.reporter && i.reporter.district === req.user.district);
        } else if (req.user.role === 'MLA' && req.user.constituency) {
            data = data.filter(i => i.reporter && i.reporter.constituency === req.user.constituency);
        }

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
            .select('created_at, status, department, reporter:users!issues_reported_by_id_fkey(district, constituency)')
            .gte('created_at', since.toISOString())
            .neq('department', 'FIRE_STATION');

        if (req.query.department) {
            query = query.eq('department', req.query.department);
        }

        let { data, error } = await query;
        if (error) throw error;

        // Auto-filter for COLLECTOR and MLA
        if (req.user.role === 'COLLECTOR' && req.user.district) {
            data = data.filter(i => i.reporter && i.reporter.district === req.user.district);
        } else if (req.user.role === 'MLA' && req.user.constituency) {
            data = data.filter(i => i.reporter && i.reporter.constituency === req.user.constituency);
        }

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
        let query = supabaseAdmin.from('issues').select('status, department, reporter:users!issues_reported_by_id_fkey(district, constituency)').neq('department', 'FIRE_STATION');
        if (req.query.department) {
            query = query.eq('department', req.query.department);
        }
        let { data, error } = await query;
        if (error) throw error;

        // Auto-filter for COLLECTOR and MLA
        if (req.user.role === 'COLLECTOR' && req.user.district) {
            data = data.filter(i => i.reporter && i.reporter.district === req.user.district);
        } else if (req.user.role === 'MLA' && req.user.constituency) {
            data = data.filter(i => i.reporter && i.reporter.constituency === req.user.constituency);
        }

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

/**
 * GET /api/analytics/department-comprehensive
 * Comprehensive analytics for the department dashboard including Employee Leaderboard logic
 */
router.get('/department-comprehensive', verifyToken, requireApproved, async (req, res) => {
    try {
        const isAdmin = req.user.role === 'ADMIN';
        const dept = isAdmin ? (req.query.department || null) : req.user.department;

        if (!dept && !isAdmin) {
            return res.status(403).json({ error: 'Department context required.' });
        }

        // 1. Fetch Employees
        let empQuery = supabaseAdmin
            .from('users')
            .select('id, name, department, role, profile_image_url')
            .eq('role', 'EMPLOYEE');
            
        if (dept) empQuery = empQuery.eq('department', dept);

        const { data: employees, error: empErr } = await empQuery;
        if (empErr) throw empErr;

        const empIds = (employees || []).map(e => e.id);

        // 2. Fetch Issues
        let issuesQuery = supabaseAdmin
            .from('issues')
            .select('id, title, description, category, priority_score, status, assigned_employee_id, created_at, assigned_date, updated_at, latitude, longitude')
            .in('assigned_employee_id', empIds);

        const { data: issuesData, error: issErr } = await issuesQuery;
        if (issErr) throw issErr;

        const issues = issuesData || [];

        // 3. Process Issues to requested format and map fields
        const processedIssues = issues.map(iss => {
            const assigned_at = iss.assigned_date || iss.created_at; 
            const completed_at = iss.status === 'COMPLETED' ? iss.updated_at : null;
            
            // Derive priority
            let priority = 'Low';
            if (iss.priority_score >= 70) priority = 'High';
            else if (iss.priority_score >= 40) priority = 'Medium';

            let completionDurationHrs = null;
            if (completed_at && assigned_at) {
                completionDurationHrs = (new Date(completed_at) - new Date(assigned_at)) / (1000 * 60 * 60);
            }

            return {
                id: iss.id,
                title: iss.title,
                description: iss.description,
                category: iss.category,
                priority,
                status: iss.status,
                assigned_employee_id: iss.assigned_employee_id,
                created_at: iss.created_at,
                assigned_at,
                completed_at,
                completion_duration_hrs: completionDurationHrs,
                latitude: iss.latitude,
                longitude: iss.longitude
            };
        });

        // 4. Calculate Employee Stats and Leaderboard Score
        const employeeStats = employees.map(emp => {
            const empIssues = processedIssues.filter(i => i.assigned_employee_id === emp.id);
            const total = empIssues.length;
            const completed = empIssues.filter(i => i.status === 'COMPLETED').length;
            const pending = empIssues.filter(i => i.status === 'PENDING').length;
            const inProgress = empIssues.filter(i => i.status === 'IN_PROGRESS').length;
            
            let totalCompletionHrs = 0;
            let completedWithDuration = 0;
            
            let onTimeCompleted = 0;

            empIssues.forEach(i => {
                if (i.status === 'COMPLETED') {
                    if (i.completion_duration_hrs !== null) {
                        totalCompletionHrs += i.completion_duration_hrs;
                        completedWithDuration++;
                        
                        // Deadline logic: SLA = 48 hours
                        if (i.completion_duration_hrs <= 48) {
                            onTimeCompleted++;
                        }
                    }
                }
            });
            
            let score = 0;
            if (total > 0) {
                const completionScore = (completed / total) * 60;
                const onTimeScore = completed > 0 ? (onTimeCompleted / completed) * 40 : 0;
                score = Math.round(completionScore + onTimeScore);
            }

            const avgCompletionTime = completedWithDuration > 0 ? (totalCompletionHrs / completedWithDuration).toFixed(1) : null;
            const successRate = total > 0 ? Math.round((completed / total) * 100) : 0;

            // Grade based on score
            let grade = 'D';
            if (score >= 90) grade = 'O';
            else if (score >= 80) grade = 'A';
            else if (score >= 70) grade = 'B';
            else if (score >= 60) grade = 'C';

            return {
                ...emp,
                stats: {
                    total,
                    completed,
                    pending,
                    inProgress,
                    avgCompletionTime,
                    successRate,
                    score,
                    grade
                }
            };
        });

        // Sort employees by score descending for leaderboard
        employeeStats.sort((a, b) => b.stats.score - a.stats.score);

        return res.json({
            employees: employeeStats,
            issues: processedIssues
        });

    } catch (err) {
        console.error('Analytics department-comprehensive error:', err);
        return res.status(500).json({ error: 'Failed to fetch comprehensive analytics.' });
    }
});

module.exports = router;
