const vision = require('@google-cloud/vision');

// Initialize the Google Cloud Vision client lazily
// This requires GOOGLE_APPLICATION_CREDENTIALS to be set in the environment or a valid JSON key.
let client;

async function verifyCivicImage(base64Image) {
    if (client === undefined) {
        if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
            console.warn("⚠️  GOOGLE_APPLICATION_CREDENTIALS missing. Skipping GC Vision.");
            client = false;
        } else {
            try {
                client = new vision.ImageAnnotatorClient();
            } catch (err) {
                console.warn("⚠️  Failed to initialize Google Cloud Vision client.");
                client = false;
            }
        }
    }

    // If client is false or undefined after attempt, bypass
    if (!client) {
        return {
            isValid: true,
            description: "Verification skipped (API not configured)",
            severityScore: 0,
            reason: 'Missing credentials'
        };
    }

    // Strip data URI prefix if present
    const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, "");
    const imageBuffer = Buffer.from(cleanBase64, 'base64');

    try {
        const [result] = await client.labelDetection(imageBuffer).catch(e => {
            throw e;
        });
        const labels = result.labelAnnotations;

        console.log('GC Vision Labels:', labels.map(l => `${l.description} (${l.score})`));

        if (!labels || labels.length === 0) {
            return {
                isValid: false,
                reason: 'Could not detect any recognizable objects in the image. Please upload a clearer photo.'
            };
        }

        // Define keywords that indicate a real civic issue
        const civicKeywords = [
            'waste', 'garbage', 'trash', 'litter', 'rubbish', 'debris', 'pollution', 'dump',
            'pothole', 'road', 'asphalt', 'street', 'cracks', 'infrastructure', 'damage',
            'water', 'flood', 'leak', 'puddle', 'spill', 'pipe', 'plumbing',
            'electricity', 'wire', 'pole', 'light', 'lamp', 'broken', 'hazard',
            'fire', 'smoke', 'burn', 'ash', 'accident', 'tree', 'fallen'
        ];

        // Define keywords that definitely indicate a non-civic irrelevant image
        const rejectKeywords = [
            'selfie', 'face', 'portrait', 'person', 'people', 'human',
            'cartoon', 'text', 'document', 'drawing', 'art', 'screenshot', 'font', 'logo',
            'toy', 'action figure', 'figurine', 'spider-man', 'spiderman', 'indoor', 'room', 'furniture'
        ];

        let isCivic = false;
        let isIrrelevant = false;
        let severityScore = 0;
        let topLabels = [];

        // Analyze labels
        for (let i = 0; i < Math.min(labels.length, 10); i++) {
            const labelDesc = labels[i].description.toLowerCase();
            const score = labels[i].score;
            topLabels.push(labelDesc);

            // Check if matches civic issue
            if (civicKeywords.some(keyword => labelDesc.includes(keyword)) && score > 0.5) {
                isCivic = true;
                // Accumulate severity based on confidence and order
                severityScore += (score * 10);
            }

            // Check if matches reject criteria strongly
            if (rejectKeywords.some(keyword => labelDesc.includes(keyword)) && score > 0.6) {
                isIrrelevant = true;
            }
        }

        const descriptionString = topLabels.slice(0, 3).join(', ');

        // Final decision logic
        if (isIrrelevant && !isCivic) {
            return {
                isValid: false,
                reason: `Image appears to be: ${descriptionString}. Please upload a photo of the actual civic issue.`,
                description: descriptionString,
                severityScore: 0
            };
        }

        if (isCivic) {
            // Normalize severity score 1-10
            let normalizedSeverity = Math.min(10, Math.max(1, Math.round(severityScore / 2)));
            return {
                isValid: true,
                reason: 'Approved',
                description: descriptionString,
                severityScore: normalizedSeverity
            };
        } else {
            return {
                isValid: false,
                reason: `Image does not look like a clear civic issue (Detected: ${descriptionString}). Please take a clearer photo.`,
                description: descriptionString,
                severityScore: 0
            };
        }

    } catch (err) {
        console.error("Failed to verify image with Google Cloud Vision:", err.message);

        // If the error is about missing credentials, allow it to pass so we don't break the app
        if (err.message && err.message.includes("Could not load the default credentials")) {
            return {
                isValid: true,
                description: "Verification skipped (Need Google Credentials)",
                severityScore: 0,
                reason: 'API exception allowed fallback'
            };
        }

        return {
            isValid: false,
            reason: 'Server error during image analysis. Please try again later.'
        };
    }
}

module.exports = { verifyCivicImage };
