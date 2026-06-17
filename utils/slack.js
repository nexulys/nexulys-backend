const https = require('https');
const http = require('http');
const logger = require('./logger');

const sendSlack = async (webhookUrl, text) => {
  if (!webhookUrl) return;
  try {
    const body = JSON.stringify({ text });
    const url = new URL(webhookUrl);
    const lib = url.protocol === 'https:' ? https : http;
    await new Promise((resolve, reject) => {
      const req = lib.request({
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
      }, res => resolve(res.statusCode));
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  } catch (err) {
    logger.error('Slack notification failed', { error: err.message });
  }
};

module.exports = { sendSlack };
