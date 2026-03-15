const exifr = require('exifr');

/**
 * Extracts date/time metadata from an image file using EXIF data.
 * @param {string} filePath - Absolute path to the local image file.
 * @returns {Promise<{ dateTaken: string|null, timeTaken: string|null }>}
 */
async function extractExif(filePath) {
    try {
        const result = await exifr.parse(filePath, {
            pick: ['DateTimeOriginal', 'DateTime', 'CreateDate']
        });

        if (!result) {
            return { dateTaken: null, timeTaken: null };
        }

        // Prefer DateTimeOriginal (when shutter fired), fall back to others
        const dt = result.DateTimeOriginal || result.CreateDate || result.DateTime;

        if (!dt || !(dt instanceof Date) || isNaN(dt.getTime())) {
            return { dateTaken: null, timeTaken: null };
        }

        const dateTaken = dt.toISOString().slice(0, 10); // YYYY-MM-DD
        const timeTaken = dt.toTimeString().slice(0, 8);  // HH:MM:SS

        return { dateTaken, timeTaken };
    } catch (err) {
        // EXIF parsing errors are non-fatal; just report missing metadata
        console.warn('EXIF extraction failed:', err.message);
        return { dateTaken: null, timeTaken: null };
    }
}

module.exports = { extractExif };
