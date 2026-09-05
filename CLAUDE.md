# HTG — Hex The Government

Static site for the label **HTG** and its artist **ABRAXAS**. Live at
**www.htg.productions**.

This is the canonical repo. An older, simpler copy of this site exists at
`hkzty/AbraxasMusic` — it is **superseded**; do not port work from it or
treat it as a source of truth.

## Stack

Vanilla HTML / CSS / JS. No build step, no framework, no runtime
dependencies. `package.json` exists only to pin Node for the scraper
script; `npm run build` is a no-op by design.

Deployed by GitHub Pages straight from `main` (see `CNAME`). Merging to
`main` **is** the deploy — there is no deploy workflow. A
`pages-build-deployment` run appears in Actions on every push to `main`.

## Layout

| File | Role |
|---|---|
| `config.js` | **The only file most content edits need.** Social URLs, the Sequence, gallery, shop, contact. Sets `window.ABRAXAS_CONFIG`. |
| `render.js` | Reads the config and rewrites the markup at runtime. |
| `script.js` | Site chrome: nav, scroll-spy, reveals, lightbox, contact form, Suit Purge unlock. |
| `game.js` | Suit Purge — the in-page shooter. Self-contained IIFE. |
| `rain.js`, `rain.html` | Jars — the second hidden game, on the rain. Self-contained IIFE. Unlocked only from `game.html`. |
| `index.html` | Desktop page: hero, roster, music, gallery, donation + legal footer. Everything else is a standalone page. The hero is a full-screen gate (`body.hero-gate`, `script.js`): the page is locked on it until the first wheel / swipe / tap / key, which scrolls to the roster. |
| `roster.html`, `music.html`, `gallery.html` | Standalone copies of the home sections in the `sequence.html` shell; the nav links here, the home page keeps the sections for scrolling. They embed the same markup as `index.html` — edit both. |
| `contact.html` | Standalone contact page (form handler lives in `script.js`). Suit Purge and the Sequence are `game.html` / `sequence.html`; the home page carries no `#game`, `#sequence` or `#contact` section. |
| `mobile.html` | Phone page. **Generated — never hand-edit.** |
| `style.css` | Stylesheet for every page (inlined into `mobile.html`). |
| `scripts/build-mobile.js` | Builds `mobile.html` from `index.html` + `style.css`. |
| `scripts/scraper.js` | Content sync. **Currently broken, workflow removed.** |

### The desktop/mobile split — read this before editing either page

`index.html` and `mobile.html` are two files serving the same site. An
inline script at the top of each (`data-page`) redirects between them by
viewport width, with `?desktop` / `?mobile` pinning a choice in
`sessionStorage`.

**`mobile.html` is generated. Do not edit it by hand.** It is
`index.html` with `style.css` inlined, `data-page` flipped to `mobile`,
and the footer view-toggle pointed back at the desktop page. There is no
phone-only chrome any more: the floating bottom-right menu pill is the
header on every width (`style.css`, `.topbar` / `.menu-toggle` /
`.nav.open`). Everything else, including the roster, comes straight from
`index.html`.

After any edit to `index.html` or `style.css`:

```bash
npm run build:mobile   # rewrites mobile.html
npm run check:mobile   # fails if the committed copy is stale
```

Run `check:mobile` before pushing. It is **not** wired into CI on purpose:
user-defined workflows in this repo almost never execute (see below), so a
CI guard here would sit permanently red without ever having run — which
trains reviewers to ignore red, the exact failure mode that let this drift
survive.

Why this is a script and not a convention: the two files were previously
kept in sync by hand, and they did not stay in sync. `mobile.html` was
left on a pre-HTG, ABRAXAS-only version of the whole site — no roster, no
vessel copy, no legal footer, and three invented merch products with
prices, in violation of the content policy below. It also survived a
deliberate deletion: PR #21 replaced it with a redirect stub, and a later
merge took a stale branch's copy and resurrected all 2,229 lines of it.
Hand-syncing does not work here.

The generator aborts if any of its find/replace anchors in `index.html`
stops matching exactly once, so a reshaped `index.html` fails loudly
instead of emitting a half-converted page.

**Testing mobile requires `?mobile=1`** on a wide viewport, or the
redirect bounces you straight to `index.html`.

## Content policy — this matters here

The site previously shipped a large amount of invented content presented
as real: three tour dates with fake venues and door times, three
unreleased "coming soon" titles with dates, three invented release names,
and fabricated statistics. All of it has been removed, and so have the
sections that held it.

**Do not add placeholder content that reads as real.** No invented tour
dates, venues, release titles, dates, or numbers. A section with no real
content does not exist on the page — no "nothing announced yet" empty
states, no stats counters.

Note the trap that let fakes survive a previous cleanup: `render.js`
only replaces a section's markup when the matching config value is
**non-empty** (the gallery still works this way). Emptying a config array
leaves the hardcoded fallback visible in the HTML. **Fix both layers** —
the config value *and* the markup fallback.

## Copy policy — nobody needs the site explained to them

The reference density is Ghostemane's and $uicideboy$'s sites: logo,
nav, embeds, merch, socials, and almost no sentences. The owner asked for
everything that read as AI-written to go, and it went. Do not bring it
back. Concretely:

- **No copy about the site itself.** Nothing that explains what a section
  is for, how to use it, where the content comes from ("pulled straight
  from Spotify"), or how honest it is ("counted, not invented").
- **No UI instructions.** No "tap for the player", "click any frame",
  "press one and it plays right here". A play icon is the instruction.
- **No empty-state messaging.** A section with nothing in it is removed,
  not narrated. The Story timeline, Stats counters, New Releases, Coming
  Soon and Upcoming Tours sections, the sticky CTA bar, the back-to-top
  button, the easter-egg hint paragraph, the platform description cards
  and the door reveal panels were all deleted for this reason.
- **No template chrome.** The custom cursor, the hero parallax layers, the
  filename captions overlaid on gallery thumbnails, the console "there is
  a maze" breadcrumb and the game's "copy the brag" share button went in
  the same sweep. Sequence cover cards carry no title until Spotify's
  oEmbed supplies the real one — never a generated "Sequence 01" label.
- **Section heads are one kicker**, as `<h2 class="section-kicker">`. No
  section title, no intro paragraph. The Sequence keeps a one-line note.
- **No metaphor spray.** The Noah/Ark lore is the owner's, and the owner
  asked for it as a background subtlety only: the faint `.door-lore`
  watermarks behind the ABRAXAS and STRETTY roster doors, the `NOAH` /
  `THE ARK` watermark sigils on `abraxas.html` / `stretty.html`, and the
  THE ARK trademark line on `legal.html`. No visible role lines, no
  copy. Everything else — "aboard", "boarding card", "Board X →", "the
  vessel", "pulled out of the water", the sign-off nod lines — is gone.
  Keep it gone.
- **Owner voice that stays:** the hero curse line, "Hex The Government",
  "Depressions Running Deep", the legal footer, the game's own
  flavour text, and the fiction/satire notice (a legal guard — may be
  shortened, never removed).
- **Links point at real profiles or don't exist.** `render.js` removes
  any `[data-social]` link whose URL is empty in `config.socials`; it
  never falls back to a platform homepage.
- Meta descriptions, `og:description`, `aria-label`s, iframe titles and
  form placeholders follow the same rule: name the thing, don't sell it.

## Discoverability layer — machine-readable, not visible

The site describes itself to crawlers and AI agents in places visitors
never read, so the visible page can stay near-silent. Nothing here depends
on `render.js` running.

| File | Role |
|---|---|
| `robots.txt` | One `User-agent: *` group: allows everything public (AI crawlers included — the owner wants AI in the back end, never showing on the front end; `legal.html` §2 still forbids training on the content and stays as written) and blocks `copydesk.html`, `content/`, `docs/`, `scripts/`. No per-bot groups — under RFC 9309 a named group inherits nothing from `*`, so a bot-specific `Allow: /` silently drops the Disallows for exactly that bot. |
| `sitemap.xml` | **Generated** by `scripts/build-sitemap.js`; `lastmod` is each page's last commit date. `mobile.html` is deliberately absent. After editing any page: `npm run build:sitemap`, and `npm run check:sitemap` before pushing (same deal as `check:mobile`, and for the same reason not in CI). |
| `llms.txt` | Plain-markdown summary for LLM agents: roster, every profile URL, the Sequence and the deck tracks, contact, trademarks, the explicit "no tour dates, no upcoming releases" line, and the ABRAXAS/Stretty Spotify disambiguation. |
| `site.webmanifest` | Name, colours, `music`/`entertainment` categories, the SVG mark as icon. |
| JSON-LD in each page head | `index.html` carries `Organization` (`#org`), `WebSite` (`#website`), a `WebPage`, the three `MusicGroup`s, the `Person` and the `VideoGame`. Each deck repeats its own entity under the same `@id` plus a `WebPage` and a `BreadcrumbList`; `abraxas.html` adds the thirteen `MusicAlbum` nodes (URL-only — their titles are not on the site), `stretty.html` / `ciggie.html` add `MusicRecording`s for the tracks named on the page, `sequence.html` an `ItemList` of the albums. No `VideoObject`s: Google requires `name` and `uploadDate`, which the site deliberately does not hand-write. |

Every indexed page also has `<link rel="canonical">`, a `robots` meta,
`twitter:title`/`twitter:description`, and the footer social icons carry
`rel="me"`. Location: `legal.html` is governed by NSW law, so every page
carries `og:locale` `en_AU` and the Organization node an `address` of
NSW, AU. Nothing prices anything (the game is `isAccessibleForFree`). `index.html` advertises `mobile.html` as its phone alternate
and `mobile.html` keeps the canonical pointing at `index.html`;
`build-mobile.js` strips the alternate link on the phone copy (and aborts
if it is missing, like its other anchors). Share cards are in
`assets/og/`; `twitter:image` used to point at a non-existent
`assets/share/`.

Rules: **facts only** — genres, handles and IDs come from `config.js` and
the pages, never guessed (no invented locations, founding dates, member
counts or genres), and descriptions are as terse as the page copy: no
manifesto sentences in `description` fields either. When an artist, page
or profile URL is added or changed, update `llms.txt`, the JSON-LD graphs
and the sitemap (`npm run build:sitemap`) in the same commit. Anything
that reads as a pitch belongs in `llms.txt` or structured data, not in
the page.

## The real Spotify artist

`https://open.spotify.com/artist/24hLqvYHqzi1eL2ZzpjO19` — in
`config.js` under `sequence.artist` and `socials.spotify`.

Several unrelated artists on Spotify are also called ABRAXAS. A previous
session guessed one by matching an audio-preview hash and got it wrong.
Take the ID from `config.js`; never infer it from a search.

## Suit Purge (`game.js`)

An original raycaster, ~1350 lines, wired into both pages as the `#game`
section. Deliberately dependency-free: walls, sprites, the weapon and all
sound are generated in code at runtime. Nothing is downloaded, and no
third-party game assets ship — which also keeps it clear of DOOM's
copyright, since only the engine is GPL and the art is not.

Enemies are four invented ruling-class caricatures, told apart by
silhouette because at 64px the outline is all the player gets:

| Type | HP | Speed | Tell |
|---|---|---|---|
| Politician | 100 | 1.00× | suit, tie, rosette, briefcase |
| Billionaire | 80 | 1.35× | gilet, jeans, headset, phone |
| Trillionaire | 220 | 0.68× | top hat, tailcoat, monocle, cigar |
| High Command | 140 | 0.95× | peaked cap, epaulettes, medals |

**These are fictional class archetypes. No real person, name or likeness
is depicted, and none should ever be added.** Generic political satire is
the whole point; a specific identifiable target is not.

Waves ramp the mix (`pickType`): politicians and billionaires at wave 1,
High Command from 2, Trillionaires from 3. The game pauses when scrolled
out of view, on Escape, and when the tab is hidden.

### Non-obvious things in the game code

- **`body.game-active` suppresses `body::before` / `body::after`.** Those
  two fixed, full-viewport masked overlays force the compositor to
  re-blend on every canvas repaint — measured at a 23fps cost (37 → 60).
  Do not remove that rule.
- **The HUD only writes to the DOM on change.** Writing all four values
  every frame forced a layout pass per frame and caused a sub-pixel
  jitter that left the overlay button permanently unstable.
- **Enemies chase without a line-of-sight gate**, and sidestep when
  blocked. Gating on LOS left them standing inert in rooms the player
  never entered; and with `dx` or `dy` at zero the axis-slide had nothing
  to slide along, so they deadlocked against head-on walls.
- **The map has no runtime validator — check it by hand after editing
  `MAP_SRC`.** There is no flood-fill or connectivity guard in the code;
  a disconnected room or a spawn placed on a wall will ship silently. The
  invariant to preserve: every open (`.`) cell must be reachable from the
  player start, and every `SPAWNS` coordinate must sit on open, reachable
  floor. Verify with a throwaway flood-fill from the start cell over
  `MAP_SRC` that visits all open cells and confirms each spawn is among
  them. (If this becomes a frequent edit, promoting that check into a
  dev-only assertion in `game.js` would be worth doing.)

## Jars (`rain.js`, `rain.html`) — the second egg

A catch-and-defend game built on the same glyph rain as `matrix.js`
(same glyphs, inks, fall and fade constants — keep the two in step). A
jar on a rail catches whatever crosses it; full jars sell for cash; cash
buys Walls, Turret, Rim, Cloud and Market; the same four fictional
archetypes as Suit Purge walk in from both edges, endlessly. Same rules
as Suit Purge: no downloads, no third-party assets, **no real person**.

It is doubly hidden: nothing links to it except `game.html`'s own
footer-less unlock script — on the Suit Purge page, type `rain` or `jar`,
tap the title three times, or add `?rain` / `?jar`. `rain.html` links
back to Suit Purge; nothing else links forward. Indexed like Suit Purge
(sitemap, `llms.txt`, JSON-LD).

Non-obvious things in the code:

- **The rain draws into an offscreen buffer** blitted onto the display
  each frame. Drawing it straight onto the display let the fade trail
  smear the jar, fort and hordes into ghosts across the rail.
- **`groundY` is measured from the shop row's `offsetTop`**, which wraps
  to three lines on a phone; `start()` sets the button labels before
  `resize()` so the measurement is of the wrapped row.
- HUD and shop buttons only write to the DOM on change, as in `game.js`.

## The HTG mark

`assets/htg-mark.svg` is the label's drawn sigil — a hexagon holding an H
whose crossbar is a hull, over a waterline. It is the favicon on the
HTG-branded pages (`index.html`/`mobile.html`, `game.html`, `legal.html`,
`404.html`); artist decks keep their own letter icons. The `og:image`
share cards live per-page in `assets/og/`. Reuse the SVG for anything that needs a stamp; don't reintroduce the old
plain-letter "H" tile.

## Drawn logos (`assets/logos/`)

`abraxas-logo.webp`, `stretty-logo.webp`, `ciggie-logo.webp`,
`justin-logo.webp` are the spiked artist marks, rasterised from the
traced SVGs beside them (`*-gen-logo.svg` / `*-logo.svg`, generated by
`deathlogo.py`) at 2000px wide, content-cropped, alpha-keyed. To regenerate
after an SVG changes: `sharp` can read the SVG directly — resize to width
2000, `trim`, encode webp q82 — then update the `width`/`height`
attributes on every `<img>` that uses it. `htg-logo.webp` is the label's
brush mark (black-on-white source inverted to white). The older HD PNG
sources live in `assets/logos/src/`; nothing references them.

HTG is the hero `<h1>` on `index.html`. Each artist mark appears in two
places with **two different assets**: the roster door on `index.html`
uses the hollow (outline-only, transparent) SVG —
`abraxas-gen-hollow-logo.svg`, `stretty-gen-hollow-logo.svg`,
`ciggieholster-hollow-logo.svg`, `justinclout-hollow-logo.svg` — while
the `<h1>` on each deck (`abraxas.html`, `stretty.html`, `ciggie.html`,
`justin.html`) keeps the filled `.webp`. That split is deliberate; do not
unify them. The `width`/`height` on the door `<img>`s come from each
SVG's viewBox. The name text stays in the DOM (alt / visually hidden) —
keep it there. They are plain `<img>`s with
real alpha: do not try `mix-blend-mode` to drop a background, the
`.fade-in` opacity transition isolates the stacking context and the blend
silently no-ops.

## Roster door art & the second Stretty trap

The roster doors on `index.html` carry cover-art collages resolved at
runtime from Spotify's oEmbed endpoint (see the loader script by the
doors). oEmbed is CORS-open in visitors' browsers even though it 403s from
datacenter IPs; on any failure the door just stays typography-only.

When adding tracks anywhere (doors, `stretty.html`, `ciggie.html`): a
second, unrelated Spotify artist is also named **Stretty**
(`6r59mx3rk3LO4VXSUhRXM5`). HTG's stretty is
`spotify:artist:4yQchxxguwc9PXmCVqb9Bm` and ciggyholster is
`spotify:artist:0xMdknHv3WOTL2AeK1uHpo` — verify the artist link on a
release before wiring it in, same rule as the ABRAXAS ID above.

## `--nav-height`

`0px` in `style.css`. The header is a floating pill pinned bottom-right,
so nothing sits under it. It used to be measured at runtime in
`script.js` when the header was a fixed top bar (hardcoding it then left
content underneath the bar); if a top bar ever returns, measure it
again rather than guessing a number.

## Webfont loading — two links on purpose

Every visitor page loads Google Fonts as **two** `css2` links: New Rocker
with `display=block`, IBM Plex Mono with `display=swap`. They used to be
one link with `display=swap` for both, which made every heading paint in
the serif fallback and then visibly morph into New Rocker once the font
arrived — reported by the owner as "the font across the site changed".
`block` holds heading text briefly instead, so the gothic face is the only
one ever shown. Plex Mono keeps `swap` because its fallback is another
monospace and that swap is invisible. Do not fold them back into one link.

## Known broken / open work

- **The rain on Brave desktop.** Reported not running there twice; the
  cause is unconfirmed (Brave's documented canvas/timer protections do
  not stop a 2D loop, its filter lists carry nothing matching
  `matrix.js`). `matrix.js` now defends every layer it can: a heartbeat
  hands the loop to `setTimeout` if rAF stops delivering, a paint probe
  two seconds in rebuilds the canvas if nothing has landed, and the two
  mirrors in `script.js` (hero, menu panel) race rAF against a 100ms
  timer. Load any page with `?raindebug=1` and the console prints one
  `[rain]` line of state — ask for that line before hardening again.
- **`scripts/scraper.js` does not work.** Its workflow was deleted after
  83 consecutive failures; it never once produced
  `assets/data/content.json`. Every source returns `403 Forbidden` from
  `https://open.spotify.com/oembed`, so the script hits its own
  "No items resolved — refusing to overwrite content.json" guard and
  exits 1. Most likely Spotify's oEmbed rejects datacenter IPs and
  Actions runners are datacenter IPs — consistent with a job that has
  never succeeded rather than one that broke. A fix probably means the
  Spotify Web API with client credentials in Actions secrets, not oEmbed.
  The script is kept so the fetch path can be repaired.

  Note that this diagnosis only covers the runs that actually executed.
  **28 of the 30 recorded `content-sync` runs failed in 3-5 seconds
  without running a step at all** — see the next item.
- **GitHub Actions does not reliably run in this repo.** Across every
  user-defined workflow — `content-sync` (28 of 30 recorded runs), the
  single `gallery-manifest` run, and a trial `mobile-sync` run — jobs
  complete as `failure` within 3-5 seconds with no logs and no steps
  executed. Only GitHub's own managed `pages build and deployment`
  succeeds, which is why deploys still work. This looks like an
  account-level Actions problem (a spending limit or runner allocation),
  not anything in the workflow files. **Do not add a CI check here
  expecting it to run**, and treat a fast red Actions job as this, not as
  your diff. Verify with `npm run` scripts locally instead.
- ~~Deduplicate `mobile.html`'s inline CSS against `style.css`.~~ Done —
  `mobile.html` is generated from `style.css`, so there is only one copy
  to edit.
- **`assets/gallery/` holds six frames off HTG's own visuals** (hero-reel
  stills and Suit Purge floors), mirrored in the fallback list in
  `config.js`. `npm run build:gallery` rebuilds `manifest.json` from
  whatever image files land in `assets/gallery/` (the `gallery-manifest`
  Action was meant to, but see above), so real session photos dropped in
  there replace the frames.
- ~~`config.heroPoster` is a picsum stock photo~~ Done — it now points at
  `assets/placeholders/hero-poster.svg`, a local placeholder graphic.
- ~~`assets/htg-hero.mp4` (25MB) loaded on both pages~~ Done — and the
  hero no longer plays a video at all: the owner asked for the coloured
  glyph rain behind the wordmark instead of the green-text reel. The
  720p pair stays in `assets/` and `config.js` (`render.js` guards on the
  missing `.hero-video`), and a `.hero-rain` canvas mirrors `#matrix-rain`
  inside the hero under a faint `.hero-echo` of the wordmark line.
- **The contact form's delivery endpoint is unset.** `script.js` POSTs
  submissions to `config.contactForm.endpoint` (Formspree or Web3Forms —
  setup notes in `config.js`) and falls back to `mailto:` without one.
  Until someone creates the free account and pastes the endpoint into
  `config.js`, every visitor is on the mailto path, which does nothing —
  silently — for anyone without a desktop mail app.

## Testing

There is no test suite. Changes are verified by driving the real pages in
a browser (Playwright/Chromium) at desktop and phone viewports, checking
for console/page errors, control overlaps, horizontal scroll, and — after
any content change — that removed strings render nowhere.

Serve locally with `python3 -m http.server` from the repo root; opening
`file://` breaks the config/render scripts.


## Collaboration note

- **ABRAXAS:** work from Codex.
- **Stretty:** work from the Claude AI workspace/bot.
- Keep copy, links, and shared HTG-site changes coordinated through the Copy Desk so handoffs remain explicit.
