// Signing in with Google, GitHub and Apple. Each one sends the person to
// the provider and back with a code, which is swapped here for who they
// are: an id that never changes, their email, and their name. A provider
// is offered only once its keys are set in the environment.
const crypto = require('node:crypto');
const { Failure } = require('./http');

let request = (...args) => fetch(...args);
// Tests stand in for the providers.
function useFetch(fn) {
  request = fn;
}

const env = name => process.env[name] || '';
const claims = jwt => JSON.parse(Buffer.from(String(jwt).split('.')[1] || '', 'base64url').toString('utf8') || '{}');
const challenge = verifier => crypto.createHash('sha256').update(verifier).digest('base64url');

async function form(url, fields, headers = {}) {
  const response = await request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json', ...headers },
    body: new URLSearchParams(fields).toString(),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) throw new Failure(502, 'The sign-in couldn’t be finished. Please try again.');
  return data;
}

const google = {
  name: 'Google',
  enabled: () => Boolean(env('GOOGLE_CLIENT_ID') && env('GOOGLE_CLIENT_SECRET')),
  pkce: true,
  authorize({ state, redirect, verifier }) {
    return 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
      client_id: env('GOOGLE_CLIENT_ID'), redirect_uri: redirect, response_type: 'code',
      scope: 'openid email profile', state, code_challenge: challenge(verifier), code_challenge_method: 'S256',
      prompt: 'select_account',
    });
  },
  async profile({ code, redirect, verifier }) {
    const data = await form('https://oauth2.googleapis.com/token', {
      code, client_id: env('GOOGLE_CLIENT_ID'), client_secret: env('GOOGLE_CLIENT_SECRET'),
      redirect_uri: redirect, grant_type: 'authorization_code', code_verifier: verifier,
    });
    // The token came straight from Google in exchange for the client
    // secret, so its contents can be trusted; check it was meant for us.
    const id = claims(data.id_token);
    if (id.aud !== env('GOOGLE_CLIENT_ID') || !['accounts.google.com', 'https://accounts.google.com'].includes(id.iss)) {
      throw new Failure(502, 'Google’s answer didn’t check out. Please try again.');
    }
    return { subject: String(id.sub), email: id.email, emailVerified: id.email_verified === true, name: id.name || '' };
  },
};

const github = {
  name: 'GitHub',
  enabled: () => Boolean(env('GITHUB_CLIENT_ID') && env('GITHUB_CLIENT_SECRET')),
  authorize({ state, redirect }) {
    return 'https://github.com/login/oauth/authorize?' + new URLSearchParams({
      client_id: env('GITHUB_CLIENT_ID'), redirect_uri: redirect, scope: 'read:user user:email', state,
    });
  },
  async profile({ code, redirect }) {
    const data = await form('https://github.com/login/oauth/access_token', {
      code, client_id: env('GITHUB_CLIENT_ID'), client_secret: env('GITHUB_CLIENT_SECRET'), redirect_uri: redirect,
    });
    const headers = { Authorization: `Bearer ${data.access_token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'Cryptex' };
    const [user, emails] = await Promise.all([
      request('https://api.github.com/user', { headers }).then(r => r.json()),
      request('https://api.github.com/user/emails', { headers }).then(r => r.json()),
    ]);
    if (!user || !user.id) throw new Failure(502, 'GitHub didn’t say who you are. Please try again.');
    const primary = Array.isArray(emails) ? emails.find(e => e.primary && e.verified) || emails.find(e => e.verified) : null;
    return { subject: String(user.id), email: primary ? primary.email : '', emailVerified: Boolean(primary), name: user.name || user.login || '' };
  },
};

// Apple wants a short-lived key signed with the team's private key in
// place of a client secret, and sends the person back with a form post.
function appleSecret() {
  const now = Math.floor(Date.now() / 1000);
  const part = obj => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const data = `${part({ alg: 'ES256', kid: env('APPLE_KEY_ID') })}.${part({
    iss: env('APPLE_TEAM_ID'), iat: now, exp: now + 300, aud: 'https://appleid.apple.com', sub: env('APPLE_CLIENT_ID'),
  })}`;
  const key = crypto.createPrivateKey(env('APPLE_PRIVATE_KEY').replace(/\\n/g, '\n'));
  const signature = crypto.sign('sha256', Buffer.from(data), { key, dsaEncoding: 'ieee-p1363' });
  return `${data}.${signature.toString('base64url')}`;
}

const apple = {
  name: 'Apple',
  enabled: () => Boolean(env('APPLE_CLIENT_ID') && env('APPLE_TEAM_ID') && env('APPLE_KEY_ID') && env('APPLE_PRIVATE_KEY')),
  formPost: true,
  authorize({ state, redirect }) {
    return 'https://appleid.apple.com/auth/authorize?' + new URLSearchParams({
      client_id: env('APPLE_CLIENT_ID'), redirect_uri: redirect, response_type: 'code',
      scope: 'name email', response_mode: 'form_post', state,
    });
  },
  async profile({ code, redirect, extra }) {
    const data = await form('https://appleid.apple.com/auth/token', {
      code, client_id: env('APPLE_CLIENT_ID'), client_secret: appleSecret(), redirect_uri: redirect, grant_type: 'authorization_code',
    });
    const id = claims(data.id_token);
    if (id.aud !== env('APPLE_CLIENT_ID') || id.iss !== 'https://appleid.apple.com') {
      throw new Failure(502, 'Apple’s answer didn’t check out. Please try again.');
    }
    // Apple sends the name only the first time, alongside the code.
    let name = '';
    try {
      const user = JSON.parse(extra.user || '{}');
      name = [user.name && user.name.firstName, user.name && user.name.lastName].filter(Boolean).join(' ');
    } catch {}
    return { subject: String(id.sub), email: id.email || '', emailVerified: id.email_verified === true || id.email_verified === 'true', name };
  },
};

const PROVIDERS = { google, github, apple };

function provider(id) {
  const p = Object.prototype.hasOwnProperty.call(PROVIDERS, id) ? PROVIDERS[id] : null;
  return p && p.enabled() ? p : null;
}

const enabledProviders = () => Object.keys(PROVIDERS).filter(id => PROVIDERS[id].enabled());

module.exports = { provider, enabledProviders, useFetch, NAMES: Object.fromEntries(Object.entries(PROVIDERS).map(([k, v]) => [k, v.name])) };
