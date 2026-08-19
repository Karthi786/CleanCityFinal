/**
 * petition.js — Report Petition Backend Route
 *
 * POST /api/petition/generate   — AI petition generation via OpenRouter
 * POST /api/petition/submit     — Save petition to database
 * GET  /api/petition/my-petitions — Get user's own petitions
 *
 * Uses google/gemma-4-26b-a4b-it:free via OpenRouter (same API key as Ezhil AI / Kural AI)
 * Does NOT modify any existing business logic.
 */

const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const { verifyToken, requireRole, requireApproved } = require('../middleware/auth');

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const PETITION_MODEL = 'google/gemma-4-26b-a4b-it:free';

/* ─────────────────────────────────────────────────────────────────
   SYSTEM PROMPT — Petition Generation
───────────────────────────────────────────────────────────────── */
function buildPetitionSystemPrompt(language) {
    const langInstruction = language === 'ta'
        ? 'The selected language is Tamil. Generate the petition in natural and formal Tamil using Tamil script. Do not translate proper nouns unnecessarily.'
        : 'The selected language is English. Generate the petition in clear English.';

    return `You are the Petition Generation Assistant for Makkal Kural, a civic issue reporting platform.

Your task is to analyse a citizen's issue description and convert it into a clear, respectful, concise, government-style basic petition.

The citizen may provide the issue in Tamil or English.

Understand the meaning of the citizen's message even when:
- The language is informal.
- The grammar is incorrect.
- The message contains spoken-language expressions.
- The user mixes Tamil and English.
- The information is given in an unstructured order.
- The description comes from speech-to-text and contains transcription mistakes.

Do not change the actual meaning of the citizen's complaint.

Extract the important information from the description, such as:
- Nature of the problem
- Location, if mentioned
- Duration, if mentioned
- People affected
- Impact of the problem
- Previous complaints or actions, if mentioned
- Requested government action
- Any other important factual information explicitly provided by the citizen

Create a basic petition using only the information provided.

Do NOT invent:
- Names
- Addresses
- Dates
- Officials
- Government departments
- Complaint numbers
- Locations
- Statistics
- Legal sections
- Government schemes
- Medical information
- Financial losses
- Any other facts not explicitly provided

If information is missing, simply omit it. Do not make unsupported assumptions.

The petition should be respectful, formal, clear and easy for a government officer to understand.
Do not make the petition unnecessarily complicated or overly legal.
Preserve the citizen's actual concern and requested action.

${langInstruction}

Do not add fictional information.

PETITION STRUCTURE:

${language === 'ta' ? `Use this Tamil structure:

பொருள்: [பிரச்சினையின் சுருக்கமான பொருள்]

மதிப்பிற்குரிய ஐயா / அம்மா,

எங்கள் பகுதியில் ஏற்பட்டுள்ள [பிரச்சினை] தொடர்பாக தங்களது கவனத்திற்கு கொண்டு வர விரும்புகிறேன்.

[குடிமகன் வழங்கிய தகவல்களின் அடிப்படையில் பிரச்சினையை தெளிவாக விவரிக்கவும்.]

இந்த பிரச்சினையால் [பாதிக்கப்பட்டவர்கள்/பகுதி, குறிப்பிடப்பட்டிருந்தால் மட்டும்] பாதிக்கப்படுகின்றனர். மேலும் [பாதிப்பு, குறிப்பிடப்பட்டிருந்தால் மட்டும்] ஏற்படுகிறது.

எனவே, இப்பிரச்சினையை விரைவாக தீர்க்க சம்பந்தப்பட்ட அதிகாரிகள் தேவையான நடவடிக்கை எடுக்குமாறு பணிவுடன் கேட்டுக்கொள்கிறேன்.

நன்றி.

தங்கள் உண்மையுள்ள,
குடிமகன்` : `Use this English structure:

Subject: [Short subject describing the issue]

Respected Sir/Madam,

I would like to bring to your kind attention the issue regarding [problem].

[Explain the issue clearly using the information provided by the citizen.]

This issue is affecting [affected people/area, only if mentioned] and is causing [impact, only if mentioned].

Therefore, I kindly request the concerned authorities to take necessary action to resolve this issue at the earliest.

Thank you.

Yours faithfully,
Citizen`}

Do not blindly use every sentence above when information is unavailable. Adapt the petition naturally according to the actual input.

OUTPUT FORMAT:
You MUST return ONLY valid JSON with this exact structure:
{
  "language": "${language}",
  "subject": "Short petition subject",
  "petition": "Complete generated petition text",
  "key_points": ["Important point 1", "Important point 2"],
  "location": null,
  "duration": null,
  "requested_action": "Requested action if explicitly mentioned"
}

Use null whenever a field is not available from the citizen's description.
Return ONLY the JSON object. No explanation, no markdown, no extra text.`;
}

/* ─────────────────────────────────────────────────────────────────
   POST /api/petition/generate
   AI petition generation via OpenRouter
───────────────────────────────────────────────────────────────── */
router.post('/generate', verifyToken, requireApproved, requireRole('USER'), async (req, res) => {
    const { description, language } = req.body;

    // Validate input
    if (!description || typeof description !== 'string' || description.trim().length === 0) {
        return res.status(400).json({ error: 'Description is required.' });
    }

    const activeLang = (language === 'ta') ? 'ta' : 'en';

    if (!OPENROUTER_API_KEY) {
        console.error('[Petition] OPENROUTER_API_KEY is missing');
        return res.status(500).json({ error: 'Petition service is temporarily unavailable.' });
    }

    const systemPrompt = buildPetitionSystemPrompt(activeLang);

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://cleancitymdu.netlify.app',
                'X-Title': 'MakkalKural Petition Generator'
            },
            body: JSON.stringify({
                model: PETITION_MODEL,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: description.trim() }
                ],
                temperature: 0.3,
                max_tokens: 1500,
                response_format: { type: 'json_object' }
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        const data = await response.json();

        if (!response.ok) {
            console.error('[Petition] OpenRouter Error:', data);
            if (response.status === 429) {
                return res.status(429).json({ error: 'Too many requests. Please try again in a moment.' });
            }
            throw new Error(data.error?.message || 'OpenRouter API error');
        }

        const rawContent = data.choices?.[0]?.message?.content || '{}';

        // Parse JSON safely
        let petitionData;
        try {
            petitionData = JSON.parse(rawContent);
        } catch (parseErr) {
            // Try to extract JSON from response if model wrapped it
            const match = rawContent.match(/\{[\s\S]*\}/);
            if (match) {
                try {
                    petitionData = JSON.parse(match[0]);
                } catch (_) {
                    console.error('[Petition] Failed to parse AI response:', rawContent.substring(0, 500));
                    return res.status(500).json({ error: 'Failed to process petition. Please try again.' });
                }
            } else {
                console.error('[Petition] No JSON found in AI response:', rawContent.substring(0, 500));
                return res.status(500).json({ error: 'Failed to process petition. Please try again.' });
            }
        }

        // Validate and sanitize response
        const result = {
            language: petitionData.language || activeLang,
            subject: petitionData.subject || null,
            petition: petitionData.petition || null,
            key_points: Array.isArray(petitionData.key_points) ? petitionData.key_points : [],
            location: petitionData.location || null,
            duration: petitionData.duration || null,
            requested_action: petitionData.requested_action || null
        };

        if (!result.petition) {
            console.error('[Petition] AI returned empty petition');
            return res.status(500).json({ error: 'Failed to generate petition. Please try again.' });
        }

        console.log(`[Petition] Generated | Lang: ${activeLang} | Subject: "${(result.subject || '').substring(0, 60)}"`);

        res.json(result);

    } catch (err) {
        if (err.name === 'AbortError') {
            console.error('[Petition] Request timed out');
            return res.status(504).json({ error: 'Petition generation timed out. Please try again.' });
        }
        console.error('[Petition] Error:', err);
        res.status(500).json({ error: 'Petition service is temporarily unavailable. Please try again.' });
    }
});

/* ─────────────────────────────────────────────────────────────────
   POST /api/petition/submit
   Save petition to database
───────────────────────────────────────────────────────────────── */
router.post('/submit', verifyToken, requireApproved, requireRole('USER'), async (req, res) => {
    const {
        originalDescription,
        language,
        inputMethod,
        subject,
        petition,
        keyPoints,
        location,
        duration,
        requestedAction
    } = req.body;

    // Validate required fields
    if (!originalDescription || typeof originalDescription !== 'string' || originalDescription.trim().length === 0) {
        return res.status(400).json({ error: 'Original description is required.' });
    }
    if (!petition || typeof petition !== 'string' || petition.trim().length === 0) {
        return res.status(400).json({ error: 'Petition text is required.' });
    }

    const activeLang = (language === 'ta') ? 'ta' : 'en';
    const method = (inputMethod === 'voice') ? 'voice' : 'text';

    try {
        const { data, error } = await supabaseAdmin
            .from('petitions')
            .insert({
                user_id: req.userId,
                original_description: originalDescription.trim(),
                language: activeLang,
                input_method: method,
                generated_subject: subject || null,
                generated_petition: petition.trim(),
                key_points: Array.isArray(keyPoints) ? keyPoints : [],
                location: location || null,
                duration: duration || null,
                requested_action: requestedAction || null,
                edited_petition: null,
                ai_model_used: PETITION_MODEL,
                status: 'SUBMITTED'
            })
            .select()
            .single();

        if (error) throw error;

        console.log(`[Petition] Submitted | User: ${req.userId} | ID: ${data.id}`);

        return res.status(201).json({
            message: 'Petition submitted successfully.',
            petition: data
        });
    } catch (err) {
        console.error('[Petition] Submit error:', err);
        return res.status(500).json({ error: 'Failed to submit petition.' });
    }
});

/* ─────────────────────────────────────────────────────────────────
   GET /api/petition/my-petitions
   Get user's own petitions
───────────────────────────────────────────────────────────────── */
router.get('/my-petitions', verifyToken, requireApproved, async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('petitions')
            .select('*')
            .eq('user_id', req.userId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return res.json({ petitions: data || [] });
    } catch (err) {
        console.error('[Petition] Fetch error:', err);
        return res.status(500).json({ error: 'Failed to fetch petitions.' });
    }
});

module.exports = router;
