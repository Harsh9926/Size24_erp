const http = require('http');

function testLogin(mobile, password) {
    return new Promise((resolve) => {
        const body = JSON.stringify({ mobile, password });
        const req = http.request({
            hostname: 'localhost', port: 5000,
            path: '/api/auth/login', method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
        }, res => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => resolve({ status: res.statusCode, body: d }));
        });
        req.on('error', e => resolve({ status: 'ERR', body: e.message }));
        req.write(body);
        req.end();
    });
}

async function main() {
    const r1 = await testLogin('987654321', 'admin@123');
    console.log('Admin login (987654321 / admin@123):', r1.status, r1.body.substring(0, 80));

    const r2 = await testLogin('7418529635', 'user@123');
    console.log('User login  (7418529635 / user@123) :', r2.status, r2.body.substring(0, 80));
}
main();
