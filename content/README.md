# content/

Generated copy snapshots. Nothing here is served by the site.

- `text-slots.json` — every editable string on the site, addressed by file
  and ordinal. Regenerate with `node scripts/textslots.js extract`.
- `preview.json` (git-ignored, rebuilt on demand) — the pages rebuilt with each text slot wrapped in a marker,
  for the Copy Desk's live preview.

Both are rebuilt from the pages, so a stale copy is never authoritative —
re-run the extractor rather than editing them by hand.
