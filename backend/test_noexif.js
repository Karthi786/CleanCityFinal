const fs = require('fs');
const FormData = require('form-data');
const axios = require('axios');

async function runLocalTest() {
    const filePath = 'dummy.jpg';
    
    // Create a 1x1 base64 JPEG that definitely has NO EXIF
    const b64 = "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";
    fs.writeFileSync(filePath, Buffer.from(b64, 'base64'));

    const formData = new FormData();
    formData.append('image', fs.createReadStream(filePath));
    formData.append('category', 'Waste');

    try {
        const res = await axios.post('http://localhost:5001/api/issues/verify-ai', formData, {
            headers: {
                ...formData.getHeaders(),
                // Mock a valid token (requires backend adjustments or just looking at how it fails)
            } // We will just test the logic directly if auth fails
        });
        console.log("Response:", res.data);
    } catch (e) {
        if (e.response && e.response.status === 401) {
            console.log("Got 401 as expected without a valid token. The route exists.");
        } else {
            console.error("Error:", e.message);
        }
    }
}
runLocalTest();
