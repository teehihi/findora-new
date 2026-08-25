const tls = require('tls');

const GMAIL_USER = process.env.GMAIL_USER || 'hotrofindora@gmail.com';
const GMAIL_APP_PASS = process.env.GMAIL_APP_PASS || 'rxqwjayjnfbyjgim';

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
          `From: Findora App <${GMAIL_USER}>`,
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

module.exports = async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json({ status: 'ok', service: 'Findora Gmail Relay on Vercel' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { to, subject, html } = body || {};

    if (!to || !subject || !html) {
      return res.status(400).json({ success: false, error: 'Missing to, subject, or html' });
    }

    const result = await sendMailViaGmailTls({ to, subject, html });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message || 'Internal Server Error' });
  }
};
