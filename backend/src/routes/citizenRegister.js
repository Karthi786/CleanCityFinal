const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { supabaseAdmin } = require('../config/supabase');
const districtsMapping = require('../config/districts');
const { sendEmail } = require('../utils/resend');
require('dotenv').config();

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;
const MAX_ATTEMPTS = 5;
const MAX_RESENDS = 5; // Configurable max resend attempts

// Utility to clean up expired OTPs
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
 * GET /api/citizen/districts
 * Returns all Tamil Nadu districts and their constituencies
 */
router.get('/districts', (req, res) => {
    return res.json(districtsMapping);
});

/**
 * POST /api/citizen/check-uniqueness
 * Check email or phone number uniqueness
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
 * Step 1-4: Validates details, generates OTP, and emails it
 */
router.post('/register-request', async (req, res) => {
    await cleanupExpiredOTPs();

    const { name, dob, email, phone_number, district, constituency, password } = req.body;

    // 1. Required field validation
    if (!name || !dob || !email || !phone_number || !district || !constituency || !password) {
        return res.status(400).json({ error: 'All fields are required.' });
    }

    // 2. Name validation (3-100 characters)
    if (name.length < 3 || name.length > 100) {
        return res.status(400).json({ error: 'Name must be between 3 and 100 characters.' });
    }

    // 3. Date of birth / Age validation (>= 18 years, not future)
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

    // 4. Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email format.' });
    }

    // 5. Phone number validation (Indian 10-digit number)
    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(phone_number)) {
        return res.status(400).json({ error: 'Invalid Indian phone number. Must be exactly 10 digits.' });
    }

    // 6. District and Constituency validation
    if (!districtsMapping[district]) {
        return res.status(400).json({ error: 'Invalid district selected.' });
    }
    if (!districtsMapping[district].includes(constituency)) {
        return res.status(400).json({ error: 'Invalid constituency selected for the district.' });
    }

    // 7. Password validation
    if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone_number.trim();

    try {
        // Check uniqueness in database
        const emailQuery = `SELECT id FROM public.users WHERE email = '${cleanEmail}' LIMIT 1;`;
        console.log(`Phone Validation Started - Checking users table`);
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

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const salt = await bcrypt.genSalt(10);
        const otpHash = await bcrypt.hash(otp, salt);

        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        console.log(`[DEBUG] OTP Generation details:`);
        console.log(`- Recipient Email: ${cleanEmail}`);
        console.log(`- Generated OTP (Plaintext): ${otp}`);
        console.log(`- Generated OTP Hash: ${otpHash}`);
        console.log(`- Expiration: ${expiresAt.toISOString()}`);

        // Check if there is an existing OTP session
        const { data: existingOTP, error: fetchOtpError } = await supabaseAdmin
            .from('otps')
            .select('*')
            .eq('email', cleanEmail)
            .maybeSingle();

        if (fetchOtpError) {
            throw new Error(`Database fetch error (OTP session): ${fetchOtpError.message}`);
        }

        if (existingOTP) {
            // Check resend timer (60s rate limiting)
            const secondsSinceLastResend = (Date.now() - new Date(existingOTP.last_resend_at).getTime()) / 1000;
            if (secondsSinceLastResend < 60) {
                return res.status(429).json({ error: `Please wait ${Math.ceil(60 - secondsSinceLastResend)} seconds before requesting a new OTP.` });
            }

            if (existingOTP.resends >= MAX_RESENDS) {
                return res.status(400).json({ error: 'Too many resend attempts. Please try again later.' });
            }

            // Update session
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
            // Create session
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

        // Send Email
        const emailBody = `
            <p>Hello ${name},</p>
            <p>Thank you for registering on our Civic Reporting Platform.</p>
            <p>Your verification code is:</p>
            <h2 style="font-size: 24px; font-weight: bold; letter-spacing: 2px;">${otp}</h2>
            <p>This code will expire in 10 minutes.</p>
            <p>If you did not request this registration, please ignore this email.</p>
            <p>Thank you.</p>
        `;

        await sendEmail({
            to: cleanEmail,
            subject: 'Verify Your Citizen Account',
            html: emailBody
        });

        return res.json({ message: 'OTP sent successfully', resendAfter: 60 });
    } catch (err) {
        console.error('Register request error:', err);
        return res.status(500).json({ error: err.message || 'Failed to send OTP. Please try again.' });
    }
});

/**
 * POST /api/citizen/verify-otp
 * Step 5-8: Verifies OTP and creates user profile
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
            return res.status(400).json({ error: 'Invalid OTP' });
        }

        console.log(`[DEBUG] Stored OTP Hash: ${otpRecord.otp_hash}`);
        console.log(`[DEBUG] Expiration Timestamp: ${otpRecord.expires_at}`);
        console.log(`[DEBUG] Current Server Time: ${new Date().toISOString()}`);

        // Check expiration
        const isExpired = new Date(otpRecord.expires_at).getTime() < Date.now();
        console.log(`[DEBUG] Expiration Check Result (Is Expired): ${isExpired}`);
        if (isExpired) {
            return res.status(400).json({ error: 'OTP expired' });
        }

        // Check attempts
        console.log(`[DEBUG] Current Attempts: ${otpRecord.attempts}/${MAX_ATTEMPTS}`);
        if (otpRecord.attempts >= MAX_ATTEMPTS) {
            return res.status(400).json({ error: 'Too many attempts' });
        }

        // Verify OTP hash
        const isMatch = await bcrypt.compare(cleanOtp, otpRecord.otp_hash);
        console.log(`[DEBUG] bcrypt.compare Result: ${isMatch}`);
        
        if (!isMatch) {
            // Increment attempts
            const { error: updateAttemptsError } = await supabaseAdmin
                .from('otps')
                .update({ attempts: otpRecord.attempts + 1 })
                .eq('email', cleanEmail);

            if (updateAttemptsError) {
                console.error(`[DEBUG] Failed to increment attempts in DB:`, updateAttemptsError);
            }

            return res.status(400).json({ error: 'Invalid OTP' });
        }

        // Valid OTP! Proceed with account creation.
        const regData = otpRecord.registration_data;
        console.log(`[DEBUG] OTP match successful! Creating citizen account for: ${regData.email}`);

        // Double check uniqueness again before final create
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

        // Create Auth User
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

        // Insert into Users profile
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
            // Rollback auth user creation
            await supabaseAdmin.auth.admin.deleteUser(userId);
            return res.status(500).json({ error: 'Failed to create user profile.' });
        }

        console.log(`[DEBUG] User profile created successfully:`, JSON.stringify(userRecord));

        // Clean up OTP record
        const { error: deleteOtpError } = await supabaseAdmin
            .from('otps')
            .delete()
            .eq('email', cleanEmail);

        if (deleteOtpError) {
            console.warn(`[DEBUG] Failed to delete OTP record after success (non-blocking):`, deleteOtpError);
        }

        // Generate JWT token
        const token = jwt.sign(
            { userId, email: userRecord.email, role: 'USER' },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        return res.status(201).json({
            message: 'Account created successfully.',
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
