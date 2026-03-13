const http = require('http');

const data = JSON.stringify({
    code: 'TEST-BONUS-2026',
    source: 'Test-Script',
    type: 'drop'
});

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/new-code',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

const req = http.request(options, (res) => {
    console.log(`Status Code: ${res.statusCode}`);
    res.on('data', (d) => {
        process.stdout.write(d);
    });
});

req.on('error', (error) => {
    console.error(error);
});

req.write(data);
req.end();
