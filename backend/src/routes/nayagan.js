/**
 * nayagan.js — Nayagan AI Voice Assistant Backend Route
 *
 * POST /api/nayagan-ai/command
 * Accepts voice command text + user context, returns structured action JSON
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
            'SHOW_TAB',
            'SHOW_MAP',
            'SPEAK_ONLY'
        ],
        allowedPages: ['citizen-dashboard.html'],
        description: 'Can view own complaints, raise new issues, view map, and track issue status.'
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
   SYSTEM PROMPT BUILDER
───────────────────────────────────────────────────────────────── */
function buildSystemPrompt(userRole, currentPage) {
    const caps = ROLE_CAPABILITIES[userRole] || ROLE_CAPABILITIES['USER'];

    return `You are Nayagan AI, a bilingual voice assistant for "MakkalKural" — a civic issue reporting and governance platform in Tamil Nadu, India.

Your job: Convert the user's voice command into a structured JSON action object that the frontend will execute.

USER CONTEXT:
- Role: ${caps.label}
- Current Page: ${currentPage || caps.dashboard}
- Permissions: ${caps.description}

AVAILABLE ACTIONS (return ONLY one of these JSON structures):

1. Navigate to a page:
{"action":"NAVIGATE","page":"citizen-dashboard.html","voiceMessage":"Opening citizen dashboard."}
{"action":"NAVIGATE","page":"department-dashboard.html","voiceMessage":"Department dashboard thirakkiren."}

2. Filter issues on current page:
{"action":"FILTER_ISSUES","priority":"HIGH","status":"PENDING","voiceMessage":"High priority pending issues ah kaattukiren."}
{"action":"FILTER_ISSUES","priority":"EMERGENCY","voiceMessage":"Emergency issues ah filter pannitaen."}
{"action":"FILTER_ISSUES","status":"PENDING","voiceMessage":"Pending complaints ah kaattukiren."}
{"action":"FILTER_ISSUES","status":"IN_PROGRESS","voiceMessage":"In-progress issues shown."}
{"action":"FILTER_ISSUES","status":"COMPLETED","voiceMessage":"Completed issues kaattukiren."}
{"action":"FILTER_ISSUES","priority":"LOW","voiceMessage":"Low priority issues shown."}
{"action":"FILTER_ISSUES","clearAll":true,"voiceMessage":"All filters cleared."}

3. Switch to a tab on the page:
{"action":"SHOW_TAB","tabName":"analytics","voiceMessage":"Analytics section thirakkiren."}
{"action":"SHOW_TAB","tabName":"issues","voiceMessage":"Issues tab ah thirakkiren."}
{"action":"SHOW_TAB","tabName":"map","voiceMessage":"Map view thirakkiren."}
{"action":"SHOW_TAB","tabName":"reports","voiceMessage":"Reports section kaattukiren."}
{"action":"SHOW_TAB","tabName":"employees","voiceMessage":"Employees section thirakkiren."}
{"action":"SHOW_TAB","tabName":"campaigns","voiceMessage":"Campaigns section thirakkiren."}
{"action":"SHOW_TAB","tabName":"leaderboard","voiceMessage":"Leaderboard kaattukiren."}
{"action":"SHOW_TAB","tabName":"overview","voiceMessage":"Overview section thirakkiren."}
{"action":"SHOW_TAB","tabName":"performance","voiceMessage":"Performance section kaattukiren."}

4. Open raise issue flow:
{"action":"OPEN_RAISE_ISSUE","title":"Road damage","category":"Roads","description":"User reported road damage issue.","voiceMessage":"Raise issue form thirakkiren. Thaangal villarathil photo upload pannungal."}

5. Trigger report download:
{"action":"TRIGGER_DOWNLOAD","format":"pdf","dateRange":"today","voiceMessage":"Today's report download pannukiren."}
{"action":"TRIGGER_DOWNLOAD","format":"excel","dateRange":"this_week","voiceMessage":"This week report download pannukiren."}
{"action":"TRIGGER_DOWNLOAD","format":"pdf","dateRange":"this_month","voiceMessage":"This month's report download pannukiren."}

6. Speak only (no action, e.g. permission denied or unknown command):
{"action":"SPEAK_ONLY","voiceMessage":"Indha feature ungalukkு access illai."}
{"action":"SPEAK_ONLY","voiceMessage":"I didn't understand that. Please try again."}

LANGUAGE RULES:
- Detect the input language (English / Tamil / Tanglish).
- voiceMessage MUST be in the same language/style as the user's input.
- Tamil input → voiceMessage in Tamil.
- English input → voiceMessage in English.
- Tanglish input → voiceMessage in Tanglish.

PERMISSION RULES:
- Role "${caps.label}" allowed actions: ${caps.allowedActions.includes('ALL') ? 'ALL actions' : caps.allowedActions.join(', ')}.
- If a requested action is NOT in allowed actions, return SPEAK_ONLY with "Indha feature ungalukkு access illai." (Tamil) or "You don't have access to this feature." (English).
- Citizens CANNOT access analytics, download reports, or view all issues — only their own.
- Employees CANNOT raise issues on behalf of citizens.

CRITICAL OUTPUT RULES:
- Return ONLY valid JSON. No explanation, no markdown, no extra text.
- The JSON must contain "action" and "voiceMessage" fields always.
- Never fabricate actions not listed above.
- If you cannot understand the command, return SPEAK_ONLY.

DEPARTMENT / CATEGORY MAPPING (for OPEN_RAISE_ISSUE):
- Road/Pothole/Pavement → category: "Roads"
- Garbage/Waste/Trash → category: "Sanitation"
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
    const { text, currentPage } = req.body;
    const userRole = req.user?.role || 'USER';

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
        return res.status(400).json({ error: 'Voice command text is required.' });
    }

    if (!OPENROUTER_API_KEY) {
        console.error('[Nayagan AI] OPENROUTER_API_KEY is missing');
        return res.status(500).json({ error: 'Nayagan AI is temporarily unavailable. (Missing API Key)' });
    }

    const systemPrompt = buildSystemPrompt(userRole, currentPage);

    try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://cleancitymdu.netlify.app',
                'X-Title': 'MakkalKural Nayagan AI Voice Assistant'
            },
            body: JSON.stringify({
                model: NAYAGAN_MODEL,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: text.trim() }
                ],
                temperature: 0.1,
                max_tokens: 200,
                response_format: { type: 'json_object' }
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('[Nayagan AI] OpenRouter Error:', data);
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
                    voiceMessage: 'I could not understand that command. Please try again.'
                };
            }
        }

        // Safety: always ensure action and voiceMessage exist
        if (!actionObj.action) actionObj.action = 'SPEAK_ONLY';
        if (!actionObj.voiceMessage) actionObj.voiceMessage = 'Done.';

        console.log(`[Nayagan AI] Role: ${userRole} | Input: "${text.trim()}" | Action: ${actionObj.action}`);

        res.json(actionObj);

    } catch (err) {
        console.error('[Nayagan AI] Error:', err);
        res.status(500).json({
            action: 'SPEAK_ONLY',
            voiceMessage: 'Nayagan AI is temporarily unavailable. Please try again.',
            error: err.message
        });
    }
});

module.exports = router;
