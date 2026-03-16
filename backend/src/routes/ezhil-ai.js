/**
 * ezhil-ai.js
 * Secure backend proxy for the Ezhil AI chatbot.
 * Calls OpenRouter (nvidia/nemotron-3-nano-30b-a3b) and returns a plain reply.
 * The API key is NEVER exposed to the frontend.
 */

const express = require('express');
const axios = require('axios');
const router = express.Router();

/* ── System Prompt ── */
const SYSTEM_PROMPT = `You are Ezhil AI (எழில் AI), the official assistant for a civic issue reporting platform called "Smart & Clean Madurai". Your job is to help citizens understand how to use the app.

APP FEATURES YOU MUST KNOW:
1. REGISTRATION: Register on the Register page. Admin approval is required.
2. LOGIN: Log in with email/password after approval.
3. REPORTING AN ISSUE: Click "Report Issue" in the Citizen Dashboard.
4. IMAGE UPLOAD & VERIFICATION: Real photos only. Sightengine AI detects fake/AI images.
5. DEPARTMENT SELECTION: Choose Roads, Water, Sanitation, Electricity, etc.
6. LOCATION CAPTURE: Automatic GPS or manual address.
7. COMPLAINT TRACKING: Track status (Pending, In Progress, Completed) on the Citizen Dashboard.

BEHAVIOR RULES:
- DEFAULT LANGUAGE: English.
- LANGUAGE SWITCHING: Only switch to Tamil if the user explicitly asks (e.g., "தமிழில் பேசுங்கள்"). Maintain the selected language until asked to switch back to English.
- CONTEXT: Answer only questions related to the application and its features.
- TONE: Simple, friendly, citizen-centric.

UNRELATED QUESTIONS:
- English: "Sorry, I can only help with using this application."
- Tamil: "மன்னிக்கவும், இந்த பயன்பாட்டைப் பயன்படுத்த உதவுவதற்காக மட்டுமே நான் உள்ளேன்."`;

/* ── POST /api/ezhil-ai ── */
router.post('/', async (req, res) => {
    try {
        const { messages } = req.body;

        if (!Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({ error: 'messages array is required.' });
        }

        const apiKey = process.env.OPENROUTER_API_KEY;
        if (!apiKey) {
            console.error('[Ezhil AI] OPENROUTER_API_KEY is not set in environment.');
            return res.status(500).json({ error: 'Ezhil AI is temporarily unavailable. Please try again.' });
        }

        const payload = {
            model: 'nvidia/nemotron-3-nano-30b-a3b',
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                ...messages
            ],
            temperature: 0.4,
            max_tokens: 500
        };

        const response = await axios.post(
            'https://openrouter.ai/api/v1/chat/completions',
            payload,
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://cleancitymdu.netlify.app',
                    'X-Title': 'CleanMadurai Ezhil AI'
                },
                timeout: 30000
            }
        );

        const reply = response.data?.choices?.[0]?.message?.content;
        if (!reply) {
            throw new Error('Empty response from OpenRouter.');
        }

        return res.json({ reply });

    } catch (err) {
        const errData = err?.response?.data;
        console.error('[Ezhil AI] Error:', JSON.stringify(errData) || err.message);
        return res.status(502).json({
            error: 'Ezhil AI is temporarily unavailable. Please try again.'
        });
    }
});

module.exports = router;
