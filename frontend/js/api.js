/**
 * api.js — Centralized API client for CleanMadurai
 * All fetch calls go through this module to handle auth headers + errors.
 */

const API_BASE = window.location.hostname === 'localhost' && window.location.port !== '3000'
    ? 'http://localhost:3000/api'
    : '/api';

/**
 * Core fetch wrapper — attaches JWT, handles 401 redirect
 */
async function apiFetch(path, options = {}) {
    const token = localStorage.getItem('cm_token');
    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
    });

    // If unauthorized, clear session and redirect to login
    if (res.status === 401) {
        localStorage.removeItem('cm_token');
        localStorage.removeItem('cm_user');
        window.location.href = '/login.html';
        return;
    }

    const data = await res.json();

    if (!res.ok) {
        const error = new Error(data.error || `Request failed: ${res.status}`);
        error.status = res.status;
        error.data = data;
        throw error;
    }

    return data;
}

/* ── Auth Endpoints ── */
export const authAPI = {
    login: (email, password) => apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
    }),

    register: (payload) => apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
    }),

    logout: () => apiFetch('/auth/logout', { method: 'POST' }),

    me: () => apiFetch('/auth/me'),
};

/* ── Issues Endpoints ── */
export const issuesAPI = {
    getAll: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return apiFetch(`/issues${query ? '?' + query : ''}`);
    },

    create: (payload) => apiFetch('/issues', {
        method: 'POST',
        body: JSON.stringify(payload),
    }),

    updateStatus: (id, status, completionImageUrl) => apiFetch(`/issues/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status, completionImageUrl }),
    }),

    support: (id) => apiFetch(`/issues/${id}/support`, { method: 'POST' }),

    mySupports: () => apiFetch('/issues/my-supports'),

    delete: (id) => apiFetch(`/issues/${id}`, { method: 'DELETE' }),
};

/* ── Users Endpoints ── */
export const usersAPI = {
    getPending: () => apiFetch('/users/pending'),

    getAll: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return apiFetch(`/users${query ? '?' + query : ''}`);
    },

    verify: (id, status) => apiFetch(`/users/${id}/verify`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
    }),

    getStats: () => apiFetch('/users/stats'),
};

/* ── Reviews Endpoints ── */
export const reviewsAPI = {
    getByIssue: (issueId) => apiFetch(`/reviews/${issueId}`),
    get: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return apiFetch(`/reviews${query ? '?' + query : ''}`);
    },
    create: (payload) => apiFetch('/reviews', {
        method: 'POST',
        body: JSON.stringify(payload),
    }),
};
