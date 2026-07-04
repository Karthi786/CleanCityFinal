const fs = require('fs');
const jwt = require('jsonwebtoken');
const path = require('path');

const filePath = path.join(__dirname, 'src/routes/citizenRegister.js');
let content = fs.readFileSync(filePath, 'utf8');

// Find the start and end of the register-request route
const startMarker = "/**\r\n * POST /api/citizen/register-request\r\n * Step 1: Validates registration details, generates OTP, sends via Gmail SMTP";
const endMarker = "    } catch (err) {\r\n        console.error('Register request error:', err);\r\n        return res.status(500).json({ error: err.message || 'Failed to send OTP. Please try again.' });\r\n    }\r\n});";

const startIdx = content.indexOf(startMarker);
const endIdx = content.indexOf(endMarker) + endMarker.length;

if (startIdx === -1 || endIdx === -1) {
    console.error('Could not find the target block. Trying alternate approach...');
    // Try finding by line content
    const lines = content.split('\n');
    let start = -1, end = -1;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('POST /api/citizen/register-request') && lines[i-1] && lines[i-1].includes('/**')) {
            start = i - 1;
        }
        if (start !== -1 && lines[i].includes("Failed to send OTP") && lines[i+1] && lines[i+1].trim() === '}' && lines[i+2] && lines[i+2].trim() === '});') {
            end = i + 3;
            break;
        }
    }
    if (start === -1 || end === -1) {
        console.error('Patch failed: could not locate block');
        process.exit(1);
    }
    console.log(`Found block: lines ${start} to ${end}`);
    const newBlock = getNewBlock();
    lines.splice(start, end - start, ...newBlock.split('\n'));
    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
    console.log('✅ Patched successfully using line-based approach!');
    process.exit(0);
}

const newBlock = getNewBlock();
content = content.slice(0, startIdx) + newBlock + content.slice(endIdx);
fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Patched register-request: OTP removed, direct registration enabled!');

function getNewBlock() {
    return `/**
 * POST /api/citizen/register-request
 * Direct citizen registration — no OTP/email verification required.
 * Validates all fields and creates the account immediately.
 */
router.post('/register-request', async (req, res) => {
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
    const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email format.' });
    }

    // 5. Phone validation (Indian 10-digit)
    const phoneRegex = /^[6-9]\\d{9}$/;
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

        // Create Supabase Auth user directly (no OTP)
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: cleanEmail,
            password,
            email_confirm: true,
        });
        if (authError) return res.status(400).json({ error: authError.message });

        const userId = authData.user.id;

        // Insert citizen profile
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
                email_verified_at: new Date().toISOString()
            })
            .select()
            .single();

        if (dbError) {
            console.error('[Citizen Register] DB insert error:', dbError);
            await supabaseAdmin.auth.admin.deleteUser(userId);
            return res.status(500).json({ error: 'Failed to create user profile.' });
        }

        // Generate JWT session token
        const token = require('jsonwebtoken').sign(
            { userId, email: cleanEmail, role: 'USER' },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        console.log('[Citizen Register] Account created for:', cleanEmail);

        return res.status(201).json({
            message: 'Account created successfully.',
            token,
            user: userRecord,
            redirect: '/citizen-dashboard.html'
        });

    } catch (err) {
        console.error('Register request error:', err);
        return res.status(500).json({ error: err.message || 'Failed to register. Please try again.' });
    }
});`;
}
