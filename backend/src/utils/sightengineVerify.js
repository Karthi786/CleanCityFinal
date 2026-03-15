const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

/**
 * Checks if an image is AI generated using Sightengine API.
 * @param {string} imagePath - Absolute path to the local image file.
 * @returns {Promise<{success: boolean, aiGenerated?: boolean, message?: string, error?: string}>}
 */
const checkImageAI = async (imagePath) => {
    try {
        const data = new FormData();
        data.append('media', fs.createReadStream(imagePath));
        data.append('models', 'genai');
        data.append('api_user', process.env.SIGHTENGINE_API_USER);
        data.append('api_secret', process.env.SIGHTENGINE_API_SECRET);

        const response = await axios({
            method: 'post',
            url: 'https://api.sightengine.com/1.0/check.json',
            data: data,
            headers: data.getHeaders()
        });

        const result = response.data;
        
        // Ensure successful response from Sightengine
        if (result.status === 'success') {
            const aiProb = result.type?.ai_generated;
            
            // Assuming that an AI-generated image has a high probability score (e.g. > 0.5)
            // Sightengine usually returns probabilities between 0 and 1
            if (aiProb !== undefined && aiProb > 0.5) {
                return {
                    success: true,
                    aiGenerated: true,
                    message: "AI-generated image detected"
                };
            }
            
            return {
                success: true,
                aiGenerated: false,
                message: "Image verified successfully"
            };
        } else {
            // API returned an error status in payload
            console.error('Sightengine checking error:', result.error?.message);
            // Don't crash the system, let the user continue if the API itself fails
            return {
                success: false,
                aiGenerated: false,
                error: result.error?.message || 'Verification API error'
            };
        }
        
    } catch (error) {
        // Network or system failure
        if (error.response) {
            console.error('Sightengine API Error:', error.response.data);
        } else {
            console.error('Sightengine Request Error:', error.message);
        }
        
        // Again, do not crash the main application, assume not AI if API fails entirely
        return {
            success: false,
            aiGenerated: false,
            error: error.message
        };
    }
};

module.exports = { checkImageAI };
