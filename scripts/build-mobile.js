#!/usr/bin/env node
/*
  build-mobile.js — generates mobile.html from index.html + style.css.

  mobile.html is NOT hand-edited. It is the same page with style.css
  inlined (GitHub Pages serves it as one request) and the desktop/mobile
  redirect flipped to the mobile side. The floating bottom-right menu is
  the header on every width, so there is no phone-only chrome any more.

  The two files drifted badly once before: mobile.html was left on an
  older, ABRAXAS-only version of the site and never received the roster
  or the vessel copy. Every edit to index.html or style.css must be
  followed by `npm run build:mobile`, and `--check` fails CI-style if the
  committed mobile.html is stale.

  Usage:
    node scripts/build-mobile.js          # write mobile.html
    node scripts/build-mobile.js --check  # exit 1 if mobile.html is stale
*/

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SOURCE = path.join(ROOT, 'index.html');
const STYLES = path.join(ROOT, 'style.css');
const TARGET = path.join(ROOT, 'mobile.html');

/* Each edit is (description, find, replace). A find that does not match
   exactly once aborts the build rather than silently emitting a
   half-converted page — that silence is how the last drift shipped. */
function edits(css) {
  return [
    [
      'inline style.css',
      '  <link rel="stylesheet" href="style.css" />\n',
      '  <style>\n' + css + '  </style>\n',
    ],
    [
      'flip the redirect to the mobile side',
      'data-page="desktop"',
      'data-page="mobile"',
    ],
    [
      'point the view toggle back at the desktop page',
      '<a class="inline-link view-toggle" href="mobile.html?mobile=1">Mobile site</a>',
      '<a class="inline-link view-toggle" href="index.html?desktop=1">Desktop site</a>',
    ],
    [
      // index.html advertises mobile.html as its phone alternate; the phone
      // page keeps only the canonical link back to index.html (the search
      // engines' separate-URL pattern), so the alternate must not survive.
      'drop the desktop-only alternate link',
      '  <link rel="alternate" media="only screen and (max-width: 820px)" href="https://www.htg.productions/mobile.html" />\n',
      '',
    ],
  ];
}

function build() {
  const source = fs.readFileSync(SOURCE, 'utf8');
  const css = fs.readFileSync(STYLES, 'utf8');

  let html = source;
  for (const [what, find, replace] of edits(css)) {
    const hits = html.split(find).length - 1;
    if (hits !== 1) {
      throw new Error(
        `build-mobile: cannot ${what} — expected 1 match in index.html, found ${hits}.\n` +
          `  looked for: ${find.trim().slice(0, 90)}\n` +
          '  index.html changed shape; update scripts/build-mobile.js to match.'
      );
    }
    html = html.replace(find, () => replace);
  }

  return (
    '<!-- GENERATED FILE — do not edit. Built from index.html + style.css by\n' +
    '     scripts/build-mobile.js. Run `npm run build:mobile` after changing\n' +
    '     either source, or this page falls behind the desktop one. -->\n' +
    html
  );
}

function main() {
  const html = build();
  const check = process.argv.includes('--check');

  if (!check) {
    fs.writeFileSync(TARGET, html);
    console.log(`build-mobile: wrote mobile.html (${html.length} bytes)`);
    return;
  }

  const current = fs.existsSync(TARGET) ? fs.readFileSync(TARGET, 'utf8') : '';
  if (current === html) {
    console.log('build-mobile: mobile.html is up to date');
    return;
  }
  console.error(
    'build-mobile: mobile.html is STALE — it does not match index.html + style.css.\n' +
      'Run `npm run build:mobile` and commit the result.'
  );
  process.exit(1);
}

try {
  main();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
