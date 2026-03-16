/**
 * chatbot.js — Ezhil AI Chatbot
 * Self-initializing vanilla JS chatbot for CleanMadurai.
 * Injects all HTML/CSS dynamically. No framework needed.
 */

(function () {
  'use strict';

  /* ── API Base (same logic as api.js) ── */
  const API_BASE =
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:5001/api'
      : 'https://cleancityfinal.onrender.com/api';

  /* ── State ── */
  let conversationHistory = [];
  let isOpen = false;
  let isMinimized = false;
  let isTyping = false;
  let currentLanguage = 'en'; // Default to English

  /* ── Boy Robot SVG Icon ── */
  const BOT_ICON_SVG = `
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <!-- Round Face -->
      <circle cx="50" cy="55" r="35" fill="#f0fdf4" stroke="#16a34a" stroke-width="2.5"/>
      <!-- Robot Hair / Antenna -->
      <path d="M45 20 L55 20 L55 30 L45 30 Z" fill="#16a34a"/>
      <line x1="50" y1="10" x2="50" y2="20" stroke="#16a34a" stroke-width="3"/>
      <circle cx="50" cy="8" r="4" fill="#16a34a"/>
      <!-- Friendly Eyes -->
      <circle cx="38" cy="52" r="6" fill="#111827"/>
      <circle cx="62" cy="52" r="6" fill="#111827"/>
      <!-- Boy Face Expression / Blush -->
      <circle cx="30" cy="62" r="3" fill="#86efac" opacity="0.6"/>
      <circle cx="70" cy="62" r="3" fill="#86efac" opacity="0.6"/>
      <!-- Smile -->
      <path d="M40 72 Q50 82 60 72" fill="none" stroke="#111827" stroke-width="3" stroke-linecap="round"/>
      <!-- Circuit lines on cheeks -->
      <line x1="20" y1="55" x2="25" y2="55" stroke="#16a34a" stroke-width="1.5"/>
      <line x1="75" y1="55" x2="80" y2="55" stroke="#16a34a" stroke-width="1.5"/>
    </svg>
  `;

  /* ── Local FAQ for instant (no-API) answers ── */
  const FAQ = [
    {
      patterns: ['how to register', 'account', 'sign up', 'signup', 'create account', 'register panna', 'account create'],
      answer: {
        en: `📝 **How to Register:**\n\n1. Visit the Registration page.\n2. Enter your Name, Email, Phone, and Password.\n3. Submit and wait for Admin Approval.\n4. Once approved, you can log in as a citizen. ✅`,
        ta: `📝 **பதிவு செய்வது எப்படி:**\n\n1. 'Register' பக்கத்திற்குச் செல்லவும்.\n2. உங்கள் பெயர், மின்னஞ்சல், தொலைபேசி எண் மற்றும் கடவுச்சொல்லை உள்ளிடவும்.\n3. சமர்ப்பித்து நிர்வாகியின் ஒப்புதலுக்காக காத்திருக்கவும்.`
      }
    },
    {
      patterns: ['login', 'sign in', 'log in', 'signin', 'password', 'login panna'],
      answer: {
        en: `🔐 **How to Login:**\n\n1. Go to the Login page.\n2. Enter your Email and Password.\n3. Click "Login".\n4. If your account is approved, you will enter the Dashboard.\n\nNote: If not approved, contact the admin.`,
        ta: `🔐 **உள்நுழைவது எப்படி:**\n\n1. 'Login' பக்கத்திற்குச் செல்லவும்.\n2. உங்கள் மின்னஞ்சல் மற்றும் கடவுச்சொல்லை உள்ளிடவும்.\n3. 'Login' பொத்தானைக் கிளிக் செய்யவும்.`
      }
    },
    {
      patterns: ['report', 'complaint', 'submit', 'report panna', 'submit issue', 'pugaar'],
      answer: {
        en: `🚨 **How to Report an Issue:**\n\n1. Click "Report Issue" in your dashboard.\n2. Enter Title and Description.\n3. Select Category and Department.\n4. Capture Location (via GPS or manually).\n5. Upload a photo (optional but recommended).\n6. Submit! ✅`,
        ta: `🚨 **புகார் அளிப்பது எப்படி:**\n\n1. உங்கள் டாஷ்போர்டில் 'Report Issue' என்பதைக் கிளிக் செய்யவும்.\n2. தலைப்பு மற்றும் விவரங்களை உள்ளிடவும்.\n3. துறை மற்றும் வகையைத் தேர்வு செய்யவும்.\n4. இருப்பிடத்தைப் பதிவிடவும்.\n5. புகைப்படம் பதிவேற்றி சமர்ப்பிக்கவும். ✅`
      }
    },
    {
      patterns: ['image', 'photo', 'upload', 'rejected', 'fake', 'verification'],
      answer: {
        en: `📸 **Image Upload & Verification:**\n\n- Upload a Real Photo using the form.\n- Our AI (Sightengine) checks if the image is real or AI-generated.\n- Only genuine photos are accepted. If rejected, please capture a real photo of the scene.`,
        ta: `📸 **புகைப்படப் பதிவேற்றம் மற்றும் சரிபார்ப்பு:**\n\n- உண்மையான புகைப்படங்களை மட்டுமே பதிவேற்றவும்.\n- எங்களின் AI அமைப்பு அது உண்மையானதா அல்லது போலியானதா என்பதைச் சரிபார்க்கும்.`
      }
    },
    {
      patterns: ['department', 'which department', 'select department', 'department select'],
      answer: {
        en: `🏛️ **How to Choose Department:**\n\nChoose based on the problem:\n- Roads for potholes\n- Sanitation for garbage\n- Electricity for streetlights / power\n- Water Supply for leaks\n\nIf unsure, select "General".`,
        ta: `🏛️ **துறையைத் தேர்ந்தெடுப்பது எப்படி:**\n\nபிரச்சனைக்கு ஏற்ற துறையைத் தேர்ந்தெடுக்கவும். தெரியவில்லை என்றால் 'General' என்பதைத் தேர்ந்தெடுக்கவும்.`
      }
    },
    {
      patterns: ['status', 'track', 'track complaint', 'status check', 'check my issue'],
      answer: {
        en: `📊 **How to Track Status:**\n\n1. Go to "My Issues" in your Dashboard.\n2. See the status tags:\n   - 🟡 Pending: Awaiting review.\n   - 🔵 In Progress: Being handled.\n   - ✅ Completed: Resolved!`,
        ta: `📊 **நிலையை எவ்வாறு கண்காணிப்பது:**\n\n1. 'My Issues' பகுதிக்குச் செல்லவும்.\n2. உங்கள் புகாரின் தற்போதைய நிலையை அங்கே காணலாம்.`
      }
    }
  ];

  /* ── Check FAQ for instant reply ── */
  function getFAQReply(text) {
    const lower = text.toLowerCase().trim();
    for (const faq of FAQ) {
      if (faq.patterns.some(p => lower.includes(p.toLowerCase()))) {
        return faq.answer[currentLanguage] || faq.answer['en'];
      }
    }
    return null;
  }

  /* ── Time helper ── */
  function getTime() {
    return new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  }

  /* ── Format reply text ── */
  function formatText(text) {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  }

  /* ── HTML Template ── */
  const QUICK_CHIPS = [
    { label: 'How to register?', value: 'How to register?' },
    { label: 'How to report?', value: 'How to report an issue?' },
    { label: 'Login guide', value: 'How to login?' },
    { label: 'Image problems', value: 'How to upload an image?' },
    { label: 'Track status', value: 'How to track complaint status?' },
    { label: 'Departments', value: 'How to select department?' },
    { label: 'தமிழில் பேசுங்கள்', value: 'தமிழில் பேசுங்கள்' },
    { label: 'Reply in English', value: 'Reply in English' }
  ];

  function buildHTML() {
    const chips = QUICK_CHIPS.map(c =>
      `<button class="ezhil-chip" data-msg="${c.value}">${c.label}</button>`
    ).join('');

    return `
    <button id="ezhil-fab" aria-label="Open Ezhil AI Assistant">
      ${BOT_ICON_SVG}
    </button>

    <div id="ezhil-window" role="dialog" aria-label="Ezhil AI Chat">
      <div class="ezhil-header">
        <div class="ezhil-avatar">${BOT_ICON_SVG}</div>
        <div class="ezhil-header-text">
          <div class="ezhil-header-title">Ezhil AI</div>
          <div class="ezhil-header-subtitle">
            <span class="ezhil-online-dot"></span>Your citizen assistant
          </div>
        </div>
        <div class="ezhil-header-actions">
          <button class="ezhil-ctrl-btn" id="ezhil-minimize-btn">─</button>
          <button class="ezhil-ctrl-btn" id="ezhil-close-btn">✕</button>
        </div>
      </div>

      <div class="ezhil-messages" id="ezhil-messages"></div>

      <div class="ezhil-chips" id="ezhil-chips">${chips}</div>

      <div class="ezhil-input-row">
        <textarea
          id="ezhil-input"
          class="ezhil-input"
          placeholder="Type your question..."
          rows="1"
        ></textarea>
        <button id="ezhil-send-btn" class="ezhil-send-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </div>
      <div class="ezhil-footer-brand">Powered by Ezhil AI</div>
    </div>`;
  }

  function appendMessage(role, text, skipHistory = false) {
    const msgs = document.getElementById('ezhil-messages');
    if (!msgs) return;

    const isUser = role === 'user';
    const row = document.createElement('div');
    row.className = `ezhil-msg-row ${isUser ? 'ezhil-user' : 'ezhil-ai'}`;

    row.innerHTML = `
      ${!isUser ? `<div class="ezhil-msg-icon">${BOT_ICON_SVG}</div>` : ''}
      <div>
        <div class="ezhil-bubble">${formatText(text)}</div>
        <div class="ezhil-timestamp">${getTime()}</div>
      </div>
    `;

    msgs.appendChild(row);
    msgs.scrollTop = msgs.scrollHeight;

    if (!skipHistory) {
      conversationHistory.push({ role, content: text });
    }
  }

  function showTyping() {
    const msgs = document.getElementById('ezhil-messages');
    if (!msgs) return;
    const row = document.createElement('div');
    row.id = 'ezhil-typing';
    row.className = 'ezhil-typing-row';
    row.innerHTML = `
      <div class="ezhil-msg-icon">${BOT_ICON_SVG}</div>
      <div class="ezhil-typing-bubble">
        <div class="ezhil-typing-dot"></div>
        <div class="ezhil-typing-dot"></div>
        <div class="ezhil-typing-dot"></div>
      </div>`;
    msgs.appendChild(row);
    msgs.scrollTop = msgs.scrollHeight;
    isTyping = true;
  }

  function removeTyping() {
    const el = document.getElementById('ezhil-typing');
    if (el) el.remove();
    isTyping = false;
  }

  /* ── Language Swap Logic ── */
  function handleLanguageSwap(text) {
    const lower = text.toLowerCase();
    if (lower.includes('தமிழில் பேசுங்கள்') || lower.includes('switch to tamil') || lower.includes('reply in tamil')) {
      currentLanguage = 'ta';
      appendMessage('assistant', 'நிச்சயமாக, இனி நான் தமிழில் பதிலளிப்பேன். உங்களுக்கு என்ன உதவி தேவை?', true);
      return true;
    }
    if (lower.includes('reply in english') || lower.includes('switch to english')) {
      currentLanguage = 'en';
      appendMessage('assistant', 'Sure, I will reply in English from now on. How can I help you?', true);
      return true;
    }
    return false;
  }

  async function sendMessage(text) {
    text = text.trim();
    if (!text || isTyping) return;

    appendMessage('user', text);
    clearInput();

    // 1. Language Swap check
    if (handleLanguageSwap(text)) return;

    // 2. FAQ check (respects currentLanguage)
    const faqReply = getFAQReply(text);
    if (faqReply) {
      showTyping();
      await delay(600);
      removeTyping();
      appendMessage('assistant', faqReply);
      return;
    }

    // 3. API
    showTyping();
    setSendDisabled(true);

    try {
      const res = await fetch(`${API_BASE}/ezhil-ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: conversationHistory.slice(-10),
          language: currentLanguage // Let backend know if needed, though system prompt handles it
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      removeTyping();
      appendMessage('assistant', data.reply);

    } catch (e) {
      removeTyping();
      appendMessage('assistant', currentLanguage === 'ta' ? 'பிழை ஏற்பட்டது. மீண்டும் முயற்சிக்கவும்.' : 'An error occurred. Please try again.', true);
    } finally {
      setSendDisabled(false);
    }
  }

  function clearInput() {
    const inp = document.getElementById('ezhil-input');
    if (inp) { inp.value = ''; inp.style.height = 'auto'; }
  }

  function setSendDisabled(val) {
    const btn = document.getElementById('ezhil-send-btn');
    if (btn) btn.disabled = val;
  }

  function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

  function openChat() {
    const win = document.getElementById('ezhil-window');
    const fab = document.getElementById('ezhil-fab');
    if (!win) return;
    isOpen = true;
    win.classList.add('ezhil-visible');
    fab.classList.add('ezhil-open');
    if (conversationHistory.length === 0) showWelcome();
    setTimeout(() => document.getElementById('ezhil-input')?.focus(), 300);
  }

  function closeChat() {
    const win = document.getElementById('ezhil-window');
    const fab = document.getElementById('ezhil-fab');
    if (!win) return;
    isOpen = false;
    win.classList.remove('ezhil-visible');
    fab.classList.remove('ezhil-open');
  }

  function minimizeChat() {
    const win = document.getElementById('ezhil-window');
    const btn = document.getElementById('ezhil-minimize-btn');
    isMinimized = !isMinimized;
    win.classList.toggle('ezhil-minimized', isMinimized);
    btn.textContent = isMinimized ? '□' : '─';
  }

  function showWelcome() {
    const msg = `Hello! I am Ezhil AI. I can help you understand how to use this app.`;
    appendMessage('assistant', msg, true);
  }

  function autoResize(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 100) + 'px';
  }

  function init() {
    document.body.insertAdjacentHTML('beforeend', buildHTML());
    document.getElementById('ezhil-fab').addEventListener('click', () => {
      if (isOpen && !isMinimized) closeChat(); else openChat();
    });
    document.getElementById('ezhil-close-btn').addEventListener('click', closeChat);
    document.getElementById('ezhil-minimize-btn').addEventListener('click', minimizeChat);
    document.getElementById('ezhil-send-btn').addEventListener('click', () => sendMessage(document.getElementById('ezhil-input').value));
    document.getElementById('ezhil-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(e.target.value); }
    });
    document.getElementById('ezhil-input').addEventListener('input', function () { autoResize(this); });
    document.getElementById('ezhil-chips').addEventListener('click', (e) => {
      const chip = e.target.closest('.ezhil-chip');
      if (chip) sendMessage(chip.dataset.msg);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
