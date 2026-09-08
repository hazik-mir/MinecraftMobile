const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = Number(process.env.PORT || 10000);
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const DATA = path.join(ROOT, 'data');
const DISCORD = process.env.DISCORD_INVITE_URL || 'https://discord.gg/FQzUhm9xDu';
const FORM = process.env.TIER_APPLY_URL || 'https://forms.gle/49LUgAW7TmLzFhmK7';
const API_BASE = process.env.PUBLIC_API_BASE || '';
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || '*';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const SESSION_SECRET = process.env.SESSION_SECRET || '';
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || '';
const YOUTUBE_HANDLE = process.env.YOUTUBE_CHANNEL_HANDLE || '@HeyHazik';
const MAX_VIDEO_COUNT = Math.min(Number(process.env.YOUTUBE_MAX_VIDEOS || 12), 50);
const oauthClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;
const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }) : null;

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '50kb' }));
app.use(cookieParser());
app.use(cors({ origin: FRONTEND_ORIGIN === '*' ? true : FRONTEND_ORIGIN, credentials: true }));
app.use('/api/', rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: true, legacyHeaders: false }));

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(path.join(DATA, file), 'utf8')); }
  catch { return fallback; }
}
function writeJson(file, value) {
  fs.writeFileSync(path.join(DATA, file), JSON.stringify(value, null, 2));
}

async function ensureDb() {
  if (!pool) return;
  await pool.query(`CREATE TABLE IF NOT EXISTS users (
    google_sub TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    youtube TEXT,
    discord TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
}
let dbReady = ensureDb().catch(err => console.error('Database initialization failed:', err.message));

function localUsers() { return readJson('users.json', []); }
function saveLocalUsers(users) { writeJson('users.json', users); }

async function findUser(sub) {
  if (pool) {
    await dbReady;
    const { rows } = await pool.query('SELECT google_sub AS sub, email, name, youtube, discord, created_at AS "createdAt", updated_at AS "updatedAt" FROM users WHERE google_sub=$1', [sub]);
    return rows[0] || null;
  }
  return localUsers().find(u => u.sub === sub) || null;
}
async function upsertUser({ sub, email, name, youtube, discord }) {
  if (pool) {
    await dbReady;
    const { rows } = await pool.query(`INSERT INTO users (google_sub,email,name,youtube,discord)
      VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT (google_sub) DO UPDATE SET email=EXCLUDED.email,name=EXCLUDED.name,youtube=EXCLUDED.youtube,discord=EXCLUDED.discord,updated_at=NOW()
      RETURNING google_sub AS sub,email,name,youtube,discord,created_at AS "createdAt",updated_at AS "updatedAt"`,
      [sub, email, name, youtube || null, discord || null]);
    return rows[0];
  }
  const users = localUsers();
  const idx = users.findIndex(u => u.sub === sub);
  const user = { sub, email, name, youtube: youtube || '', discord: discord || '', createdAt: idx >= 0 ? users[idx].createdAt : new Date().toISOString(), updatedAt: new Date().toISOString() };
  if (idx >= 0) users[idx] = user; else users.push(user);
  saveLocalUsers(users);
  return user;
}

function sessionToken(sub) {
  if (!SESSION_SECRET) throw new Error('SESSION_SECRET is not configured');
  return jwt.sign({ sub }, SESSION_SECRET, { expiresIn: '30d', issuer: 'minecraft-mobile' });
}
function currentSub(req) {
  if (!SESSION_SECRET) return null;
  const token = req.cookies.mm_session;
  if (!token) return null;
  try { return jwt.verify(token, SESSION_SECRET, { issuer: 'minecraft-mobile' }).sub; }
  catch { return null; }
}
async function currentUser(req) {
  const sub = currentSub(req);
  return sub ? findUser(sub) : null;
}
function safeUser(user) {
  if (!user) return null;
  return { email: user.email, name: user.name, youtube: user.youtube || '', discord: user.discord || '', createdAt: user.createdAt };
}

app.get('/api/config', (_req, res) => res.json({
  name: 'Minecraft Mobile', discord: DISCORD, tierApplication: FORM, apiBase: API_BASE,
  googleClientId: GOOGLE_CLIENT_ID || null, authEnabled: Boolean(GOOGLE_CLIENT_ID && SESSION_SECRET),
  youtubeEnabled: Boolean(YOUTUBE_API_KEY), youtubeHandle: YOUTUBE_HANDLE,
  categories: ['All','Add-ons','Mods','Resource Packs','Behavior Packs','Worlds','Maps','Skin Packs','Shaders','Servers','Tutorials']
}));

app.get('/api/projects', (req, res) => {
  const projects = readJson('projects.json', []);
  const q = String(req.query.q || '').trim().toLowerCase();
  const category = String(req.query.category || 'All');
  const filtered = projects.filter(p => {
    const matchesCategory = category === 'All' || p.category === category;
    const haystack = [p.name, p.author, p.description, ...(p.tags || [])].join(' ').toLowerCase();
    return matchesCategory && (!q || haystack.includes(q));
  });
  res.json(filtered);
});
app.get('/api/players', (_req, res) => res.json(readJson('players.json', [])));
app.get('/api/stats', (_req, res) => {
  const projects = readJson('projects.json', []), players = readJson('players.json', []);
  const counts = {}; for (const p of projects) counts[p.category] = (counts[p.category] || 0) + 1;
  res.json({ projects: projects.length, rankedPlayers: players.length, categories: counts });
});

app.get('/api/auth/me', async (req, res) => {
  const user = await currentUser(req);
  res.json({ authenticated: Boolean(user), user: safeUser(user) });
});

app.post('/api/auth/google', async (req, res) => {
  try {
    if (!oauthClient || !SESSION_SECRET) return res.status(503).json({ error: 'Google authentication is not configured on this server.' });
    const credential = String(req.body.credential || '');
    if (!credential) return res.status(400).json({ error: 'Missing Google credential.' });
    const ticket = await oauthClient.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    if (!payload || !payload.sub || !payload.email || !payload.email_verified) return res.status(401).json({ error: 'Google account verification failed.' });
    const existing = await findUser(payload.sub);
    const token = sessionToken(payload.sub);
    res.cookie('mm_session', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: process.env.FRONTEND_ORIGIN ? 'none' : 'lax', maxAge: 30 * 24 * 60 * 60 * 1000, path: '/' });
    res.json({ ok: true, firstLogin: !existing, user: safeUser(existing), googleProfile: { name: payload.name || payload.email.split('@')[0], email: payload.email, picture: payload.picture || null } });
  } catch (err) {
    console.error('Google auth:', err.message);
    res.status(401).json({ error: 'Google sign-in could not be verified.' });
  }
});

app.post('/api/auth/profile', async (req, res) => {
  try {
    const sub = currentSub(req); if (!sub) return res.status(401).json({ error: 'Sign in first.' });
    const existing = await findUser(sub); if (!existing) return res.status(401).json({ error: 'Account session is not initialized.' });
    const name = String(req.body.name || '').trim().slice(0, 40);
    const youtube = String(req.body.youtube || '').trim().slice(0, 120);
    const discord = String(req.body.discord || '').trim().slice(0, 80);
    if (name.length < 2) return res.status(400).json({ error: 'Choose a name with at least 2 characters.' });
    const user = await upsertUser({ sub, email: existing.email, name, youtube, discord });
    res.json({ ok: true, user: safeUser(user) });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Could not save profile.' }); }
});

app.post('/api/auth/logout', (req, res) => { res.clearCookie('mm_session', { path: '/' }); res.json({ ok: true }); });

async function youtubeFetch(url) {
  const r = await fetch(url); const data = await r.json();
  if (!r.ok) throw new Error(data?.error?.message || `YouTube API ${r.status}`);
  return data;
}
let youtubeCache = { at: 0, data: null };
app.get('/api/youtube', async (_req, res) => {
  try {
    if (!YOUTUBE_API_KEY) return res.status(503).json({ enabled: false, error: 'YOUTUBE_API_KEY is not configured.' });
    if (youtubeCache.data && Date.now() - youtubeCache.at < 5 * 60 * 1000) return res.json(youtubeCache.data);
    const base = 'https://www.googleapis.com/youtube/v3';
    const channel = await youtubeFetch(`${base}/channels?part=snippet,contentDetails&forHandle=${encodeURIComponent(YOUTUBE_HANDLE)}&key=${encodeURIComponent(YOUTUBE_API_KEY)}`);
    const c = channel.items?.[0];
    if (!c) return res.status(404).json({ enabled: true, error: `YouTube channel ${YOUTUBE_HANDLE} was not found.` });
    const uploads = c.contentDetails.relatedPlaylists.uploads;
    const playlist = await youtubeFetch(`${base}/playlistItems?part=snippet,contentDetails&playlistId=${encodeURIComponent(uploads)}&maxResults=${MAX_VIDEO_COUNT}&key=${encodeURIComponent(YOUTUBE_API_KEY)}`);
    const videos = (playlist.items || []).filter(x => x.contentDetails?.videoId).map(x => ({
      id: x.contentDetails.videoId, title: x.snippet.title, description: x.snippet.description,
      publishedAt: x.snippet.publishedAt, thumbnail: x.snippet.thumbnails?.high?.url || x.snippet.thumbnails?.medium?.url || x.snippet.thumbnails?.default?.url,
      url: `https://www.youtube.com/watch?v=${x.contentDetails.videoId}`
    }));
    const result = { enabled: true, channel: { id: c.id, title: c.snippet.title, handle: YOUTUBE_HANDLE, description: c.snippet.description, thumbnail: c.snippet.thumbnails?.high?.url || c.snippet.thumbnails?.default?.url, url: `https://www.youtube.com/channel/${c.id}` }, videos };
    youtubeCache = { at: Date.now(), data: result }; res.json(result);
  } catch (err) { console.error('YouTube:', err.message); res.status(502).json({ enabled: true, error: err.message }); }
});

app.get('/api/creators', (_req, res) => res.json(readJson('creators.json', [])));
app.post('/api/community/submit', async (req, res) => {
  try {
    const user = await currentUser(req); if (!user) return res.status(401).json({ error: 'Sign in to submit community content.' });
    const type = String(req.body.type || '').trim(); const url = String(req.body.url || '').trim(); const note = String(req.body.note || '').trim().slice(0, 500);
    if (!['youtube','project'].includes(type) || !/^https?:\/\//i.test(url)) return res.status(400).json({ error: 'Provide a valid URL.' });
    const submissions = readJson('submissions.json', []); submissions.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2,8)}`, userEmail: user.email, type, url, note, status: 'pending', createdAt: new Date().toISOString() }); writeJson('submissions.json', submissions);
    res.json({ ok: true, message: 'Submitted for community review.' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Could not submit content.' }); }
});

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'minecraft-mobile', database: Boolean(pool), auth: Boolean(GOOGLE_CLIENT_ID && SESSION_SECRET), timestamp: new Date().toISOString() }));

app.use(express.static(PUBLIC, { extensions: ['html'] }));
app.get('*splat', (_req, res) => res.sendFile(path.join(PUBLIC, 'index.html')));

app.listen(PORT, () => console.log(`Minecraft Mobile running on port ${PORT}`));
