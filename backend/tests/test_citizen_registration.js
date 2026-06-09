/**
 * Test script for citizen registration endpoints and services
 */
const bcrypt = require('bcryptjs');
const districtsMapping = require('../src/config/districts');
const { sendEmail } = require('../src/utils/resend');

// Simple assertion helper
function assert(condition, message) {
    if (!condition) {
        throw new Error(`Assertion Failed: ${message}`);
    }
    console.log(`[PASS] ${message}`);
}

async function runTests() {
    console.log("Starting Citizen Registration Test Suite...\n");

    // Test 1: Districts mapping structure
    console.log("--- Test 1: Tamil Nadu Districts Mapping Config ---");
    assert(Object.keys(districtsMapping).length === 38, "Mapping should contain exactly 38 Tamil Nadu districts");
    assert(districtsMapping["Madurai"].includes("Madurai East"), "Madurai East should be a constituency in Madurai district");
    assert(districtsMapping["Chennai"].includes("Velachery"), "Velachery should be a constituency in Chennai");

    // Test 2: Age Verification Logic
    console.log("\n--- Test 2: Age Verification logic ---");
    const validateAge = (dobString) => {
        const birthDate = new Date(dobString);
        const today = new Date();
        if (birthDate > today) return false;
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age >= 18;
    };

    assert(validateAge("2000-01-01") === true, "Born in 2000 should be allowed (>=18)");
    assert(validateAge(new Date().toISOString().split('T')[0]) === false, "Born today should be rejected (<18)");
    assert(validateAge("2015-05-15") === false, "Born in 2015 should be rejected (<18)");

    // Test 3: OTP Hashing and Verification Logic
    console.log("\n--- Test 3: OTP Hashing and verification ---");
    const otp = "543210";
    const salt = await bcrypt.genSalt(10);
    const otpHash = await bcrypt.hash(otp, salt);
    
    const isCorrect = await bcrypt.compare(otp, otpHash);
    const isWrong = await bcrypt.compare("111111", otpHash);
    
    assert(isCorrect === true, "Valid OTP should match hash");
    assert(isWrong === false, "Invalid OTP should not match hash");

    // Test 4: Email Simulation fallback or active dispatch
    console.log("\n--- Test 4: Resend Email dispatch check ---");
    try {
        const testRecipient = process.env.RESEND_API_KEY ? "kevinashvarman20@gmail.com" : "test@example.com";
        const emailResult = await sendEmail({
            to: testRecipient,
            subject: "Verify Your Citizen Account",
            html: "<p>Hello Test, your OTP is 123456</p>"
        });
        assert(emailResult.success === true, "Email wrapper should succeed sending the verification email");
    } catch (err) {
        console.error("Test 4 encountered an error:", err);
        throw err;
    }

    console.log("\nAll core validations and services tested successfully!");
}

runTests().catch(err => {
    console.error("Test Suite Failed:", err);
    process.exit(1);
});
