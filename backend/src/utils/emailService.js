/**
 * emailService.js — Brevo (Sendinblue) SMTP Email Service via Nodemailer
 * 
 * Uses Brevo's SMTP relay which:
 *  - Works on Render (not blocked unlike Gmail direct SMTP)
 *  - Sends to ANY email address without domain verification
 *  - Free plan: 300 emails/day
 * 
 * Environment Variables Required:
 *   BREVO_SMTP_USER - Your Brevo account email
 *   BREVO_SMTP_KEY  - Your Brevo SMTP key (from brevo.com → Profile → SMTP & API)
 */
require('dotenv').config();
const nodemailer = require('nodemailer');

const BREVO_USER = process.env.BREVO_SMTP_USER;
const BREVO_KEY  = process.env.BREVO_SMTP_KEY;

// ── Diagnostic logging ──
console.log("==========================================");
console.log("BREVO SMTP CONFIGURATION DIAGNOSTICS:");
console.log(`- BREVO_SMTP_USER Present: ${BREVO_USER ? "TRUE" : "FALSE"}`);
console.log(`- BREVO_SMTP_KEY Present: ${BREVO_KEY ? "TRUE" : "FALSE"}`);
if (BREVO_USER) console.log(`- BREVO_SMTP_USER: ${BREVO_USER}`);
console.log("==========================================");

// ── Create Nodemailer transporter using Brevo SMTP relay ──
const transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false,       // STARTTLS — NOT blocked by Render
    auth: {
        user: BREVO_USER,
        pass: BREVO_KEY
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000
});

// ── Verify SMTP connection on startup ──
if (BREVO_USER && BREVO_KEY) {
    transporter.verify()
        .then(() => {
            console.log("[EMAIL SERVICE] ✅ Brevo SMTP connection verified successfully.");
        })
        .catch((err) => {
            console.error("[EMAIL SERVICE] ❌ Brevo SMTP connection FAILED:", err.message);
        });
} else {
    console.warn("[EMAIL SERVICE] ⚠️ BREVO_SMTP_USER or BREVO_SMTP_KEY missing. Email sending will fail.");
}

/**
 * Sends an email using Brevo SMTP via Nodemailer
 * @param {Object} options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML content
 */
async function sendEmail({ to, subject, html }) {
    if (!BREVO_USER || !BREVO_KEY) {
        throw new Error("Email Service Unavailable. SMTP credentials not configured. Please contact administrator.");
    }

    console.log(`[EMAIL DISPATCH] Sending email to: ${to} | Subject: ${subject}`);

    try {
        const mailOptions = {
            from: `"MakkalKural - Citizen Portal" <${BREVO_USER}>`,
            to: to,
            subject: subject,
            html: html
        };

        const info = await transporter.sendMail(mailOptions);

        console.log(`[SUCCESS] Email sent. Message ID: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error("[ERROR] Failed to send email via Brevo:", error.message);

        if (error.code === 'EAUTH') {
            throw new Error("Email authentication failed. Please verify Brevo SMTP credentials.");
        } else if (error.code === 'ESOCKET' || error.code === 'ECONNECTION') {
            throw new Error("Unable to connect to email server. Please try again later.");
        } else {
            throw new Error(`Failed to send verification email: ${error.message}`);
        }
    }
}

module.exports = { sendEmail };
