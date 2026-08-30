#!/usr/bin/env node
/* Bake the extracted slots and the marker-wrapped page previews into the
   Copy Desk page. Everything ships inline — the artifact viewer blocks
   fetches, so the desk has to carry the whole site with it. */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const out = process.argv[2] || path.join(ROOT, 'content', 'copy-desk.html');

function run(cmd) {
  return execFileSync('node', [path.join(__dirname, 'textslots.js'), cmd], {
    cwd: ROOT, maxBuffer: 64 * 1024 * 1024, encoding: 'utf8'
  });
}

const slots = JSON.parse(run('extract'));
const preview = JSON.parse(run('preview'));

/* </script> inside the data would close the tag that carries it. */
const json = JSON.stringify({ slots, preview }).replace(/<\//g, '<\\/');
const html = fs.readFileSync(path.join(__dirname, 'copydesk-template.html'), 'utf8')
  .replace('/*__DATA__*/', 'var DATA = ' + json + ';');

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log(out, (html.length / 1024).toFixed(0) + ' KB');
