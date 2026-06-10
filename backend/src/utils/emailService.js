/**
 * emailService.js — Gmail SMTP Email Service via Nodemailer
 * 
 * Replaces the old Resend API integration with Gmail SMTP.
 * Uses Nodemailer with App Password authentication.
 * 
 * Environment Variables Required:
 *   EMAIL_USER - Gmail address (e.g. makkalsevi1@gmail.com)
 *   EMAIL_PASS - 16-character Gmail App Password
 */
require('dotenv').config();
const nodemailer = require('nodemailer');

const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

// ── Diagnostic logging (never prints credentials) ──
console.log("==========================================");
console.log("GMAIL SMTP CONFIGURATION DIAGNOSTICS:");
console.log(`- EMAIL_USER Present: ${EMAIL_USER ? "TRUE" : "FALSE"}`);
console.log(`- EMAIL_PASS Present: ${EMAIL_PASS ? "TRUE" : "FALSE"}`);
if (EMAIL_USER) {
    console.log(`- EMAIL_USER: ${EMAIL_USER}`);
}
if (EMAIL_PASS) {
    console.log(`- EMAIL_PASS Length: ${EMAIL_PASS.length} characters`);
}
console.log("==========================================");

// ── Create reusable Nodemailer transporter ──
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // Use STARTTLS
    auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS
    },
    // Connection pool for better performance
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    // Timeout settings
    connectionTimeout: 10000, // 10 seconds
    greetingTimeout: 10000,
    socketTimeout: 15000
});

// ── Verify SMTP connection on startup ──
if (EMAIL_USER && EMAIL_PASS) {
    transporter.verify()
        .then(() => {
            console.log("[EMAIL SERVICE] ✅ Gmail SMTP connection verified successfully.");
        })
        .catch((err) => {
            console.error("[EMAIL SERVICE] ❌ Gmail SMTP connection verification FAILED:", err.message);
            console.error("[EMAIL SERVICE] Check EMAIL_USER and EMAIL_PASS in .env");
        });
} else {
    console.warn("[EMAIL SERVICE] ⚠️ EMAIL_USER or EMAIL_PASS missing. Email sending will fail.");
}

/**
 * Sends an email using Gmail SMTP via Nodemailer
 * 
 * @param {Object} options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject line
 * @param {string} options.html - HTML content of the email body
 * @returns {Promise<Object>} Nodemailer send result
 * @throws {Error} If SMTP credentials are missing or sending fails
 */
async function sendEmail({ to, subject, html }) {
    // ── Validate SMTP credentials ──
    if (!EMAIL_USER || !EMAIL_PASS || EMAIL_USER.trim() === '' || EMAIL_PASS.trim() === '') {
        console.error("[ERROR] EMAIL_USER or EMAIL_PASS is missing or empty in environment variables.");
        throw new Error("Email Service Unavailable. SMTP credentials not configured. Please contact administrator.");
    }

    console.log(`[EMAIL DISPATCH] Attempting to send email to: ${to}`);
    console.log(`[EMAIL DISPATCH] Subject: ${subject}`);

    try {
        const mailOptions = {
            from: `"MakkalSevi - Citizen Portal" <${EMAIL_USER}>`,
            to: to,
            subject: subject,
            html: html
        };

        const info = await transporter.sendMail(mailOptions);

        console.log(`[SUCCESS] Email sent successfully.`);
        console.log(`[SUCCESS] Message ID: ${info.messageId}`);
        console.log(`[SUCCESS] Accepted: ${info.accepted.join(', ')}`);

        return { success: true, messageId: info.messageId, accepted: info.accepted };
    } catch (error) {
        console.error("[ERROR] Failed to send email via Gmail SMTP:", error.message);

        // Provide user-friendly error messages based on error type
        if (error.code === 'EAUTH') {
            throw new Error("Email authentication failed. Please verify Gmail App Password configuration.");
        } else if (error.code === 'ESOCKET' || error.code === 'ECONNECTION') {
            throw new Error("Unable to connect to email server. Please try again later.");
        } else if (error.code === 'EENVELOPE') {
            throw new Error("Invalid recipient email address.");
        } else {
            throw new Error(`Failed to send verification email: ${error.message}`);
        }
    }
}

module.exports = {
    sendEmail
};
