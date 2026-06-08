/**
 * Ezhil AI - Civic Reporting Assistant
 */

const EzhilFAQ = [
    {
        questions: ["how to register", "create account", "singup", "கணக்கு தொடங்குவது எப்படி"],
        answer: "To register, click the 'Register' link on the login page. Fill in your name, email, and password. Choose 'Citizen' as your role to get access to the reporting dashboard."
    },
    {
        questions: ["how to report an issue", "submit complaint", "புகார் செய்வது எப்படி", "file complaint"],
        answer: "Click the '+ Report New Issue' button on the dashboard. Provide a title, choose a category, enter the location, describe the problem, and MUST upload a photo."
    },
    {
        questions: ["image rejected", "upload problem", "verification failed", "புகைப்படம் ஏன் நிராகரிக்கப்பட்டது"],
        answer: "The app uses EXIF verification. Ensure your photo is taken directly from a camera device. Screenshots or downloaded images often lack 'Date Taken' metadata and will be rejected."
    },
    {
        questions: ["choose department", "select category", "துறையை எப்படி தேர்வு செய்வது"],
        answer: "Simply pick the category that best fits your issue (e.g., 'Waste' for trash, 'Water' for leaks). The system automatically assigns it to the correct department (Madurai Corp, TNEB, etc.)."
    },
    {
        questions: ["track status", "complaint status", "என்னுடைய புகாரின் நிலை"],
        answer: "Go to the 'My Submissions' tab on your dashboard. Each reported issue shows its current status: PENDING, IN_PROGRESS, or COMPLETED."
    }
];

class EzhilAI {
    constructor() {
        this.isOpen = false;
        this.isFullScreen = false;
        this.history = JSON.parse(sessionStorage.getItem('ezhil_history')) || [];
        this.init();
    }

    init() {
        this.renderElements();
        this.attachEvents();
        if (this.history.length > 0) {
            this.renderHistory();
        }
    }

    renderElements() {
        const launcher = document.createElement('button');
        launcher.className = 'ezhil-launcher';
        launcher.id = 'ezhil-launcher';
        launcher.innerHTML = `
            <img src="./ezhil_robot_icon.png" alt="Ezhil">
            <span class="ezhil-tooltip">Ezhil AI</span>
        `;

        const window = document.createElement('div');
        window.className = 'ezhil-window';
        window.id = 'ezhil-window';
        window.innerHTML = `
            <div class="ezhil-header">
                <div class="ezhil-header-info">
                    <div class="ezhil-avatar">
                        <img src="./ezhil_robot_icon.png" alt="Ezhil" style="width:36px; height:36px;">
                    </div>
                    <div class="ezhil-header-text">
                        <h3>Ezhil AI</h3>
                        <p>உங்கள் உதவிக்கான AI வழிகாட்டி</p>
                    </div>
                </div>
                <div class="ezhil-header-actions">
                    <button id="ezhil-toggle-fs" title="Toggle Fullscreen">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
                    </button>
                    <button id="ezhil-close" title="Close Chat">✕</button>
                </div>
            </div>
            <div class="ezhil-messages" id="ezhil-messages">
                <!-- Welcome -->
                <div class="message message-ai">
                    வணக்கம்! நான் Ezhil AI. இந்த பயன்பாட்டை எப்படி பயன்படுத்துவது என்று நான் உதவுகிறேன்.
                    <div class="ezhil-chips">
                        <div class="chip">How to report an issue?</div>
                        <div class="chip">புகார் எப்படி அளிப்பது?</div>
                        <div class="chip">Image upload problem</div>
                        <div class="chip">Department selection</div>
                        <div class="chip">Track complaint status</div>
                    </div>
                </div>
            </div>
            <div class="typing-indicator" id="ezhil-typing">
                <div class="dot"></div><div class="dot"></div><div class="dot"></div>
            </div>
            <div class="ezhil-footer">
                <div class="ezhil-input-wrapper">
                    <input type="text" id="ezhil-input" placeholder="Ask me something about the app...">
                </div>
                <button class="ezhil-send" id="ezhil-send">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                </button>
            </div>
        `;

        document.body.appendChild(launcher);
        document.body.appendChild(window);
    }

    attachEvents() {
        const launcher = document.getElementById('ezhil-launcher');
        const closeBtn = document.getElementById('ezhil-close');
        const fsBtn = document.getElementById('ezhil-toggle-fs');
        const sendBtn = document.getElementById('ezhil-send');
        const input = document.getElementById('ezhil-input');

        launcher.addEventListener('click', () => this.toggleWindow());
        closeBtn.addEventListener('click', () => this.toggleWindow());
        fsBtn.addEventListener('click', () => this.toggleFullScreen());
        
        sendBtn.addEventListener('click', () => this.handleSend());
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleSend();
        });

        // Chips delegation
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('chip')) {
                input.value = e.target.textContent;
                this.handleSend();
            }
        });
    }

    toggleWindow() {
        this.isOpen = !this.isOpen;
        const window = document.getElementById('ezhil-window');
        window.classList.toggle('open', this.isOpen);
        if (this.isOpen) {
            this.scrollToBottom();
            document.getElementById('ezhil-input').focus();
        }
    }

    toggleFullScreen() {
        this.isFullScreen = !this.isFullScreen;
        const window = document.getElementById('ezhil-window');
        window.classList.toggle('full-screen', this.isFullScreen);
        
        const fsBtn = document.getElementById('ezhil-toggle-fs');
        fsBtn.innerHTML = this.isFullScreen 
            ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7"/></svg>'
            : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>';
    }

    async handleSend() {
        const input = document.getElementById('ezhil-input');
        const text = input.value.trim();
        if (!text) return;

        input.value = '';
        this.addMessage('user', text);
        this.showTyping(true);

        // 1. Check local FAQ
        const faqAnswer = this.checkFAQ(text);
        if (faqAnswer) {
            setTimeout(() => {
                this.showTyping(false);
                this.addMessage('ai', faqAnswer);
            }, 500);
            return;
        }

        // 2. Call Backend AI
        try {
            const apiBase = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
                ? 'http://localhost:5001/api'
                : '/api';

            const token = localStorage.getItem('cm_token');
            const messages = this.history.slice(-10).map(m => ({
                role: m.role === 'user' ? 'user' : 'assistant',
                content: m.text
            }));

            const res = await fetch(`${apiBase}/ezhil-ai`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ messages: [...messages, { role: 'user', content: text }] })
            });

            const data = await res.json();
            this.showTyping(false);

            if (data.message) {
                this.addMessage('ai', data.message);
            } else {
                this.addMessage('ai', "Ezhil AI is temporarily unavailable. Please try again.");
            }

        } catch (err) {
            console.error('Chat AI Error:', err);
            this.showTyping(false);
            this.addMessage('ai', "Ezhil AI is temporarily unavailable. Please try again.");
        }
    }

    checkFAQ(text) {
        const lowerText = text.toLowerCase();
        const match = EzhilFAQ.find(faq => 
            faq.questions.some(q => lowerText.includes(q.toLowerCase()))
        );
        return match ? match.answer : null;
    }

    addMessage(role, text) {
        const container = document.getElementById('ezhil-messages');
        const msgDiv = document.createElement('div');
        msgDiv.className = `message message-${role}`;
        msgDiv.textContent = text;
        container.appendChild(msgDiv);
        this.scrollToBottom();

        this.history.push({ role, text });
        sessionStorage.setItem('ezhil_history', JSON.stringify(this.history));
    }

    renderHistory() {
        const container = document.getElementById('ezhil-messages');
        this.history.forEach(m => {
            const msgDiv = document.createElement('div');
            msgDiv.className = `message message-${m.role}`;
            msgDiv.textContent = m.text;
            container.appendChild(msgDiv);
        });
        this.scrollToBottom();
    }

    showTyping(show) {
        document.getElementById('ezhil-typing').style.display = show ? 'flex' : 'none';
        if (show) this.scrollToBottom();
    }

    scrollToBottom() {
        const container = document.getElementById('ezhil-messages');
        container.scrollTop = container.scrollHeight;
    }
}

// Instantiate Chatbot only on Citizen Dashboard
if (window.location.pathname.includes('citizen-dashboard.html')) {
    window.addEventListener('DOMContentLoaded', () => {
        new EzhilAI();
    });
}
