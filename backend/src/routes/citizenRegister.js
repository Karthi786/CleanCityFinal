const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { supabaseAdmin } = require('../config/supabase');
const districtsMapping = require('../config/districts');
// ── Use Nodemailer Gmail SMTP email service ──
const { sendEmail } = require('../utils/emailService');
require('dotenv').config();

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;
const MAX_ATTEMPTS = 5;         // Max OTP verification attempts before lockout
const MAX_RESENDS = 5;          // Max resend attempts per OTP session

/**
 * Utility: Clean up expired OTPs from the database
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
                                    🌿 MakkalKural
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
                                    Thank you for registering with <strong>MakkalKural Citizen Portal</strong>. Please use the verification code below to complete your registration.
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
                                    © ${new Date().getFullYear()} MakkalKural — Tamilnadu District Administration
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
            const { data: existingEmail, error: emailCheckError } = await supabaseAdmin
                .from('users')
                .select('id')
                .eq('email', cleanEmail)
                .maybeSingle();

            if (emailCheckError) {
                return res.status(500).json({ error: 'Email validation failed. Please try again later.' });
            }

            if (existingEmail) {
                return res.status(400).json({ error: 'Email already registered' });
            }
        }

        if (phone_number) {
            const cleanPhone = phone_number.trim();
            const { data: existingPhone, error: phoneCheckError } = await supabaseAdmin
                .from('users')
                .select('id')
                .eq('phone_number', cleanPhone)
                .maybeSingle();

            if (phoneCheckError) {
                return res.status(500).json({ error: 'Phone validation failed. Please try again later.' });
            }

            if (existingPhone) {
                return res.status(400).json({ error: 'Phone number already registered' });
            }
        }

        return res.json({ available: true });
    } catch (err) {
        console.error('Uniqueness check error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/citizen/register-request
 * Step 1: Validates citizen registration details, generates a secure 6-digit OTP,
 * stores temporary payload in otps table and sends verification code via email.
 * DOES NOT create user account in database before OTP verification.
 */
router.post('/register-request', async (req, res) => {
    await cleanupExpiredOTPs();

    const { name, dob, email, phone_number, district, constituency, password, otp_login_enabled } = req.body;

    // 1. Required field validation
    if (!name || !dob || !email || !phone_number || !district || !constituency || !password) {
        return res.status(400).json({ error: 'All fields are required.' });
    }

    // 2. Name validation
    if (name.length < 3 || name.length > 100) {
        return res.status(400).json({ error: 'Name must be between 3 and 100 characters.' });
    }

    // 3. Age validation (>= 18 years)
    const birthDate = new Date(dob);
    const today = new Date();
    if (birthDate > today) {
        return res.status(400).json({ error: 'Date of birth cannot be in the future.' });
    }
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age--;
    if (age < 18) {
        return res.status(400).json({ error: 'Citizen must be at least 18 years old.' });
    }

    // 4. Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email format.' });
    }

    // 5. Phone validation (Indian 10-digit)
    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(phone_number)) {
        return res.status(400).json({ error: 'Invalid Indian phone number. Must be exactly 10 digits.' });
    }

    // 6. District and Constituency validation
    if (!districtsMapping[district]) {
        return res.status(400).json({ error: 'Invalid district selected.' });
    }
    if (!districtsMapping[district].includes(constituency)) {
        return res.status(400).json({ error: 'Invalid constituency for this district.' });
    }

    // 7. Password validation
    if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone_number.trim();

    try {
        // Check email uniqueness in users table
        const { data: existingEmail, error: emailCheckError } = await supabaseAdmin
            .from('users').select('id').eq('email', cleanEmail).maybeSingle();
        if (emailCheckError) throw new Error('Email validation failed. Please try again later.');
        if (existingEmail) return res.status(400).json({ error: 'Email already registered' });

        // Check phone uniqueness in users table
        const { data: existingPhone, error: phoneCheckError } = await supabaseAdmin
            .from('users').select('id').eq('phone_number', cleanPhone).maybeSingle();
        if (phoneCheckError) throw new Error('Phone validation failed. Please try again later.');
        if (existingPhone) return res.status(400).json({ error: 'Phone number already registered' });

        // Generate secure 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const salt = await bcrypt.genSalt(10);
        const otpHash = await bcrypt.hash(otp, salt);
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

        // Delete any existing pending OTP session for this email
        await supabaseAdmin.from('otps').delete().eq('email', cleanEmail);

        // Store OTP and pending registration data in otps table
        const { error: otpInsertError } = await supabaseAdmin
            .from('otps')
            .insert({
                email: cleanEmail,
                otp_hash: otpHash,
                attempts: 0,
                resends: 0,
                registration_data: {
                    name,
                    email: cleanEmail,
                    dob,
                    phone_number: cleanPhone,
                    district,
                    constituency,
                    password,
                    otp_login_enabled: otp_login_enabled === true
                },
                expires_at: expiresAt.toISOString(),
                last_resend_at: new Date().toISOString()
            });

        if (otpInsertError) {
            console.error('OTP DB insert error:', otpInsertError);
            return res.status(500).json({ error: 'Failed to initiate verification. Please try again.' });
        }

        // Send OTP via Gmail SMTP using emailService
        const emailBody = generateOTPEmailTemplate(name, otp);
        await sendEmail({
            to: cleanEmail,
            subject: 'Email Verification - MakkalKural Citizen Portal',
            html: emailBody
        });

        console.log(`[Citizen Register] OTP sent successfully to: ${cleanEmail}`);

        return res.status(200).json({
            message: 'Verification code sent to your email.',
            email: cleanEmail,
            expires_in_seconds: 600
        });

    } catch (err) {
        console.error('Register request error:', err);
        // If email failed, delete stored OTP session
        await supabaseAdmin.from('otps').delete().eq('email', cleanEmail);
        return res.status(500).json({ error: err.message || 'Failed to send verification email. Please check your email address and try again.' });
    }
});

/**
 * POST /api/citizen/resend-otp
 * Dedicated endpoint for resending OTP without re-submitting full registration data
 */
router.post('/resend-otp', async (req, res) => {
    await cleanupExpiredOTPs();

    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Email is required.' });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
        return res.status(400).json({ error: 'Invalid email format.' });
    }

    try {
        // Look up existing OTP session
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

        // 60-second cooldown check
        const secondsSinceLastResend = (Date.now() - new Date(existingOTP.last_resend_at).getTime()) / 1000;
        if (secondsSinceLastResend < 60) {
            return res.status(429).json({ error: `Please wait ${Math.ceil(60 - secondsSinceLastResend)} seconds before requesting a new OTP.` });
        }

        // Max resend attempts check
        if (existingOTP.resends >= MAX_RESENDS) {
            return res.status(400).json({ error: 'Maximum resend attempts reached. Please start registration again.' });
        }

        // Generate new OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const salt = await bcrypt.genSalt(10);
        const otpHash = await bcrypt.hash(otp, salt);
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        // Update OTP session
        const { error: updateError } = await supabaseAdmin
            .from('otps')
            .update({
                otp_hash: otpHash,
                attempts: 0,
                resends: existingOTP.resends + 1,
                expires_at: expiresAt.toISOString(),
                last_resend_at: new Date().toISOString()
            })
            .eq('email', cleanEmail);

        if (updateError) {
            throw new Error(`Database update error: ${updateError.message}`);
        }

        // Send new OTP email via Gmail SMTP
        const regData = existingOTP.registration_data;
        const emailBody = generateOTPEmailTemplate(regData.name || 'User', otp);

        await sendEmail({
            to: cleanEmail,
            subject: 'Email Verification - MakkalKural Citizen Portal',
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
 */
router.post('/verify-otp', async (req, res) => {
    await cleanupExpiredOTPs();

    const { email, otp } = req.body;

    if (!email || !otp) {
        return res.status(400).json({ error: 'Email and OTP code are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otp.toString().trim();

    try {
        const { data: otpRecord, error: fetchError } = await supabaseAdmin
            .from('otps')
            .select('*')
            .eq('email', cleanEmail)
            .maybeSingle();

        if (fetchError) {
            throw new Error(`Database query failed: ${fetchError.message}`);
        }

        if (!otpRecord) {
            return res.status(400).json({ error: 'No pending verification found. Please register again.' });
        }

        // Check if OTP has expired
        const isExpired = new Date(otpRecord.expires_at).getTime() < Date.now();
        if (isExpired) {
            return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
        }

        // Check verification attempt limit
        if (otpRecord.attempts >= MAX_ATTEMPTS) {
            return res.status(400).json({ error: 'Too many incorrect attempts. Please request a new OTP.' });
        }

        // Verify OTP using bcrypt hash comparison
        const isMatch = await bcrypt.compare(cleanOtp, otpRecord.otp_hash);
        
        if (!isMatch) {
            await supabaseAdmin
                .from('otps')
                .update({ attempts: otpRecord.attempts + 1 })
                .eq('email', cleanEmail);

            const remainingAttempts = MAX_ATTEMPTS - (otpRecord.attempts + 1);
            return res.status(400).json({ 
                error: `Invalid OTP. ${remainingAttempts > 0 ? `${remainingAttempts} attempt(s) remaining.` : 'No attempts remaining. Please request a new OTP.'}` 
            });
        }

        // OTP verified successfully! Create the citizen account.
        const regData = otpRecord.registration_data;

        // Final uniqueness check before creating the account
        const { data: finalEmailCheck, error: finalEmailError } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('email', regData.email)
            .maybeSingle();

        if (finalEmailError) {
            throw new Error(`Database check error (final email): ${finalEmailError.message}`);
        }

        if (finalEmailCheck) {
            await supabaseAdmin.from('otps').delete().eq('email', cleanEmail);
            return res.status(400).json({ error: 'Email already registered' });
        }

        // Create Supabase Auth user
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: regData.email,
            password: regData.password,
            email_confirm: true,
        });

        if (authError) {
            return res.status(400).json({ error: authError.message });
        }

        const userId = authData.user.id;

        // Insert citizen profile into users table
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
                email_verified_at: new Date().toISOString(),
                otp_login_enabled: regData.otp_login_enabled === true
            })
            .select()
            .single();

        if (dbError) {
            console.error('[Citizen Register] Profile DB insert error:', dbError);
            // Rollback auth user creation if profile insert fails
            await supabaseAdmin.auth.admin.deleteUser(userId);
            return res.status(500).json({ error: 'Failed to create user profile.' });
        }

        // Clean up OTP record after successful verification
        await supabaseAdmin.from('otps').delete().eq('email', cleanEmail);

        // Generate JWT session token
        const token = jwt.sign(
            { userId, email: userRecord.email, role: 'USER' },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        return res.status(201).json({
            message: 'Email verified successfully. Your account has been created.',
            token,
            user: userRecord,
            redirect: '/login.html'
        });
    } catch (err) {
        console.error('Verify OTP error:', err);
        return res.status(500).json({ error: err.message || 'Internal server error.' });
    }
});

/**
 * POST /api/citizen/direct-register
 * Registers a citizen directly without OTP email verification.
 * Used when the user has disabled OTP login during registration.
 */
router.post('/direct-register', async (req, res) => {
    const { name, dob, email, phone_number, district, constituency, password } = req.body;

    // 1. Required field validation
    if (!name || !dob || !email || !phone_number || !district || !constituency || !password) {
        return res.status(400).json({ error: 'All fields are required.' });
    }

    // 2. Name validation
    if (name.length < 3 || name.length > 100) {
        return res.status(400).json({ error: 'Name must be between 3 and 100 characters.' });
    }

    // 3. Age validation (>= 18 years)
    const birthDate = new Date(dob);
    const today = new Date();
    if (birthDate > today) {
        return res.status(400).json({ error: 'Date of birth cannot be in the future.' });
    }
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age--;
    if (age < 18) {
        return res.status(400).json({ error: 'Citizen must be at least 18 years old.' });
    }

    // 4. Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email format.' });
    }

    // 5. Phone validation (Indian 10-digit)
    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(phone_number)) {
        return res.status(400).json({ error: 'Invalid Indian phone number. Must be exactly 10 digits.' });
    }

    // 6. District and Constituency validation
    if (!districtsMapping[district]) {
        return res.status(400).json({ error: 'Invalid district selected.' });
    }
    if (!districtsMapping[district].includes(constituency)) {
        return res.status(400).json({ error: 'Invalid constituency for this district.' });
    }

    // 7. Password validation
    if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone_number.trim();

    try {
        // Check email uniqueness
        const { data: existingEmail, error: emailCheckError } = await supabaseAdmin
            .from('users').select('id').eq('email', cleanEmail).maybeSingle();
        if (emailCheckError) throw new Error('Email validation failed. Please try again later.');
        if (existingEmail) return res.status(400).json({ error: 'Email already registered' });

        // Check phone uniqueness
        const { data: existingPhone, error: phoneCheckError } = await supabaseAdmin
            .from('users').select('id').eq('phone_number', cleanPhone).maybeSingle();
        if (phoneCheckError) throw new Error('Phone validation failed. Please try again later.');
        if (existingPhone) return res.status(400).json({ error: 'Phone number already registered' });

        // Create Supabase Auth user
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: cleanEmail,
            password,
            email_confirm: true,
        });

        if (authError) {
            return res.status(400).json({ error: authError.message });
        }

        const userId = authData.user.id;

        // Insert citizen profile into users table
        const { data: userRecord, error: dbError } = await supabaseAdmin
            .from('users')
            .insert({
                id: userId,
                name,
                email: cleanEmail,
                role: 'USER',
                verification_status: 'approved',
                full_name: name,
                date_of_birth: dob,
                phone_number: cleanPhone,
                district,
                constituency,
                email_verified: true,
                email_verified_at: new Date().toISOString(),
                otp_login_enabled: false
            })
            .select()
            .single();

        if (dbError) {
            console.error('[Citizen Direct Register] Profile DB insert error:', dbError);
            await supabaseAdmin.auth.admin.deleteUser(userId);
            return res.status(500).json({ error: 'Failed to create user profile.' });
        }

        console.log(`[Citizen Direct Register] Account created for: ${cleanEmail}`);

        return res.status(201).json({
            message: 'Account created successfully.',
            redirect: '/login.html'
        });

    } catch (err) {
        console.error('Direct register error:', err);
        return res.status(500).json({ error: err.message || 'Internal server error.' });
    }
});

module.exports = router;
