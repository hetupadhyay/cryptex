// The database: Neon Postgres on Vercel, or any client with the same
// query(text, params) -> rows shape (tests and local development use an
// in-memory Postgres). The tables are created on first use, so a new
// database needs no setup step.

const SCHEMA = [
  `create table if not exists users (
    id uuid primary key default gen_random_uuid(),
    email text not null unique,
    email_verified boolean not null default false,
    name text not null default '',
    password_hash text,
    created_at timestamptz not null default now()
  )`,
  // A Google, GitHub or Apple account linked to a user.
  `create table if not exists identities (
    provider text not null,
    subject text not null,
    user_id uuid not null references users (id) on delete cascade,
    email text,
    created_at timestamptz not null default now(),
    primary key (provider, subject)
  )`,
  // Only a hash of each session token is kept, so the table alone can't sign anyone in.
  `create table if not exists sessions (
    token_hash text primary key,
    user_id uuid not null references users (id) on delete cascade,
    created_at timestamptz not null default now(),
    expires_at timestamptz not null
  )`,
  // Email confirmation and password reset links, hashed the same way.
  `create table if not exists tokens (
    token_hash text primary key,
    user_id uuid not null references users (id) on delete cascade,
    kind text not null,
    expires_at timestamptz not null
  )`,
  // A sign-in with Google, GitHub or Apple that has started but not come back yet.
  `create table if not exists oauth_states (
    id text primary key,
    secret text not null,
    provider text not null,
    verifier text,
    link_user uuid references users (id) on delete cascade,
    created_at timestamptz not null default now()
  )`,
  `create table if not exists progress (
    user_id uuid primary key references users (id) on delete cascade,
    cracked jsonb not null default '[]',
    daily jsonb not null default '{}',
    updated_at timestamptz not null default now()
  )`,
  // Recent failed sign-ins and sign-ups, to slow down guessing.
  `create table if not exists attempts (
    key text not null,
    at timestamptz not null default now()
  )`,
  'create index if not exists attempts_key_at on attempts (key, at)',
  'create index if not exists sessions_user on sessions (user_id)',
  'create index if not exists identities_user on identities (user_id)',
];

let client = null;
let ready = null;

function connect() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) {
    const error = new Error('Accounts aren’t switched on yet.');
    error.status = 503;
    throw error;
  }
  const { neon } = require('@neondatabase/serverless');
  const sql = neon(url);
  return { query: (text, params) => sql.query(text, params) };
}

// Tests and the local server hand in their own client.
function use(next) {
  client = next;
  ready = null;
}

function configured() {
  return Boolean(client || process.env.DATABASE_URL || process.env.POSTGRES_URL);
}

async function query(text, params = []) {
  if (!client) client = connect();
  if (!ready) {
    ready = (async () => {
      for (const statement of SCHEMA) await client.query(statement, []);
    })().catch(error => {
      ready = null;
      throw error;
    });
  }
  await ready;
  return client.query(text, params);
}

async function one(text, params) {
  return (await query(text, params))[0] || null;
}

module.exports = { query, one, use, configured };
