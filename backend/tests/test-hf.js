const fs = require('fs');

async function testHF() {
    // Generate a small dummy 1x1 base64 GIF or just fetch a random image online
    const base64Image = "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"; // 1x1 transparent
    const API_URL = "https://router.huggingface.co/hf-inference/models/openai/clip-vit-base-patch32";

    const payload = {
        inputs: base64Image,
        parameters: {
            candidate_labels: ["garbage", "pothole", "toy", "person"]
        }
    };

    console.log("Sending request...");
    const res = await fetch(API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });

    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
}

testHF().catch(console.error);
