import { analyticsAPI } from './api.js';
import { toast } from './toast.js';

let rawData = null;
let filteredEmployees = [];
let filteredIssues = [];
let charts = {};
let map = null;
let mapMarkers = null;

export async function initDepartmentAnalytics(userDept) {
    try {
        const data = await analyticsAPI.departmentComprehensive({ department: userDept });
        rawData = data;
        
        setupFilters();
        applyFilters(); // This will trigger rendering
        
        populateEmployeeSelect();
        
    } catch (err) {
        console.error('Failed to load comprehensive analytics:', err);
        toast.error('Error', 'Failed to load analytics data.');
    }
}

function setupFilters() {
    ['filter-date', 'filter-employee', 'filter-category', 'filter-priority', 'filter-status', 'filter-location'].forEach(id => {
        document.getElementById(id).addEventListener('change', applyFilters);
    });
    document.getElementById('filter-location').addEventListener('keyup', applyFilters);
}

function applyFilters() {
    if (!rawData) return;
    
    const dateRange = document.getElementById('filter-date').value;
    const empId = document.getElementById('filter-employee').value;
    const category = document.getElementById('filter-category').value;
    const priority = document.getElementById('filter-priority').value;
    const status = document.getElementById('filter-status').value;
    const loc = document.getElementById('filter-location').value.toLowerCase();

    filteredIssues = rawData.issues.filter(issue => {
        if (dateRange) {
            const issueDate = new Date(issue.created_at).toISOString().split('T')[0];
            if (issueDate !== dateRange) return false;
        }
        if (empId && issue.assigned_employee_id !== empId) return false;
        if (category && issue.category !== category) return false;
        if (priority && issue.priority !== priority) return false;
        if (status && issue.status !== status) return false;
        if (loc && (!issue.location_name || !issue.location_name.toLowerCase().includes(loc))) return false;
        return true;
    });

    // We don't filter employees themselves except to recalculate their stats based on filtered issues if needed,
    // but the prompt implies filtering the dashboard overall. We'll show total analytics based on filteredIssues.
    
    renderTotalAnalytics();
    renderMap();
    renderLeaderboard();
}

function populateEmployeeSelect() {
    const filterSel = document.getElementById('filter-employee');
    const opts = rawData.employees.map(emp => `<option value="${emp.id}">${emp.name}</option>`).join('');
    filterSel.innerHTML = '<option value="">All Employees</option>' + opts;
}

function renderTotalAnalytics() {
    // KPI Cards
    const totalAssigned = filteredIssues.length;
    const completed = filteredIssues.filter(i => i.status === 'COMPLETED').length;
    const pending = filteredIssues.filter(i => i.status === 'PENDING').length;
    const inProgress = filteredIssues.filter(i => i.status === 'IN_PROGRESS').length;
    
    let totalHrs = 0;
    let compWithTime = 0;
    filteredIssues.forEach(i => {
        if (i.status === 'COMPLETED' && i.completion_duration_hrs !== null) {
            totalHrs += i.completion_duration_hrs;
            compWithTime++;
        }
    });
    
    const avgTime = compWithTime > 0 ? (totalHrs / compWithTime).toFixed(1) : 0;
    const efficiency = totalAssigned > 0 ? Math.round((completed / totalAssigned) * 100) : 0;

    document.getElementById('kpi-tot-emp').textContent = rawData.employees.length;
    document.getElementById('kpi-tot-iss').textContent = totalAssigned;
    document.getElementById('kpi-comp-iss').textContent = completed;
    document.getElementById('kpi-pend-iss').textContent = pending;
    document.getElementById('kpi-prog-iss').textContent = inProgress;
    document.getElementById('kpi-avg-time').textContent = avgTime > 0 ? `${avgTime}h` : '-';
    document.getElementById('kpi-efficiency').textContent = `${efficiency}%`;

    renderTotalCharts();
}

function renderTotalCharts() {
    // 1. Employee Performance Comparison (Bar)
    const empData = rawData.employees.map(e => {
        const empIss = filteredIssues.filter(i => i.assigned_employee_id === e.id);
        return {
            name: e.name,
            completed: empIss.filter(i => i.status === 'COMPLETED').length
        };
    }).sort((a,b) => b.completed - a.completed).slice(0, 10);

    if (charts.empPerf) charts.empPerf.destroy();
    charts.empPerf = new ApexCharts(document.getElementById('chart-emp-perf'), {
        series: [{ name: 'Completed Issues', data: empData.map(d => d.completed) }],
        chart: { type: 'bar', height: 300, toolbar: { show: false } },
        xaxis: { categories: empData.map(d => d.name) },
        colors: ['#3b82f6']
    });
    charts.empPerf.render();

    // 2. Issue Status Distribution (Pie)
    const statCounts = {
        'COMPLETED': filteredIssues.filter(i => i.status === 'COMPLETED').length,
        'IN_PROGRESS': filteredIssues.filter(i => i.status === 'IN_PROGRESS').length,
        'PENDING': filteredIssues.filter(i => i.status === 'PENDING').length
    };
    if (charts.issueStatus) charts.issueStatus.destroy();
    charts.issueStatus = new ApexCharts(document.getElementById('chart-issue-status'), {
        series: [statCounts.COMPLETED, statCounts.IN_PROGRESS, statCounts.PENDING],
        chart: { type: 'donut', height: 300 },
        labels: ['Completed', 'In Progress', 'Pending'],
        colors: ['#10b981', '#8b5cf6', '#f59e0b']
    });
    charts.issueStatus.render();

    // 3. Time Performance (Line) - simplified by month for demo
    const monthCounts = {};
    filteredIssues.forEach(i => {
        if(i.status === 'COMPLETED' && i.completed_at) {
            const m = new Date(i.completed_at).toLocaleString('default', { month: 'short' });
            monthCounts[m] = (monthCounts[m] || 0) + 1;
        }
    });
    
    if (charts.timePerf) charts.timePerf.destroy();
    charts.timePerf = new ApexCharts(document.getElementById('chart-time-perf'), {
        series: [{ name: 'Resolved', data: Object.values(monthCounts) }],
        chart: { type: 'area', height: 250, toolbar: { show: false } },
        xaxis: { categories: Object.keys(monthCounts) },
        colors: ['#14b8a6'],
        stroke: { curve: 'smooth' }
    });
    charts.timePerf.render();

    // 4. Category Analytics (Bar)
    const catCounts = {};
    filteredIssues.forEach(i => {
        catCounts[i.category] = (catCounts[i.category] || 0) + 1;
    });
    if (charts.category) charts.category.destroy();
    charts.category = new ApexCharts(document.getElementById('chart-category'), {
        series: [{ name: 'Issues', data: Object.values(catCounts) }],
        chart: { type: 'bar', height: 300, toolbar: { show: false } },
        xaxis: { categories: Object.keys(catCounts) },
        colors: ['#6366f1']
    });
    charts.category.render();

    // 5. Priority Handling (Bar)
    const priCounts = { High: 0, Medium: 0, Low: 0 };
    filteredIssues.forEach(i => {
        if(i.status === 'COMPLETED' && priCounts[i.priority] !== undefined) {
            priCounts[i.priority]++;
        }
    });
    if (charts.priority) charts.priority.destroy();
    charts.priority = new ApexCharts(document.getElementById('chart-priority'), {
        series: [{ name: 'Resolved', data: [priCounts.High, priCounts.Medium, priCounts.Low] }],
        chart: { type: 'bar', height: 300, toolbar: { show: false } },
        xaxis: { categories: ['High', 'Medium', 'Low'] },
        colors: ['#ef4444', '#f59e0b', '#3b82f6'],
        plotOptions: { bar: { distributed: true } }
    });
    charts.priority.render();
}

function renderMap() {
    if (!map) {
        map = L.map('analytics-map').setView([11.1271, 78.6569], 7);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
        mapMarkers = L.markerClusterGroup();
        map.addLayer(mapMarkers);
    }
    
    mapMarkers.clearLayers();
    
    filteredIssues.forEach(issue => {
        if (!issue.latitude || !issue.longitude) return;
        
        let color = '#f59e0b'; // pending
        if (issue.status === 'COMPLETED') color = '#16a34a';
        else if (issue.priority === 'High' && issue.status !== 'COMPLETED') color = '#dc2626';
        
        const markerHtml = `<div style="background:${color};width:20px;height:20px;border-radius:50%;border:2px solid white;box-shadow:0 2px 5px rgba(0,0,0,0.3);"></div>`;
        const icon = L.divIcon({ html: markerHtml, className: '', iconSize: [20,20] });
        
        const marker = L.marker([issue.latitude, issue.longitude], { icon });
        marker.bindPopup(`<b>${issue.title}</b><br>${issue.description}<br>Status: ${issue.status}<br>Priority: ${issue.priority}`);
        mapMarkers.addLayer(marker);
    });
}

function renderLeaderboard() {
    const tbody = document.getElementById('leaderboard-tbody');
    if (!rawData || !rawData.employees) return;
    
    const html = rawData.employees.map((emp, idx) => {
        let rankIcon = `#${idx + 1}`;
        if (idx === 0) rankIcon = '🥇 1st';
        else if (idx === 1) rankIcon = '🥈 2nd';
        else if (idx === 2) rankIcon = '🥉 3rd';
        
        let gradeColor = '#10b981';
        if (emp.stats.grade === 'O') gradeColor = '#3b82f6';
        else if (emp.stats.grade === 'D') gradeColor = '#ef4444';

        return `
        <tr style="border-bottom:1px solid var(--border);">
            <td style="padding:16px 20px; font-weight:800;">${rankIcon}</td>
            <td style="padding:16px 20px; display:flex; align-items:center; gap:12px;">
                <img src="${emp.profile_image_url || `https://ui-avatars.com/api/?name=${emp.name}`}" style="width:36px; height:36px; border-radius:50%; object-fit:cover;">
                <span style="font-weight:600;">${emp.name}</span>
            </td>
            <td style="padding:16px 20px;">${emp.stats.completed}</td>
            <td style="padding:16px 20px;">${emp.stats.total}</td>
            <td style="padding:16px 20px; font-weight:800; color:var(--primary);">${emp.stats.score}</td>
            <td style="padding:16px 20px;">
                <span style="background:${gradeColor}22; color:${gradeColor}; padding:4px 12px; border-radius:99px; font-weight:800;">${emp.stats.grade}</span>
            </td>
        </tr>`;
    }).join('');
    
    tbody.innerHTML = html || '<tr><td colspan="6" style="text-align:center; padding:20px;">No employees found.</td></tr>';
}

