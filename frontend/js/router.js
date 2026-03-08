/**
 * router.js — Client-side route guard for CleanMadurai
 * Call guardPage() at the top of every protected page.
 */
import { isLoggedIn, getUser, ROLE_DASHBOARDS } from './auth.js';

/**
 * Guard a dashboard page — redirects to login if not authenticated.
 * @param {string[]} allowedRoles — if empty, any authenticated user is allowed
 * @returns {object|null} current user profile or null (will have already redirected)
 */
export function guardPage(allowedRoles = []) {
    if (!isLoggedIn()) {
        window.location.href = 'login.html';
        return null;
    }

    const user = getUser();

    // Check account status
    if (user.verification_status === 'pending_verification') {
        window.location.href = 'pending.html';
        return null;
    }
    if (user.verification_status === 'rejected') {
        window.location.href = 'login.html';
        return null;
    }

    // Role check
    if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
        const correctDash = ROLE_DASHBOARDS[user.role] || 'index.html';
        window.location.href = correctDash;
        return null;
    }

    return user;
}

/**
 * Redirect logged-in users away from auth pages (login/register)
 */
export function redirectIfLoggedIn() {
    if (isLoggedIn()) {
        const user = getUser();
        if (user) {
            window.location.href = ROLE_DASHBOARDS[user.role] || '/citizen-dashboard.html';
        }
    }
}

/**
 * Redirect pending/unapproved users to pending page
 */
export function guardApproved() {
    const user = getUser();
    if (user && user.verification_status !== 'approved') {
        window.location.href = 'pending.html';
        return null;
    }
    return user;
}
