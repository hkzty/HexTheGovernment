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
| `config.js` | **The only file most content edits need.** Artist info, social URLs, the Sequence, releases, gallery, stats, contact. Sets `window.ABRAXAS_CONFIG`. |
| `render.js` | Reads the config and rewrites the markup at runtime. |
| `script.js` | Site chrome: nav, scroll-spy, reveals, lightbox, custom cursor, contact form. |
| `game.js` | Suit Purge — the in-page shooter. Self-contained IIFE. |
| `index.html` | Desktop page. |
| `mobile.html` | Phone page. Separate file, same section structure. |
| `style.css` | Desktop stylesheet. |
| `scripts/scraper.js` | Content sync. **Currently broken, workflow removed.** |

### The desktop/mobile split — read this before editing either page

`index.html` and `mobile.html` are **two separate files** that must be
kept in sync by hand. An inline script at the top of each (`data-page`)
redirects between them by viewport width, with `?desktop` / `?mobile`
pinning a choice in `sessionStorage`.

Consequences that have already caused bugs:

- **A change to one page almost always needs making in the other.** All
  the content sections were byte-identical between the two.
- **`mobile.html` does not link `style.css`.** It carries its own inline
  `<style>` copy. CSS added only to `style.css` will not reach phones —
  this shipped once as a completely unstyled mobile game section. The two
  copies are otherwise identical apart from a mobile-chrome block
  (`.topbar { position: static }`, `.sticky-cta { display: none }`,
  `main { padding-top: 0 }`). Deduplicating this is open work.
- **Testing mobile requires `?mobile=1`**, or the redirect bounces a
  narrow viewport straight back.

## Content policy — this matters here

The site previously shipped a large amount of invented content presented
as real: three tour dates with fake venues and door times, three
unreleased "coming soon" titles with dates, three invented release names,
and fabricated statistics. All of it has been removed and replaced with
honest empty states.

**Do not add placeholder content that reads as real.** No invented tour
dates, venues, release titles, dates, or numbers. If a section has no
real content, it shows an empty state saying so. Stats must be countable
from the actual catalog.

Note the trap that let fakes survive a previous cleanup: `render.js`
only replaces a section's markup when the matching config array is
**non-empty**. Emptying `config.comingSoon` therefore left the hardcoded
fake cards visible in the HTML. **Fix both layers** — the config array
*and* the markup fallback.

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
- **The map is validated by flood fill.** All open cells must be
  reachable and every spawn point must sit on open, reachable floor.
  Re-check after editing `MAP_SRC`.

## `--nav-height`

Set at runtime in `script.js` from the header's measured height, on load,
on resize, and again once the webfont lands. It was previously hardcoded
to `114px` while the real header measures 178–229px depending on width,
so page content sat underneath the fixed header at every desktop size.
Do not hardcode it again.

## Known broken / open work

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
- **Deduplicate `mobile.html`'s inline CSS** against `style.css` (see
  above).
- **`assets/gallery/` holds six picsum placeholders** with captions
  implying real photos. The `gallery-manifest.yml` Action rebuilds
  `manifest.json` from whatever image files are in that folder, so real
  photos dropped in there replace them automatically.
- **`config.heroPoster` is a picsum stock photo** — the grey mountain
  visible until the hero video loads.
- **`assets/htg-hero.mp4` is 25MB**, the entire weight of the repo and a
  heavy load on mobile.

## Testing

There is no test suite. Changes are verified by driving the real pages in
a browser (Playwright/Chromium) at desktop and phone viewports, checking
for console/page errors, control overlaps, horizontal scroll, and — after
any content change — that removed strings render nowhere.

Serve locally with `python3 -m http.server` from the repo root; opening
`file://` breaks the config/render scripts.
