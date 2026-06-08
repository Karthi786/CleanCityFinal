const express = require('express');
const { extractExifData } = require('../utils/exifExtract');
const { verifyToken, requireApproved } = require('../middleware/auth');

const router = express.Router();

/**
 * POST /api/image/verify-exif
 * Extracts and verifies EXIF metadata from an uploaded image.
 */
router.post('/verify-exif', verifyToken, requireApproved, async (req, res) => {
    const { imageUrl } = req.body;

    if (!imageUrl) {
        return res.status(400).json({
            success: false,
            verified: false,
            message: "No image provided."
        });
    }

    const result = await extractExifData(imageUrl);

    if (!result.success) {
        return res.status(200).json({
            success: false,
            verified: false,
            message: result.message
        });
    }

    return res.json({
        success: true,
        verified: true,
        dateTaken: result.dateTaken,
        timeTaken: result.timeTaken,
        device: result.device,
        gps: result.gps
    });
});

module.exports = router;
