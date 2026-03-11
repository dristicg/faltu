const https = require('https');
const API_KEY = 'AIzaSyAawHuSrzzyhxQ_XE4Ujbsadj95Ec49WHM';
const body = JSON.stringify({
    contents: [{ parts: [{ text: "Hello" }] }]
});

const req = https.request('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=' + API_KEY, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
    }
}, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => console.log('Status:', res.statusCode, 'Body:', data));
});

req.on('error', e => console.log('Error:', e.message));
req.write(body);
req.end();
