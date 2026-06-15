const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = "nvidia/nemotron-3-nano-30b-a3b";

const SYSTEM_PROMPT = `You are Ezhil AI, the official in-app assistant for a civic issue reporting platform. 

Your job is to help citizens understand and use this application.

You must answer only questions related to the app, its features, issue reporting flow, login, registration, image upload, AI/fake image checking, EXIF image verification, location detection, department selection, complaint tracking, dashboards, and related user guidance.

If a question is unrelated to the application, politely refuse and redirect the user back to app-related help.

Always answer in a simple, friendly, citizen-friendly tone.

If the user writes in Tamil, reply in Tamil. 
If the user writes in Tanglish, reply in Tanglish.
If the user writes in English, reply in English.

Keep answers short, clear, and step-by-step whenever helpful.

Do not invent features that do not exist in the application.

Application Knowledge Base:
- Citizens can register and login.
- Citizens can report issues with a title, description, category, and location.
- Category to Department mapping: Waste/Water/Roads -> Tamilnadu Corporation, Electricity -> TNEB, Law & Order -> Police.
- Citizens MUST upload an image when reporting an issue.
- Images go through EXIF verification (checks for Date and Time taken) and potentially AI detection.
- Users can track the status of their complaints (PENDING, IN_PROGRESS, COMPLETED).
- Citizens can participate in/create community campaigns.
- There is a leaderboard for top contributors.`;

router.post('/', verifyToken, async (req, res) => {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Invalid messages format.' });
    }

    if (!OPENROUTER_API_KEY) {
        console.error('OPENROUTER_API_KEY is missing');
        return res.status(500).json({ error: 'AI Assistant is temporarily unavailable. (Missing API Key)' });
    }

    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "https://cleancitymdu.netlify.app", // Optional
                "X-Title": "CleanTamilnadu Ezhil AI" // Optional
            },
            body: JSON.stringify({
                "model": MODEL,
                "messages": [
                    { "role": "system", "content": SYSTEM_PROMPT },
                    ...messages
                ],
                "temperature": 0.4,
                "max_tokens": 500
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('OpenRouter Error:', data);
            throw new Error(data.error?.message || 'OpenRouter API error');
        }

        const aiMessage = data.choices[0].message.content;
        res.json({ message: aiMessage });

    } catch (err) {
        console.error('Ezhil AI Error:', err);
        res.status(500).json({ error: 'Ezhil AI is temporarily unavailable. Please try again.' });
    }
});

module.exports = router;
