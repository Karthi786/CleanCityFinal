/**
 * api.js — Centralized API client for CleanMadurai
 * All fetch calls go through this module to handle auth headers + errors.
 */

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5001/api'
    : 'https://cleancityfinal.onrender.com/api';

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

    const text = await res.text();
    let data;
    try {
        data = text ? JSON.parse(text) : {};
    } catch (e) {
        console.error("Failed to parse JSON. Raw response from server was:", text);
        throw new Error("Server returned an invalid JSON response. Please check the console or ensure the backend is running properly.");
    }

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
    me: () => apiFetch('/users/me'),

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

/* ── Analytics Endpoints ── */
export const analyticsAPI = {
    stats: (params = {}) => {
        const q = new URLSearchParams(params).toString();
        return apiFetch(`/analytics/stats${q ? '?' + q : ''}`);
    },
    byCategory: (params = {}) => {
        const q = new URLSearchParams(params).toString();
        return apiFetch(`/analytics/by-category${q ? '?' + q : ''}`);
    },
    byDepartment: () => apiFetch('/analytics/by-department'),
    monthly: (params = {}) => {
        const q = new URLSearchParams(params).toString();
        return apiFetch(`/analytics/monthly${q ? '?' + q : ''}`);
    },
    statusDistribution: (params = {}) => {
        const q = new URLSearchParams(params).toString();
        return apiFetch(`/analytics/status-distribution${q ? '?' + q : ''}`);
    },
};

/* ── Campaigns Endpoints ── */
export const campaignsAPI = {
    getAll: (params = {}) => {
        const q = new URLSearchParams(params).toString();
        return apiFetch(`/campaigns${q ? '?' + q : ''}`);
    },

    create: (payload) => apiFetch('/campaigns', {
        method: 'POST',
        body: JSON.stringify(payload),
    }),


    register: (id, payload = {}) => apiFetch(`/campaigns/${id}/register`, {
        method: 'POST',
        body: Object.keys(payload).length > 0 ? JSON.stringify(payload) : undefined
    }),

    myRegistrations: () => apiFetch('/campaigns/my-registrations'),

    delete: (id) => apiFetch(`/campaigns/${id}`, { method: 'DELETE' }),

    getVolunteers: (id) => apiFetch(`/campaigns/${id}/volunteers`),

    confirmVolunteer: (campaignId, volunteerId) => apiFetch(`/campaigns/${campaignId}/volunteers/${volunteerId}/confirm`, { method: 'POST' }),

    completeCampaign: (id) => apiFetch(`/campaigns/${id}/complete`, { method: 'POST' }),

    getPending: () => apiFetch('/campaigns/pending'),

    verify: (id, status) => apiFetch(`/campaigns/${id}/verify`, {
        method: 'PUT',
        body: JSON.stringify({ status })
    }),
};

/* ── Leaderboard Endpoints ── */
export const leaderboardAPI = {
    getTop100: () => apiFetch('/leaderboard')
};
