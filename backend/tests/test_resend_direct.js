require('dotenv').config();

const RESEND_API_KEY = process.env.RESEND_API_KEY;

console.log("Diagnostic check for RESEND_API_KEY:");
console.log("Present:", !!RESEND_API_KEY);
console.log("Type:", typeof RESEND_API_KEY);
console.log("Length:", RESEND_API_KEY ? RESEND_API_KEY.length : 0);

async function testResend() {
    if (!RESEND_API_KEY) {
        console.error("Error: RESEND_API_KEY is not defined in the environment.");
        return;
    }

    try {
        console.log("Sending request to Resend API...");
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: 'MakkalKural <onboarding@resend.dev>',
                to: ['kevinashvarman20@gmail.com'], // Send to the owner email
                subject: 'Test Resend Delivery',
                html: '<p>Test verification code: <strong>123456</strong></p>'
            })
        });

        console.log("Response status:", response.status);
        const data = await response.json();
        console.log("Response data:", JSON.stringify(data, null, 2));
    } catch (err) {
        console.error("Fetch/API Error:", err);
    }
}

testResend();
