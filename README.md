# ABRAXAS × HTG — Official Site (www.htg.productions)

**Tagline:** Depressions Running Deep
**Label:** HTG - Hex The Government
**Sound:** HEXCORE · 93 93/93

Label site for **HTG** and its roster (ABRAXAS, Stretty, ciggyholster, Justinn.clout), built with pure HTML, CSS, and vanilla JavaScript. No frameworks, no build tools, no dependencies. Black/white with matrix rain: roster doors, Spotify embeds, the Sequence, a gallery, a contact form. Almost no copy, on purpose — see the copy policy in `CLAUDE.md`.

---

## How the site works

There are two versions of the page, and visitors are routed automatically:

| File | Role |
|------|------|
| `index.html` | **Main site** (split build: HTML + `style.css` + `script.js`) |
| `mobile.html` | **Mobile site** (one-page build with CSS inlined) |

Phones (screens ≤ 820px) landing on `index.html` are redirected to `mobile.html`, and desktops landing on `mobile.html` are sent to `index.html`. The landing page footer has a "Mobile site" / "Desktop site" link that overrides the automatic choice.

`mobile.html` is **generated from** `index.html` + `style.css` — don't edit it by hand. After changing `index.html` or `style.css`, run `npm run build:mobile` (see below).

---

## Updating the site — edit `config.js` only

Links, the Sequence, the gallery list and the contact addresses live in **`config.js`**. Edit it, save, upload. The pages rebuild themselves from it in the browser — no other file needs touching. An empty `""` social URL removes that link from the page; nothing falls back to a platform homepage.

### 1. Link your profiles

```js
socials: {
  instagram:  "https://instagram.com/abraxas.htg",
  spotify:    "https://open.spotify.com/artist/24hLqvYHqzi1eL2ZzpjO19",
  soundcloud: "https://on.soundcloud.com/uTMdelzf0aAmn2Nx9a",
  tiktok:     "https://www.tiktok.com/@abraxasthemage",
  ...
},
linktree: "https://linktr.ee/abraxashtg",
```

These power the footer icons and the links under the Music players; `linktree` is the "Links" row on the contact card. An empty `""` removes that link.

### 2. The Sequence — the full playthrough

The `sequence` block in `config.js` holds the artist card, the numbered album playthrough (01 → 13, in order), and the pinned highlight tracks. Add or reorder by editing the URL lists — every Spotify URL becomes a cover card that loads its player on tap. The tracks in `highlights` are pinned at the top with the `PINNED` tag.

### 3. Embed players from public URLs

Paste any public **Spotify / SoundCloud / YouTube** track, album, playlist, or artist URL into `outNowEmbeds` and it appears under the artist players in the Music section:

```js
outNowEmbeds: [
  "https://open.spotify.com/track/XXXXXXXXXXXX",
  "https://soundcloud.com/yourname/yourtrack",
  "https://youtu.be/XXXXXXXXXXX"
],
```

### 4. Photos — just drop them in a folder

Put image files in **`assets/gallery/`**, run `npm run build:gallery` (rebuilds `assets/gallery/manifest.json`), and commit both. The site's gallery + lightbox pick the photos up on their own — captions come from the filenames (`night-session.jpg` → "night session"). Run `npm run check:gallery` before pushing to catch a stale manifest. (A GitHub Action was meant to rebuild the manifest on push, but user-defined workflows never execute in this repo — see *Known broken*.)

The gallery currently holds real frames off HTG's own visuals — hero-reel stills and live Suit Purge floors. Session/phone shots should replace them as they exist.

Instagram: paste public post/reel URLs into `instagramPosts` in `config.js` and they appear embedded in the Gallery section.

Everything else (hero video, gallery fallback) points at files you place in `assets/`:

```js
heroVideo: "assets/htg-hero-720p.mp4",
heroVideoWebm: "assets/htg-hero-720p.webm",
gallery: [
  { thumb: "assets/gallery/shot1.jpg", full: "assets/gallery/shot1.jpg", caption: "Night session" },
],
```

Public image URLs work too. Add or remove entries freely — the grid and lightbox rebuild automatically. There is no releases / coming-soon / tours / stats config any more: those sections were removed rather than shown empty (see the content and copy policies in `CLAUDE.md`).

> The hero video is the 720p pair (`assets/htg-hero-720p.webm` ~0.55 MB, `.mp4` ~0.9 MB). The site skips it for visitors with Data Saver or reduced motion.

### 5. Bookings / contact

```js
contactForm: {
  endpoint: "",   // Formspree or Web3Forms endpoint — setup notes in config.js
  accessKey: ""   // Web3Forms only
},
contactEmail: "Abraxas@htg.productions",
management: "Bookings@htg.productions",
```

The contact form validates the message, then delivers it one of two ways. With `contactForm.endpoint` set — a free Formspree or Web3Forms form-to-email endpoint, no backend, setup notes in `config.js` — it sends straight from the page and the visitor never needs a mail app. Without one it falls back to opening the visitor's email app pre-addressed to `contactEmail`, and shows the address to copy in case no mail app is installed. **The endpoint is currently unset**, so every visitor is on the mailto fallback; creating the free account and pasting the endpoint is the open task.

---

## Auto content sync (scraper) — currently broken

`scripts/scraper.js` was meant to keep the site's catalog current without anyone editing
files by hand: resolve the Spotify / SoundCloud URLs already in `config.js` through the
platforms' public oEmbed endpoints and write `assets/data/content.json`. Nothing on the
site reads that file any more — the New Releases grid it fed was removed — so a repaired
scraper would also need a new consumer.

**It has never produced that file.** Every source returns `403 Forbidden` from Spotify's
oEmbed endpoint (which appears to reject datacenter IPs, and Actions runners are datacenter
IPs), so the script exits on its own "No items resolved" guard. Its workflow
(`content-sync.yml`) was deleted after 83 consecutive failures. The script is kept so the
fetch path can be repaired — a fix probably means the Spotify Web API with client
credentials in Actions secrets, not oEmbed. Details in `CLAUDE.md`.

The site is unaffected: with no `content.json` it simply shows the hand-written config
content. Run the script locally with `npm run scrape` (Node 18+, no dependencies).

---

## Regenerating mobile.html

`mobile.html` is a **generated file** — never edit it directly. It is
`index.html` with `style.css` inlined, the `data-page` redirect flipped to
the mobile side, the footer view-toggle pointed back at the desktop page,
and one phone-chrome rule appended.

After editing `index.html` or `style.css`, rebuild it:

```bash
npm run build:mobile
```

To verify the committed copy is current:

```bash
npm run check:mobile
```

Run it before pushing anything that touches `index.html` or `style.css`.
It is deliberately **not** a GitHub Actions workflow: user-defined workflows
in this repo almost never execute — 28 of the 30 recorded `content-sync`
runs, the single `gallery-manifest` run, and a trial `mobile-sync` run all
failed within 3-5 seconds without reaching a runner (only GitHub's own
managed `pages build and deployment` succeeds). A check that is permanently
red without ever running is worse than none, so this stays a local command.
If Actions is ever fixed for this repo, wiring `npm run check:mobile` into a
workflow is the obvious next step.

The generator is `scripts/build-mobile.js`. It aborts if any of its anchors
in `index.html` stops matching exactly once, so a reshaped page fails loudly
rather than emitting a half-converted mobile build — the two files drifted
badly once, leaving phones on a pre-HTG version of the site.

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
│   ├── htg-hero-720p.webm  # hero loop (mp4 fallback alongside)
│   ├── og/           # 1200×630 og:image cards, one per page
│   └── gallery/      # ← DROP PHOTOS HERE, they appear automatically
└── .github/workflows/gallery-manifest.yml
```

Script order matters: `config.js` → `render.js` → `script.js`.

---

## Search & AI-agent discoverability

`robots.txt`, `sitemap.xml`, `llms.txt` and `site.webmanifest` at the root, plus schema.org JSON-LD and canonical links in every page head, describe the label, roster, profiles, the Sequence and Suit Purge to crawlers and LLM agents. `sitemap.xml` is generated: run `npm run build:sitemap` after editing a page (`npm run check:sitemap` tells you if it is stale). Keep the rest factual and update it together with any new artist, page or profile URL (details in `CLAUDE.md` under "Discoverability layer").

## Deployment

This repo deploys to **www.htg.productions** via GitHub Pages (the `CNAME` file — don't delete it). Merging to `main` publishes the site live.

---

## What's real vs placeholder

Real: artist identity, the Spotify artist page and the full Sequence (13 albums + 3 pinned highlight tracks), Instagram / SoundCloud / TikTok / Linktree links, booking email, hero video.

Still placeholder (swap in `config.js` as they become real): gallery frames until session photos land in `assets/gallery/`, the hero poster. Apple Music / YouTube / YouTube Music links are empty and therefore not shown. The invented release titles, merch products, and tour dates that used to ship here have been removed outright, along with their sections (see the content policy in `CLAUDE.md`).

Also external for now (self-host before heavy promo pushes): Google Fonts. Placeholder art is now bundled locally under `assets/placeholders/` — no third-party image host in the runtime path.

---

## Credits

Built for **ABRAXAS** under **HTG - Hex The Government**.
Management / bookings: `Bookings@htg.productions` · Produces as **HexBoy** · Mastering: **Microbial Mastering**
