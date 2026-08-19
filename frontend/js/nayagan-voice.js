/**
 * ══════════════════════════════════════════════════════════════
 * Kural AI — Full Website Control Agent
 * Version 4.1 | MakkalKural Platform
 *
 * Features:
 *  - Floating mic button (bottom-left)
 *  - Wake word detection: "Hey Kural" (English) + "வணக்கம் குரல்" / "Vanakkam Kural" (Tamil)
 *  - Bilingual: English (en-IN) + Tamil (ta-IN)
 *  - Manual language toggle: EN | தமிழ்
 *  - Tamil-mode: greet in Tamil, recognize Tamil, respond in Tamil
 *  - Gemma via /api/nayagan-ai/command
 *  - Full action execution: navigate, filter, fill forms, download,
 *    scroll, open notifications, assign issues, submit forms
 *  - Voice Issue Workflow (multi-turn guided conversation)
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
        : 'https://makkalkural-3528.onrender.com/api';

    // English wake words
    const WAKE_WORDS_EN = ['hey kural', 'hey kurral', 'kural', 'hay kural'];
    // Tamil wake words (script + romanized)
    const WAKE_WORDS_TA_SCRIPT = ['வணக்கம் குரல்', 'வணக்கம் கூரல்'];
    const WAKE_WORDS_TA_ROMAN  = ['vanakkam kural', 'vanakam kural', 'vanakkam kuralai', 'vanakkam'];
    // Combined for checks
    const WAKE_WORDS_TA = [...WAKE_WORDS_TA_SCRIPT, ...WAKE_WORDS_TA_ROMAN];

    const GREETING_EN      = 'Hi, I am Kural AI. How can I help you?';
    const GREETING_WAKE_EN = 'How can I help you?';
    const GREETING_TA      = 'வணக்கம்! நான் குரல் AI. உங்களுக்கு என்ன உதவி வேண்டும்?';
    const GREETING_WAKE_TA = 'உங்களுக்கு என்ன உதவி வேண்டும்?';

    const LANG_EN = 'en-IN';
    const LANG_TA = 'ta-IN';

    /* ─────────────────────────────────────────────────────────
       LANGUAGE STATE  (persisted across page loads within session)
    ───────────────────────────────────────────────────────── */
    let activeLang = sessionStorage.getItem('kural_lang') || 'en'; // 'en' | 'ta'

    function setActiveLang(lang) {
        activeLang = lang;
        sessionStorage.setItem('kural_lang', lang);
        _updateLangToggleUI();
        _updateWakeHintUI();
    }

    function _updateLangToggleUI() {
        const btnEn = document.getElementById('kural-lang-en');
        const btnTa = document.getElementById('kural-lang-ta');
        if (btnEn) btnEn.classList.toggle('active', activeLang === 'en');
        if (btnTa) btnTa.classList.toggle('active', activeLang === 'ta');
    }

    function _updateWakeHintUI() {
        const hintChip = document.querySelector('.kural-hint .kural-hint-chip');
        const hint     = document.querySelector('.kural-hint');
        if (hintChip) {
            hintChip.textContent = activeLang === 'ta'
                ? 'வணக்கம் குரல்'
                : 'Hey Kural';
        }
        if (hint) {
            hint.classList.toggle('ta-mode', activeLang === 'ta');
        }
    }

    /* ─────────────────────────────────────────────────────────
       LANGUAGE DETECTOR (for auto-detecting from AI response text)
       Detects Tamil by Unicode range U+0B80–U+0BFF
    ───────────────────────────────────────────────────────── */
    function detectLanguage(text) {
        const tamilCharCount = (text.match(/[\u0B80-\u0BFF]/g) || []).length;
        return tamilCharCount >= 2 ? LANG_TA : LANG_EN;
    }

    function getSpeechLang() {
        return activeLang === 'ta' ? LANG_TA : LANG_EN;
    }

    /* ─────────────────────────────────────────────────────────
       SPEECH SYNTHESIS HELPER
       FIX: Guards isSpeaking via a local instance ref to avoid
            window.KuralAI being undefined during early boot.
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

        // Prefer Tamil/Indian voice if available
        const voices = window.speechSynthesis.getVoices();
        if (utter.lang === LANG_TA) {
            const tamilVoice = voices.find(v =>
                v.lang === 'ta-IN' || v.lang.startsWith('ta') ||
                v.name.toLowerCase().includes('tamil')
            );
            if (tamilVoice) utter.voice = tamilVoice;
        } else {
            const indianVoice = voices.find(v =>
                v.lang === 'en-IN' ||
                v.name.toLowerCase().includes('india') ||
                v.name.toLowerCase().includes('ravi') ||
                v.name.toLowerCase().includes('heera')
            );
            if (indianVoice) utter.voice = indianVoice;
        }

        // FIX: Use a getter fn so we always reference the live instance,
        //      even if window.KuralAI is assigned after speak() is called.
        const getAI = () => window.KuralAI;

        utter.onstart = () => {
            const ai = getAI();
            if (ai) ai._setSpeakingState(true);
        };
        utter.onend = () => {
            const ai = getAI();
            if (ai) ai._setSpeakingState(false, !!onEndCallback);
            if (onEndCallback) onEndCallback();
        };
        utter.onerror = () => {
            const ai = getAI();
            if (ai) ai._setSpeakingState(false, !!onEndCallback);
            if (onEndCallback) onEndCallback();
        };

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
        USER:     ['NAVIGATE', 'SHOW_TAB', 'OPEN_MAP', 'FILTER_ISSUES', 'OPEN_RAISE_ISSUE', 'VOICE_ISSUE_FLOW', 'FILL_ISSUE_FORM', 'SUBMIT_FORM', 'SCROLL_TO', 'OPEN_NOTIFICATIONS', 'SPEAK_ONLY'],
        EMPLOYEE: ['NAVIGATE', 'SHOW_TAB', 'OPEN_MAP', 'FILTER_ISSUES', 'SCROLL_TO', 'OPEN_NOTIFICATIONS', 'SPEAK_ONLY'],
        DEFAULT:  ['ALL'] // admin, dept, collector, mla, cm, commissioner
    };

    function isActionAllowed(action, role) {
        const allowed = ROLE_ALLOWED_ACTIONS[role] || ROLE_ALLOWED_ACTIONS.DEFAULT;
        if (allowed.includes('ALL')) return true;
        return allowed.includes(action);
    }

    /* ─────────────────────────────────────────────────────────
       VOICE ISSUE FLOW — Multi-turn guided conversation
       Collects: title → description → category → location → photo → confirm → submit
    ───────────────────────────────────────────────────────── */
    const VoiceIssueFlow = {
        active: false,
        step: 0,
        data: {},

        steps: [
            {
                key: 'title',
                prompt_en: 'What is the title or main issue? For example: broken road, street light not working.',
                prompt_ta: 'பிரச்சினையின் தலைப்பு என்ன? உதாரணம்: சாலை உடைந்துள்ளது, தெரு விளக்கு வேலை செய்யவில்லை.',
                type: 'speech'
            },
            {
                key: 'description',
                prompt_en: 'Please describe the issue in more detail.',
                prompt_ta: 'பிரச்சினையை விரிவாக விவரிக்கவும்.',
                type: 'speech'
            },
            {
                key: 'category',
                prompt_en: 'Which department is this for? Say: Roads, Sanitation, Electricity, Water, or Law and Order.',
                prompt_ta: 'எந்த துறைக்கு தொடர்புடையது? சொல்லுங்கள்: சாலைகள், சுகாதாரம், மின்சாரம், தண்ணீர், அல்லது சட்டம் மற்றும் ஒழுங்கு.',
                type: 'speech'
            },
            {
                key: 'location',
                prompt_en: 'What is the location? Say the address, or say "current location" to use GPS.',
                prompt_ta: 'இடம் என்ன? முகவரியை சொல்லுங்கள், அல்லது GPS பயன்படுத்த "தற்போதைய இடம்" சொல்லுங்கள்.',
                type: 'speech'
            },
            {
                key: 'photo',
                prompt_en: 'Please upload a photo of the issue by clicking the camera button below. Then say "done" when ready.',
                prompt_ta: 'கீழே உள்ள கேமரா பொத்தானை கிளிக் செய்து புகைப்படம் பதிவேற்றவும். தயாரானதும் "முடிந்தது" என்று சொல்லுங்கள்.',
                type: 'confirm_upload'
            },
            {
                key: 'confirm',
                prompt_en: null,
                prompt_ta: null,
                type: 'confirm'
            }
        ],

        categoryMap: {
            'road': 'Roads', 'roads': 'Roads', 'pothole': 'Roads', 'pavement': 'Roads', 'சாலை': 'Roads', 'சாலைகள்': 'Roads',
            'sanitation': 'Sanitation', 'garbage': 'Sanitation', 'waste': 'Sanitation', 'trash': 'Sanitation', 'சுகாதாரம்': 'Sanitation', 'குப்பை': 'Sanitation',
            'electricity': 'Electricity', 'electric': 'Electricity', 'light': 'Electricity', 'power': 'Electricity', 'மின்சாரம்': 'Electricity', 'விளக்கு': 'Electricity',
            'water': 'Water', 'pipe': 'Water', 'leak': 'Water', 'borewell': 'Water', 'தண்ணீர்': 'Water', 'குழாய்': 'Water',
            'law': 'Law & Order', 'police': 'Law & Order', 'crime': 'Law & Order', 'சட்டம்': 'Law & Order', 'காவல்': 'Law & Order',
        },

        start(kuralInstance) {
            this.active = true;
            this.step = 0;
            this.data = {};
            this._kural = kuralInstance;
            this._renderFlowUI();
            this._askCurrentStep();
        },

        cancel() {
            this.active = false;
            this.step = 0;
            this.data = {};
            this._kural = null;
            this._hideFlowUI();
        },

        _getStep() {
            return this.steps[this.step];
        },

        _askCurrentStep() {
            if (!this.active) return;
            const s = this._getStep();
            if (!s) { this._doSubmit(); return; }

            let prompt;
            if (s.key === 'confirm') {
                prompt = this._buildConfirmPrompt();
            } else {
                prompt = activeLang === 'ta' ? s.prompt_ta : s.prompt_en;
            }

            this._renderFlowProgress();
            this._kural._addLog('ai', prompt, null);
            const lang = getSpeechLang();
            speak(prompt, lang, () => {
                if (s.type === 'confirm_upload') {
                    this._highlightUploadButton();
                    this._kural.startListening();
                } else {
                    this._kural.startListening();
                }
            });
        },

        handleFlowInput(text) {
            if (!this.active) return false;
            const s = this._getStep();
            if (!s) return false;

            const lower = text.toLowerCase().trim();

            if (['cancel', 'stop', 'quit', 'நிறுத்து', 'ரத்து'].some(w => lower.includes(w))) {
                const msg = activeLang === 'ta'
                    ? 'பிரச்சினை பதிவு ரத்து செய்யப்பட்டது.'
                    : 'Issue reporting cancelled.';
                this._kural._addLog('ai', msg, null);
                speak(msg, getSpeechLang());
                this.cancel();
                return true;
            }

            if (s.key === 'confirm') {
                const isYes = ['yes', 'ஆம்', 'சரி', 'confirm', 'submit', 'proceed', 'ஆமாம்', 'okay', 'ok'].some(w => lower.includes(w));
                const isNo  = ['no', 'இல்லை', 'cancel', 'ரத்து', 'nope'].some(w => lower.includes(w));
                if (isYes) { this._doSubmit(); return true; }
                if (isNo) {
                    const msg = activeLang === 'ta'
                        ? 'பிரச்சினை பதிவு ரத்து செய்யப்பட்டது.'
                        : 'Issue reporting cancelled.';
                    this._kural._addLog('ai', msg, null);
                    speak(msg, getSpeechLang());
                    this.cancel();
                    return true;
                }
                this._askCurrentStep();
                return true;
            }

            if (s.key === 'photo') {
                const isDone = ['done', 'முடிந்தது', 'ready', 'uploaded', 'yes', 'ஆம்', 'ok', 'okay'].some(w => lower.includes(w));
                if (isDone) { this.step++; this._askCurrentStep(); return true; }
                this._askCurrentStep();
                return true;
            }

            if (s.key === 'location') {
                const isCurrentLoc = ['current location', 'my location', 'gps', 'current', 'தற்போதைய இடம்', 'என் இடம்'].some(w => lower.includes(w));
                if (isCurrentLoc) {
                    this._getGPSLocation((locStr) => {
                        this.data.location = locStr;
                        this._updateFlowFieldUI('location', locStr);
                        this.step++;
                        this._askCurrentStep();
                    });
                    return true;
                }
            }

            if (s.key === 'category') {
                const mapped = this._mapCategory(lower);
                this.data.category = mapped;
                this._updateFlowFieldUI('category', mapped);
            } else if (s.key !== 'photo') {
                this.data[s.key] = text.trim();
                this._updateFlowFieldUI(s.key, text.trim());
            }

            this.step++;
            this._askCurrentStep();
            return true;
        },

        _mapCategory(text) {
            for (const [key, val] of Object.entries(this.categoryMap)) {
                if (text.includes(key)) return val;
            }
            return 'General';
        },

        _buildConfirmPrompt() {
            const d = this.data;
            if (activeLang === 'ta') {
                return `சரி, விவரங்களை உறுதிப்படுத்துகிறேன்: ` +
                    `தலைப்பு: ${d.title || '-'}. ` +
                    `விவரம்: ${d.description || '-'}. ` +
                    `வகை: ${d.category || 'பொது'}. ` +
                    `இடம்: ${d.location || '-'}. ` +
                    `சமர்ப்பிக்கவா? "ஆம்" அல்லது "இல்லை" சொல்லுங்கள்.`;
            }
            return `Confirming: Title: ${d.title || '-'}. ` +
                `Description: ${d.description || '-'}. ` +
                `Category: ${d.category || 'General'}. ` +
                `Location: ${d.location || '-'}. ` +
                `Shall I submit? Say yes or no.`;
        },

        _doSubmit() {
            const d = this.data;
            KuralActionHandler._openRaiseIssue({
                title: d.title,
                category: d.category,
                description: d.description,
                location: d.location
            });
            setTimeout(() => {
                KuralActionHandler._prefillIssueForm({
                    title: d.title,
                    category: d.category,
                    description: d.description,
                    location: d.location
                });
            }, 800);
            const msg = activeLang === 'ta'
                ? 'படிவம் நிரப்பப்பட்டது. சமர்ப்பிக்க சமர்ப்பிக்கவும் பொத்தானை கிளிக் செய்யவும்.'
                : 'Form filled. Please click Submit to complete your report.';
            this._kural._addLog('ai', msg, 'SUBMIT_FORM');
            speak(msg, getSpeechLang());
            this.cancel();
        },

        _getGPSLocation(callback) {
            const loadingMsg = activeLang === 'ta'
                ? 'GPS இடம் கண்டுபிடிக்கிறேன்...'
                : 'Getting your GPS location...';
            this._kural._addLog('ai', loadingMsg, null);
            if (!navigator.geolocation) {
                callback(activeLang === 'ta' ? 'இடம் கண்டுபிடிக்க முடியவில்லை' : 'Location unavailable');
                return;
            }
            navigator.geolocation.getCurrentPosition(
                (pos) => callback(`${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`),
                () => callback(activeLang === 'ta' ? 'இடம் கண்டுபிடிக்க முடியவில்லை' : 'Location unavailable'),
                { timeout: 6000 }
            );
        },

        _highlightUploadButton() {
            const uploadEl = document.getElementById('issue-image')
                || document.getElementById('report-image')
                || document.getElementById('image-upload')
                || document.querySelector('input[type="file"]');
            if (uploadEl) {
                uploadEl.style.outline = '3px solid #f59e0b';
                uploadEl.style.outlineOffset = '4px';
                setTimeout(() => { uploadEl.style.outline = ''; uploadEl.style.outlineOffset = ''; }, 6000);
            }
        },

        _renderFlowUI() {
            const panel = document.getElementById('kural-flow-steps');
            if (!panel) return;
            panel.classList.add('active');
            const title = panel.querySelector('.kural-flow-title');
            if (title) title.textContent = activeLang === 'ta' ? '🚨 பிரச்சினை பதிவு' : '🚨 Issue Reporting';
            const collected = panel.querySelector('.kural-flow-collected');
            if (collected) collected.innerHTML = '';
            this._renderFlowProgress();
        },

        _hideFlowUI() {
            const panel = document.getElementById('kural-flow-steps');
            if (panel) panel.classList.remove('active');
        },

        _renderFlowProgress() {
            const prog = document.getElementById('kural-flow-progress');
            if (!prog) return;
            prog.innerHTML = '';
            this.steps.forEach((s, i) => {
                const dot = document.createElement('div');
                dot.className = 'kural-flow-dot';
                if (i < this.step) dot.classList.add('done');
                if (i === this.step) dot.classList.add('current');
                prog.appendChild(dot);
            });
            const label = document.getElementById('kural-flow-label');
            if (label && this.steps[this.step]) {
                const en = ['Title', 'Description', 'Category', 'Location', 'Photo', 'Confirm'];
                const ta = ['தலைப்பு', 'விவரம்', 'வகை', 'இடம்', 'புகைப்படம்', 'உறுதிப்படுத்தல்'];
                const labels = activeLang === 'ta' ? ta : en;
                label.textContent = `${this.step + 1}/${this.steps.length}: ${labels[this.step] || ''}`;
            }
        },

        _updateFlowFieldUI(key, value) {
            const collected = document.querySelector('.kural-flow-collected');
            if (!collected) return;
            const en = { title: 'Title', description: 'Desc', category: 'Category', location: 'Location' };
            const ta = { title: 'தலைப்பு', description: 'விவரம்', category: 'வகை', location: 'இடம்' };
            const labels = activeLang === 'ta' ? ta : en;
            let el = collected.querySelector(`[data-field="${key}"]`);
            if (!el) {
                el = document.createElement('div');
                el.className = 'kural-flow-field';
                el.setAttribute('data-field', key);
                collected.appendChild(el);
            }
            el.innerHTML = `<strong>${labels[key] || key}:</strong> <span>${value}</span>`;
        }
    };

    /* ─────────────────────────────────────────────────────────
       ACTION HANDLER
       Executes actions returned by the AI backend.
       Only calls existing page functions / DOM APIs.
    ───────────────────────────────────────────────────────── */
    const KuralActionHandler = {

        execute(action, voiceMessage) {
            const role = getCurrentUserRole() || 'USER';
            if (!isActionAllowed(action.action, role)) {
                console.warn('[Kural AI] Action blocked by role guard:', action.action, 'role:', role);
                return;
            }
            switch (action.action) {
                case 'NAVIGATE':           this._navigate(action.page); break;
                case 'SHOW_TAB':           this._showTab(action.tabName); break;
                case 'OPEN_MAP':           this._openMap(action.payload); break;
                case 'OPEN_ANALYTICS':     this._openAnalytics(action.payload); break;
                case 'FILTER_ISSUES':      this._filterIssues(action); break;
                case 'TRIGGER_DOWNLOAD':   this._triggerDownload(action); break;
                case 'OPEN_RAISE_ISSUE':   this._openRaiseIssue(action); break;
                case 'VOICE_ISSUE_FLOW':
                    if (window.KuralAI) setTimeout(() => VoiceIssueFlow.start(window.KuralAI), 600);
                    break;
                case 'FILL_ISSUE_FORM':    this._fillIssueForm(action); break;
                case 'SUBMIT_FORM':        this._submitForm(action); break;
                case 'SCROLL_TO':          this._scrollTo(action.target); break;
                case 'OPEN_NOTIFICATIONS': this._openNotifications(); break;
                case 'ASSIGN_ISSUE':       this._assignIssue(action); break;
                case 'SPEAK_ONLY':         break;
                default:
                    console.warn('[Kural AI] Unknown action:', action.action);
            }
        },

        _navigate(page) {
            if (!page) return;
            const pageMap = {
                'dashboard': 'citizen-dashboard.html', 'citizen': 'citizen-dashboard.html',
                'department': 'department-dashboard.html', 'employee': 'employee-dashboard.html',
                'collector': 'collector-dashboard.html', 'admin': 'admin-dashboard.html',
                'mla': 'mla-dashboard.html', 'cm': 'cm-dashboard.html',
                'commissioner': 'commissioner-dashboard.html',
            };
            const resolved = pageMap[page.toLowerCase().replace(/-dashboard\.html$/, '').trim()] || page;
            const base = window.location.pathname.replace(/[^/]*$/, '');
            setTimeout(() => { window.location.href = base + resolved; }, 600);
        },

        _showTab(tabName) {
            if (!tabName) return;
            const name = tabName.toLowerCase().trim();
            if (typeof window.switchTab === 'function') {
                try { window.switchTab(name); return; } catch (e) {}
            }
            for (const id of [`tab-${name}-btn`, `tab-${name}`, `btn-${name}`, `nav-${name}`, `drawer-${name}`]) {
                const el = document.getElementById(id);
                if (el) { el.click(); return; }
            }
            for (const id of [`nav-${name}`, `nav-${name}-link`, `drawer-${name}-link`]) {
                const el = document.getElementById(id);
                if (el) { el.click(); return; }
            }
            const dataTabEl = document.querySelector(`[data-tab="${name}"]`);
            if (dataTabEl) { dataTabEl.click(); return; }
            const dataSectionEl = document.querySelector(`[data-section="${name}"]`);
            if (dataSectionEl) { dataSectionEl.click(); return; }
            const hrefEl = document.querySelector(`[href="#${name}"]`);
            if (hrefEl) { hrefEl.click(); return; }
            const match = Array.from(document.querySelectorAll(
                'button, a, li, [role="tab"], .nav-link-item, .sidebar-item, .tab-btn, .tab-item, .mobile-drawer-link'
            )).find(el => {
                const text = el.textContent.trim().toLowerCase();
                return text === name || text.startsWith(name) || name.includes(text.split(/\s+/)[0]);
            });
            if (match) { match.click(); match.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
        },

        _openMap(payload) {
            if (typeof window.switchTab === 'function') {
                try { window.switchTab('map'); return; } catch (e) {}
            }
            this._showTab('map');
        },

        _openAnalytics(payload) {
            if (typeof window.switchTab === 'function') {
                try { window.switchTab('analytics'); return; } catch (e) {}
            }
            this._showTab('analytics');
        },

        _filterIssues(action) {
            const detail = {
                priority: action.priority || null, status: action.status || null,
                dateRange: action.dateRange || null, clearAll: action.clearAll || false
            };
            window.dispatchEvent(new CustomEvent('kural:filterIssues', { detail }));
            window.dispatchEvent(new CustomEvent('nayagan:filterIssues', { detail }));
            this._applyFilterDirectly(detail);
        },

        _applyFilterDirectly(detail) {
            if (detail.clearAll) {
                const ss = document.getElementById('status-filter') || document.querySelector('select[name="status"]');
                if (ss) { ss.value = ''; ss.dispatchEvent(new Event('change')); }
                const ps = document.getElementById('filter-priority') || document.querySelector('select[name="priority"]');
                if (ps) { ps.value = ''; ps.dispatchEvent(new Event('change')); }
                document.querySelectorAll('.map-pill[data-filter-val=""]').forEach(b => b.click());
                document.querySelectorAll('[data-filter="all"]').forEach(e => e.click());
                return;
            }
            if (detail.dateRange) this._setDateRange(detail.dateRange);
            if (detail.status) {
                const s = detail.status.toUpperCase();
                const statusSel = document.getElementById('status-filter') || document.querySelector('#filter-status, select[name="status"]');
                if (statusSel) {
                    const opt = Array.from(statusSel.options).find(o => o.value.toUpperCase() === s || o.text.toUpperCase().replace(/[\s_-]/g, '_') === s);
                    if (opt) { statusSel.value = opt.value; statusSel.dispatchEvent(new Event('change')); statusSel.dispatchEvent(new Event('input')); }
                }
                const statusBtn = document.querySelector(`[data-status="${s}"], [data-filter="status-${s}"], [data-value="${s}"]`) || this._findButtonByText(s.replace(/_/g, ' '));
                if (statusBtn) statusBtn.click();
            }
            if (detail.priority) {
                const p = detail.priority;
                const pLower = p.toLowerCase();
                const pCap = p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
                const prioritySel = document.getElementById('filter-priority') || document.querySelector('select[name="priority"]');
                if (prioritySel) {
                    const opt = Array.from(prioritySel.options).find(o => o.value.toUpperCase() === p.toUpperCase() || o.text.toLowerCase() === pLower);
                    if (opt) { prioritySel.value = opt.value; prioritySel.dispatchEvent(new Event('change')); prioritySel.dispatchEvent(new Event('input')); }
                }
                const mapPill = document.querySelector(`.map-pill[data-filter-type="priority"][data-filter-val="${pLower}"]`);
                if (mapPill) mapPill.click();
                const priorityBtn = document.querySelector(`[data-priority="${p.toUpperCase()}"], [data-priority="${pCap}"], [data-filter="priority-${pLower}"]`)
                    || this._findButtonByText(pCap) || this._findButtonByText(pLower);
                if (priorityBtn && priorityBtn !== prioritySel) priorityBtn.click();
            }
        },

        _triggerDownload(action) {
            const format = (action.format || 'excel').toLowerCase();
            const dateRange = action.dateRange || null;
            if (action.priority || action.status || dateRange) {
                this._applyFilterDirectly({ priority: action.priority || null, status: action.status || null, dateRange, clearAll: false });
            }
            if (dateRange) this._setDateRange(dateRange);
            setTimeout(() => {
                if (format === 'excel' || format === 'xlsx') {
                    const eb = document.getElementById('download-excel-btn') || document.querySelector('[data-export="excel"], .export-excel, .btn-excel');
                    if (eb) { eb.click(); return; }
                    const m = document.getElementById('download-reports-modal');
                    if (m) { m.classList.add('open'); return; }
                }
                if (format === 'pdf') {
                    const pb = document.getElementById('download-pdf-btn') || document.querySelector('#export-pdf, .export-pdf, [data-export="pdf"], .btn-pdf');
                    if (pb) { pb.click(); return; }
                }
                const any = document.querySelector('.download-btn, #download-report, [data-action="download"], .report-download')
                    || this._findButtonByText('download') || this._findButtonByText('export');
                if (any) any.click();
            }, action.priority || action.status ? 600 : 0);
        },

        _setDateRange(dateRange) {
            const today = new Date();
            let fromDate = today, toDate = today;
            if (dateRange === 'this_week') { fromDate = new Date(today); fromDate.setDate(today.getDate() - today.getDay()); }
            else if (dateRange === 'last_week') {
                fromDate = new Date(today); fromDate.setDate(today.getDate() - today.getDay() - 7);
                toDate = new Date(today); toDate.setDate(today.getDate() - today.getDay() - 1);
            } else if (dateRange === 'this_month') { fromDate = new Date(today.getFullYear(), today.getMonth(), 1); }
            const fmt = d => d.toISOString().split('T')[0];
            const fromEl = document.querySelector('#date-from, #start-date, #from-date, input[name="from"]');
            const toEl   = document.querySelector('#date-to, #end-date, #to-date, input[name="to"]');
            if (fromEl) { fromEl.value = fmt(fromDate); fromEl.dispatchEvent(new Event('change')); }
            if (toEl)   { toEl.value   = fmt(toDate);   toEl.dispatchEvent(new Event('change')); }
        },

        _openRaiseIssue(action) {
            const raiseBtn = document.getElementById('report-btn') || document.getElementById('raise-issue-btn')
                || document.getElementById('btn-raise-issue') || document.getElementById('new-issue-btn')
                || document.querySelector('[data-action="raise-issue"]') || this._findButtonByText('report issue')
                || this._findButtonByText('raise issue') || this._findButtonByText('new issue')
                || this._findButtonByText('+ report') || this._findButtonByText('report');
            if (raiseBtn) {
                raiseBtn.click();
                if (action.title || action.category || action.description) setTimeout(() => this._prefillIssueForm(action), 500);
            } else { this._navigate('citizen-dashboard.html'); }
        },

        _fillIssueForm(action) {
            const modal = document.getElementById('report-modal');
            const isOpen = modal && (modal.classList.contains('open') || modal.style.display === 'flex' || modal.style.display === 'block');
            if (!isOpen) {
                const btn = document.getElementById('report-btn') || document.getElementById('raise-issue-btn')
                    || this._findButtonByText('report') || this._findButtonByText('raise issue');
                if (btn) { btn.click(); setTimeout(() => this._prefillIssueForm(action), 600); }
                else { sessionStorage.setItem('kural_pending_fill', JSON.stringify(action)); this._navigate('citizen-dashboard.html'); }
            } else { this._prefillIssueForm(action); }
        },

        _prefillIssueForm(action) {
            const titleEl = document.getElementById('issue-title') || document.querySelector('input[name="title"], #complaint-title');
            if (titleEl && action.title) {
                titleEl.value = action.title;
                titleEl.dispatchEvent(new Event('input', { bubbles: true }));
                titleEl.dispatchEvent(new Event('change', { bubbles: true }));
                titleEl.style.borderColor = '#0f766e';
                setTimeout(() => { titleEl.style.borderColor = ''; }, 2000);
            }
            const catEl = document.getElementById('issue-category') || document.querySelector('select[name="category"], #category-select');
            if (catEl && action.category) {
                const opt = Array.from(catEl.options).find(o =>
                    o.value.toLowerCase().includes(action.category.toLowerCase()) || o.text.toLowerCase().includes(action.category.toLowerCase())
                );
                if (opt) { catEl.value = opt.value; catEl.dispatchEvent(new Event('change', { bubbles: true })); }
            }
            const descEl = document.getElementById('issue-desc') || document.querySelector('textarea[name="description"], #complaint-desc, #issue-description');
            if (descEl && action.description) {
                descEl.value = action.description;
                descEl.dispatchEvent(new Event('input', { bubbles: true }));
                descEl.dispatchEvent(new Event('change', { bubbles: true }));
                descEl.style.borderColor = '#0f766e';
                setTimeout(() => { descEl.style.borderColor = ''; }, 2000);
            }
            const locEl = document.getElementById('issue-location') || document.querySelector('input[name="location"], #location-input');
            if (locEl && action.location) {
                locEl.value = action.location;
                locEl.dispatchEvent(new Event('input', { bubbles: true }));
                locEl.dispatchEvent(new Event('change', { bubbles: true }));
                locEl.style.borderColor = '#0f766e';
                setTimeout(() => { locEl.style.borderColor = ''; }, 2000);
            }
            const issueToggle = document.getElementById('toggle-issue');
            if (issueToggle) issueToggle.click();
        },

        _submitForm(action) {
            const submitBtn = document.getElementById('submit-issue-btn') || document.getElementById('submit-report-btn')
                || document.getElementById('report-submit-btn') || document.querySelector('form#report-form button[type="submit"]')
                || document.querySelector('#report-modal button[type="submit"]')
                || document.querySelector('.submit-issue-btn, .report-submit, [data-action="submit-issue"]')
                || this._findButtonByText('submit issue') || this._findButtonByText('submit complaint') || this._findButtonByText('submit');
            if (submitBtn) { submitBtn.click(); }
            else {
                const form = document.querySelector('#report-modal form, form.issue-form, form#issue-form');
                if (form) form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
            }
        },

        _scrollTo(target) {
            if (!target) { window.scrollBy({ top: 300, behavior: 'smooth' }); return; }
            const t = target.toLowerCase().trim();
            if (t === 'top') { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
            if (t === 'bottom') { window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); return; }
            for (const id of [t, `${t}-section`, `section-${t}`, `${t}-container`, `${t}-wrapper`, `${t}-panel`, `${t}-area`]) {
                const el = document.getElementById(id);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    el.style.outline = '2px solid #0f766e'; el.style.outlineOffset = '4px';
                    setTimeout(() => { el.style.outline = ''; el.style.outlineOffset = ''; }, 2500);
                    return;
                }
            }
            const classEl = document.querySelector(`.${t}-section, .${t}-container, [data-section="${t}"], [data-tab="${t}"]`);
            if (classEl) { classEl.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
            const matchH = Array.from(document.querySelectorAll('h1, h2, h3, h4, .section-title, .card-title'))
                .find(h => h.textContent.trim().toLowerCase().includes(t));
            if (matchH) { matchH.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
            window.scrollBy({ top: window.innerHeight * 0.8, behavior: 'smooth' });
        },

        _openNotifications() {
            const btn = document.getElementById('notification-btn') || document.getElementById('notif-btn')
                || document.getElementById('notifications-btn') || document.getElementById('bell-btn')
                || document.querySelector('[data-action="notifications"], [data-panel="notifications"]')
                || document.querySelector('.notification-bell, .notif-btn, .bell-icon, #notification-icon')
                || document.querySelector('[aria-label="Notifications"], [aria-label="notifications"]')
                || this._findButtonByText('notification') || this._findButtonByText('notifications');
            if (btn) { btn.click(); return; }
            this._showTab('notifications');
        },

        _assignIssue(action) {
            const btn = document.getElementById('assign-btn') || document.getElementById('assign-issue-btn')
                || document.getElementById('assignment-btn')
                || document.querySelector('[data-action="assign"], .assign-btn, .btn-assign')
                || this._findButtonByText('assign');
            if (btn) { btn.click(); return; }
            const modal = document.getElementById('assign-modal') || document.getElementById('assignment-modal');
            if (modal) { modal.classList.add('open'); modal.style.display = 'flex'; }
        },

        _findButtonByText(text) {
            const low = text.toLowerCase().trim();
            return Array.from(document.querySelectorAll('button, .btn, [role="button"], a.btn'))
                .find(b => b.textContent.trim().toLowerCase().includes(low)) || null;
        }
    };

    /* ═══════════════════════════════════════════════════════
       MAIN KURAL AI CLASS
       Root-cause fixes applied (see comments with FIX:)
    ═══════════════════════════════════════════════════════ */
    class KuralVoiceAssistant {
        constructor() {
            this.isOpen          = false;
            this.isListening     = false;
            this.isProcessing    = false;
            this.isSpeaking      = false;
            this.isExternallyPaused = false;

            // FIX: Single wake recognition instance (not two simultaneous).
            //      Chrome allows only ONE SpeechRecognition per tab.
            //      We alternate between en-IN / ta-IN based on activeLang,
            //      and also scan romanized Tamil in the en-IN transcript.
            this._wakeRecognition = null;
            this._wakeActive      = false;   // true while .start() has been called
            this._wakeRestarting  = false;   // debounce flag to prevent double-restart

            // FIX: Wake word detected mutex — prevents double-trigger.
            this._wakeDetectedLock = false;

            this.commandRecognition = null;
            this.voicesLoaded = false;

            if (window.speechSynthesis) {
                window.speechSynthesis.onvoiceschanged = () => { this.voicesLoaded = true; };
                window.speechSynthesis.getVoices();
            }

            this._injectHTML();
            this._bindEvents();

            // FIX: Assign window.KuralAI BEFORE starting wake listeners so that
            //      the speak() onstart/onend callbacks can reference it.
            window.KuralAI  = this;
            window.NayaganAI = this;

            this._startWakeListen();
            this._checkPendingFill();

            console.log('[Kural AI] v4.1 initialized. Wake listener started.');
        }

        /* ── Pending form fill after page navigation ── */
        _checkPendingFill() {
            const pending = sessionStorage.getItem('kural_pending_fill');
            if (pending) {
                sessionStorage.removeItem('kural_pending_fill');
                try {
                    const action = JSON.parse(pending);
                    setTimeout(() => {
                        KuralActionHandler._fillIssueForm(action);
                        speak(
                            activeLang === 'ta' ? 'படிவம் நிரப்பப்பட்டது. புகைப்படம் பதிவேற்றவும்.' : 'Form filled. Please upload a photo.',
                            getSpeechLang()
                        );
                    }, 1500);
                } catch (e) {}
            }
        }

        /* ──────────────────────────────────────────────────
           INJECT HTML UI
        ─────────────────────────────────────────────────── */
        _injectHTML() {
            const launcher = document.createElement('button');
            launcher.className = 'kural-launcher';
            launcher.id = 'kural-launcher';
            launcher.setAttribute('aria-label', 'Kural AI Voice Assistant');
            launcher.innerHTML = `${this._micSVG()}<span class="kural-tooltip">Kural AI</span>`;

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
                    <div class="kural-lang-toggle" id="kural-lang-toggle">
                        <button class="kural-lang-btn ${activeLang === 'en' ? 'active' : ''}" id="kural-lang-en" title="English Mode">EN</button>
                        <button class="kural-lang-btn ${activeLang === 'ta' ? 'active' : ''}" id="kural-lang-ta" title="Tamil Mode">தமிழ்</button>
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

                <div class="kural-hint" id="kural-hint">
                    Wake word: <span class="kural-hint-chip">${activeLang === 'ta' ? 'வணக்கம் குரல்' : 'Hey Kural'}</span>
                </div>

                <div class="kural-flow-steps" id="kural-flow-steps">
                    <div class="kural-flow-title">🚨 Issue Reporting</div>
                    <div class="kural-flow-progress" id="kural-flow-progress"></div>
                    <div class="kural-flow-label" id="kural-flow-label"></div>
                    <div class="kural-flow-collected"></div>
                </div>

                <div class="kural-quick-chips" id="kural-quick-chips">
                    <button class="kural-chip" data-cmd="Open dashboard">🏠 Dashboard</button>
                    <button class="kural-chip" data-cmd="Show analytics">📊 Analytics</button>
                    <button class="kural-chip" data-cmd="Report an issue by voice">🚨 Voice Issue</button>
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
                    <input type="text" class="kural-text-input" id="kural-text-input"
                        placeholder="Type a command..." autocomplete="off" />
                    <button class="kural-send-btn" id="kural-send-btn" title="Send command">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="22" y1="2" x2="11" y2="13"/>
                            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                        </svg>
                    </button>
                </div>
            `;

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
            const map = {
                USER: 'Citizen Dashboard Agent', EMPLOYEE: 'Employee Dashboard Agent',
                TAMILNADU_CORPORATION: 'Department Control Agent', TNEB: 'Department Control Agent',
                POLICE: 'Department Control Agent', COLLECTOR: 'Collector Control Agent',
                ADMIN: 'Admin Control Agent', MLA: 'MLA Control Agent',
                CM: 'CM Control Agent', COMMISSIONER: 'Commissioner Control Agent',
            };
            const el = document.getElementById('kural-role-label');
            if (el && role) el.textContent = map[role] || 'Website Control Agent';
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

            document.getElementById('kural-lang-en').addEventListener('click', () => {
                setActiveLang('en');
                const msg = 'Switched to English mode. How can I help you?';
                this._addLog('ai', msg, null);
                speak(msg, LANG_EN, () => this._scheduleWakeRestart());
            });

            document.getElementById('kural-lang-ta').addEventListener('click', () => {
                setActiveLang('ta');
                const msg = 'தமிழ் பயன்முறைக்கு மாறினோம். உங்களுக்கு என்ன உதவி வேண்டும்?';
                this._addLog('ai', msg, null);
                speak(msg, LANG_TA, () => this._scheduleWakeRestart());
            });

            const textInput = document.getElementById('kural-text-input');
            const sendBtn   = document.getElementById('kural-send-btn');
            sendBtn.addEventListener('click', () => this._sendTextCommand());
            textInput.addEventListener('keydown', e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this._sendTextCommand(); }
            });

            document.getElementById('kural-quick-chips').addEventListener('click', e => {
                const chip = e.target.closest('.kural-chip');
                if (chip?.dataset.cmd) {
                    if (!this.isOpen) this.openPanel();
                    this._processCommand(chip.dataset.cmd);
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
        togglePanel() { this.isOpen ? this.closePanel() : this.openPanel(); }

        openPanel() {
            this.isOpen = true;
            const panel = document.getElementById('kural-panel');
            panel.style.display = 'flex';
            setTimeout(() => panel.classList.add('open'), 10);

            const hasGreeted = sessionStorage.getItem('kural_greeted');
            if (!hasGreeted) {
                sessionStorage.setItem('kural_greeted', '1');
                const greeting = activeLang === 'ta' ? GREETING_TA : GREETING_EN;
                setTimeout(() => {
                    this._addLog('ai', greeting, null);
                    speak(greeting, getSpeechLang(), () => {
                        // Auto-listen after greeting completes
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
            if (VoiceIssueFlow.active) VoiceIssueFlow.cancel();
        }

        /* ── Status UI ── */
        _setStatus(state, text) {
            const dot      = document.getElementById('kural-status-dot');
            const statTxt  = document.getElementById('kural-status-text');
            const waveform = document.getElementById('kural-waveform');
            const launcher = document.getElementById('kural-launcher');
            const micBtn   = document.getElementById('kural-mic-btn');
            const micLabel = document.getElementById('kural-mic-label');

            if (dot)    dot.className = `kural-status-dot ${state}`;
            if (statTxt) statTxt.textContent = text;

            if (state === 'listening') {
                waveform?.classList.add('active');
                launcher?.classList.add('listening');
                launcher?.classList.remove('processing');
                micBtn?.classList.add('active');
                if (micLabel) micLabel.textContent = activeLang === 'ta' ? 'நிறுத்து' : 'Stop Listening';
            } else if (state === 'processing') {
                waveform?.classList.remove('active');
                launcher?.classList.remove('listening');
                launcher?.classList.add('processing');
                micBtn?.classList.remove('active');
                if (micLabel) micLabel.textContent = activeLang === 'ta' ? 'செயல்படுகிறது...' : 'Processing...';
            } else if (state === 'speaking') {
                waveform?.classList.add('active');
                launcher?.classList.remove('listening', 'processing');
                micBtn?.classList.remove('active');
                if (micLabel) micLabel.textContent = activeLang === 'ta' ? 'பேசுகிறது...' : 'Speaking...';
            } else {
                waveform?.classList.remove('active');
                launcher?.classList.remove('listening', 'processing');
                micBtn?.classList.remove('active');
                if (micLabel) micLabel.textContent = activeLang === 'ta' ? 'கேட்க தொடங்கு' : 'Start Listening';
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
            const msg    = document.createElement('div');
            msg.className = `kural-log-msg ${type === 'user' ? 'user-msg' : 'ai-msg'}`;
            const bubble = document.createElement('div');
            bubble.className = 'kural-log-bubble';
            if (actionType && actionType !== 'SPEAK_ONLY') {
                const badge = document.createElement('span');
                badge.className = 'kural-action-badge';
                badge.textContent = this._getActionBadgeLabel(actionType);
                bubble.appendChild(badge);
                bubble.appendChild(document.createElement('br'));
            }
            bubble.appendChild(document.createTextNode(text));
            msg.appendChild(bubble);
            log.appendChild(msg);
            log.scrollTop = log.scrollHeight;
        }

        _getActionBadgeLabel(action) {
            return ({
                'NAVIGATE': '🔀 Navigate', 'SHOW_TAB': '📂 Tab Switch', 'OPEN_MAP': '🗺️ Map',
                'OPEN_ANALYTICS': '📊 Analytics', 'FILTER_ISSUES': '🔍 Filter',
                'OPEN_RAISE_ISSUE': '🚨 Open Form', 'VOICE_ISSUE_FLOW': '🎙️ Voice Flow',
                'FILL_ISSUE_FORM': '✍️ Form Fill', 'SUBMIT_FORM': '✅ Submit',
                'TRIGGER_DOWNLOAD': '⬇️ Download', 'SCROLL_TO': '📜 Scroll',
                'OPEN_NOTIFICATIONS': '🔔 Notifications', 'ASSIGN_ISSUE': '👤 Assign',
            })[action] || `⚡ ${action}`;
        }

        clearLog() {
            const log = document.getElementById('kural-log');
            if (log) log.innerHTML = '';
            this._setTranscript(activeLang === 'ta' ? 'பேசுங்கள் அல்லது கட்டளை தட்டச்சு செய்யுங்கள்...' : 'Speak or type a command...', true);
            sessionStorage.removeItem('kural_greeted');
            if (VoiceIssueFlow.active) VoiceIssueFlow.cancel();
        }

        _showToast(text) {
            const toast = document.getElementById('kural-toast');
            if (!toast) return;
            toast.textContent = text;
            toast.classList.add('show');
            clearTimeout(this._toastTimer);
            this._toastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
        }

        /* ══════════════════════════════════════════════════
           WAKE WORD DETECTION — Root-cause fixed version
           
           FIX 1: Single SpeechRecognition instance (not two).
                  Chrome enforces one recognition per tab.
           FIX 2: Uses en-IN lang (picks up both English AND
                  romanized Vanakkam Kural naturally).
                  The ta-IN recognizer is not parallel; we switch
                  its lang dynamically when language mode changes.
           FIX 3: _wakeDetectedLock mutex prevents double-fire.
           FIX 4: Restart only from onend, not from stopListening().
           FIX 5: _scheduleWakeRestart uses a flag to prevent
                  concurrent restarts.
        ══════════════════════════════════════════════════ */
        _startWakeListen() {
            const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SR) {
                console.warn('[Kural AI] SpeechRecognition not supported. Wake word disabled.');
                return;
            }

            // Abort any existing instance cleanly
            if (this._wakeRecognition) {
                try { this._wakeRecognition.abort(); } catch (e) {}
                this._wakeRecognition = null;
            }

            this._wakeActive = false;
            this._wakeDetectedLock = false;

            const rec = new SR();
            rec.continuous       = true;
            rec.interimResults   = false;
            // FIX: Always use en-IN — Chrome en-IN recognizes "vanakkam kural" well.
            //      If user is in Tamil mode and speaks Tamil script, the ta-IN switch
            //      happens for command recognition (startListening), not here.
            rec.lang             = LANG_EN;
            rec.maxAlternatives  = 1;

            rec.onstart = () => {
                this._wakeActive = true;
                this._wakeRestarting = false;
                console.log('[Kural AI] Wake listener started (lang: en-IN, scanning EN + romanized TA).');
            };

            rec.onresult = (e) => {
                // FIX: Guard against processing while already triggered
                if (this._wakeDetectedLock) return;
                if (this.isListening || this.isProcessing || this.isSpeaking) return;

                const result    = e.results[e.results.length - 1];
                const rawText   = result[0].transcript;
                const transcript = rawText.toLowerCase()
                    .replace(/[^\w\s\u0B80-\u0BFF]/g, '') // strip punctuation, keep Tamil chars
                    .replace(/\s+/g, ' ')
                    .trim();

                console.log('[Kural AI] Wake scan transcript:', transcript);

                // Check English wake words
                const isEN = WAKE_WORDS_EN.some(ww => transcript.includes(ww));
                // Check Tamil romanized wake words
                const isTA_Roman = WAKE_WORDS_TA_ROMAN.some(ww => transcript.includes(ww));
                // Check Tamil script wake words (en-IN recognition may still capture them)
                const isTA_Script = WAKE_WORDS_TA_SCRIPT.some(ww => transcript.includes(ww));
                const isTA = isTA_Roman || isTA_Script;

                if (isEN || isTA) {
                    const detectedLang = isTA ? 'ta' : 'en';
                    console.log('[Kural AI] Wake word detected! detectedLang:', detectedLang, '| transcript:', transcript);
                    this._onWakeWordDetected(detectedLang);
                }
            };

            rec.onerror = (e) => {
                this._wakeActive = false;
                if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
                    console.warn('[Kural AI] Wake: microphone permission denied.');
                    return; // Don't retry on permission error
                }
                if (e.error === 'no-speech') return; // Normal — just restart below
                console.warn('[Kural AI] Wake recognition error:', e.error);
            };

            rec.onend = () => {
                this._wakeActive = false;
                console.log('[Kural AI] Wake listener ended. isListening:', this.isListening, 'isProcessing:', this.isProcessing, 'isSpeaking:', this.isSpeaking);
                // FIX: Only restart wake listener when fully idle (not listening/processing/speaking)
                if (!this.isExternallyPaused && !this.isListening && !this.isProcessing && !this.isSpeaking) {
                    this._scheduleWakeRestart();
                }
            };

            this._wakeRecognition = rec;
            try {
                rec.start();
            } catch (err) {
                console.warn('[Kural AI] Wake start error:', err.message);
            }
        }

        // FIX: Debounced restart — prevents concurrent restart attempts
        _scheduleWakeRestart(delayMs = 300) {
            if (this._wakeRestarting) return;
            this._wakeRestarting = true;
            setTimeout(() => {
                this._wakeRestarting = false;
                if (!this.isExternallyPaused && !this.isListening && !this.isProcessing && !this.isSpeaking && !this._wakeActive) {
                    console.log('[Kural AI] Restarting wake listener...');
                    this._startWakeListen();
                }
            }, delayMs);
        }

        _stopWakeListen() {
            if (this._wakeRecognition && this._wakeActive) {
                try { this._wakeRecognition.abort(); } catch (e) {}
                this._wakeActive = false;
                console.log('[Kural AI] Wake listener stopped.');
            }
        }

        /* ── Wake Word Detected Handler ── */
        _onWakeWordDetected(detectedLang) {
            // FIX: Set lock immediately to prevent double-trigger before isSpeaking is set
            if (this._wakeDetectedLock) return;
            if (this.isListening || this.isProcessing || this.isSpeaking) return;
            this._wakeDetectedLock = true;

            // Stop the wake listener while we handle the wake event
            this._stopWakeListen();

            // Switch language mode if needed
            if (detectedLang === 'ta' && activeLang !== 'ta') setActiveLang('ta');
            if (detectedLang === 'en' && activeLang !== 'en') setActiveLang('en');

            const wakeWord = detectedLang === 'ta' ? 'வணக்கம் குரல்' : 'Hey Kural';
            const greeting = detectedLang === 'ta' ? GREETING_WAKE_TA : GREETING_WAKE_EN;
            const lang     = detectedLang === 'ta' ? LANG_TA : LANG_EN;

            console.log('[Kural AI] Opening panel and greeting. lang:', lang);

            if (!this.isOpen) this.openPanel();
            this._showToast(`🎙️ ${wakeWord} — ${detectedLang === 'ta' ? 'கேட்கிறேன்!' : 'Listening!'}`);
            this._setTranscript(`"${wakeWord}" detected...`, false);

            // FIX: Short delay so openPanel() finishes before speak() is called,
            //      ensuring window.KuralAI reference is live for onstart/onend hooks.
            setTimeout(() => {
                console.log('[Kural AI] Speaking greeting:', greeting);
                this._addLog('ai', greeting, null);
                speak(greeting, lang, () => {
                    // Greeting finished → auto-start command listening
                    console.log('[Kural AI] Greeting complete. Starting command listening...');
                    this._wakeDetectedLock = false; // Release lock
                    this.startListening();
                });
            }, 150);
        }

        /* ══════════════════════════════════════════════════
           COMMAND LISTENING
        ══════════════════════════════════════════════════ */
        toggleListening() {
            if (this.isListening) { this.stopListening(); } else { this.startListening(); }
        }

        startListening() {
            if (this.isSpeaking) return;
            if (this.isListening) return; // guard against double-start

            const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SR) {
                const msg = 'Speech recognition is not supported. Please use Chrome or Edge.';
                this._addLog('ai', msg, null);
                speak(msg, LANG_EN);
                return;
            }

            // Stop wake listener before starting command recognition
            this._stopWakeListen();

            this.isListening = true;
            const listeningText = activeLang === 'ta' ? 'கேட்கிறேன்... பேசுங்கள்' : 'Listening... speak now';
            this._setStatus('listening', activeLang === 'ta' ? 'கேட்கிறேன்...' : 'Listening...');
            this._setTranscript(listeningText, false);
            console.log('[Kural AI] Command listening started. lang:', activeLang === 'ta' ? LANG_TA : LANG_EN);

            const cmd = new SR();
            cmd.continuous     = false;
            cmd.interimResults = true;
            cmd.lang           = activeLang === 'ta' ? LANG_TA : LANG_EN;
            this.commandRecognition = cmd;

            let finalTranscript = '';

            cmd.onresult = (e) => {
                let interim = '';
                for (let i = e.resultIndex; i < e.results.length; i++) {
                    const t = e.results[i][0].transcript;
                    if (e.results[i].isFinal) { finalTranscript += t; }
                    else { interim += t; }
                }
                this._setTranscript(finalTranscript || interim, false);
            };

            cmd.onend = () => {
                this.isListening = false;
                console.log('[Kural AI] Command recognition ended. finalTranscript:', finalTranscript.trim());
                if (finalTranscript.trim()) {
                    this._processCommand(finalTranscript.trim());
                } else {
                    this._setStatus('', activeLang === 'ta' ? 'தயார்' : 'Ready');
                    this._setTranscript(activeLang === 'ta' ? 'பேச்சு கண்டுபிடிக்கவில்லை. மீண்டும் முயற்சிக்கவும்.' : 'No speech detected. Try again.', true);
                    // FIX: Resume wake listener after failed command attempt
                    this._scheduleWakeRestart(500);
                }
            };

            cmd.onerror = (e) => {
                this.isListening = false;
                this._setStatus('', activeLang === 'ta' ? 'தயார்' : 'Ready');
                const errMsg = e.error === 'no-speech'
                    ? (activeLang === 'ta' ? 'பேச்சு கண்டுபிடிக்கவில்லை.' : 'No speech detected.')
                    : e.error === 'not-allowed'
                    ? (activeLang === 'ta' ? 'மைக்ரோஃபோன் அணுகல் மறுக்கப்பட்டது.' : 'Microphone access denied. Please allow microphone in browser settings.')
                    : `Error: ${e.error}`;
                this._setTranscript(errMsg, true);
                this._addLog('ai', errMsg, null);
                // FIX: Resume wake listener after error
                this._scheduleWakeRestart(500);
            };

            try { cmd.start(); }
            catch (err) {
                this.isListening = false;
                this._setStatus('', 'Ready');
                this._setTranscript('Could not access microphone.', true);
                this._scheduleWakeRestart(500);
            }
        }

        stopListening() {
            this.isListening = false;
            try { if (this.commandRecognition) this.commandRecognition.abort(); } catch (e) {}

            // FIX: Only restart wake listener if not speaking or processing.
            //      Do NOT call _startWakeListen from inside stopListening
            //      because setSpeakingState(true) calls stopListening first —
            //      which would create a race where wake restarts while speaking.
            if (!this.isSpeaking && !this.isProcessing) {
                this._setStatus('', activeLang === 'ta' ? 'தயார்' : 'Ready');
                this._scheduleWakeRestart(500);
            }
        }

        /* ── Speaking State (replaces public setSpeakingState) ── */
        // FIX: Renamed to _setSpeakingState (internal). The old public name setSpeakingState
        //      is aliased below for backward compatibility with any external callers.
        _setSpeakingState(isSpeaking, skipWakeRestart = false) {
            this.isSpeaking = isSpeaking;
            if (isSpeaking) {
                this._setStatus('speaking', activeLang === 'ta' ? 'பேசுகிறது...' : 'Speaking...');
                // Stop command listening while speaking (prevent self-capture)
                if (this.commandRecognition) {
                    try { this.commandRecognition.abort(); } catch (e) {}
                }
                // Stop wake listener while speaking
                this._stopWakeListen();
                this.isListening = false;
                console.log('[Kural AI] Speaking started. Mic disabled.');
            } else {
                console.log('[Kural AI] Speaking ended. skipWakeRestart:', skipWakeRestart);
                if (!this.isListening && !this.isProcessing && !skipWakeRestart) {
                    this._setStatus('', activeLang === 'ta' ? 'தயார்' : 'Ready');
                    // FIX: Only restart wake if no callback is about to start command listening
                    this._scheduleWakeRestart(400);
                }
            }
        }

        // Backward-compat alias (speak() calls this via window.KuralAI.setSpeakingState)
        setSpeakingState(isSpeaking, skipWakeRestart = false) {
            this._setSpeakingState(isSpeaking, skipWakeRestart);
        }

        /* ── External Control API (e.g. for Form Voice Recorders) ── */
        pauseVoiceAssistant() {
            this.isExternallyPaused = true;
            this._stopWakeListen();
            if (this.commandRecognition) {
                try { this.commandRecognition.abort(); } catch (e) {}
                this.isListening = false;
            }
            if (window.speechSynthesis) {
                try { window.speechSynthesis.cancel(); } catch (e) {}
                this.isSpeaking = false;
            }
            this._setStatus('', activeLang === 'ta' ? 'தயார்' : 'Ready');
            console.log('[Kural AI] Voice assistant externally paused.');
        }

        resumeVoiceAssistant() {
            this.isExternallyPaused = false;
            console.log('[Kural AI] Voice assistant externally resumed.');
            this._scheduleWakeRestart(300);
        }

        /* ══════════════════════════════════════════════════
           COMMAND PROCESSING
        ══════════════════════════════════════════════════ */
        async _processCommand(text) {
            if (VoiceIssueFlow.active) {
                const handled = VoiceIssueFlow.handleFlowInput(text);
                if (handled) { this._addLog('user', text, null); return; }
            }

            this.isProcessing = true;
            this._setStatus('processing', activeLang === 'ta' ? 'செயல்படுகிறது...' : 'Processing...');
            this._addLog('user', text, null);
            console.log('[Kural AI] Processing command:', text, '| lang:', activeLang);

            const token = localStorage.getItem('cm_token');
            if (!token) {
                const msg = activeLang === 'ta' ? 'குரல் AI பயன்படுத்த உள்நுழைக.' : 'Please log in to use Kural AI.';
                this._handleResponse({ action: 'SPEAK_ONLY', voiceMessage: msg });
                return;
            }

            try {
                const currentPage = window.location.pathname.split('/').pop() || 'index.html';
                const res = await fetch(`${API_BASE}/nayagan-ai/command`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ text, currentPage, lang: activeLang })
                });
                if (!res.ok) throw new Error(`Server error: ${res.status}`);
                const action = await res.json();
                console.log('[Kural AI] Action received:', action.action, '|', action.voiceMessage);
                this._handleResponse(action);
            } catch (err) {
                console.error('[Kural AI] processCommand error:', err);
                const msg = activeLang === 'ta' ? 'குரல் AI தற்காலிகமாக இல்லை. மீண்டும் முயற்சிக்கவும்.' : 'Kural AI is temporarily unavailable. Please try again.';
                this._handleResponse({ action: 'SPEAK_ONLY', voiceMessage: msg });
            }
        }

        _handleResponse(action) {
            this.isProcessing = false;
            this._setStatus('', activeLang === 'ta' ? 'தயார்' : 'Ready');

            const voiceMsg  = action.voiceMessage || (activeLang === 'ta' ? 'செய்யப்பட்டது.' : 'Done.');
            const actionType = action.action || 'SPEAK_ONLY';

            this._addLog('ai', voiceMsg, actionType);
            this._showToast(`${this._getActionEmoji(actionType)} ${voiceMsg}`);

            const speechLang = activeLang === 'ta' ? LANG_TA : detectLanguage(voiceMsg);
            // After response is spoken, wake listener resumes automatically via setSpeakingState(false)
            speak(voiceMsg, speechLang);

            KuralActionHandler.execute(action, voiceMsg);
        }

        _getActionEmoji(action) {
            return ({
                'NAVIGATE': '🔀', 'SHOW_TAB': '📂', 'OPEN_MAP': '🗺️', 'OPEN_ANALYTICS': '📊',
                'FILTER_ISSUES': '🔍', 'OPEN_RAISE_ISSUE': '🚨', 'VOICE_ISSUE_FLOW': '🎙️',
                'FILL_ISSUE_FORM': '✍️', 'SUBMIT_FORM': '✅', 'TRIGGER_DOWNLOAD': '⬇️',
                'SCROLL_TO': '📜', 'OPEN_NOTIFICATIONS': '🔔', 'ASSIGN_ISSUE': '👤', 'SPEAK_ONLY': '🤖',
            })[action] || '⚡';
        }
    }

    /* ─────────────────────────────────────────────────────────
       INIT — Wait for DOM, then instantiate
    ───────────────────────────────────────────────────────── */
    function init() {
        const token = localStorage.getItem('cm_token');
        if (!token) return;
        // FIX: window.KuralAI is now set INSIDE the constructor before wake listener starts,
        //      so speak() onstart/onend handlers always have a valid reference.
        new KuralVoiceAssistant();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        setTimeout(init, 100);
    }

})();
