// Email for confirming an address and resetting a password. Sent through
// any SMTP server named in SMTP_URL (Gmail with an app password works).
// Without one, the site works but doesn't offer those two things.

let transport = null;
let sink = null;

function enabled() {
  return Boolean(sink || process.env.SMTP_URL);
}

function sender() {
  if (process.env.MAIL_FROM) return process.env.MAIL_FROM;
  try {
    const user = decodeURIComponent(new URL(process.env.SMTP_URL).username);
    return `Cryptex <${user}>`;
  } catch {
    return 'Cryptex';
  }
}

async function send({ to, subject, text }) {
  if (sink) return sink({ to, subject, text });
  if (!transport) transport = require('nodemailer').createTransport(process.env.SMTP_URL);
  await transport.sendMail({ from: sender(), to, subject, text });
}

// Tests catch the mail instead of sending it.
function capture(fn) {
  sink = fn;
}

module.exports = { enabled, send, capture };
