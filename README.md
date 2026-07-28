# ABRAXAS × HTG — Official Site (www.htg.productions)

**Tagline:** Depressions Running Deep
**Label:** HTG - Hex The Government
**Sound:** Underground Occult Rap · 93 93/93

One-page music site for **ABRAXAS**, built with pure HTML, CSS, and vanilla JavaScript. No frameworks, no build tools, no dependencies. Terminal-styled purple/black interface with scroll storytelling, embedded players, lightbox gallery, and a booking contact flow.

---

## How the site works

There are two versions of the page, and visitors are routed automatically:

| File | Role |
|------|------|
| `index.html` | **Main site** (split build: HTML + `style.css` + `script.js`) |
| `mobile.html` | **Mobile site** (one-page build with CSS inlined) |

Phones (screens ≤ 820px) landing on `index.html` are redirected to `mobile.html`, and desktops landing on `mobile.html` are sent to `index.html`. Every page has a "Switch to Mobile/Desktop Version" link in the footer that overrides the automatic choice.

`mobile.html` is **generated from** `index.html` + `style.css` — don't edit it by hand. After changing `index.html` or `style.css`, regenerate it (see below).

---

## Updating the site — edit `config.js` only

Everything real about the artist lives in **`config.js`**. Edit it, save, upload. The pages rebuild themselves from it in the browser — no other file needs touching.

### 1. Link your profiles

```js
socials: {
  instagram:  "https://instagram.com/abraxas.htg",
  spotify:    "",                       // paste your Spotify artist URL when live
  soundcloud: "https://on.soundcloud.com/uTMdelzf0aAmn2Nx9a",
  tiktok:     "https://www.tiktok.com/@abraxasthemage",
  ...
},
linktree: "https://linktr.ee/abraxashtg",
```

These power the footer icons, the "Out Now" platform cards, and the "All Links" buttons. An empty `""` falls back to the platform's homepage until you fill it in.

### 2. The Sequence — the full playthrough

The `sequence` block in `config.js` holds the recovery sequence: the artist player, the numbered album playthrough (01 → 13, in order), and the pinned **STRETTY** highlight tracks. Add or reorder by editing the URL lists — every Spotify URL becomes a player automatically. The three tracks in `highlights` are pinned at the top with a glowing STRETTY tag.

### 3. Embed players from public URLs

Paste any public **Spotify / SoundCloud / YouTube** track, album, playlist, or artist URL into `outNowEmbeds` and it appears on the site as an embedded player automatically:

```js
outNowEmbeds: [
  "https://open.spotify.com/track/XXXXXXXXXXXX",
  "https://soundcloud.com/yourname/yourtrack",
  "https://youtu.be/XXXXXXXXXXX"
],
```

### 4. Photos — just drop them in a folder

Put image files in **`assets/gallery/`** and push (the GitHub web "Upload files" button works). A GitHub Action rebuilds `assets/gallery/manifest.json` automatically and the site's gallery + lightbox pick the photos up on their own — captions come from the filenames (`night-session.jpg` → "night session"). No code edits.

Instagram: paste public post/reel URLs into `instagramPosts` in `config.js` and they appear embedded in the Gallery section.

Everything else (hero video, covers) points at files you place in `assets/`:

```js
heroVideo: "assets/htg-hero.mp4",
gallery: [
  { thumb: "assets/gallery/shot1.jpg", full: "assets/gallery/shot1.jpg", caption: "Night session" },
],
releases: [
  { title: "Black Halo Error", type: "Single", tag: "Occult Rap",
    blurb: "…", cover: "assets/covers/bhe.jpg", link: "https://open.spotify.com/track/…" },
],
```

Public image URLs work too. Add or remove entries freely — grids, lightbox, and players rebuild automatically.

> **Tip:** the current hero video (`assets/htg-hero.mp4`) is ~25 MB. Re-exporting it at 720p / higher compression (2–5 MB) will make the page load dramatically faster on phones. The site skips the video automatically for visitors with Data Saver enabled.

### 5. Bookings / contact

```js
contactEmail: "Bookings@htg.productions",
```

The contact form validates the message, then opens the visitor's email app pre-addressed to this email with their message filled in. No backend needed. (For silent in-page submissions later, hook the form to Formspree or Netlify Forms.)

---

## Auto content sync (scraper)

`scripts/scraper.js` keeps the site's catalog current without anyone editing files by hand.
It runs on a schedule via `.github/workflows/content-sync.yml` (every 6 hours, plus a
manual **Run workflow** button in the Actions tab), commits any changes, and GitHub Pages
redeploys automatically.

**What it does with no API keys at all:** reads the Spotify / SoundCloud URLs already in
`config.js` (`sequence.albums`, `sequence.highlights`, `outNowEmbeds`, `socials.soundcloud`),
resolves each through the platform's public oEmbed endpoint for the real title and cover art,
and writes `assets/data/content.json`. `render.js` reads that file and appends the results to
the New Releases grid as `AUTO-SYNC` cards. If the file is missing or empty the site simply
shows the hand-written releases — nothing breaks.

**Instagram photos (needs one tap from the artist):** the artist authorizes a Meta app once
via Instagram Login; store the resulting long-lived token as the repo secret
`INSTAGRAM_ACCESS_TOKEN`. The scraper then pulls his posts, downloads any new images into
`assets/gallery/`, and the existing `gallery-manifest.yml` Action makes them appear in the
gallery. Without the secret this step is skipped with a log line and everything else still runs.

Run it locally with `npm run scrape` (Node 18+, no dependencies to install).

> Note: the scraper needs outbound access to `open.spotify.com` and `soundcloud.com`. Some
> sandboxed environments block these; GitHub Actions runners do not.

---

## Regenerating mobile.html

After editing `index.html` or `style.css`, rebuild the one-page mobile version:

```bash
node -e "
const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('style.css', 'utf8');
html = html.replace('    <link rel=\"stylesheet\" href=\"style.css\" />', '  <style>\n' + css + '  </style>');
html = html.replace('data-page=\"desktop\"', 'data-page=\"mobile\"');
html = html.replace('<a class=\"inline-link view-toggle\" href=\"mobile.html?mobile=1\">Switch to Mobile Version</a>', '<a class=\"inline-link view-toggle\" href=\"index.html?desktop=1\">Switch to Desktop Version</a>');
fs.writeFileSync('mobile.html', html);
"
```

(If you only edited `config.js`, nothing needs regenerating.)

---

## Project structure

```text
hexthegovernment/
├── index.html        # main (desktop) page
├── mobile.html       # generated one-page mobile build
├── style.css         # all styling (inlined into mobile.html)
├── script.js         # interactions: nav, reveals, lightbox, form
├── render.js         # builds page content from config.js
├── config.js         # ← EDIT THIS: links, sequence, gallery, contact
├── CNAME             # custom domain (www.htg.productions) — do not delete
├── assets/
│   ├── htg-hero.mp4  # hero video
│   └── gallery/      # ← DROP PHOTOS HERE, they appear automatically
└── .github/workflows/gallery-manifest.yml
```

Script order matters: `config.js` → `render.js` → `script.js`.

---

## Deployment

This repo deploys to **www.htg.productions** via GitHub Pages (the `CNAME` file — don't delete it). Merging to `main` publishes the site live.

---

## What's real vs placeholder

Real: artist identity, the Spotify artist page and the full Sequence (13 albums + 3 Stretty highlight tracks), release titles (*Black Halo Error*, *Violet Static*, *Crash Prayer*, *Saintless Code*, *Purple Mourning*, *Null Cathedral Video*), Instagram / SoundCloud / TikTok / Linktree links, booking email, hero video.

Still placeholder (swap in `config.js` / `index.html` as they become real): gallery images until photos land in `assets/gallery/`, release cover art, merch items and prices, tour dates, Apple Music / YouTube links.

Also external for now (self-host before heavy promo pushes): Google Fonts and the picsum placeholder images.

---

## Credits

Built for **ABRAXAS** under **HTG - Hex The Government**.
Management / bookings: `Bookings@htg.productions` · Produces as **HexBoy** · Mastering: **Microbial Mastering**
