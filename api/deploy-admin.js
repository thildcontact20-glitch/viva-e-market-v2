const https = require('https');

const payload = JSON.stringify({
  "type": "web_service",
  "name": "viva-e-market-admin",
  "ownerId": "tea-d8h832gjo6nc738o6f60",
  "repo": "https://github.com/thildcontact20-glitch/viva-e-market-v2",
  "branch": "main",
  "envVars": [
    {"key": "ADMIN_PASSWORD", "value": "Mystiko2026!"}
  ],
  "serviceDetails": {
    "env": "docker",
    "dockerfilePath": "admin-backend/Dockerfile",
    "healthCheckPath": "/admin/login"
  },
  "plan": "free",
  "region": "frankfurt"
});

const req = https.request({
  hostname: 'api.render.com',
  path: '/v1/services',
  method: 'POST',
  headers: {
    'Authorization': 'Bearer rnd_CFnPRyPdajMnYeIeogZwvDF4xceS',
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
}, (res) => {
  let chunk = '';
  res.on('data', d => chunk += d);
  res.on('end', () => console.log('Status:', res.statusCode, '\n', chunk.substring(0,800)));
});
req.on('error', e => console.error('Error:', e.message));
req.write(payload);
req.end();
