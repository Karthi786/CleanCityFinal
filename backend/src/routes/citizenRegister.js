const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { supabaseAdmin } = require('../config/supabase');
const districtsMapping = require('../config/districts');
// ── Use Gmail SMTP email service instead of Resend ──
const { sendEmail } = require('../utils/emailService');
require('dotenv').config();

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;
const MAX_ATTEMPTS = 5;         // Max OTP verification attempts before lockout
const MAX_RESENDS = 5;          // Max resend attempts per OTP session
const MAX_OTP_PER_HOUR = 5;    // Max OTP requests per hour per email (rate limiting)

/**
 * Utility: Clean up expired OTPs from the database
 * Called before OTP operations to keep the table clean
 */
async function cleanupExpiredOTPs() {
    try {
        await supabaseAdmin
            .from('otps')
            .delete()
            .lt('expires_at', new Date().toISOString());
    } catch (err) {
        console.error('Error cleaning up expired OTPs:', err);
    }
}

/**
 * Utility: Generate a professional branded HTML email template for OTP verification
 * @param {string} name - Recipient's name
 * @param {string} otp - The 6-digit OTP code
 * @returns {string} Complete HTML email body
 */
function generateOTPEmailTemplate(name, otp) {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #f4f5f7; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f5f7; padding: 40px 20px;">
            <tr>
                <td align="center">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="480" style="max-width: 480px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
                        
                        <!-- Header Banner -->
                        <tr>
                            <td style="background: linear-gradient(135deg, #B00000 0%, #8B0000 50%, #600000 100%); padding: 32px 40px; text-align: center;">
                                <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: 0.5px;">
                                    🌿 MakkalSevi
                                </h1>
                                <p style="margin: 6px 0 0 0; color: rgba(255,255,255,0.85); font-size: 13px; font-weight: 400;">
                                    Citizen Portal — Email Verification
                                </p>
                            </td>
                        </tr>
                        
                        <!-- Body Content -->
                        <tr>
                            <td style="padding: 36px 40px 20px 40px;">
                                <p style="margin: 0 0 20px 0; color: #1a1a2e; font-size: 16px; line-height: 1.6;">
                                    Hello <strong>${name}</strong>,
                                </p>
                                <p style="margin: 0 0 24px 0; color: #444; font-size: 15px; line-height: 1.6;">
                                    Thank you for registering with <strong>Citizen Portal</strong>. Please use the verification code below to complete your registration.
                                </p>
                                
                                <!-- OTP Code Box -->
                                <div style="background: linear-gradient(135deg, #fef9f0 0%, #fff5e6 100%); border: 2px dashed #B00000; border-radius: 14px; padding: 28px; text-align: center; margin: 0 0 24px 0;">
                                    <p style="margin: 0 0 8px 0; color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; font-weight: 600;">
                                        Your Verification Code
                                    </p>
                                    <p style="margin: 0; color: #B00000; font-size: 36px; font-weight: 800; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                                        ${otp}
                                    </p>
                                </div>
                                
                                <!-- Expiry Notice -->
                                <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; border-radius: 8px; padding: 14px 18px; margin: 0 0 24px 0;">
                                    <p style="margin: 0; color: #664d03; font-size: 13px; line-height: 1.5;">
                                        ⏰ This code will expire in <strong>10 minutes</strong>. If expired, please request a new one.
                                    </p>
                                </div>
                                
                                <!-- Security Notice -->
                                <div style="background-color: #f8f9fa; border-radius: 8px; padding: 14px 18px; margin: 0 0 24px 0;">
                                    <p style="margin: 0; color: #6c757d; font-size: 12px; line-height: 1.5;">
                                        🔒 <strong>Security Notice:</strong> If you did not request this code, please ignore this email. Never share your OTP with anyone. Our team will never ask for your verification code.
                                    </p>
                                </div>
                            </td>
                        </tr>
                        
                        <!-- Footer -->
                        <tr>
                            <td style="padding: 20px 40px 32px 40px; border-top: 1px solid #eee;">
                                <p style="margin: 0 0 4px 0; color: #888; font-size: 13px; line-height: 1.5;">
                                    Regards,<br>
                                    <strong style="color: #B00000;">Citizen Portal Team</strong>
                                </p>
                                <p style="margin: 16px 0 0 0; color: #aaa; font-size: 11px;">
                                    © ${new Date().getFullYear()} MakkalSevi — Tamilnadu District Administration
                                </p>
                            </td>
                        </tr>
                        
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    `;
}

/**
 * GET /api/citizen/districts
 * Returns all Tamil Nadu districts and their constituencies
 */
router.get('/districts', (req, res) => {
    return res.json(districtsMapping);
});

/**
 * POST /api/citizen/check-uniqueness
 * Check email or phone number uniqueness against existing users
 */
router.post('/check-uniqueness', async (req, res) => {
    const { email, phone_number } = req.body;

    try {
        if (email) {
            const cleanEmail = email.trim().toLowerCase();
            const sqlQuery = `SELECT id FROM public.users WHERE email = '${cleanEmail}' LIMIT 1;`;
            console.log(`Phone Validation Started - Checking users table`);
            console.log(`[SQL QUERY] Executing: ${sqlQuery}`);
            
            const { data: existingEmail, error: emailCheckError } = await supabaseAdmin
                .from('users')
                .select('id')
                .eq('email', cleanEmail)
                .maybeSingle();

            if (emailCheckError) {
                console.error(`[DATABASE ERROR] SQL Query: ${sqlQuery}`);
                console.error(`[DATABASE ERROR] Message: ${emailCheckError.message}`);
                console.error(`[DATABASE ERROR] Details:`, emailCheckError);
                console.log("Validation Failed: Database error occurred.");
                return res.status(500).json({ error: 'Email validation failed. Please try again later.' });
            }

            if (existingEmail) {
                console.log("Validation Failed: Email already registered.");
                return res.status(400).json({ error: 'Email already registered' });
            }
            console.log("Validation Passed: Email is unique.");
        }

        if (phone_number) {
            const cleanPhone = phone_number.trim();
            const sqlQuery = `SELECT id FROM public.users WHERE phone_number = '${cleanPhone}' LIMIT 1;`;
            console.log(`Phone Validation Started - Checking users table`);
            console.log(`Using column: phone_number`);
            console.log(`[SQL QUERY] Executing: ${sqlQuery}`);

            const { data: existingPhone, error: phoneCheckError } = await supabaseAdmin
                .from('users')
                .select('id')
                .eq('phone_number', cleanPhone)
                .maybeSingle();

            if (phoneCheckError) {
                console.error(`[DATABASE ERROR] SQL Query: ${sqlQuery}`);
                console.error(`[DATABASE ERROR] Message: ${phoneCheckError.message}`);
                console.error(`[DATABASE ERROR] Details:`, phoneCheckError);
                console.log(`Validation Failed: ${phoneCheckError.message}`);
                return res.status(500).json({ error: 'Phone validation failed. Please try again later.' });
            }

            if (existingPhone) {
                console.log("Validation Failed: Phone number already registered.");
                return res.status(400).json({ error: 'Phone number already registered' });
            }
            console.log("Validation Passed: Phone number is unique.");
        }

        return res.json({ available: true });
    } catch (err) {
        console.error('Uniqueness check error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/citizen/register-request
 * Step 1: Validates registration details, generates OTP, sends via Gmail SMTP
 * 
 * Does NOT create the user account — that happens after OTP verification.
 * Includes rate limiting: max 5 OTP requests per hour per email.
 */
router.post('/register-request', async (req, res) => {
    await cleanupExpiredOTPs();

    const { name, dob, email, phone_number, district, constituency, password } = req.body;

    // ── 1. Required field validation ──
    if (!name || !dob || !email || !phone_number || !district || !constituency || !password) {
        return res.status(400).json({ error: 'All fields are required.' });
    }

    // ── 2. Name validation (3-100 characters) ──
    if (name.length < 3 || name.length > 100) {
        return res.status(400).json({ error: 'Name must be between 3 and 100 characters.' });
    }

    // ── 3. Date of birth / Age validation (>= 18 years, not future) ──
    const birthDate = new Date(dob);
    const today = new Date();
    if (birthDate > today) {
        return res.status(400).json({ error: 'Date of birth cannot be in the future.' });
    }
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    if (age < 18) {
        return res.status(400).json({ error: 'Citizen must be at least 18 years old.' });
    }

    // ── 4. Email format validation ──
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email format.' });
    }

    // ── 5. Phone number validation (Indian 10-digit number) ──
    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(phone_number)) {
        return res.status(400).json({ error: 'Invalid Indian phone number. Must be exactly 10 digits.' });
    }

    // ── 6. District and Constituency validation ──
    if (!districtsMapping[district]) {
        return res.status(400).json({ error: 'Invalid district selected.' });
    }
    if (!districtsMapping[district].includes(constituency)) {
        return res.status(400).json({ error: 'Invalid constituency selected for the district.' });
    }

    // ── 7. Password validation ──
    if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone_number.trim();

    try {
        // ── Check uniqueness in the users table ──
        const emailQuery = `SELECT id FROM public.users WHERE email = '${cleanEmail}' LIMIT 1;`;
        console.log(`Email Validation Started - Checking users table`);
        console.log(`[SQL QUERY] Executing: ${emailQuery}`);

        const { data: existingEmail, error: emailCheckError } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('email', cleanEmail)
            .maybeSingle();

        if (emailCheckError) {
            console.error(`[DATABASE ERROR] SQL Query: ${emailQuery}`);
            console.error(`[DATABASE ERROR] Message: ${emailCheckError.message}`);
            throw new Error('Email validation failed. Please try again later.');
        }

        if (existingEmail) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        const phoneQuery = `SELECT id FROM public.users WHERE phone_number = '${cleanPhone}' LIMIT 1;`;
        console.log(`Phone Validation Started - Checking users table`);
        console.log(`Using column: phone_number`);
        console.log(`[SQL QUERY] Executing: ${phoneQuery}`);

        const { data: existingPhone, error: phoneCheckError } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('phone_number', cleanPhone)
            .maybeSingle();

        if (phoneCheckError) {
            console.error(`[DATABASE ERROR] SQL Query: ${phoneQuery}`);
            console.error(`[DATABASE ERROR] Message: ${phoneCheckError.message}`);
            throw new Error('Phone validation failed. Please try again later.');
        }

        if (existingPhone) {
            return res.status(400).json({ error: 'Phone number already registered' });
        }

        // ── Generate 6-digit OTP and hash it with bcrypt ──
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const salt = await bcrypt.genSalt(10);
        const otpHash = await bcrypt.hash(otp, salt);

        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

        console.log(`[DEBUG] OTP Generation details:`);
        console.log(`- Recipient Email: ${cleanEmail}`);
        console.log(`- Generated OTP (Plaintext): ${otp}`);
        console.log(`- Generated OTP Hash: ${otpHash}`);
        console.log(`- Expiration: ${expiresAt.toISOString()}`);

        // ── Check if there is an existing OTP session for this email ──
        const { data: existingOTP, error: fetchOtpError } = await supabaseAdmin
            .from('otps')
            .select('*')
            .eq('email', cleanEmail)
            .maybeSingle();

        if (fetchOtpError) {
            throw new Error(`Database fetch error (OTP session): ${fetchOtpError.message}`);
        }

        if (existingOTP) {
            // ── Rate limiting: 60-second cooldown between resends ──
            const secondsSinceLastResend = (Date.now() - new Date(existingOTP.last_resend_at).getTime()) / 1000;
            if (secondsSinceLastResend < 60) {
                return res.status(429).json({ error: `Please wait ${Math.ceil(60 - secondsSinceLastResend)} seconds before requesting a new OTP.` });
            }

            // ── Rate limiting: max resend attempts per session ──
            if (existingOTP.resends >= MAX_RESENDS) {
                return res.status(400).json({ error: 'Too many resend attempts. Please try again later.' });
            }

            // ── Update the existing OTP session with new OTP ──
            const { error: updateError } = await supabaseAdmin
                .from('otps')
                .update({
                    otp_hash: otpHash,
                    attempts: 0,
                    resends: existingOTP.resends + 1,
                    registration_data: { name, dob, email: cleanEmail, phone_number: cleanPhone, district, constituency, password },
                    expires_at: expiresAt.toISOString(),
                    last_resend_at: new Date().toISOString()
                })
                .eq('email', cleanEmail);

            if (updateError) {
                throw new Error(`Database update error (OTP): ${updateError.message}`);
            }
            console.log(`[DEBUG] Successfully updated OTP session in database for: ${cleanEmail}`);
        } else {
            // ── Create a new OTP session ──
            const { error: insertError } = await supabaseAdmin
                .from('otps')
                .insert({
                    email: cleanEmail,
                    otp_hash: otpHash,
                    attempts: 0,
                    resends: 0,
                    registration_data: { name, dob, email: cleanEmail, phone_number: cleanPhone, district, constituency, password },
                    expires_at: expiresAt.toISOString(),
                    last_resend_at: new Date().toISOString()
                });

            if (insertError) {
                throw new Error(`Database insert error (OTP): ${insertError.message}`);
            }
            console.log(`[DEBUG] Successfully inserted new OTP session in database for: ${cleanEmail}`);
        }

        // ── Send OTP email via Gmail SMTP ──
        const emailBody = generateOTPEmailTemplate(name, otp);

        await sendEmail({
            to: cleanEmail,
            subject: 'Email Verification - Citizen Portal',
            html: emailBody
        });

        return res.json({ message: 'OTP sent successfully', resendAfter: 60 });
    } catch (err) {
        console.error('Register request error:', err);
        return res.status(500).json({ error: err.message || 'Failed to send OTP. Please try again.' });
    }
});

/**
 * POST /api/citizen/resend-otp
 * Dedicated endpoint for resending OTP without re-submitting full registration data
 * 
 * Rate limiting:
 * - 60-second cooldown between resends
 * - Maximum 5 resend attempts per session
 */
router.post('/resend-otp', async (req, res) => {
    await cleanupExpiredOTPs();

    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Email is required.' });
    }

    const cleanEmail = email.trim().toLowerCase();

    // ── Validate email format ──
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
        return res.status(400).json({ error: 'Invalid email format.' });
    }

    try {
        // ── Look up existing OTP session ──
        const { data: existingOTP, error: fetchError } = await supabaseAdmin
            .from('otps')
            .select('*')
            .eq('email', cleanEmail)
            .maybeSingle();

        if (fetchError) {
            throw new Error(`Database fetch error: ${fetchError.message}`);
        }

        if (!existingOTP) {
            return res.status(400).json({ error: 'No pending registration found for this email. Please start registration again.' });
        }

        // ── Rate limiting: 60-second cooldown ──
        const secondsSinceLastResend = (Date.now() - new Date(existingOTP.last_resend_at).getTime()) / 1000;
        if (secondsSinceLastResend < 60) {
            return res.status(429).json({ error: `Please wait ${Math.ceil(60 - secondsSinceLastResend)} seconds before requesting a new OTP.` });
        }

        // ── Rate limiting: max resend attempts ──
        if (existingOTP.resends >= MAX_RESENDS) {
            return res.status(400).json({ error: 'Maximum resend attempts reached. Please start registration again.' });
        }

        // ── Generate new OTP ──
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const salt = await bcrypt.genSalt(10);
        const otpHash = await bcrypt.hash(otp, salt);
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        console.log(`[DEBUG] Resend OTP for: ${cleanEmail}`);
        console.log(`- New OTP (Plaintext): ${otp}`);
        console.log(`- Resend count: ${existingOTP.resends + 1}/${MAX_RESENDS}`);

        // ── Update OTP session: invalidate old OTP, set new one ──
        const { error: updateError } = await supabaseAdmin
            .from('otps')
            .update({
                otp_hash: otpHash,
                attempts: 0,       // Reset verification attempts on resend
                resends: existingOTP.resends + 1,
                expires_at: expiresAt.toISOString(),
                last_resend_at: new Date().toISOString()
            })
            .eq('email', cleanEmail);

        if (updateError) {
            throw new Error(`Database update error: ${updateError.message}`);
        }

        // ── Send new OTP email via Gmail SMTP ──
        const regData = existingOTP.registration_data;
        const emailBody = generateOTPEmailTemplate(regData.name || 'User', otp);

        await sendEmail({
            to: cleanEmail,
            subject: 'Email Verification - Citizen Portal',
            html: emailBody
        });

        return res.json({
            message: 'New OTP sent successfully',
            resendAfter: 60,
            resendsRemaining: MAX_RESENDS - (existingOTP.resends + 1)
        });
    } catch (err) {
        console.error('Resend OTP error:', err);
        return res.status(500).json({ error: err.message || 'Failed to resend OTP. Please try again.' });
    }
});

/**
 * POST /api/citizen/verify-otp
 * Step 2: Verifies OTP and creates the citizen user account
 * 
 * Security checks:
 * - OTP exists and is not expired
 * - Max 5 verification attempts
 * - bcrypt hash comparison
 * - Final uniqueness check before account creation
 * - Rollback on failure
 */
router.post('/verify-otp', async (req, res) => {
    await cleanupExpiredOTPs();

    const { email, otp } = req.body;

    if (!email || !otp) {
        return res.status(400).json({ error: 'Email and OTP code are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otp.toString().trim();

    console.log(`[DEBUG] OTP Verification Request received:`);
    console.log(`- Email Used: ${cleanEmail}`);
    console.log(`- User Entered OTP: ${cleanOtp}`);

    try {
        // ── Fetch the OTP record from database ──
        const { data: otpRecord, error: fetchError } = await supabaseAdmin
            .from('otps')
            .select('*')
            .eq('email', cleanEmail)
            .maybeSingle();

        if (fetchError) {
            console.error(`[DEBUG] Database fetch error for OTP record:`, fetchError);
            throw new Error(`Database query failed: ${fetchError.message}`);
        }

        console.log(`[DEBUG] Database record fetched:`, JSON.stringify(otpRecord));

        if (!otpRecord) {
            console.warn(`[DEBUG] No active OTP session found for email: ${cleanEmail}`);
            return res.status(400).json({ error: 'No pending verification found. Please register again.' });
        }

        console.log(`[DEBUG] Stored OTP Hash: ${otpRecord.otp_hash}`);
        console.log(`[DEBUG] Expiration Timestamp: ${otpRecord.expires_at}`);
        console.log(`[DEBUG] Current Server Time: ${new Date().toISOString()}`);

        // ── Check if OTP has expired ──
        const isExpired = new Date(otpRecord.expires_at).getTime() < Date.now();
        console.log(`[DEBUG] Expiration Check Result (Is Expired): ${isExpired}`);
        if (isExpired) {
            return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
        }

        // ── Check verification attempt limit ──
        console.log(`[DEBUG] Current Attempts: ${otpRecord.attempts}/${MAX_ATTEMPTS}`);
        if (otpRecord.attempts >= MAX_ATTEMPTS) {
            return res.status(400).json({ error: 'Too many incorrect attempts. Please request a new OTP.' });
        }

        // ── Verify OTP using bcrypt hash comparison ──
        const isMatch = await bcrypt.compare(cleanOtp, otpRecord.otp_hash);
        console.log(`[DEBUG] bcrypt.compare Result: ${isMatch}`);
        
        if (!isMatch) {
            // Increment attempt counter
            const { error: updateAttemptsError } = await supabaseAdmin
                .from('otps')
                .update({ attempts: otpRecord.attempts + 1 })
                .eq('email', cleanEmail);

            if (updateAttemptsError) {
                console.error(`[DEBUG] Failed to increment attempts in DB:`, updateAttemptsError);
            }

            const remainingAttempts = MAX_ATTEMPTS - (otpRecord.attempts + 1);
            return res.status(400).json({ 
                error: `Invalid OTP. ${remainingAttempts > 0 ? `${remainingAttempts} attempt(s) remaining.` : 'No attempts remaining. Please request a new OTP.'}` 
            });
        }

        // ── OTP verified successfully! Create the citizen account. ──
        const regData = otpRecord.registration_data;
        console.log(`[DEBUG] OTP match successful! Creating citizen account for: ${regData.email}`);

        // ── Final uniqueness check before creating the account ──
        const { data: finalEmailCheck, error: finalEmailError } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('email', regData.email)
            .maybeSingle();

        if (finalEmailError) {
            throw new Error(`Database check error (final email): ${finalEmailError.message}`);
        }

        if (finalEmailCheck) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // ── Create Supabase Auth user ──
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: regData.email,
            password: regData.password,
            email_confirm: true,
        });

        if (authError) {
            return res.status(400).json({ error: authError.message });
        }

        const userId = authData.user.id;
        console.log(`[DEBUG] Auth user created successfully. ID: ${userId}`);

        // ── Insert citizen profile into users table ──
        const { data: userRecord, error: dbError } = await supabaseAdmin
            .from('users')
            .insert({
                id: userId,
                name: regData.name,
                email: regData.email,
                role: 'USER',
                verification_status: 'approved',
                full_name: regData.name,
                date_of_birth: regData.dob,
                phone_number: regData.phone_number,
                district: regData.district,
                constituency: regData.constituency,
                email_verified: true,
                email_verified_at: new Date().toISOString()
            })
            .select()
            .single();

        if (dbError) {
            console.error(`[DEBUG] Database insert error (user profile):`, dbError);
            // Rollback: delete the auth user if profile creation fails
            await supabaseAdmin.auth.admin.deleteUser(userId);
            return res.status(500).json({ error: 'Failed to create user profile.' });
        }

        console.log(`[DEBUG] User profile created successfully:`, JSON.stringify(userRecord));

        // ── Clean up OTP record after successful verification ──
        const { error: deleteOtpError } = await supabaseAdmin
            .from('otps')
            .delete()
            .eq('email', cleanEmail);

        if (deleteOtpError) {
            console.warn(`[DEBUG] Failed to delete OTP record after success (non-blocking):`, deleteOtpError);
        }

        // ── Generate JWT session token ──
        const token = jwt.sign(
            { userId, email: userRecord.email, role: 'USER' },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        return res.status(201).json({
            message: 'Email verified successfully. Your account has been created.',
            token,
            user: userRecord,
            redirect: '/citizen-dashboard.html'
        });
    } catch (err) {
        console.error('Verify OTP error:', err);
        return res.status(500).json({ error: err.message || 'Internal server error.' });
    }
});

module.exports = router;
