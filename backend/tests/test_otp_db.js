require('dotenv').config();
const { supabaseAdmin } = require('../src/config/supabase');
const bcrypt = require('bcryptjs');

async function testOtpDb() {
    const email = "otp_test_unique@example.com";
    const otp = "888888";
    
    console.log("1. Generating Hash...");
    const salt = await bcrypt.genSalt(10);
    const otpHash = await bcrypt.hash(otp, salt);
    console.log("Generated Hash:", otpHash);

    // Clean up any existing test records first
    await supabaseAdmin.from('otps').delete().eq('email', email);

    console.log("2. Storing to Database...");
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const { data: inserted, error: insertError } = await supabaseAdmin
        .from('otps')
        .insert({
            email,
            otp_hash: otpHash,
            attempts: 0,
            resends: 0,
            registration_data: { name: "Test User", email, password: "password123", dob: "1999-01-01", phone_number: "9999999999", district: "Madurai", constituency: "Melur" },
            expires_at: expiresAt.toISOString()
        })
        .select()
        .single();

    if (insertError) {
        console.error("Insert Error:", insertError);
        return;
    }
    console.log("Successfully Inserted record:", inserted);

    console.log("3. Fetching from Database...");
    const { data: fetched, error: fetchError } = await supabaseAdmin
        .from('otps')
        .select('*')
        .eq('email', email)
        .maybeSingle();

    if (fetchError) {
        console.error("Fetch Error:", fetchError);
        return;
    }
    console.log("Fetched Record:", fetched);
    console.log("Stored Hash in Database:", fetched.otp_hash);

    console.log("4. Verifying OTP...");
    const isMatch = await bcrypt.compare(otp, fetched.otp_hash);
    console.log("Match Result:", isMatch);

    // Clean up test data
    await supabaseAdmin.from('otps').delete().eq('email', email);
}

testOtpDb();
