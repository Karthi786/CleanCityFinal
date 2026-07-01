/**
 * ══════════════════════════════════════════════════════════════
 * Kural AI — Full Website Control Agent
 * Version 3.0 | MakkalKural Platform
 *
 * Features:
 *  - Floating mic button (bottom-left)
 *  - Wake word detection: "Hey Kural"
 *  - Trilingual: English (en-IN) + Tamil (ta-IN) + Tanglish
 *  - Gemma via /api/nayagan-ai/command
 *  - Full action execution: navigate, filter, fill forms, download,
 *    scroll, open notifications, assign issues, submit forms
 *  - Text input for typed commands
 *  - Role-based permission guard (client-side JWT decode)
 *  - Web Speech Synthesis for voice responses
 *  - Action confirmation badges in conversation log
 *
 * Does NOT modify existing business logic.
 * Filename kept as nayagan-voice.js for backward compatibility with all dashboards.
 * ══════════════════════════════════════════════════════════════
 */

(function () {
    'use strict';

    /* ─────────────────────────────────────────────────────────
       CONFIG
    ───────────────────────────────────────────────────────── */
    const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? 'http://localhost:5001/api'
        : 'https://cleancityfinal.onrender.com/api';

    const WAKE_WORDS = ['hey kural', 'kural', 'ஹே குரல்', 'குரல்'];

    const GREETING_EN = 'Hi, I am Kural AI. How can I help you?';
    const GREETING_WAKE = 'How can I help you?';
    const LANG_EN = 'en-IN';
    const LANG_TA = 'ta-IN';

    /* ─────────────────────────────────────────────────────────
       LANGUAGE DETECTOR
       Detects Tamil by Unicode range U+0B80–U+0BFF
    ───────────────────────────────────────────────────────── */
    function detectLanguage(text) {
        const tamilCharCount = (text.match(/[\u0B80-\u0BFF]/g) || []).length;
        return tamilCharCount >= 2 ? LANG_TA : LANG_EN;
    }

    /* ─────────────────────────────────────────────────────────
       SPEECH SYNTHESIS HELPER
    ───────────────────────────────────────────────────────── */
    function speak(text, lang, onEndCallback) {
        if (!window.speechSynthesis) {
            if (onEndCallback) onEndCallback();
            return;
        }
        window.speechSynthesis.cancel();

        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = lang || detectLanguage(text);
        utter.rate = 1.0;
        utter.pitch = 1.0;
        utter.volume = 1.0;

        // Prefer a Tamil/Indian voice if available
        const voices = window.speechSynthesis.getVoices();
        const preferred = voices.find(v =>
            v.lang === utter.lang ||
            v.lang.startsWith('ta') ||
            v.name.toLowerCase().includes('india')
        );
        if (preferred) utter.voice = preferred;

        // State management for speaking
        if (window.KuralAI) {
            utter.onstart = () => window.KuralAI.setSpeakingState(true);
            utter.onend = () => {
                window.KuralAI.setSpeakingState(false, !!onEndCallback);
                if (onEndCallback) onEndCallback();
            };
            utter.onerror = () => {
                window.KuralAI.setSpeakingState(false, !!onEndCallback);
                if (onEndCallback) onEndCallback();
            };
        }

        window.speechSynthesis.speak(utter);
    }

    /* ─────────────────────────────────────────────────────────
       JWT DECODER — client-side role extraction (no server call)
    ───────────────────────────────────────────────────────── */
    function decodeJWT(token) {
        try {
            const payload = token.split('.')[1];
            const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
            return JSON.parse(decoded);
        } catch (e) {
            return null;
        }
    }

    function getCurrentUserRole() {
        const token = localStorage.getItem('cm_token');
        if (!token) return null;
        const payload = decodeJWT(token);
        return payload?.role || 'USER';
    }

    /* ─────────────────────────────────────────────────────────
       ROLE-BASED PERMISSION CHECK (client-side guard)
    ───────────────────────────────────────────────────────── */
    const ROLE_ALLOWED_ACTIONS = {
        USER:     ['NAVIGATE', 'SHOW_TAB', 'OPEN_MAP', 'FILTER_ISSUES', 'OPEN_RAISE_ISSUE', 'FILL_ISSUE_FORM', 'SUBMIT_FORM', 'SCROLL_TO', 'OPEN_NOTIFICATIONS', 'SPEAK_ONLY'],
        EMPLOYEE: ['NAVIGATE', 'SHOW_TAB', 'OPEN_MAP', 'FILTER_ISSUES', 'SCROLL_TO', 'OPEN_NOTIFICATIONS', 'SPEAK_ONLY'],
        DEFAULT:  ['ALL'] // admin, dept, collector, mla, cm, commissioner
    };

    function isActionAllowed(action, role) {
        const allowed = ROLE_ALLOWED_ACTIONS[role] || ROLE_ALLOWED_ACTIONS.DEFAULT;
        if (allowed.includes('ALL')) return true;
        return allowed.includes(action);
    }

    /* ─────────────────────────────────────────────────────────
       ACTION HANDLER
       Executes actions returned by the AI backend.
       Only calls existing page functions / DOM APIs.
    ───────────────────────────────────────────────────────── */
    const KuralActionHandler = {

        execute(action, voiceMessage) {
            const role = getCurrentUserRole() || 'USER';

            // Client-side permission guard
            if (!isActionAllowed(action.action, role)) {
                console.warn('[Kural AI] Action blocked by client-side role guard:', action.action, 'role:', role);
                return;
            }

            switch (action.action) {

                case 'NAVIGATE':
                    this._navigate(action.page);
                    break;

                case 'SHOW_TAB':
                    this._showTab(action.tabName);
                    break;

                case 'OPEN_MAP':
                    this._openMap(action.payload);
                    break;

                case 'OPEN_ANALYTICS':
                    this._openAnalytics(action.payload);
                    break;

                case 'FILTER_ISSUES':
                    this._filterIssues(action);
                    break;

                case 'TRIGGER_DOWNLOAD':
                    this._triggerDownload(action);
                    break;

                case 'OPEN_RAISE_ISSUE':
                    this._openRaiseIssue(action);
                    break;

                case 'FILL_ISSUE_FORM':
                    this._fillIssueForm(action);
                    break;

                case 'SUBMIT_FORM':
                    this._submitForm(action);
                    break;

                case 'SCROLL_TO':
                    this._scrollTo(action.target);
                    break;

                case 'OPEN_NOTIFICATIONS':
                    this._openNotifications();
                    break;

                case 'ASSIGN_ISSUE':
                    this._assignIssue(action);
                    break;

                case 'SPEAK_ONLY':
                    // Just speak — handled externally
                    break;

                default:
                    console.warn('[Kural AI] Unknown action:', action.action);
            }
        },

        /* ── Navigate to a page ── */
        _navigate(page) {
            if (!page) return;

            // Map friendly shorthand to actual filenames
            const pageMap = {
                'dashboard': 'citizen-dashboard.html',
                'citizen': 'citizen-dashboard.html',
                'department': 'department-dashboard.html',
                'employee': 'employee-dashboard.html',
                'collector': 'collector-dashboard.html',
                'admin': 'admin-dashboard.html',
                'mla': 'mla-dashboard.html',
                'cm': 'cm-dashboard.html',
                'commissioner': 'commissioner-dashboard.html',
            };

            const resolved = pageMap[page.toLowerCase().replace(/-dashboard\.html$/, '').trim()]
                || page;

            const base = window.location.pathname.replace(/[^/]*$/, '');
            const target = base + resolved;

            setTimeout(() => {
                window.location.href = target;
            }, 600);
        },

        /* ── Show / switch to a tab ── */
        _showTab(tabName) {
            if (!tabName) return;
            const name = tabName.toLowerCase().trim();

            // 1. Try window.switchTab() — used by department/collector/mla/cm dashboards
            if (typeof window.switchTab === 'function') {
                try {
                    window.switchTab(name);
                    return;
                } catch (e) { /* continue to DOM fallback */ }
            }

            // 2. Try hidden trigger buttons (department dashboard pattern)
            const tabBtnPatterns = [
                `tab-${name}-btn`,
                `tab-${name}`,
                `btn-${name}`,
                `nav-${name}`,
                `drawer-${name}`
            ];
            for (const id of tabBtnPatterns) {
                const el = document.getElementById(id);
                if (el) { el.click(); return; }
            }

            // 3. Try nav links by ID
            const navIds = [`nav-${name}`, `nav-${name}-link`, `drawer-${name}-link`];
            for (const id of navIds) {
                const el = document.getElementById(id);
                if (el) { el.click(); return; }
            }

            // 4. Try data-tab attribute (citizen dashboard pattern)
            const dataTabEl = document.querySelector(`[data-tab="${name}"]`);
            if (dataTabEl) { dataTabEl.click(); return; }

            // 5. Try data-section attribute
            const dataSectionEl = document.querySelector(`[data-section="${name}"]`);
            if (dataSectionEl) { dataSectionEl.click(); return; }

            // 6. Try href="#name" pattern
            const hrefEl = document.querySelector(`[href="#${name}"]`);
            if (hrefEl) { hrefEl.click(); return; }

            // 7. Fallback — find by text content
            const allNavBtns = document.querySelectorAll(
                'button, a, li, [role="tab"], .nav-link-item, .sidebar-item, .tab-btn, .tab-item, .mobile-drawer-link'
            );
            const match = Array.from(allNavBtns).find(el => {
                const text = el.textContent.trim().toLowerCase();
                return text === name || text.startsWith(name) || name.includes(text.split(/\s+/)[0]);
            });
            if (match) {
                match.click();
                match.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        },

        /* ── Open Map view ── */
        _openMap(payload) {
            if (typeof window.switchTab === 'function') {
                try { window.switchTab('map'); return; } catch (e) {}
            }
            this._showTab('map');
        },

        /* ── Open Analytics section ── */
        _openAnalytics(payload) {
            const section = payload?.section || 'overview';
            if (typeof window.switchTab === 'function') {
                try { window.switchTab('analytics'); return; } catch (e) {}
            }
            this._showTab('analytics');
        },

        /* ── Filter issues ── */
        _filterIssues(action) {
            // Dispatch custom event for pages that listen to it
            const detail = {
                priority: action.priority || null,
                status: action.status || null,
                dateRange: action.dateRange || null,
                clearAll: action.clearAll || false
            };
            window.dispatchEvent(new CustomEvent('kural:filterIssues', { detail }));
            // Also fire the old event name for backward compatibility
            window.dispatchEvent(new CustomEvent('nayagan:filterIssues', { detail }));

            // Also apply directly to known DOM elements
            this._applyFilterDirectly(detail);
        },

        _applyFilterDirectly(detail) {
            if (detail.clearAll) {
                // Clear status filter
                const statusSel = document.getElementById('status-filter')
                    || document.querySelector('select[name="status"]');
                if (statusSel) {
                    statusSel.value = '';
                    statusSel.dispatchEvent(new Event('change'));
                }

                // Clear priority filter
                const prioritySel = document.getElementById('filter-priority')
                    || document.querySelector('select[name="priority"]');
                if (prioritySel) {
                    prioritySel.value = '';
                    prioritySel.dispatchEvent(new Event('change'));
                }

                // Click "All" map pills
                document.querySelectorAll('.map-pill[data-filter-val=""]').forEach(btn => btn.click());

                // Click data-filter="all" elements
                document.querySelectorAll('[data-filter="all"]').forEach(el => el.click());
                return;
            }

            // ── Date Range Filter ──
            if (detail.dateRange) {
                this._setDateRange(detail.dateRange);
            }

            // ── Status Filter ──
            if (detail.status) {
                const s = detail.status.toUpperCase();
                const statusSel = document.getElementById('status-filter')
                    || document.querySelector('#filter-status, select[name="status"]');
                if (statusSel) {
                    const opt = Array.from(statusSel.options).find(o =>
                        o.value.toUpperCase() === s || o.text.toUpperCase().replace(/[\s_-]/g, '_') === s
                    );
                    if (opt) {
                        statusSel.value = opt.value;
                        statusSel.dispatchEvent(new Event('change'));
                        statusSel.dispatchEvent(new Event('input'));
                    }
                }

                // Try data-status buttons
                const statusBtn = document.querySelector(
                    `[data-status="${s}"], [data-filter="status-${s}"], [data-value="${s}"]`
                ) || this._findButtonByText(s.replace(/_/g, ' '));
                if (statusBtn) statusBtn.click();
            }

            // ── Priority Filter ──
            if (detail.priority) {
                const p = detail.priority;
                const pLower = p.toLowerCase();
                const pCapitalized = p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();

                const prioritySel = document.getElementById('filter-priority')
                    || document.querySelector('select[name="priority"]');
                if (prioritySel) {
                    const opt = Array.from(prioritySel.options).find(o =>
                        o.value.toUpperCase() === p.toUpperCase() || o.text.toLowerCase() === pLower
                    );
                    if (opt) {
                        prioritySel.value = opt.value;
                        prioritySel.dispatchEvent(new Event('change'));
                        prioritySel.dispatchEvent(new Event('input'));
                    }
                }

                // Map pill buttons
                const mapPill = document.querySelector(
                    `.map-pill[data-filter-type="priority"][data-filter-val="${pLower}"]`
                );
                if (mapPill) mapPill.click();

                // Generic data attribute buttons
                const priorityBtn = document.querySelector(
                    `[data-priority="${p.toUpperCase()}"], [data-priority="${pCapitalized}"], [data-filter="priority-${pLower}"]`
                ) || this._findButtonByText(pCapitalized) || this._findButtonByText(pLower);
                if (priorityBtn && priorityBtn !== prioritySel) priorityBtn.click();
            }
        },

        /* ── Trigger report download ── */
        _triggerDownload(action) {
            const format = (action.format || 'excel').toLowerCase();
            const dateRange = action.dateRange || null;

            // Apply filters first if provided
            if (action.priority || action.status || dateRange) {
                this._applyFilterDirectly({
                    priority: action.priority || null,
                    status: action.status || null,
                    dateRange: dateRange,
                    clearAll: false
                });
                // Small delay to let filters apply before download
            }

            if (dateRange) this._setDateRange(dateRange);

            setTimeout(() => {
                // Excel download
                if (format === 'excel' || format === 'xlsx') {
                    const excelBtn = document.getElementById('download-excel-btn')
                        || document.querySelector('[data-export="excel"], .export-excel, .btn-excel');
                    if (excelBtn) { excelBtn.click(); return; }

                    const dlModal = document.getElementById('download-reports-modal');
                    if (dlModal) { dlModal.classList.add('open'); return; }
                }

                // PDF download
                if (format === 'pdf') {
                    const pdfBtn = document.getElementById('download-pdf-btn')
                        || document.querySelector('#export-pdf, .export-pdf, [data-export="pdf"], .btn-pdf');
                    if (pdfBtn) { pdfBtn.click(); return; }
                }

                // Fallback — any download button
                const anyDownload = document.querySelector(
                    '.download-btn, #download-report, [data-action="download"], .report-download'
                ) || this._findButtonByText('download') || this._findButtonByText('export');
                if (anyDownload) anyDownload.click();
            }, action.priority || action.status ? 600 : 0);
        },

        _setDateRange(dateRange) {
            const today = new Date();
            let fromDate = today, toDate = today;

            if (dateRange === 'this_week') {
                fromDate = new Date(today);
                fromDate.setDate(today.getDate() - today.getDay());
            } else if (dateRange === 'last_week') {
                fromDate = new Date(today);
                fromDate.setDate(today.getDate() - today.getDay() - 7);
                toDate = new Date(today);
                toDate.setDate(today.getDate() - today.getDay() - 1);
            } else if (dateRange === 'this_month') {
                fromDate = new Date(today.getFullYear(), today.getMonth(), 1);
            }

            const fmt = d => d.toISOString().split('T')[0];

            const fromEl = document.querySelector('#date-from, #start-date, #from-date, input[name="from"]');
            const toEl = document.querySelector('#date-to, #end-date, #to-date, input[name="to"]');

            if (fromEl) { fromEl.value = fmt(fromDate); fromEl.dispatchEvent(new Event('change')); }
            if (toEl) { toEl.value = fmt(toDate); toEl.dispatchEvent(new Event('change')); }
        },

        /* ── Open raise issue form ── */
        _openRaiseIssue(action) {
            const raiseBtn = document.getElementById('report-btn')
                || document.getElementById('raise-issue-btn')
                || document.getElementById('btn-raise-issue')
                || document.getElementById('new-issue-btn')
                || document.querySelector('[data-action="raise-issue"]')
                || this._findButtonByText('report issue')
                || this._findButtonByText('raise issue')
                || this._findButtonByText('new issue')
                || this._findButtonByText('+ report')
                || this._findButtonByText('report');

            if (raiseBtn) {
                raiseBtn.click();
                if (action.title || action.category || action.description) {
                    setTimeout(() => this._prefillIssueForm(action), 500);
                }
            } else {
                this._navigate('citizen-dashboard.html');
            }
        },

        /* ── Fill issue form with extracted data ── */
        _fillIssueForm(action) {
            const modal = document.getElementById('report-modal');
            const isModalOpen = modal && (
                modal.classList.contains('open') ||
                modal.style.display === 'flex' ||
                modal.style.display === 'block'
            );

            if (!isModalOpen) {
                const raiseBtn = document.getElementById('report-btn')
                    || document.getElementById('raise-issue-btn')
                    || this._findButtonByText('report')
                    || this._findButtonByText('raise issue');

                if (raiseBtn) {
                    raiseBtn.click();
                    setTimeout(() => this._prefillIssueForm(action), 600);
                } else {
                    sessionStorage.setItem('kural_pending_fill', JSON.stringify(action));
                    this._navigate('citizen-dashboard.html');
                }
            } else {
                this._prefillIssueForm(action);
            }
        },

        _prefillIssueForm(action) {
            // Title — #issue-title
            const titleEl = document.getElementById('issue-title')
                || document.querySelector('input[name="title"], #complaint-title');
            if (titleEl && action.title) {
                titleEl.value = action.title;
                titleEl.dispatchEvent(new Event('input', { bubbles: true }));
                titleEl.dispatchEvent(new Event('change', { bubbles: true }));
                titleEl.style.borderColor = '#0f766e';
                setTimeout(() => { titleEl.style.borderColor = ''; }, 2000);
            }

            // Category — #issue-category select
            const catEl = document.getElementById('issue-category')
                || document.querySelector('select[name="category"], #category-select');
            if (catEl && action.category) {
                const opt = Array.from(catEl.options).find(o =>
                    o.value.toLowerCase().includes(action.category.toLowerCase()) ||
                    o.text.toLowerCase().includes(action.category.toLowerCase())
                );
                if (opt) {
                    catEl.value = opt.value;
                    catEl.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }

            // Description — #issue-desc textarea
            const descEl = document.getElementById('issue-desc')
                || document.querySelector('textarea[name="description"], #complaint-desc, #issue-description');
            if (descEl && action.description) {
                descEl.value = action.description;
                descEl.dispatchEvent(new Event('input', { bubbles: true }));
                descEl.dispatchEvent(new Event('change', { bubbles: true }));
                descEl.style.borderColor = '#0f766e';
                setTimeout(() => { descEl.style.borderColor = ''; }, 2000);
            }

            // Location — #issue-location
            const locEl = document.getElementById('issue-location')
                || document.querySelector('input[name="location"], #location-input');
            if (locEl && action.location) {
                locEl.value = action.location;
                locEl.dispatchEvent(new Event('input', { bubbles: true }));
                locEl.dispatchEvent(new Event('change', { bubbles: true }));
                locEl.style.borderColor = '#0f766e';
                setTimeout(() => { locEl.style.borderColor = ''; }, 2000);
            }

            // Switch to issue tab if campaign toggle exists
            const issueToggle = document.getElementById('toggle-issue');
            if (issueToggle) issueToggle.click();
        },

        /* ── Submit open form ── */
        _submitForm(action) {
            // Try to submit the report/issue form
            const submitBtn = document.getElementById('submit-issue-btn')
                || document.getElementById('submit-report-btn')
                || document.getElementById('report-submit-btn')
                || document.querySelector('form#report-form button[type="submit"]')
                || document.querySelector('#report-modal button[type="submit"]')
                || document.querySelector('.submit-issue-btn, .report-submit, [data-action="submit-issue"]')
                || this._findButtonByText('submit issue')
                || this._findButtonByText('submit complaint')
                || this._findButtonByText('submit');

            if (submitBtn) {
                submitBtn.click();
            } else {
                // Try dispatching submit event on open form
                const openForm = document.querySelector('#report-modal form, form.issue-form, form#issue-form');
                if (openForm) {
                    openForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
                }
            }
        },

        /* ── Scroll to a section ── */
        _scrollTo(target) {
            if (!target) {
                window.scrollBy({ top: 300, behavior: 'smooth' });
                return;
            }

            const t = target.toLowerCase().trim();

            if (t === 'top') {
                window.scrollTo({ top: 0, behavior: 'smooth' });
                return;
            }

            if (t === 'bottom') {
                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                return;
            }

            // Try finding element by ID patterns
            const idPatterns = [
                t,
                `${t}-section`,
                `section-${t}`,
                `${t}-container`,
                `${t}-wrapper`,
                `${t}-panel`,
                `${t}-area`
            ];

            for (const id of idPatterns) {
                const el = document.getElementById(id);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    // Briefly highlight the section
                    el.style.outline = '2px solid #0f766e';
                    el.style.outlineOffset = '4px';
                    setTimeout(() => { el.style.outline = ''; el.style.outlineOffset = ''; }, 2500);
                    return;
                }
            }

            // Try class-based selectors
            const classEl = document.querySelector(
                `.${t}-section, .${t}-container, [data-section="${t}"], [data-tab="${t}"]`
            );
            if (classEl) {
                classEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                return;
            }

            // Try heading text match
            const headings = document.querySelectorAll('h1, h2, h3, h4, .section-title, .card-title');
            const matchHeading = Array.from(headings).find(h =>
                h.textContent.trim().toLowerCase().includes(t)
            );
            if (matchHeading) {
                matchHeading.scrollIntoView({ behavior: 'smooth', block: 'start' });
                return;
            }

            // Fallback: scroll down a page worth
            window.scrollBy({ top: window.innerHeight * 0.8, behavior: 'smooth' });
        },

        /* ── Open notification panel ── */
        _openNotifications() {
            // Try notification bell / button by common IDs
            const notifBtn = document.getElementById('notification-btn')
                || document.getElementById('notif-btn')
                || document.getElementById('notifications-btn')
                || document.getElementById('bell-btn')
                || document.querySelector('[data-action="notifications"], [data-panel="notifications"]')
                || document.querySelector('.notification-bell, .notif-btn, .bell-icon, #notification-icon')
                || document.querySelector('[aria-label="Notifications"], [aria-label="notifications"]')
                || this._findButtonByText('notification')
                || this._findButtonByText('notifications');

            if (notifBtn) {
                notifBtn.click();
                return;
            }

            // Try SHOW_TAB fallback
            this._showTab('notifications');
        },

        /* ── Open issue assignment workflow ── */
        _assignIssue(action) {
            // Try assignment button
            const assignBtn = document.getElementById('assign-btn')
                || document.getElementById('assign-issue-btn')
                || document.getElementById('assignment-btn')
                || document.querySelector('[data-action="assign"], .assign-btn, .btn-assign')
                || this._findButtonByText('assign');

            if (assignBtn) {
                assignBtn.click();
                return;
            }

            // Try to open assignment modal
            const assignModal = document.getElementById('assign-modal')
                || document.getElementById('assignment-modal');
            if (assignModal) {
                assignModal.classList.add('open');
                assignModal.style.display = 'flex';
            }
        },

        /* ── Utility: find button by text ── */
        _findButtonByText(text) {
            const lowerText = text.toLowerCase().trim();
            const buttons = document.querySelectorAll('button, .btn, [role="button"], a.btn');
            return Array.from(buttons).find(btn =>
                btn.textContent.trim().toLowerCase().includes(lowerText)
            ) || null;
        }
    };

    /* ─────────────────────────────────────────────────────────
       MAIN KURAL AI CLASS
    ───────────────────────────────────────────────────────── */
    class KuralVoiceAssistant {
        constructor() {
            this.isOpen = false;
            this.isListening = false;
            this.isProcessing = false;
            this.isSpeaking = false;
            this.wakeRecognition = null;
            this.commandRecognition = null;
            this.voicesLoaded = false;

            // Preload voices
            if (window.speechSynthesis) {
                window.speechSynthesis.onvoiceschanged = () => { this.voicesLoaded = true; };
                window.speechSynthesis.getVoices();
            }

            this._injectHTML();
            this._bindEvents();
            this._startWakeWordListener();
            this._checkPendingFill();
        }

        /* ── Check if we need to auto-fill a form after navigation ── */
        _checkPendingFill() {
            const pending = sessionStorage.getItem('kural_pending_fill');
            if (pending) {
                sessionStorage.removeItem('kural_pending_fill');
                try {
                    const action = JSON.parse(pending);
                    setTimeout(() => {
                        KuralActionHandler._fillIssueForm(action);
                        speak('Form fill pannitaen. Photo upload pannunga.', LANG_EN);
                    }, 1500);
                } catch (e) { /* ignore */ }
            }
        }

        /* ── Inject HTML UI ── */
        _injectHTML() {
            // Launcher button
            const launcher = document.createElement('button');
            launcher.className = 'kural-launcher';
            launcher.id = 'kural-launcher';
            launcher.setAttribute('aria-label', 'Kural AI Voice Assistant');
            launcher.innerHTML = `
                ${this._micSVG()}
                <span class="kural-tooltip">Kural AI</span>
            `;

            // Main panel
            const panel = document.createElement('div');
            panel.className = 'kural-panel';
            panel.id = 'kural-panel';
            panel.innerHTML = `
                <div class="kural-header">
                    <div class="kural-header-left">
                        <div class="kural-avatar">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                                <line x1="12" y1="19" x2="12" y2="23"/>
                                <line x1="8" y1="23" x2="16" y2="23"/>
                            </svg>
                        </div>
                        <div class="kural-header-info">
                            <h3>Kural AI</h3>
                            <p id="kural-role-label">Website Control Agent</p>
                        </div>
                    </div>
                    <button class="kural-close-btn" id="kural-close" aria-label="Close">✕</button>
                </div>

                <div class="kural-status-bar">
                    <div class="kural-status-dot" id="kural-status-dot"></div>
                    <span class="kural-status-text" id="kural-status-text">Ready</span>
                </div>

                <div class="kural-waveform" id="kural-waveform">
                    ${Array.from({length: 12}, () => '<div class="kural-wave-bar"></div>').join('')}
                </div>

                <div class="kural-transcript empty" id="kural-transcript">
                    Speak or type a command...
                </div>

                <div class="kural-hint">
                    Wake word: <span class="kural-hint-chip">Hey Kural</span>
                </div>

                <div class="kural-quick-chips" id="kural-quick-chips">
                    <button class="kural-chip" data-cmd="Open dashboard">🏠 Dashboard</button>
                    <button class="kural-chip" data-cmd="Show analytics">📊 Analytics</button>
                    <button class="kural-chip" data-cmd="Raise issue">🚨 Raise Issue</button>
                    <button class="kural-chip" data-cmd="Show map">🗺️ Map</button>
                    <button class="kural-chip" data-cmd="Download report">⬇️ Download</button>
                    <button class="kural-chip" data-cmd="Show high priority issues">🔴 High Priority</button>
                    <button class="kural-chip" data-cmd="Open notifications">🔔 Notifications</button>
                    <button class="kural-chip" data-cmd="Show campaigns">📣 Campaigns</button>
                </div>

                <div class="kural-log" id="kural-log"></div>

                <div class="kural-footer">
                    <button class="kural-mic-btn" id="kural-mic-btn">
                        ${this._micSVG()}
                        <span id="kural-mic-label">Start Listening</span>
                    </button>
                    <button class="kural-clear-btn" id="kural-clear-btn" title="Clear conversation">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                            <path d="M10 11v6M14 11v6"/>
                        </svg>
                    </button>
                </div>

                <div class="kural-text-input-row" id="kural-text-row">
                    <input
                        type="text"
                        class="kural-text-input"
                        id="kural-text-input"
                        placeholder="Type a command..."
                        autocomplete="off"
                    />
                    <button class="kural-send-btn" id="kural-send-btn" title="Send command">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="22" y1="2" x2="11" y2="13"/>
                            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                        </svg>
                    </button>
                </div>
            `;

            // Toast notification
            const toast = document.createElement('div');
            toast.className = 'kural-toast';
            toast.id = 'kural-toast';

            document.body.appendChild(launcher);
            document.body.appendChild(panel);
            document.body.appendChild(toast);

            this._updateRoleLabel();
        }

        _updateRoleLabel() {
            const role = getCurrentUserRole();
            const roleLabels = {
                USER: 'Citizen Dashboard Agent',
                EMPLOYEE: 'Employee Dashboard Agent',
                TAMILNADU_CORPORATION: 'Department Control Agent',
                TNEB: 'Department Control Agent',
                POLICE: 'Department Control Agent',
                COLLECTOR: 'Collector Control Agent',
                ADMIN: 'Admin Control Agent',
                MLA: 'MLA Control Agent',
                CM: 'CM Control Agent',
                COMMISSIONER: 'Commissioner Control Agent',
            };
            const label = document.getElementById('kural-role-label');
            if (label && role) {
                label.textContent = roleLabels[role] || 'Website Control Agent';
            }
        }

        _micSVG() {
            return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="23"/>
                <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>`;
        }

        /* ── Bind UI Events ── */
        _bindEvents() {
            document.getElementById('kural-launcher').addEventListener('click', () => this.togglePanel());
            document.getElementById('kural-close').addEventListener('click', () => this.closePanel());
            document.getElementById('kural-mic-btn').addEventListener('click', () => this.toggleListening());
            document.getElementById('kural-clear-btn').addEventListener('click', () => this.clearLog());

            // Text input
            const textInput = document.getElementById('kural-text-input');
            const sendBtn = document.getElementById('kural-send-btn');

            sendBtn.addEventListener('click', () => this._sendTextCommand());
            textInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this._sendTextCommand();
                }
            });

            // Quick chips
            document.getElementById('kural-quick-chips').addEventListener('click', (e) => {
                const chip = e.target.closest('.kural-chip');
                if (chip) {
                    const cmd = chip.dataset.cmd;
                    if (cmd) {
                        if (!this.isOpen) this.openPanel();
                        this._processCommand(cmd);
                    }
                }
            });
        }

        _sendTextCommand() {
            const input = document.getElementById('kural-text-input');
            const text = (input.value || '').trim();
            if (!text || this.isProcessing) return;
            input.value = '';
            this._processCommand(text);
        }

        /* ── Panel Controls ── */
        togglePanel() {
            this.isOpen ? this.closePanel() : this.openPanel();
        }

        openPanel() {
            this.isOpen = true;
            const panel = document.getElementById('kural-panel');
            panel.style.display = 'flex';
            setTimeout(() => panel.classList.add('open'), 10);

            // Greet user on first open
            const hasGreeted = sessionStorage.getItem('kural_greeted');
            if (!hasGreeted) {
                sessionStorage.setItem('kural_greeted', '1');
                setTimeout(() => {
                    this._addLog('ai', GREETING_EN, null);
                    speak(GREETING_EN, LANG_EN, () => {
                        this.startListening();
                    });
                }, 300);
            }
        }

        closePanel() {
            this.isOpen = false;
            const panel = document.getElementById('kural-panel');
            panel.classList.remove('open');
            setTimeout(() => { panel.style.display = 'none'; }, 300);
            this.stopListening();
        }

        /* ── Status UI Updates ── */
        _setStatus(state, text) {
            const dot = document.getElementById('kural-status-dot');
            const statusText = document.getElementById('kural-status-text');
            const waveform = document.getElementById('kural-waveform');
            const launcher = document.getElementById('kural-launcher');
            const micBtn = document.getElementById('kural-mic-btn');
            const micLabel = document.getElementById('kural-mic-label');

            dot.className = `kural-status-dot ${state}`;
            if (statusText) statusText.textContent = text;

            if (state === 'listening') {
                waveform.classList.add('active');
                launcher.classList.add('listening');
                launcher.classList.remove('processing');
                micBtn.classList.add('active');
                if (micLabel) micLabel.textContent = 'Stop Listening';
            } else if (state === 'processing') {
                waveform.classList.remove('active');
                launcher.classList.remove('listening');
                launcher.classList.add('processing');
                micBtn.classList.remove('active');
                if (micLabel) micLabel.textContent = 'Processing...';
            } else if (state === 'speaking') {
                waveform.classList.add('active');
                launcher.classList.remove('listening', 'processing');
                micBtn.classList.remove('active');
                if (micLabel) micLabel.textContent = 'Speaking...';
            } else {
                waveform.classList.remove('active');
                launcher.classList.remove('listening', 'processing');
                micBtn.classList.remove('active');
                if (micLabel) micLabel.textContent = 'Start Listening';
            }
        }

        _setTranscript(text, isEmpty) {
            const el = document.getElementById('kural-transcript');
            if (!el) return;
            el.textContent = text;
            el.classList.toggle('empty', !!isEmpty);
        }

        /* ── Conversation Log ── */
        _addLog(type, text, actionType) {
            const log = document.getElementById('kural-log');
            if (!log) return;

            const msg = document.createElement('div');
            msg.className = `kural-log-msg ${type === 'user' ? 'user-msg' : 'ai-msg'}`;

            const bubble = document.createElement('div');
            bubble.className = 'kural-log-bubble';

            if (actionType && actionType !== 'SPEAK_ONLY') {
                const badge = document.createElement('span');
                badge.className = 'kural-action-badge';
                badge.textContent = this._getActionBadgeLabel(actionType);
                bubble.appendChild(badge);
                const br = document.createElement('br');
                bubble.appendChild(br);
            }

            const textNode = document.createTextNode(text);
            bubble.appendChild(textNode);

            msg.appendChild(bubble);
            log.appendChild(msg);
            log.scrollTop = log.scrollHeight;
        }

        _getActionBadgeLabel(action) {
            const labels = {
                'NAVIGATE': '🔀 Navigate',
                'SHOW_TAB': '📂 Tab Switch',
                'OPEN_MAP': '🗺️ Map',
                'OPEN_ANALYTICS': '📊 Analytics',
                'FILTER_ISSUES': '🔍 Filter',
                'OPEN_RAISE_ISSUE': '🚨 Open Form',
                'FILL_ISSUE_FORM': '✍️ Form Fill',
                'SUBMIT_FORM': '✅ Submit',
                'TRIGGER_DOWNLOAD': '⬇️ Download',
                'SCROLL_TO': '📜 Scroll',
                'OPEN_NOTIFICATIONS': '🔔 Notifications',
                'ASSIGN_ISSUE': '👤 Assign',
            };
            return labels[action] || `⚡ ${action}`;
        }

        clearLog() {
            const log = document.getElementById('kural-log');
            if (log) log.innerHTML = '';
            this._setTranscript('Speak or type a command...', true);
            sessionStorage.removeItem('kural_greeted');
        }

        /* ── Toast Notification ── */
        _showToast(text) {
            const toast = document.getElementById('kural-toast');
            if (!toast) return;
            toast.textContent = text;
            toast.classList.add('show');
            clearTimeout(this._toastTimer);
            this._toastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
        }

        /* ─────────────────────────────────────────────────────
           WAKE WORD LISTENER
           Runs continuously in background (silent mode)
        ───────────────────────────────────────────────────── */
        _startWakeWordListener() {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition) return;

            this.wakeRecognition = new SpeechRecognition();
            this.wakeRecognition.continuous = true;
            this.wakeRecognition.interimResults = false;
            this.wakeRecognition.lang = LANG_EN;

            this.wakeRecognition.onresult = (e) => {
                const transcript = e.results[e.results.length - 1][0].transcript.toLowerCase().trim();
                if (WAKE_WORDS.some(ww => transcript.includes(ww))) {
                    this._onWakeWordDetected();
                }
            };

            this.wakeRecognition.onend = () => {
                if (!this.isListening && !this.isProcessing && !this.isSpeaking) {
                    try { this.wakeRecognition.start(); } catch (e) { /* ignore */ }
                }
            };

            try { this.wakeRecognition.start(); } catch (e) { /* browser may block until user interaction */ }
        }

        _onWakeWordDetected() {
            if (this.isListening || this.isProcessing || this.isSpeaking) return;
            if (!this.isOpen) this.openPanel();
            this._showToast('🎙️ Hey Kural — listening!');
            this._setTranscript('"Hey Kural" detected...', false);
            setTimeout(() => {
                this._addLog('ai', GREETING_WAKE, null);
                speak(GREETING_WAKE, LANG_EN, () => {
                    this.startListening();
                });
            }, 300);
        }

        /* ─────────────────────────────────────────────────────
           COMMAND LISTENING
        ───────────────────────────────────────────────────── */
        toggleListening() {
            if (this.isListening) {
                this.stopListening();
            } else {
                this.startListening();
            }
        }

        startListening() {
            if (this.isSpeaking) return;

            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition) {
                this._addLog('ai', 'Speech recognition is not supported in this browser. Please use Chrome or Edge.', null);
                speak('Speech recognition not supported. Please use Chrome.', LANG_EN);
                return;
            }

            try { if (this.wakeRecognition) this.wakeRecognition.stop(); } catch (e) { /* ignore */ }

            this.isListening = true;
            this._setStatus('listening', 'Listening...');
            this._setTranscript('Listening... speak now', false);

            this.commandRecognition = new SpeechRecognition();
            this.commandRecognition.continuous = false;
            this.commandRecognition.interimResults = true;
            this.commandRecognition.lang = LANG_EN;

            let finalTranscript = '';

            this.commandRecognition.onresult = (e) => {
                let interim = '';
                for (let i = e.resultIndex; i < e.results.length; i++) {
                    const t = e.results[i][0].transcript;
                    if (e.results[i].isFinal) {
                        finalTranscript += t;
                    } else {
                        interim += t;
                    }
                }
                this._setTranscript(finalTranscript || interim, false);
            };

            this.commandRecognition.onend = () => {
                this.isListening = false;
                if (finalTranscript.trim()) {
                    this._processCommand(finalTranscript.trim());
                } else {
                    this._setStatus('', 'Ready');
                    this._setTranscript('No speech detected. Try again.', true);
                    try { if (this.wakeRecognition) this.wakeRecognition.start(); } catch (e) { /* ignore */ }
                }
            };

            this.commandRecognition.onerror = (e) => {
                this.isListening = false;
                this._setStatus('', 'Ready');
                const errMsg = e.error === 'no-speech'
                    ? 'No speech detected.'
                    : e.error === 'not-allowed'
                    ? 'Microphone access denied. Please allow microphone in browser settings.'
                    : `Error: ${e.error}`;
                this._setTranscript(errMsg, true);
                this._addLog('ai', errMsg, null);
                try { if (this.wakeRecognition) this.wakeRecognition.start(); } catch (er) { /* ignore */ }
            };

            try {
                this.commandRecognition.start();
            } catch (err) {
                this.isListening = false;
                this._setStatus('', 'Ready');
                this._setTranscript('Could not access microphone.', true);
            }
        }

        stopListening() {
            this.isListening = false;
            try { if (this.commandRecognition) this.commandRecognition.stop(); } catch (e) { /* ignore */ }
            
            if (!this.isSpeaking && !this.isProcessing) {
                this._setStatus('', 'Ready');
                setTimeout(() => {
                    if (!this.isSpeaking && !this.isProcessing && !this.isListening) {
                        try { if (this.wakeRecognition) this.wakeRecognition.start(); } catch (e) { /* ignore */ }
                    }
                }, 500);
            }
        }

        setSpeakingState(isSpeaking, skipWakeRestart = false) {
            this.isSpeaking = isSpeaking;
            if (isSpeaking) {
                this._setStatus('speaking', 'Speaking...');
                this.stopListening();
                try { if (this.wakeRecognition) this.wakeRecognition.stop(); } catch (e) { /* ignore */ }
            } else {
                if (!this.isListening && !this.isProcessing && !skipWakeRestart) {
                    this._setStatus('', 'Ready');
                    try { if (this.wakeRecognition) this.wakeRecognition.start(); } catch (e) { /* ignore */ }
                }
            }
        }

        /* ─────────────────────────────────────────────────────
           COMMAND PROCESSING
        ───────────────────────────────────────────────────── */
        async _processCommand(text) {
            this.isProcessing = true;
            this._setStatus('processing', 'Processing...');
            this._addLog('user', text, null);

            const token = localStorage.getItem('cm_token');
            if (!token) {
                const msg = 'Please log in to use Kural AI.';
                this._handleResponse({ action: 'SPEAK_ONLY', voiceMessage: msg });
                return;
            }

            try {
                const currentPage = window.location.pathname.split('/').pop() || 'index.html';
                const res = await fetch(`${API_BASE}/nayagan-ai/command`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ text, currentPage })
                });

                if (!res.ok) {
                    throw new Error(`Server error: ${res.status}`);
                }

                const action = await res.json();
                this._handleResponse(action);

            } catch (err) {
                console.error('[Kural AI] processCommand error:', err);
                const errMsg = 'Kural AI is temporarily unavailable. Please try again.';
                this._handleResponse({ action: 'SPEAK_ONLY', voiceMessage: errMsg });
            }
        }

        _handleResponse(action) {
            this.isProcessing = false;
            this._setStatus('', 'Ready');

            const voiceMsg = action.voiceMessage || 'Done.';
            const actionType = action.action || 'SPEAK_ONLY';

            this._addLog('ai', voiceMsg, actionType);

            const toastEmoji = this._getActionEmoji(actionType);
            this._showToast(`${toastEmoji} ${voiceMsg}`);

            const lang = detectLanguage(voiceMsg);
            speak(voiceMsg, lang);

            KuralActionHandler.execute(action, voiceMsg);
        }

        _getActionEmoji(action) {
            const emojis = {
                'NAVIGATE': '🔀',
                'SHOW_TAB': '📂',
                'OPEN_MAP': '🗺️',
                'OPEN_ANALYTICS': '📊',
                'FILTER_ISSUES': '🔍',
                'OPEN_RAISE_ISSUE': '🚨',
                'FILL_ISSUE_FORM': '✍️',
                'SUBMIT_FORM': '✅',
                'TRIGGER_DOWNLOAD': '⬇️',
                'SCROLL_TO': '📜',
                'OPEN_NOTIFICATIONS': '🔔',
                'ASSIGN_ISSUE': '👤',
                'SPEAK_ONLY': '🤖',
            };
            return emojis[action] || '⚡';
        }
    }

    /* ─────────────────────────────────────────────────────────
       INIT — Wait for DOM, then instantiate
    ───────────────────────────────────────────────────────── */
    function init() {
        const token = localStorage.getItem('cm_token');
        if (!token) return;

        window.KuralAI = new KuralVoiceAssistant();
        // Expose on old name too for any external references
        window.NayaganAI = window.KuralAI;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        setTimeout(init, 100);
    }

})();
