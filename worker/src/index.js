/*
  Suit Purge highscores — Cloudflare Worker + KV.

  GET  /scores          -> { scores: [{ tag, kills, wave, at }] }  top ten
  POST /scores          <- { tag, kills, wave }                     one run
                        -> { scores, rank }  rank is 1-based, or 0 if unplaced

  Only runs the player chooses to submit arrive here; game.js posts on the
  Save button and nowhere else. Storage is one KV key holding the board.

  Limits, and why they are only deterrents: the game runs in the browser,
  so any number can be posted. The worker rejects impossible runs (kills
  above what the waves could have spawned), bad tags, foreign origins,
  and more than one submit per address per half-minute. Nothing here can
  prove a run happened.
*/

const KEY = 'board';
const MAX = 10;
const TAG_LEN = 3;
const RATE_TTL = 30;

// Mirrors game.js: wave w spawns min(3 + 2w, 12) suits, so kills after
// finishing wave w-1 cannot exceed the sum of spawns through wave w.
const maxKillsForWave = (wave) => {
  let total = 0;
  for (let w = 1; w <= wave; w++) total += Math.min(3 + w * 2, 12);
  return total;
};

const cleanTag = (value) =>
  String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, TAG_LEN);

const beats = (a, b) => a.kills > b.kills || (a.kills === b.kills && a.wave > b.wave);

const corsHeaders = (origin) => ({
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
  'Vary': 'Origin'
});

const json = (body, status, origin) =>
  new Response(JSON.stringify(body), {
    status,
    headers: Object.assign(
      { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
      corsHeaders(origin)
    )
  });

const readBoard = async (env) => {
  const rows = await env.SCORES.get(KEY, 'json');
  return Array.isArray(rows) ? rows : [];
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const allowed = String(env.ALLOWED_ORIGINS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (url.pathname !== '/scores') return new Response('Not found', { status: 404 });

    // Browsers send Origin on POST and on cross-site GET; curl sends none.
    // Reads without an Origin are allowed (the board is public); writes
    // must come from the site.
    const originOk = allowed.includes(origin);
    const echo = originOk ? origin : allowed[0] || '*';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: originOk ? 204 : 403, headers: corsHeaders(echo) });
    }

    if (request.method === 'GET') {
      return json({ scores: await readBoard(env) }, 200, echo);
    }

    if (request.method !== 'POST') return json({ error: 'method' }, 405, echo);
    if (!originOk) return json({ error: 'origin' }, 403, echo);

    let body;
    try { body = await request.json(); } catch (err) { return json({ error: 'json' }, 400, echo); }

    const tag = cleanTag(body && body.tag);
    const kills = Number.isInteger(body && body.kills) ? body.kills : -1;
    const wave = Number.isInteger(body && body.wave) ? body.wave : -1;
    if (tag.length !== TAG_LEN) return json({ error: 'tag' }, 400, echo);
    if (kills < 1 || wave < 1 || wave > 999 || kills > maxKillsForWave(wave)) {
      return json({ error: 'run' }, 400, echo);
    }

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const rateKey = 'rate:' + ip;
    if (await env.SCORES.get(rateKey)) return json({ error: 'rate' }, 429, echo);
    await env.SCORES.put(rateKey, '1', { expirationTtl: RATE_TTL });

    const run = { tag, kills, wave, at: Date.now() };
    const rows = await readBoard(env);
    let i = 0;
    while (i < rows.length && !beats(run, rows[i])) i++;
    let rank = 0;
    if (i < MAX) {
      rows.splice(i, 0, run);
      rows.length = Math.min(rows.length, MAX);
      // KV is last-write-wins; two submits in the same second can drop one.
      await env.SCORES.put(KEY, JSON.stringify(rows));
      rank = i + 1;
    }
    return json({ scores: rows, rank }, 200, echo);
  }
};
