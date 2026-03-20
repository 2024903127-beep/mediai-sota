const http = require('http');

const data = JSON.stringify({
  email: 'testempty1@example.com',
  password: 'password123',
  role: 'patient',
  phone: ''
});

const options = {
  hostname: 'localhost',
  port: 4000,
  path: '/api/auth/register',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, res => {
  let body = '';
  res.on('data', d => { body += d; });
  res.on('end', () => { console.log('Response:', body); });
});

req.on('error', error => {
  console.error('Error:', error);
});

req.write(data);
req.end();
