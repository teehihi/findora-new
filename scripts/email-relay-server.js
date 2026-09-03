/**
 * Findora Email Relay Server
 * Zero-dependency standalone HTTP server that sends emails via Gmail SMTP TLS
 * 
 * Usage:
 *   node scripts/email-relay-server.js
 */

const http = require('http');
const tls = require('tls');

const PORT = process.env.PORT || 5005;
const GMAIL_USER = process.env.GMAIL_USER || '';
const GMAIL_APP_PASS = process.env.GMAIL_APP_PASS || '';

/**
 * Send email via raw TLS to smtp.gmail.com:465
 */
function sendMailViaGmailTls({ to, subject, html }) {
  return new Promise((resolve, reject) => {
    const toList = Array.isArray(to) ? to : [to];
    const validEmails = toList.filter((e) => e && e.includes('@'));

    if (validEmails.length === 0) {
      return reject(new Error('No valid recipient emails provided'));
    }

    const socket = tls.connect(465, 'smtp.gmail.com', () => {});
    socket.setEncoding('utf8');
    let step = 0;
    let rcptIndex = 0;

    socket.on('data', (chunk) => {
      const msg = chunk.trim();

      if (msg.startsWith('220') && step === 0) {
        step = 1;
        socket.write('EHLO localhost\r\n');
      } else if (step === 1 && (msg.includes('250') || msg.startsWith('250'))) {
        step = 2;
        socket.write('AUTH LOGIN\r\n');
      } else if (step === 2 && msg.startsWith('334 VXNlcm5hbWU6')) {
        step = 3;
        socket.write(Buffer.from(GMAIL_USER).toString('base64') + '\r\n');
      } else if (step === 3 && msg.startsWith('334 UGFzc3dvcmQ6')) {
        step = 4;
        socket.write(Buffer.from(GMAIL_APP_PASS).toString('base64') + '\r\n');
      } else if (step === 4 && msg.startsWith('235')) {
        step = 5;
        socket.write(`MAIL FROM:<${GMAIL_USER}>\r\n`);
      } else if (step === 5 && msg.startsWith('250')) {
        step = 6;
        rcptIndex = 0;
        socket.write(`RCPT TO:<${validEmails[rcptIndex]}>\r\n`);
      } else if (step === 6 && msg.startsWith('250')) {
        rcptIndex++;
        if (rcptIndex < validEmails.length) {
          socket.write(`RCPT TO:<${validEmails[rcptIndex]}>\r\n`);
        } else {
          step = 7;
          socket.write('DATA\r\n');
        }
      } else if (step === 7 && msg.startsWith('354')) {
        step = 8;
        const mailContent = [
          `From: Findora Support <${GMAIL_USER}>`,
          `To: ${validEmails.join(', ')}`,
          `Subject: ${subject}`,
          'MIME-Version: 1.0',
          'Content-Type: text/html; charset=UTF-8',
          '',
          html,
          '\r\n.\r\n',
        ].join('\r\n');
        socket.write(mailContent);
      } else if (step === 8 && msg.startsWith('250')) {
        console.log('[GMAIL SMTP] Successfully delivered email to:', validEmails);
        socket.end('QUIT\r\n');
        resolve({ success: true, deliveredTo: validEmails });
      }
    });

    socket.on('error', (err) => {
      console.error('[GMAIL SMTP] Socket Error:', err);
      reject(err);
    });
  });
}

const server = http.createServer(async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'Findora Gmail Relay', sender: GMAIL_USER }));
    return;
  }

  if (req.method === 'POST' && req.url === '/send-appointment-email') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });

    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const { to, subject, html } = payload;

        if (!to || !subject || !html) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Missing to, subject, or html' }));
          return;
        }

        const result = await sendMailViaGmailTls({ to, subject, html });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: result }));
      } catch (err) {
        console.error('Relay error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message || 'Internal Server Error' }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`🚀 Findora Gmail SMTP Relay Server Running on Port ${PORT}`);
  console.log(`📧 Sender: ${GMAIL_USER}`);
  console.log(`🔗 Endpoint: http://localhost:${PORT}/send-appointment-email`);
  console.log(`====================================================`);
});
