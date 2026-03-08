require('dotenv').config();
const { verifyCivicImage } = require('./src/utils/googleVisionVerify');

async function test() {
    console.log("Testing with no external credentials...");
    const res = await verifyCivicImage("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z/C/HgAGgwJ/lK3Q6wAAAABJRU5ErkJggg==");
    console.log("Result:", res);
}

test().catch(console.error);
