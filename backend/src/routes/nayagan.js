/**
 * nayagan.js — Kural AI Voice Assistant Backend Route
 *
 * POST /api/nayagan-ai/command
 * Accepts voice command text + user context + active language,
 * returns structured action JSON.
 * Uses google/gemma-4-26b-a4b-it:free via OpenRouter (same API key as Ezhil AI)
 *
 * Does NOT modify any existing business logic.
 * Uses existing verifyToken middleware.
 */

const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const NAYAGAN_MODEL = 'google/gemma-4-26b-a4b-it:free';

/* ─────────────────────────────────────────────────────────────────
   ROLE → ALLOWED ACTIONS MAP
   Used to build role-specific context for the AI
───────────────────────────────────────────────────────────────── */
const ROLE_CAPABILITIES = {
    USER: {
        label: 'Citizen',
        dashboard: 'citizen-dashboard.html',
        allowedActions: [
            'NAVIGATE_CITIZEN_DASHBOARD',
            'SHOW_MY_ISSUES',
            'FILTER_ISSUES',
            'OPEN_RAISE_ISSUE',
            'VOICE_ISSUE_FLOW',
            'SHOW_TAB',
            'SHOW_MAP',
            'SPEAK_ONLY'
        ],
        allowedPages: ['citizen-dashboard.html'],
        description: 'Can view own complaints, raise new issues via voice or form, view map, and track issue status.'
    },
    EMPLOYEE: {
        label: 'Department Employee',
        dashboard: 'employee-dashboard.html',
        allowedActions: [
            'NAVIGATE_EMPLOYEE_DASHBOARD',
            'SHOW_MY_ISSUES',
            'FILTER_ISSUES',
            'SHOW_TAB',
            'SHOW_MAP',
            'SPEAK_ONLY'
        ],
        allowedPages: ['employee-dashboard.html'],
        description: 'Can view assigned issues, update status, view map of tasks.'
    },
    TAMILNADU_CORPORATION: {
        label: 'Department (Tamilnadu Corporation)',
        dashboard: 'department-dashboard.html',
        allowedActions: ['ALL'],
        allowedPages: ['department-dashboard.html'],
        description: 'Full department control: view issues, analytics, employee performance, download reports.'
    },
    TNEB: {
        label: 'Department (TNEB)',
        dashboard: 'department-dashboard.html',
        allowedActions: ['ALL'],
        allowedPages: ['department-dashboard.html'],
        description: 'Full department control: view issues, analytics, employee performance, download reports.'
    },
    POLICE: {
        label: 'Department (Police)',
        dashboard: 'department-dashboard.html',
        allowedActions: ['ALL'],
        allowedPages: ['department-dashboard.html'],
        description: 'Full department control: view issues, analytics, employee performance, download reports.'
    },
    COLLECTOR: {
        label: 'District Collector',
        dashboard: 'collector-dashboard.html',
        allowedActions: ['ALL'],
        allowedPages: ['collector-dashboard.html'],
        description: 'District-level oversight: all issues, analytics, department performance, reports.'
    },
    ADMIN: {
        label: 'System Administrator',
        dashboard: 'admin-dashboard.html',
        allowedActions: ['ALL'],
        allowedPages: ['admin-dashboard.html'],
        description: 'Full system access: user management, verifications, all analytics.'
    },
    MLA: {
        label: 'MLA',
        dashboard: 'mla-dashboard.html',
        allowedActions: ['ALL'],
        allowedPages: ['mla-dashboard.html'],
        description: 'Constituency oversight: all issues, analytics, reports.'
    },
    CM: {
        label: 'Chief Minister',
        dashboard: 'cm-dashboard.html',
        allowedActions: ['ALL'],
        allowedPages: ['cm-dashboard.html'],
        description: 'State-level oversight: all dashboards, analytics, performance, reports.'
    },
    COMMISSIONER: {
        label: 'District Commissioner',
        dashboard: 'commissioner-dashboard.html',
        allowedActions: ['ALL'],
        allowedPages: ['commissioner-dashboard.html'],
        description: 'Commissioner-level oversight: all issues, analytics, reports.'
    }
};

/* ─────────────────────────────────────────────────────────────────
   LANGUAGE RULES BUILDER
   Generates strict language enforcement instructions for the AI
───────────────────────────────────────────────────────────────── */
function buildLanguageRules(lang) {
    if (lang === 'ta') {
        return `ACTIVE LANGUAGE MODE: TAMIL
CRITICAL LANGUAGE RULES:
- The user is in TAMIL mode. ALL "voiceMessage" fields MUST be written in Tamil script (Unicode தமிழ்) ONLY.
- Do NOT use Tanglish (romanized Tamil). Do NOT use English words in voiceMessage.
- Examples of correct Tamil voiceMessages:
  * "குடிமகன் டாஷ்போர்டு திறக்கிறேன்"
  * "உங்களுக்கு என்ன உதவி வேண்டும்?"
  * "பிரச்சினை படிவம் திறக்கிறேன். புகைப்படம் பதிவேற்றவும்."
  * "உயர் முன்னுரிமை பிரச்சினைகளை காட்டுகிறேன்"
  * "இந்த அம்சத்திற்கு உங்களுக்கு அணுகல் இல்லை"
  * "இந்த கட்டளை புரியவில்லை. மீண்டும் முயற்சிக்கவும்."`;
    }
    return `ACTIVE LANGUAGE MODE: ENGLISH
LANGUAGE RULES:
- The user is in ENGLISH mode. ALL "voiceMessage" fields MUST be in clear, friendly English.
- Do NOT use Tamil script or Tanglish in voiceMessage.`;
}

/* ─────────────────────────────────────────────────────────────────
   SYSTEM PROMPT BUILDER
───────────────────────────────────────────────────────────────── */
function buildSystemPrompt(userRole, currentPage, lang) {
    const caps = ROLE_CAPABILITIES[userRole] || ROLE_CAPABILITIES['USER'];
    const langRules = buildLanguageRules(lang);

    return `You are Kural AI, a bilingual voice assistant for "MakkalKural" — a civic issue reporting and governance platform in Tamil Nadu, India.

Your job: Convert the user's voice command into a structured JSON action object that the frontend will execute.

USER CONTEXT:
- Role: ${caps.label}
- Current Page: ${currentPage || caps.dashboard}
- Permissions: ${caps.description}

${langRules}

AVAILABLE ACTIONS (return ONLY one of these JSON structures):

1. Navigate to a page:
{"action":"NAVIGATE","page":"citizen-dashboard.html","voiceMessage":"Opening citizen dashboard."}
{"action":"NAVIGATE","page":"department-dashboard.html","voiceMessage":"Department dashboard opening."}

2. Filter issues on current page:
{"action":"FILTER_ISSUES","priority":"HIGH","status":"PENDING","voiceMessage":"High priority pending issues shown."}
{"action":"FILTER_ISSUES","priority":"EMERGENCY","voiceMessage":"Emergency issues filtered."}
{"action":"FILTER_ISSUES","status":"PENDING","voiceMessage":"Pending complaints shown."}
{"action":"FILTER_ISSUES","status":"IN_PROGRESS","voiceMessage":"In-progress issues shown."}
{"action":"FILTER_ISSUES","status":"COMPLETED","voiceMessage":"Completed issues shown."}
{"action":"FILTER_ISSUES","priority":"LOW","voiceMessage":"Low priority issues shown."}
{"action":"FILTER_ISSUES","clearAll":true,"voiceMessage":"All filters cleared."}

3. Switch to a tab on the page:
{"action":"SHOW_TAB","tabName":"analytics","voiceMessage":"Opening analytics section."}
{"action":"SHOW_TAB","tabName":"issues","voiceMessage":"Opening issues tab."}
{"action":"SHOW_TAB","tabName":"map","voiceMessage":"Opening map view."}
{"action":"SHOW_TAB","tabName":"reports","voiceMessage":"Opening reports section."}
{"action":"SHOW_TAB","tabName":"employees","voiceMessage":"Opening employees section."}
{"action":"SHOW_TAB","tabName":"campaigns","voiceMessage":"Opening campaigns section."}
{"action":"SHOW_TAB","tabName":"leaderboard","voiceMessage":"Opening leaderboard."}
{"action":"SHOW_TAB","tabName":"overview","voiceMessage":"Opening overview section."}
{"action":"SHOW_TAB","tabName":"performance","voiceMessage":"Opening performance section."}

4. Start guided voice issue reporting flow:
{"action":"VOICE_ISSUE_FLOW","voiceMessage":"Starting voice issue reporting. Please tell me the issue title."}

5. Open raise issue form directly (quick path):
{"action":"OPEN_RAISE_ISSUE","title":"Road damage","category":"Roads","description":"User reported road damage issue.","voiceMessage":"Opening raise issue form. Please upload a photo."}

6. Trigger report download:
{"action":"TRIGGER_DOWNLOAD","format":"pdf","dateRange":"today","voiceMessage":"Downloading today's report."}
{"action":"TRIGGER_DOWNLOAD","format":"excel","dateRange":"this_week","voiceMessage":"Downloading this week's report."}
{"action":"TRIGGER_DOWNLOAD","format":"pdf","dateRange":"this_month","voiceMessage":"Downloading this month's report."}

7. Scroll to a section:
{"action":"SCROLL_TO","target":"notifications","voiceMessage":"Scrolling to notifications."}

8. Open notifications:
{"action":"OPEN_NOTIFICATIONS","voiceMessage":"Opening notifications."}

9. Speak only (no action, e.g. permission denied or unknown command):
{"action":"SPEAK_ONLY","voiceMessage":"You don't have access to this feature."}
{"action":"SPEAK_ONLY","voiceMessage":"I didn't understand that. Please try again."}

PERMISSION RULES:
- Role "${caps.label}" allowed actions: ${caps.allowedActions.includes('ALL') ? 'ALL actions' : caps.allowedActions.join(', ')}.
- If a requested action is NOT in allowed actions, return SPEAK_ONLY with a permission denied message.
- Citizens CANNOT access analytics, download reports, or view all issues — only their own.
- Employees CANNOT raise issues on behalf of citizens.

CRITICAL OUTPUT RULES:
- Return ONLY valid JSON. No explanation, no markdown, no extra text.
- The JSON must contain "action" and "voiceMessage" fields always.
- Never fabricate actions not listed above.
- If you cannot understand the command, return SPEAK_ONLY.
- "voiceMessage" MUST follow the ACTIVE LANGUAGE MODE rules above — no exceptions.

DEPARTMENT / CATEGORY MAPPING (for OPEN_RAISE_ISSUE):
- Road/Pothole/Pavement → category: "Roads"
- Garbage/Waste/Trash/Sanitation → category: "Sanitation"
- Street light/Electricity/Power → category: "Electricity"
- Water/Pipe/Leak/Borewell → category: "Water"
- Law/Police/Crime → category: "Law & Order"
- Other/General → category: "General"

Now convert the user's voice command into the correct JSON action.`;
}

/* ─────────────────────────────────────────────────────────────────
   POST /api/nayagan-ai/command
───────────────────────────────────────────────────────────────── */
router.post('/command', verifyToken, async (req, res) => {
    const { text, currentPage, lang } = req.body;
    const userRole = req.user?.role || 'USER';

    // Validate lang: 'en' or 'ta', default to 'en'
    const activeLang = (lang === 'ta') ? 'ta' : 'en';

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
        return res.status(400).json({ error: 'Voice command text is required.' });
    }

    if (!OPENROUTER_API_KEY) {
        console.error('[Kural AI] OPENROUTER_API_KEY is missing');
        return res.status(500).json({ error: 'Kural AI is temporarily unavailable. (Missing API Key)' });
    }

    const systemPrompt = buildSystemPrompt(userRole, currentPage, activeLang);

    try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://cleancitymdu.netlify.app',
                'X-Title': 'MakkalKural Kural AI Voice Assistant'
            },
            body: JSON.stringify({
                model: NAYAGAN_MODEL,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: text.trim() }
                ],
                temperature: 0.1,
                max_tokens: 250,
                response_format: { type: 'json_object' }
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('[Kural AI] OpenRouter Error:', data);
            throw new Error(data.error?.message || 'OpenRouter API error');
        }

        const rawContent = data.choices?.[0]?.message?.content || '{}';

        // Parse JSON safely
        let actionObj;
        try {
            actionObj = JSON.parse(rawContent);
        } catch (parseErr) {
            // Try to extract JSON from response if model wrapped it
            const match = rawContent.match(/\{[\s\S]*\}/);
            if (match) {
                actionObj = JSON.parse(match[0]);
            } else {
                actionObj = {
                    action: 'SPEAK_ONLY',
                    voiceMessage: activeLang === 'ta'
                        ? 'கட்டளை புரியவில்லை. மீண்டும் முயற்சிக்கவும்.'
                        : 'I could not understand that command. Please try again.'
                };
            }
        }

        // Safety: always ensure action and voiceMessage exist
        if (!actionObj.action) actionObj.action = 'SPEAK_ONLY';
        if (!actionObj.voiceMessage) {
            actionObj.voiceMessage = activeLang === 'ta' ? 'செய்யப்பட்டது.' : 'Done.';
        }

        console.log(`[Kural AI] Role: ${userRole} | Lang: ${activeLang} | Input: "${text.trim()}" | Action: ${actionObj.action}`);

        res.json(actionObj);

    } catch (err) {
        console.error('[Kural AI] Error:', err);
        res.status(500).json({
            action: 'SPEAK_ONLY',
            voiceMessage: 'Kural AI is temporarily unavailable. Please try again.',
            error: err.message
        });
    }
});

module.exports = router;
