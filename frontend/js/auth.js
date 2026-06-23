/**
 * auth.js — Session management for CleanTamilnadu frontend
 */
import { authAPI } from './api.js';

/* ── Session Helpers ── */
export function saveSession(token, user) {
    localStorage.setItem('cm_token', token);
    localStorage.setItem('cm_user', JSON.stringify(user));
}

export function clearSession() {
    localStorage.removeItem('cm_token');
    localStorage.removeItem('cm_user');
}

export function getToken() {
    return localStorage.getItem('cm_token');
}

export function getUser() {
    const raw = localStorage.getItem('cm_user');
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
}

export function isLoggedIn() {
    return !!getToken() && !!getUser();
}

/* ── Role-based redirect paths ── */
export const ROLE_DASHBOARDS = {
    USER: 'citizen-dashboard.html',
    TAMILNADU_CORPORATION: 'department-dashboard.html',
    TNEB: 'department-dashboard.html',
    POLICE: 'department-dashboard.html',
    EMPLOYEE: 'employee-dashboard.html',
    COLLECTOR: 'collector-dashboard.html',
    ADMIN: 'admin-dashboard.html',
    MLA: 'mla-dashboard.html',
    CM: 'cm-dashboard.html',
    COMMISSIONER: 'commissioner-dashboard.html',
};

export const ROLE_LABELS = {
    USER: 'Citizen',
    TAMILNADU_CORPORATION: 'Tamilnadu Corporation',
    TNEB: 'TNEB (Electrical)',
    POLICE: 'Tamilnadu Police',
    EMPLOYEE: 'Department Employee',
    COLLECTOR: 'District Collector',
    ADMIN: 'System Administrator',
    MLA: 'Member of Legislative Assembly',
    CM: 'Chief Minister',
    COMMISSIONER: 'District Commissioner',
};

/* ── Get dashboard path for a role ── */
export function getDashboardForRole(role) {
    return ROLE_DASHBOARDS[role] || 'citizen-dashboard.html';
}

/* ── Login ── */
export async function login(email, password) {
    const data = await authAPI.login(email, password);
    saveSession(data.token, data.user);
    return data;
}

/* ── Register ── */
export async function register(payload) {
    const data = await authAPI.register(payload);
    if (data.token) saveSession(data.token, data.user);
    return data;
}

/* ── Logout ── */
export async function logout() {
    try { await authAPI.logout(); } catch (_) { }
    clearSession();
    sessionStorage.clear();
    window.location.href = 'login.html';
}
