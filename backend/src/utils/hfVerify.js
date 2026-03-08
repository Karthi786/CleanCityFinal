// Hugging Face zero-shot image classification utility
// We use openai/clip-vit-base-patch32 to determine if an image is a valid civic issue.

async function verifyCivicImage(base64Image) {
    // If no token is configured, skip verification to prevent breaking the app
    if (!process.env.HF_TOKEN) {
        console.warn("⚠️  HF_TOKEN not found in .env, skipping image verification.");
        return { isValid: true, reason: 'No token' };
    }

    // Strip data URI prefix if present
    const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, "");

    const MODEL_ID = "openai/clip-vit-base-patch32";
    const API_URL = `https://router.huggingface.co/hf-inference/models/${MODEL_ID}`;

    // Define what is explicitly allowed vs everything else.
    const candidate_labels = [
        "a civic problem like garbage, pothole, street leak, or broken infrastructure",
        "a person, selfie, face, or ID card",
        "a cartoon, meme, drawing, or screenshot",
        "an indoor object, toy, animal, or random item"
    ];

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${process.env.HF_TOKEN}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                inputs: { image: cleanBase64 },
                parameters: { candidate_labels }
            })
        });

        if (!response.ok) {
            const err = await response.text();
            console.error("HF Inference Error:", err);
            // If HF API is down or model loading, we will allow it to pass or fail gracefully.
            return { isValid: true, reason: 'API Error, allowed fallback' };
        }

        const data = await response.json();

        // Custom logic to check the top categories
        // Format of data: [{ score: 0.9, label: "selfie..." }, ...]
        if (Array.isArray(data) && data.length > 0) {
            const topLabel = data[0].label;
            const score = data[0].score;

            console.log("Image Classification Results:", data.slice(0, 3));

            // Only allow if the AI's #1 guess is a civic problem
            if (topLabel.includes("civic problem")) {
                if (score < 0.25) {
                    return {
                        isValid: false,
                        reason: `Image doesn't look like a clear civic issue (confidence too low). Please take a clearer photo.`
                    };
                }
                return { isValid: true };
            } else {
                return {
                    isValid: false,
                    reason: `Image appears to be ${topLabel}. Please upload a photo of the actual civic issue.`
                };
            }
        }

        return { isValid: true };

    } catch (err) {
        console.error("Failed to call Hugging Face:", err);
        return { isValid: true, reason: 'Exception in verification' };
    }
}

module.exports = { verifyCivicImage };
