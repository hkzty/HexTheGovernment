/* scripts/scraper.test.js — zero-dep sanity check for the Spotify resolver.
   Run: node scripts/scraper.test.js
   Mocks global fetch so it never touches the network. */

const assert = require('assert');
const { spotifyItem, BROWSER_HEADERS } = require('./scraper');

const URL = 'https://open.spotify.com/track/7Az3pwgwCk09ZfQzlH8slr';

function mockFetch(sequence) {
  const calls = [];
  global.fetch = async (u, opts = {}) => {
    calls.push({ url: u, headers: opts.headers || {} });
    const next = sequence.shift();
    if (!next) throw new Error(`unexpected extra fetch: ${u}`);
    return next(u);
  };
  return calls;
}

function jsonRes(body) {
  return async () => ({ ok: true, status: 200, statusText: 'OK', json: async () => body, text: async () => JSON.stringify(body) });
}
function textRes(body) {
  return async () => ({ ok: true, status: 200, statusText: 'OK', text: async () => body });
}
function errRes(status, statusText = 'Forbidden') {
  return async () => ({ ok: false, status, statusText, json: async () => ({}), text: async () => '' });
}

async function run() {
  // 1. Primary oEmbed succeeds with browser headers.
  {
    const calls = mockFetch([jsonRes({ title: 'Track A', thumbnail_url: 'https://i/a.jpg' })]);
    const out = await spotifyItem(URL, 'highlight');
    assert.deepStrictEqual(out, { platform: 'spotify', kind: 'highlight', url: URL, title: 'Track A', thumbnail: 'https://i/a.jpg' });
    assert.strictEqual(calls.length, 1);
    assert.ok(calls[0].url.startsWith('https://open.spotify.com/oembed?url='));
    assert.strictEqual(calls[0].headers['user-agent'], BROWSER_HEADERS['user-agent']);
    assert.ok(/application\/json/.test(calls[0].headers.accept));
    console.log('ok  primary oEmbed uses browser UA + Accept');
  }

  // 2. Primary 403s → mirror answers.
  {
    const calls = mockFetch([errRes(403), jsonRes({ title: 'Track B', thumbnail_url: 'https://i/b.jpg' })]);
    const out = await spotifyItem(URL, 'album');
    assert.strictEqual(out.title, 'Track B');
    assert.strictEqual(out.thumbnail, 'https://i/b.jpg');
    assert.strictEqual(calls.length, 2);
    assert.ok(calls[1].url.startsWith('https://embed.spotify.com/oembed?url='));
    console.log('ok  falls back to embed.spotify.com mirror on 403');
  }

  // 3. Both oEmbed hosts 403 → og-tag HTML scrape.
  {
    const html = `
      <html><head>
        <meta property="og:title" content="Scraped Title" />
        <meta property="og:image" content="https://i.scdn.co/image/scraped.jpg" />
      </head></html>`;
    const calls = mockFetch([errRes(403), errRes(403), textRes(html)]);
    const out = await spotifyItem(URL, 'embed');
    assert.strictEqual(out.title, 'Scraped Title');
    assert.strictEqual(out.thumbnail, 'https://i.scdn.co/image/scraped.jpg');
    assert.strictEqual(calls.length, 3);
    assert.strictEqual(calls[2].url, URL);
    console.log('ok  falls back to og-tag HTML scrape when both oEmbed hosts 403');
  }

  // 4. Non-4xx failure surfaces immediately (does not fall through silently).
  {
    mockFetch([async () => { throw new Error('ENOTFOUND'); }]);
    await assert.rejects(() => spotifyItem(URL, 'album'), /ENOTFOUND/);
    console.log('ok  non-403 failures on primary propagate');
  }

  console.log('\nall assertions passed');
}

run().catch(e => { console.error(e); process.exit(1); });
