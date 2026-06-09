/**
 * Resend Email Service Wrapper
 */
require('dotenv').config();

const RESEND_API_KEY = process.env.RESEND_API_KEY;

// Safe diagnostic logging (never print the secret key)
console.log("==========================================");
console.log("RESEND CONFIGURATION DIAGNOSTICS:");
console.log(`- API Key Present: ${RESEND_API_KEY ? "TRUE" : "FALSE"}`);
console.log(`- API Key Undefined: ${RESEND_API_KEY === undefined ? "TRUE" : "FALSE"}`);
console.log(`- API Key Empty: ${RESEND_API_KEY === "" ? "TRUE" : "FALSE"}`);
if (RESEND_API_KEY) {
    console.log(`- API Key Length: ${RESEND_API_KEY.length} characters`);
}
console.log("==========================================");

/**
 * Sends an email using the Resend REST API
 * @param {Object} options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML content of the email
 * @returns {Promise<Object>} Resend API response
 */
async function sendEmail({ to, subject, html }) {
    if (!RESEND_API_KEY || RESEND_API_KEY.trim() === '') {
        console.error("[ERROR] RESEND_API_KEY is missing or empty in environment variables.");
        throw new Error("Email Service Unavailable. Please contact administrator.");
    }

    console.log(`[EMAIL DISPATCH] Attempting to send email to recipient: ${to}`);
    
    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: 'MakkalSevi <onboarding@resend.dev>',
                to: [to],
                subject: subject,
                html: html
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error(`[ERROR] Resend API responded with status ${response.status}:`, JSON.stringify(data));
            throw new Error(data.message || `Failed to send verification email (HTTP ${response.status})`);
        }

        console.log(`[SUCCESS] Email sent successfully. Resend ID: ${data.id}`);
        return { success: true, ...data };
    } catch (error) {
        console.error("[ERROR] Failed to send email via Resend API:", error);
        throw error;
    }
}

module.exports = {
    sendEmail
};

