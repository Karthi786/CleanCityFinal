export function closeDashboardDrawer() {
    const overlay = document.getElementById('mobile-nav-overlay');
    if (!overlay) return;
    overlay.classList.remove('open');
    document.body.classList.remove('drawer-open');
}

export function syncDrawerActive(activeId) {
    document.querySelectorAll('.mobile-drawer-link').forEach(link => {
        link.classList.toggle('active', link.id === activeId);
    });
}

export function initDashboardDrawer({ linkMap = {}, onLogout } = {}) {
    const openBtn = document.getElementById('mobile-menu-btn');
    const overlay = document.getElementById('mobile-nav-overlay');
    const closeBtn = document.getElementById('mobile-nav-close');
    const logoutBtn = document.getElementById('drawer-logout-btn');
    if (!openBtn || !overlay || !closeBtn) return;

    const openDrawer = () => {
        overlay.classList.add('open');
        document.body.classList.add('drawer-open');
    };
    const closeDrawer = () => closeDashboardDrawer();

    openBtn.setAttribute('aria-expanded', 'false');
    openBtn.setAttribute('aria-controls', overlay.id);
    closeBtn.setAttribute('aria-label', 'Close menu');

    openBtn.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        openDrawer();
        openBtn.setAttribute('aria-expanded', 'true');
    });

    closeBtn.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        closeDrawer();
        openBtn.setAttribute('aria-expanded', 'false');
    });

    overlay.addEventListener('click', e => {
        if (e.target === overlay) {
            closeDrawer();
            openBtn.setAttribute('aria-expanded', 'false');
        }
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            closeDrawer();
            openBtn.setAttribute('aria-expanded', 'false');
        }
    });

    overlay.querySelectorAll('.mobile-drawer-link').forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            e.stopPropagation();

            const targetId = linkMap[link.id];
            const target = targetId ? document.getElementById(targetId) : null;
            syncDrawerActive(link.id);

            if (target) {
                target.click();
            } else if (link.dataset.targetTab && typeof window.switchTab === 'function') {
                window.switchTab(link.dataset.targetTab);
            } else if (link.href && link.getAttribute('href') !== '#') {
                window.location.href = link.href;
            }

            closeDrawer();
            openBtn.setAttribute('aria-expanded', 'false');
        });
    });

    if (logoutBtn) {
        logoutBtn.addEventListener('click', e => {
            e.preventDefault();
            e.stopPropagation();
            closeDrawer();
            openBtn.setAttribute('aria-expanded', 'false');
            if (typeof onLogout === 'function') onLogout();
        });
    }
}
