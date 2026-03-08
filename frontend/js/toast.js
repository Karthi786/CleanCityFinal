/**
 * toast.js — Toast notification system for CleanMadurai
 */

let container = null;

function getContainer() {
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    return container;
}

const ICONS = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };

/**
 * Show a toast notification
 * @param {string} title
 * @param {string} [description]
 * @param {'success'|'error'|'warning'|'info'} [type]
 * @param {number} [duration=4000]
 */
export function showToast(title, description = '', type = 'success', duration = 4000) {
    const c = getContainer();
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
    <span class="toast-icon">${ICONS[type] || ICONS.info}</span>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      ${description ? `<div class="toast-desc">${description}</div>` : ''}
    </div>
    <button class="toast-close" onclick="this.closest('.toast').remove()">✕</button>
  `;
    c.appendChild(toast);

    // Auto dismiss
    setTimeout(() => {
        toast.style.animation = 'none';
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(24px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

export const toast = {
    success: (title, desc) => showToast(title, desc, 'success'),
    error: (title, desc) => showToast(title, desc, 'error'),
    warning: (title, desc) => showToast(title, desc, 'warning'),
    info: (title, desc) => showToast(title, desc, 'info'),
};
