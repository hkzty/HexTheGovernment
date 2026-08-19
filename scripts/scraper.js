/* scripts/scraper.js — keyless content sync for the ABRAXAS / HTG site.
   Run: node scripts/scraper.js  (Node 18+, zero dependencies)

   What it does today (no API keys needed):
   - Reads the URLs already in config.js (sequence albums/highlights,
     SoundCloud profile, outNowEmbeds).
   - Resolves each through the platform's public oEmbed endpoint to get
     the real title + cover art.
   - Writes assets/data/content.json, which render.js picks up to show
     the auto-synced catalog on the site.

   What it does once the artist authorizes Instagram (one tap):
   - Set INSTAGRAM_ACCESS_TOKEN (repo secret / .env) and it pulls his
     photo posts and downloads new images into assets/gallery/, where the
     existing gallery-manifest.yml Action makes them appear on the site.

   Scheduled by .github/workflows/content-sync.yml every 6 hours. */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_FILE = path.join(ROOT, 'assets', 'data', 'content.json');
const GALLERY_DIR = path.join(ROOT, 'assets', 'gallery');

/* ---- load config.js (a browser file) in a sandbox ---------------------- */
function loadConfig() {
  const code = fs.readFileSync(path.join(ROOT, 'config.js'), 'utf8');
  const windowShim = {};
  new Function('window', code)(windowShim);
  return windowShim.ABRAXAS_CONFIG || {};
}

// Spotify's oEmbed endpoint now 403s any request that doesn't look like a real
// browser — send a desktop UA and an explicit JSON Accept.
const BROWSER_HEADERS = {
  'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'accept': 'application/json,text/html;q=0.9,*/*;q=0.8',
  'accept-language': 'en-US,en;q=0.9'
};

async function fetchJson(url, headers = { 'user-agent': 'HTG-content-sync/1.0' }) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

async function fetchText(url, headers = BROWSER_HEADERS) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.text();
}

function ogTag(html, prop) {
  const re = new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i');
  const m = html.match(re);
  return m ? m[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'") : '';
}

/* ---- keyless oEmbed resolvers ------------------------------------------ */
async function spotifyItem(url, kind) {
  const oembed = `oembed?url=${encodeURIComponent(url)}`;
  // 1. Real oEmbed on open.spotify.com — needs a browser UA or it 403s.
  try {
    const data = await fetchJson(`https://open.spotify.com/${oembed}`, BROWSER_HEADERS);
    return { platform: 'spotify', kind, url, title: data.title || '', thumbnail: data.thumbnail_url || '' };
  } catch (err) {
    if (!/^40[0-9]/.test(err.message)) throw err;
  }
  // 2. Older mirror still serves oEmbed JSON when the primary blocks us.
  try {
    const data = await fetchJson(`https://embed.spotify.com/${oembed}`, BROWSER_HEADERS);
    return { platform: 'spotify', kind, url, title: data.title || '', thumbnail: data.thumbnail_url || '' };
  } catch (err) {
    if (!/^40[0-9]/.test(err.message)) throw err;
  }
  // 3. Last resort: pull og: tags out of the public share page's HTML.
  const html = await fetchText(url);
  const title = ogTag(html, 'og:title') || ogTag(html, 'twitter:title');
  const thumbnail = ogTag(html, 'og:image') || ogTag(html, 'twitter:image');
  if (!title && !thumbnail) throw new Error(`no metadata for ${url}`);
  return { platform: 'spotify', kind, url, title, thumbnail };
}

async function soundcloudItem(url, kind) {
  const data = await fetchJson(`https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(url)}`);
  return { platform: 'soundcloud', kind, url, title: (data.title || '').trim(), thumbnail: data.thumbnail_url || '' };
}

function resolverFor(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    if (host === 'open.spotify.com') return spotifyItem;
    if (host.endsWith('soundcloud.com')) return soundcloudItem;
  } catch { /* not a URL */ }
  return null;
}

/* ---- Instagram (activates when the artist authorizes once) -------------- */
async function syncInstagram(token) {
  const fields = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp';
  const media = await fetchJson(`https://graph.instagram.com/me/media?fields=${fields}&limit=50&access_token=${token}`);
  const items = [];
  fs.mkdirSync(GALLERY_DIR, { recursive: true });
  for (const post of media.data || []) {
    const imageUrl = post.media_type === 'VIDEO' ? post.thumbnail_url : post.media_url;
    if (!imageUrl) continue;
    const file = `ig-${post.timestamp?.slice(0, 10) || 'undated'}-${post.id}.jpg`;
    const dest = path.join(GALLERY_DIR, file);
    if (!fs.existsSync(dest)) {
      const res = await fetch(imageUrl);
      if (res.ok) fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
    }
    items.push({
      platform: 'instagram', kind: 'post', url: post.permalink,
      title: (post.caption || '').slice(0, 120), thumbnail: `assets/gallery/${file}`,
      publishedAt: post.timestamp || ''
    });
  }
  return items;
}

/* ---- main ---------------------------------------------------------------- */
if (require.main === module) main();

module.exports = { spotifyItem, soundcloudItem, ogTag, BROWSER_HEADERS };

async function main() {
  const cfg = loadConfig();
  const seq = cfg.sequence || {};
  const sources = [
    ...(seq.albums || []).map(url => ({ url, kind: 'album' })),
    ...(seq.highlights || []).map(url => ({ url, kind: 'highlight' })),
    ...(cfg.outNowEmbeds || []).map(url => ({ url, kind: 'embed' })),
    ...(cfg.socials?.soundcloud ? [{ url: cfg.socials.soundcloud, kind: 'profile' }] : [])
  ];

  const items = [];
  const errors = [];
  for (const { url, kind } of sources) {
    const resolve = resolverFor(url);
    if (!resolve) continue;
    try {
      items.push(await resolve(url, kind));
      process.stdout.write('.');
    } catch (err) {
      errors.push(`${url}: ${err.message}`);
      process.stdout.write('x');
    }
  }
  console.log('');

  if (process.env.INSTAGRAM_ACCESS_TOKEN) {
    try {
      const ig = await syncInstagram(process.env.INSTAGRAM_ACCESS_TOKEN);
      items.push(...ig);
      console.log(`instagram: ${ig.length} posts synced`);
    } catch (err) {
      errors.push(`instagram: ${err.message}`);
    }
  } else {
    console.log('instagram: skipped (no INSTAGRAM_ACCESS_TOKEN — artist authorization pending)');
  }

  // Deduplicate by url, keep stable order (albums first, as configured).
  const seen = new Set();
  const unique = items.filter(i => !seen.has(i.url) && seen.add(i.url));

  if (!unique.length) {
    console.error('No items resolved — refusing to overwrite content.json.');
    if (errors.length) console.error(errors.join('\n'));
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify({
    generatedAt: new Date().toISOString(),
    counts: unique.reduce((acc, i) => ((acc[i.platform] = (acc[i.platform] || 0) + 1), acc), {}),
    items: unique
  }, null, 2) + '\n');

  console.log(`wrote ${path.relative(ROOT, OUT_FILE)} — ${unique.length} items`);
  if (errors.length) console.log(`warnings:\n${errors.join('\n')}`);
}
