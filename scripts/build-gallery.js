#!/usr/bin/env node
/*
  build-gallery.js — rebuilds assets/gallery/manifest.json from the image
  files actually present in assets/gallery/.

  The gallery-manifest.yml Action was meant to do this on push, but
  user-defined workflows never execute in this repo (see CLAUDE.md), so the
  manifest is built locally, same pattern as build-mobile.js:

    node scripts/build-gallery.js          # write manifest.json
    node scripts/build-gallery.js --check  # exit 1 if manifest.json is stale

  Drop image files into assets/gallery/, run `npm run build:gallery`, commit
  both. render.js turns each filename into its caption (dashes/underscores
  become spaces), so name files like `night-session-01.jpg`.
*/

'use strict';

const fs = require('fs');
const path = require('path');

const GALLERY = path.resolve(__dirname, '..', 'assets', 'gallery');
const TARGET = path.join(GALLERY, 'manifest.json');

// Same extension list as the Action and render.js's manifest filter.
const IMAGE_RE = /\.(jpe?g|png|webp|gif|avif)$/i;

function build() {
  const files = fs.readdirSync(GALLERY).filter(f => IMAGE_RE.test(f)).sort();
  return JSON.stringify(files, null, 2) + '\n';
}

function main() {
  const manifest = build();
  const check = process.argv.includes('--check');

  if (!check) {
    fs.writeFileSync(TARGET, manifest);
    console.log(`build-gallery: wrote manifest.json (${JSON.parse(manifest).length} images)`);
    return;
  }

  const current = fs.existsSync(TARGET) ? fs.readFileSync(TARGET, 'utf8') : '';
  if (current === manifest) {
    console.log('build-gallery: manifest.json is up to date');
    return;
  }
  console.error(
    'build-gallery: manifest.json is STALE — it does not match the images in assets/gallery/.\n' +
      'Run `npm run build:gallery` and commit the result.'
  );
  process.exit(1);
}

try {
  main();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
