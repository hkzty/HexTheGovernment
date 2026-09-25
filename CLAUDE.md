# HTG — Hex The Government

Static site for the label **HTG** and its artist **ABRAXAS**. Live at
**www.htg.productions**.

This is the canonical repo. An older, simpler copy of this site exists at
`hkzty/AbraxasMusic` — it is **superseded**; do not port work from it or
treat it as a source of truth.

## Stack

Vanilla HTML / CSS / JS. No build step, no framework, no runtime
dependencies. `package.json` exists only to pin Node for the build
scripts; `npm run build` is a no-op by design.

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
| `worker/` | Cloudflare Worker + KV for the Suit Purge shared highscores. Not served by Pages. |
| `analytics.js` | Loads Cloudflare Web Analytics only when `config.analytics.cloudflareToken` is set. Off by default; enabling it changes `legal.html` §6/§7 (see the comment in `config.js`). |
| `rain.js`, `rain.html` | Jars — the second hidden game, on the rain. Self-contained IIFE. Unlocked only from `game.html`. |
| `index.html` | Desktop page: hero, roster, music, gallery, donation + legal footer. Everything else is a standalone page. The hero is a full-screen gate (`body.hero-gate`, `script.js`): the page is locked on it until the first wheel / swipe / tap / key, which scrolls to the roster. |
| `roster.html`, `music.html`, `gallery.html` | Standalone copies of the home sections in the `sequence.html` shell; the nav links here, the home page keeps the sections for scrolling. They embed the same markup as `index.html` — edit both. |
| `hexboy.html`, `graveboy.html`, `desk.js` | Service desks. HexBoy is ABRAXAS's mixing/mastering desk; Graveboy is Stretty's desk for sites, marks, stores, browser games and IT/security work — Stretty built this site, and the short blurb under the Graveboy mark is owner copy, the one blurb on the site. Same black deck shell, white accent; `desk.js` reads `config.services[<body data-desk>]` and removes any section whose list is empty. HexBoy's packages and add-ons are real prices from the owner's rate card; each `shop` is a Shopify cart permalink into the H.T.G Merch store (published). Graveboy's packages carry no `price` and no `shop` on purpose — quoted per job — so they render Details + Enquire only; never add a placeholder price. Both desks are roster doors on `index.html` / `roster.html`. |
| `contact.html` | Standalone contact page (form handler lives in `script.js`). Suit Purge and the Sequence are `game.html` / `sequence.html`; the home page carries no `#game`, `#sequence` or `#contact` section. |
| `mobile.html` | Phone page. **Generated — never hand-edit.** |
| `style.css` | Stylesheet for every page (inlined into `mobile.html`). |
| `scripts/build-mobile.js` | Builds `mobile.html` from `index.html` + `style.css`. |

### The desktop/mobile split — read this before editing either page

`index.html` and `mobile.html` are two files serving the same site:
`mobile.html` is the same page with `style.css` inlined, reached only
through the footer *Mobile site* toggle. **There is no width redirect
between them any more.** The inline script that used to bounce phones
from `index.html` to `mobile.html` (and desktops back, with `?desktop` /
`?mobile` pins in `sessionStorage`) was retired in September 2026: it
cost every bio-link visitor a second document for a page that differs
only by inlined CSS. The head script directly after the viewport meta is
now only the `html.js` handshake: it adds `html.js` and disarms it 2.5 s
later unless `script.js` has set `window.__htgRevealArmed`; that
handshake is what stops a failed `script.js` (404, parse error) leaving
every `.fade-in` element invisible. Its `data-page` attribute is a marker
`build-mobile.js` flips; nothing reads it.

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

**Testing the phone copy:** open `mobile.html` directly at any width;
nothing redirects either way.

The hero gate (`body.hero-gate`) holds its scroll lock until the glide to
the roster has landed (read off `scrollY`, 1.2 s deadline) and cancels
wheel and `touchmove` meanwhile: dropping the lock on the first wheel tick
let trackpad inertia carry the page hundreds of pixels past the roster,
and any user scroll gesture cancels a smooth scroll. While gated the
topbar is `visibility: hidden` so its pills are out of the tab order, and
focus leaving the hero (Tab to a door) releases the gate.

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
  `sequence.html` renders lazy Spotify players straight from
  `config.sequence` and carries no generated titles; the click-to-play
  cover-card path that once lived in `render.js` was unreachable from
  every page and has been removed.
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
  never falls back to a platform homepage. The static anchors in
  `index.html` / `music.html` carry the same real URLs as `config.js`
  (crawlers that never run `render.js` read the file as shipped), so a
  platform that gains a URL in config also gets its anchor back in the
  markup, and one that loses it has the anchor deleted. Do not link a
  domain that does not resolve: `stretty.music` was NXDOMAIN and came
  out of `stretty.html`, the JSON-LD and `llms.txt`.
- Meta descriptions, `og:description`, `aria-label`s, iframe titles and
  form placeholders follow the same rule: name the thing, don't sell it.

## Discoverability layer — machine-readable, not visible

The site describes itself to crawlers and AI agents in places visitors
never read, so the visible page can stay near-silent. Nothing here depends
on `render.js` running.

| File | Role |
|---|---|
| `robots.txt` | One `User-agent: *` group: allows everything public (AI crawlers included — the owner wants AI in the back end, never showing on the front end; `legal.html` §2 still forbids training on the content and stays as written) and blocks `copydesk.html`, `content/`, `docs/`, `scripts/`. No per-bot groups — under RFC 9309 a named group inherits nothing from `*`, so a bot-specific `Allow: /` silently drops the Disallows for exactly that bot. |
| `sitemap.xml` | **Generated** by `scripts/build-sitemap.js`; `lastmod` is each page's last commit date. `mobile.html` is deliberately absent. **Commit the page first**: `lastmod` is read with `git log -1`, so a sitemap built before the page commit carries the previous date (PR #94 shipped a stale one that way). After the commit: `npm run build:sitemap`, commit the sitemap as a follow-up, and `npm run check:sitemap` before pushing (same deal as `check:mobile`, and for the same reason not in CI). |
| `humans.txt` | humanstxt.org credits: roster, which agent each artist works from, stack, games. Linked as `rel="author"` from every visitor page. |
| `llms.txt` | Plain-markdown summary for LLM agents: roster, every profile URL, the Sequence and the deck tracks, contact, trademarks, the explicit "no tour dates, no upcoming releases" line, and the ABRAXAS/Stretty Spotify disambiguation. |
| `site.webmanifest` | Name, colours, `music`/`entertainment` categories, PNG icons (192, 512, maskable 512) plus the SVG mark. Linked from every visitor page. |
| `favicon.ico`, `assets/icons/` | Raster icons rasterised from `assets/htg-mark.svg` (Safari before 26 ignores SVG favicons; iOS home-screen and bookmarks need `apple-touch-icon`). Every page declares `.ico` + SVG + `apple-touch-icon`; the four decks keep their own letter tiles, rasterised to `assets/icons/<artist>-32/180.png`. Regenerate by screenshotting the SVG with Playwright at 16/32/48/180/192/512. |
| `aa3ba17e5adc90eee1d183ab3f140bf9.txt` | IndexNow key file (Bing, DuckDuckGo, Yandex, Naver, Seznam). `npm run ping:indexnow` POSTs every sitemap URL after a deploy that changed pages. Google does not use IndexNow. |
| `.well-known/security.txt` | RFC 9116 contact; `Expires` must stay under a year out — bump it each September. |
| `.nojekyll` | Skips the Jekyll pass on deploy, which would otherwise drop `.well-known/`. |
| JSON-LD in each page head | `index.html` carries `Organization` (`#org`), `WebSite` (`#website`), a `WebPage`, the three `MusicGroup`s, the `Person` and the `VideoGame`. Each deck repeats its own entity under the same `@id` plus a `WebPage` and a `BreadcrumbList`; `abraxas.html` adds the thirteen `MusicAlbum` nodes (URL-only — their titles are not on the site), `stretty.html` / `ciggie.html` add `MusicRecording`s for the tracks named on the page, `sequence.html` an `ItemList` of the albums. No `VideoObject`s: Google requires `name` and `uploadDate`, which the site deliberately does not hand-write. |

Every visitor page opens with one source comment addressed to whoever reads the markup (pointers to `llms.txt` / `humans.txt` and a hex-encoded tagline), and `script.js` opens `llms.txt` when `llms` or `agent` is typed or `?agent` is in the URL — the agent-facing layer stays invisible on the rendered page; do not surface any of it in copy.

Every indexed page also has `<link rel="canonical">`, a `robots` meta,
`twitter:title`/`twitter:description`, `<meta name="color-scheme"
content="dark">` (dark UA scrollbars and form chrome on the all-black
pages), and the footer social icons carry `rel="me"`. The Organization
node carries `sameAs` (the source repo only — add the MusicBrainz label
entry once it exists; never the merch store, which is already Stretty's
identity in that `MusicGroup`'s own `sameAs`, and asserting it for HTG
too tells Google the two are one entity) and a `logo` on a dark tile
(`assets/icons/icon-512.png`): Google draws the logo on white, where the
white-on-transparent wordmark is invisible. Location: `legal.html` is governed by NSW law, so every page
carries `og:locale` `en_AU` and the Organization node an `address` of
NSW, AU. The only priced things on the site are HexBoy's packages, which are real rate-card prices; the game is `isAccessibleForFree`. `mobile.html` keeps its canonical pointing at `index.html`
so it is never indexed as a duplicate; `index.html` no longer advertises
it as a phone alternate (that pattern describes a redirect, and the
redirect is gone). Share cards are in
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

### Highscores (`worker/`)

Shared top ten: a Cloudflare Worker + KV in `worker/` (`GET`/`POST
/scores`), deploy steps in `worker/README.md`, URL pasted into
`config.game.scoresEndpoint`. `game.js` reads the board on FLATLINED and
posts a run **only when the player presses Save**; with the endpoint
empty, or when it fails, the board is the per-browser localStorage copy.
`game.html` loads `config.js` for this — it did not before.

Limits to know: the game is client-side, so scores are forgeable; the
worker only rejects impossible runs (kills above the spawn total for the
wave — keep `maxKillsForWave` in step with `spawnWave`), foreign origins
and rapid resubmits. KV is last-write-wins, so two submits in the same
second can drop one. A Durable Object fixes that if it ever matters.
`robots.txt` blocks `/worker/`.

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
`justin-logo.webp`, `hexboy-logo.webp`, `graveboy-logo.webp` are the
spiked marks, rasterised from the traced SVGs beside them (`*-gen-logo.svg`
/ `*-logo.svg`, generated by `deathlogo.py`) at 2000px wide,
content-cropped, alpha-keyed. To regenerate after an SVG changes: `sharp`
can read the SVG directly — resize to width 2000, `trim`, encode webp q82 —
then update the `width`/`height` attributes on every `<img>` that uses it.
`htg-logo.webp` is the label's brush mark (black-on-white source inverted
to white). The older HD PNG sources live in `assets/logos/src/`; nothing
references them.

`deathlogo.py` needs Pillow, numpy, scipy and the `potrace` binary, and
draws with Metal Mania (SIL OFL, `src/MetalMania-Regular.ttf` with its
licence beside it). `python3 deathlogo.py TEXT name '#mass' '#ink' seed
[font|-] [door_reach]` writes `name-logo.svg` and `name-hollow-logo.svg`
(plus intermediates — keep those out of the repo). The HexBoy, Graveboy
and ciggyholster marks are `HEXBOY #1a1a1a #f2f2f2 7`, `GRAVEBOY
#141414 #cbc4b4 11` and `CIGGYHOLSTER #03222a #2fd4e0 11`, all with
`door_reach 0.8`: the door variant is rendered again with the crown/drip
spikes shortened so its proportions sit closer to the ABRAXAS and
STRETTY marks (HexBoy still measures taller, 768×455 against ABRAXAS's
768×407 — six letters under the same crown). A long name widens the
canvas on its own. **The ciggyholster deck mark is the owner's pick and
stays as it is**: `ciggie-logo.webp` (2000×602, from the hand-traced
`ciggyholster-logo.svg`) on `ciggie.html`; only the roster door uses the
regenerated hollow. Do not swap the deck mark for the generated one
again. The roster grid
(`grid-auto-rows: 1fr`, and a fixed row with `max-height` on the mark
below 760 px) keeps all six doors the same size whatever a mark measures.

HTG is the hero `<h1>` on `index.html`. Each artist mark appears in two
places with **two different assets**: the roster door on `index.html` /
`roster.html` uses the hollow (outline-only, transparent) mark, while
the `<h1>` on each deck (`abraxas.html`, `stretty.html`, `ciggie.html`,
`justin.html`, `hexboy.html`, `graveboy.html`) keeps the filled mark.
That split is deliberate; do not unify them. The hollow marks ship as
webp rasters (`<name>-hollow-768.webp` / `-1152.webp`, `srcset` by width)
rasterised from the traced SVGs, which stay in the repo as sources
(`abraxas-gen-hollow-logo.svg`, `stretty-gen-hollow-logo.svg`,
`ciggyholster-gen-hollow-logo.svg`, `justinclout-hollow-logo.svg`,
`hexboy-gen-hollow-logo.svg`, `graveboy-gen-hollow-logo.svg`): the SVGs
are 500-1130 KB of potrace paths each, about 4.5 MB per home-page load
for marks that render 384 px wide, and `loading="lazy"` never deferred
them.
The `width`/`height` on the door `<img>`s are the 768 raster's pixels.
Every filled mark and the hero wordmark also carry a smaller `srcset`
variant (800 px) and are encoded with `alphaQuality: 60` — the alpha plane was
most of the file. The name text stays in the DOM (alt / visually hidden)
— keep it there. They are plain `<img>`s with
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

## Webfont loading — self-hosted, block/swap split on purpose

Every visitor page loads `assets/fonts/fonts.css` (four `@font-face`
rules, latin-subset woff2, both faces SIL OFL 1.1 with the licences beside
the files) and preloads the New Rocker file. New Rocker is
`font-display: block`, IBM Plex Mono `swap`. They used to be Google Fonts
links, and before that one link with `swap` for both, which made every
heading paint in the serif fallback and then visibly morph into New
Rocker once the font arrived — reported by the owner as "the font across
the site changed". `block` holds heading text briefly instead, so the
gothic face is the only one ever shown. Plex Mono keeps `swap` because its
fallback is another monospace and that swap is invisible. Self-hosting
removed the render-blocking round trip to fonts.googleapis.com (first
paint tracked Google's response time exactly) and the two third-party
connections `legal.html` used to have to disclose. Keep the block/swap
split; do not put the Google links back.

## Known broken / open work

- **The rain's start is deferred one idle tick** (`requestIdleCallback`,
  1.2 s ceiling, never to `load` — that waits on every embed). Its per-frame
  cost was the whole of a throttled phone's blocking time while the page was
  still loading. The canvas is dark for roughly half a second longer than it
  used to be; the rain has always filled the screen by falling in from above
  the fold, so it reads as the same load. `dpr` is capped at 1.5 below 700 px
  (`resize()` — assign `width` before `dpr`, or the cap silently misses on the
  first call). The paint probe is armed by `start()`, never at parse time: a
  probe that fires before the first frame reads an unpainted canvas and
  rebuilds it for nothing.
- **Game exits chain Jars → Suit Purge → HTG home.** `game.js` reads `data-exit` off the Exit button (`game.html` sets `index.html`); without it, it falls back to scrolling to `#out-now` for a page that still embeds the game. `legal.html` §5 and the home footer name both games.
- **`-webkit-tap-highlight-color: transparent` is set site-wide**, so any
  full-bleed tappable block needs its own `:active` state or a phone gets no
  touch feedback at all — see `.door:active` in `index.html` / `roster.html`.
- **The rain on Brave desktop.** Reported not running there twice; the
  cause is unconfirmed (Brave's documented canvas/timer protections do
  not stop a 2D loop, its filter lists carry nothing matching
  `matrix.js`). `matrix.js` now defends every layer it can: a heartbeat
  hands the loop to `setTimeout` if rAF stops delivering, a paint probe
  two seconds in rebuilds the canvas if nothing has landed, and the two
  mirrors in `script.js` (hero, menu panel) race rAF against a 100ms
  timer. Load any page with `?raindebug=1` and the console prints one
  `[rain]` line of state — ask for that line before hardening again.
- **The content scraper is gone.** `scripts/scraper.js` was removed
  (September 2026): every source returned `403` from
  `https://open.spotify.com/oembed` (datacenter IPs), it never produced
  `assets/data/content.json`, and nothing consumed that file. A future
  sync means the Spotify Web API with client credentials in Actions
  secrets, not oEmbed — and see the next item before adding a workflow
  for it.

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
- **Everything that needs an account or DNS is in
  `docs/launch-checklist.md`**: Search Console, Bing/IndexNow, the
  GitHub Pages domain check behind the Cloudflare proxy, profile
  backlinks, MusicBrainz, the shop domain, analytics. None of it is
  visible on the site.
- **Cross-browser testing here is Chromium-only.** WebKit and Firefox
  cannot be installed in the remote sandbox; Safari/Firefox behaviour is
  audited from source (prefixes, `svh` fallbacks, `:has()`, forced-colors,
  print, `-webkit-user-select`, iOS input zoom) and should be checked on a
  real iPhone and a Firefox before big CSS changes.

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
