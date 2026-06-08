const exifr = require('exifr');

/**
 * Extracts EXIF metadata from a base64 image or Buffer.
 * Checks for Date Taken and Time Taken.
 * 
 * @param {string|Buffer} imageSource 
 * @returns {Promise<Object>} Verification results
 */
async function extractExifData(imageSource) {
    try {
        let buffer;
        if (typeof imageSource === 'string' && imageSource.startsWith('data:image')) {
            // Remove data:image/...;base64, prefix
            const base64Data = imageSource.replace(/^data:image\/\w+;base64,/, "");
            buffer = Buffer.from(base64Data, 'base64');
        } else {
            buffer = imageSource;
        }

        // Parse EXIF metadata
        // We specifically want DateTimeOriginal for Date and Time Taken
        const metadata = await exifr.parse(buffer, {
            pick: ['DateTimeOriginal', 'Make', 'Model', 'GPSLatitude', 'GPSLongitude'],
            translateValues: true
        });

        if (!metadata || !metadata.DateTimeOriginal) {
            return {
                success: false,
                verified: false,
                message: "Image does not belong to a valid camera device or required metadata is missing."
            };
        }

        const dateObj = new Date(metadata.DateTimeOriginal);
        
        // Check if date is valid
        if (isNaN(dateObj.getTime())) {
            return {
                success: false,
                verified: false,
                message: "Image does not belong to a valid camera device or required metadata is missing."
            };
        }

        // Format Date: YYYY-MM-DD
        const dateTaken = dateObj.toISOString().split('T')[0];
        // Format Time: HH:MM:SS
        const timeTaken = dateObj.toTimeString().split(' ')[0];

        return {
            success: true,
            verified: true,
            dateTaken,
            timeTaken,
            device: metadata.Make && metadata.Model ? `${metadata.Make} ${metadata.Model}` : (metadata.Make || metadata.Model || 'Unknown'),
            gps: metadata.GPSLatitude && metadata.GPSLongitude ? {
                lat: metadata.GPSLatitude,
                lng: metadata.GPSLongitude
            } : null
        };

    } catch (err) {
        console.error('EXIF Extraction Error:', err);
        return {
            success: false,
            verified: false,
            message: "Image does not belong to a valid camera device or required metadata is missing."
        };
    }
}

module.exports = { extractExifData };
