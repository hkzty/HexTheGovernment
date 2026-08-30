# content/

Generated copy snapshots. Nothing here is served by the site.

- `text-slots.json` — every editable string on the site, addressed by file
  and ordinal. Regenerate with `node scripts/textslots.js extract`.
- `preview.json` (git-ignored, rebuilt on demand) — the pages rebuilt with each text slot wrapped in a marker,
  for the Copy Desk's live preview.
- `copy-desk.html` — the built Copy Desk, a self-contained page with the
  slots and previews baked in. Committed (not git-ignored) so GitHub Pages
  serves it with the rest of the site: it's live at
  **www.htg.productions/content/copy-desk.html**, reachable from both the
  Claude workspace and Codex. Rebuild after any copy change with
  `node scripts/build-copydesk.js`, then commit the result.

Both are rebuilt from the pages, so a stale copy is never authoritative —
re-run the extractor rather than editing them by hand.
