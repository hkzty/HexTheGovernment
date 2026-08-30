#!/usr/bin/env node
/* Bake the extracted slots and the marker-wrapped page previews into the
   Copy Desk page. Everything ships inline — the artifact viewer blocks
   fetches, so the desk has to carry the whole site with it. */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2).filter((a) => a !== '--standalone');
const standalone = process.argv.includes('--standalone');
const out = args[0] || path.join(ROOT, 'content', 'copy-desk.html');

function run(cmd) {
  return execFileSync('node', [path.join(__dirname, 'textslots.js'), cmd], {
    cwd: ROOT, maxBuffer: 64 * 1024 * 1024, encoding: 'utf8'
  });
}

const slots = JSON.parse(run('extract'));
const preview = JSON.parse(run('preview'));

/* </script> inside the data would close the tag that carries it. */
const json = JSON.stringify({ slots, preview }).replace(/<\//g, '<\\/');
let html = fs.readFileSync(path.join(__dirname, 'copydesk-template.html'), 'utf8')
  .replace('/*__DATA__*/', 'var DATA = ' + json + ';');

/* The template is authored bare for the claude.ai artifact host, which wraps
   it in its own document skeleton. Served straight off GitHub Pages it needs a
   real skeleton of its own — and noindex, since it's an internal editing tool,
   not a page for visitors or search engines. */
if (standalone) {
  const marker = '<div class="rail">';
  const cut = html.indexOf(marker);
  const head =
    '<!DOCTYPE html>\n<html lang="en">\n<head>\n' +
    '<meta charset="UTF-8" />\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0" />\n' +
    '<meta name="robots" content="noindex, nofollow" />\n' +
    '<style>html,body{margin:0}body{background:#0b0b0c;font:14px system-ui,sans-serif}' +
    'img{max-width:100%}[hidden]{display:none!important}</style>\n';
  html = head + html.slice(0, cut) + '</head>\n<body>\n' + html.slice(cut) + '\n</body>\n</html>\n';
}

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log(out, (html.length / 1024).toFixed(0) + ' KB' + (standalone ? ' (standalone)' : ''));
