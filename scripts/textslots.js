#!/usr/bin/env node
/* =========================================================================
   textslots.js — pull every editable text slot out of the site, and put
   edited copy back in.

     node scripts/textslots.js extract  > content/text-slots.json
     node scripts/textslots.js apply content/text-slots.json

   Why a hand-rolled tokenizer: the repo has no dependencies and is not
   allowed to grow any. The walk is deterministic, so a slot is addressed
   by its ordinal position in the file rather than by a byte offset — the
   ordinal survives an edit that changes the length of the text, an offset
   does not.
   ========================================================================= */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PAGES = [
  ['index.html',    'Landing (HTG)', 'Landing'],
  ['abraxas.html',  'ABRAXAS deck',  'ABRAXAS'],
  ['stretty.html',  'Stretty deck',  'Stretty'],
  ['sequence.html', 'The Sequence',  'Sequence'],
  ['game.html',     'Suit Purge',    'Suit Purge'],
  ['contact.html',  'Contact',       'Contact'],
  ['legal.html',    'Legal',         'Legal']
];

/* Tags whose contents are code or graphics, never display copy. */
const OPAQUE = new Set(['script', 'style', 'svg', 'noscript']);

/* Attributes worth editing, by tag. */
const ATTRS = {
  meta: ['content'],
  input: ['placeholder'],
  textarea: ['placeholder'],
  img: ['alt']
};

/* Only the meta tags that carry prose. viewport, theme-color and robots are
   settings that happen to live in an attribute; they are not copy. */
const META_COPY = /^(description|og:title|og:description|twitter:title|twitter:description|apple-mobile-web-app-title)$/i;

/* Block elements — every text fragment inside one belongs to the same slot
   group, so a sentence broken up by <b> or <a> still reads as one thought. */
const BLOCKS = new Set([
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'button', 'label',
  'figcaption', 'blockquote', 'td', 'th', 'dt', 'dd', 'summary', 'title'
]);

/* Entities are a storage detail. Editors see the character; the file keeps
   the escape where one is required. */
const NAMED = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0',
  mdash: '\u2014', ndash: '\u2013', middot: '\u00b7', hellip: '\u2026',
  rsquo: '\u2019', lsquo: '\u2018', ldquo: '\u201c', rdquo: '\u201d',
  copy: '\u00a9', reg: '\u00ae', trade: '\u2122', times: '\u00d7'
};
function decodeEntities(str) {
  return str.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, body) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X'
        ? parseInt(body.slice(2), 16)
        : parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    const hit = NAMED[body.toLowerCase()];
    return hit === undefined ? whole : hit;
  });
}
/* Copy is edited as one line of prose; the indentation in the file is
   layout, not content, so it is collapsed on the way out and the original
   leading/trailing whitespace is restored on the way back in. */
function collapse(str) {
  return str.replace(/\s+/g, ' ').trim();
}
function encodeText(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ---- tokenizer ---------------------------------------------------------- */
/* Yields { kind: 'text'|'tag', raw, start, end } plus, for tags, the parsed
   name and whether it closes. Comments and doctypes come back as 'other'. */
function tokenize(src) {
  const out = [];
  let i = 0;
  while (i < src.length) {
    const lt = src.indexOf('<', i);
    if (lt === -1) { out.push({ kind: 'text', raw: src.slice(i), start: i, end: src.length }); break; }
    if (lt > i) out.push({ kind: 'text', raw: src.slice(i, lt), start: i, end: lt });

    if (src.startsWith('<!--', lt)) {
      const close = src.indexOf('-->', lt);
      const end = close === -1 ? src.length : close + 3;
      out.push({ kind: 'other', raw: src.slice(lt, end), start: lt, end });
      i = end; continue;
    }
    if (src.startsWith('<!', lt)) {
      const close = src.indexOf('>', lt);
      const end = close === -1 ? src.length : close + 1;
      out.push({ kind: 'other', raw: src.slice(lt, end), start: lt, end });
      i = end; continue;
    }
    /* Find the tag's closing '>', skipping any inside quoted attributes. */
    let j = lt + 1, quote = null;
    while (j < src.length) {
      const c = src[j];
      if (quote) { if (c === quote) quote = null; }
      else if (c === '"' || c === "'") quote = c;
      else if (c === '>') break;
      j++;
    }
    const end = Math.min(j + 1, src.length);
    const raw = src.slice(lt, end);
    const m = /^<\s*(\/?)\s*([a-zA-Z0-9-]+)/.exec(raw);
    out.push({
      kind: m ? 'tag' : 'other',
      raw, start: lt, end,
      name: m ? m[2].toLowerCase() : null,
      closing: m ? m[1] === '/' : false
    });
    i = end;
  }
  return out;
}

/* Walk a page and hand each candidate slot to `visit`. Ordinals are assigned
   in walk order so extract and apply agree without storing offsets. */
function walk(src, visit) {
  const tokens = tokenize(src);
  const opaque = [];          // stack of open opaque tags
  const stack = [];           // open element names, for context
  let inHead = false;
  let ordinal = 0;
  let blockId = 0;            // rises on every block element opened
  const blocks = [];          // stack of { id, name } for open blocks

  for (const t of tokens) {
    if (t.kind === 'tag') {
      if (t.name === 'head') inHead = !t.closing;
      if (OPAQUE.has(t.name)) {
        if (t.closing) opaque.pop();
        else if (!/\/>$/.test(t.raw)) opaque.push(t.name);
      }
      if (BLOCKS.has(t.name)) {
        if (t.closing) blocks.pop();
        else if (!/\/>$/.test(t.raw)) blocks.push({ id: ++blockId, name: t.name });
      }
      if (!t.closing && !/\/>$/.test(t.raw)) stack.push(t.name);
      else if (t.closing) stack.pop();

      if (opaque.length) continue;
      const wanted = ATTRS[t.name];
      if (!wanted) continue;
      for (const attr of wanted) {
        const re = new RegExp(`(\\s${attr}\\s*=\\s*)(["'])([\\s\\S]*?)\\2`, 'i');
        const am = re.exec(t.raw);
        if (!am) continue;
        if (t.name === 'meta') {
          const which = /\s(?:name|property)\s*=\s*["']([^"']+)/i.exec(t.raw);
          if (!which || !META_COPY.test(which[1])) continue;
        }
        const value = decodeEntities(am[3]);
        if (!value.trim()) continue;
        visit({
          type: 'attr', tag: t.name, attr, value,
          ordinal: ordinal++, token: t, match: am,
          context: describeTag(t),
          block: 0
        });
      }
      continue;
    }

    if (t.kind !== 'text' || opaque.length) continue;
    if (!t.raw.trim()) continue;
    if (inHead) continue;
    visit({
      type: 'text', value: decodeEntities(t.raw), ordinal: ordinal++, token: t,
      context: stack.slice(-3).join(' > '),
      block: blocks.length ? blocks[blocks.length - 1].id : 0,
      blockTag: blocks.length ? blocks[blocks.length - 1].name : stack[stack.length - 1] || ''
    });
  }
}

function describeTag(t) {
  const name = /\sname\s*=\s*["']([^"']+)/i.exec(t.raw);
  const prop = /\sproperty\s*=\s*["']([^"']+)/i.exec(t.raw);
  const id   = /\sid\s*=\s*["']([^"']+)/i.exec(t.raw);
  const cls  = /\sclass\s*=\s*["']([^"']+)/i.exec(t.raw);
  return [t.name, name && name[1], prop && prop[1], id && ('#' + id[1]), cls && ('.' + cls[1].split(/\s+/)[0])]
    .filter(Boolean).join(' ');
}

/* ---- config.js ---------------------------------------------------------- */
/* Only prose is exposed. URLs, IDs and numbers stay out of the copy desk —
   a typo in a Spotify ID is not a copy edit. */
const CONFIG_KEYS = [
  'artist', 'tagline', 'label', 'genre',
  'kicker', 'title', 'note', 'highlightTag',
  'caption', 'contactEmail', 'management'
];

function extractConfig() {
  const src = fs.readFileSync(path.join(ROOT, 'config.js'), 'utf8');
  const lines = src.split('\n');
  const slots = [];
  lines.forEach((line, idx) => {
    /* key: "value" — one per line is the file's own style. */
    const kv = /^\s*([A-Za-z]+)\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(line);
    if (kv && CONFIG_KEYS.includes(kv[1]) && kv[2].trim() && !/^https?:/.test(kv[2])) {
      /* A URL that happens to sit under a prose-named key (sequence.artist) is
         not copy — editing it would corrupt the player link. Keep it out. */
      slots.push({ kind: 'pair', key: kv[1], line: idx, value: kv[2], label: kv[1] });
      return;
    }
    /* Bare prose strings inside config arrays. */
    const bare = /^\s*"((?:[^"\\]|\\.)*)"\s*,?\s*$/.exec(line);
    if (bare && bare[1].trim() && !/^https?:/.test(bare[1])) {
      slots.push({ kind: 'bare', line: idx, value: bare[1], label: 'terminal line' });
      return;
    }
    /* label: "..." inside the stats array. */
    const stat = /label\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(line);
    if (stat && stat[1].trim()) {
      slots.push({ kind: 'stat', line: idx, value: stat[1], label: 'stat label' });
    }
  });
  return slots;
}

/* ---- extract ------------------------------------------------------------ */
function extract() {
  const groups = [];

  for (const [file, pageLabel, shortLabel] of PAGES) {
    const full = path.join(ROOT, file);
    if (!fs.existsSync(full)) continue;
    const src = fs.readFileSync(full, 'utf8');
    const slots = [];
    walk(src, (hit) => {
      const value = collapse(hit.value);
      if (!value) return;
      if (hit.type === 'text' && !/[A-Za-z]/.test(value)) return;  // punctuation, or a live counter's placeholder digits
      slots.push({
        id: `${file}:${hit.ordinal}`,
        file,
        ordinal: hit.ordinal,
        kind: hit.type,
        block: hit.block || 0,
        blockTag: hit.blockTag || hit.tag || '',
        where: hit.context,
        original: value,
        text: value
      });
    });
    groups.push({ id: file, label: pageLabel, short: shortLabel, source: file, slots });
  }

  const cfg = extractConfig().map((s) => ({
    id: `config.js:${s.line}`,
    file: 'config.js',
    line: s.line,
    kind: 'config',
    where: s.label,
    original: s.value,
    text: s.value
  }));
  groups.unshift({ id: 'config.js', label: 'Config (shared strings)', short: 'Config', source: 'config.js', slots: cfg });

  return { generated: new Date().toISOString(), groups };
}

/* Accept either the full extract() document ({groups:[…]}) or the compact
   list the Copy Desk's "Send to Claude" exports ([{id, text, …}]). The
   compact form carries only id→text, so rebuild the authoritative slots from
   a fresh extract() and stamp the edited text onto matching ids — that keeps
   original/ordinal/line correct no matter how stale the export is. */
function normalizeEdits(data) {
  if (data && Array.isArray(data.groups)) return data;
  const list = Array.isArray(data) ? data : (data && Array.isArray(data.slots) ? data.slots : null);
  if (!list) throw new Error('apply: expected {groups:[…]} or a list of {id, text}');
  const byId = new Map();
  for (const e of list) {
    if (e && e.id && typeof e.text === 'string') byId.set(e.id, e.text);
  }
  const doc = extract();
  for (const group of doc.groups) {
    for (const slot of group.slots) {
      if (byId.has(slot.id)) slot.text = byId.get(slot.id);
    }
  }
  return doc;
}

/* ---- apply -------------------------------------------------------------- */
function apply(jsonPath) {
  const data = normalizeEdits(JSON.parse(fs.readFileSync(jsonPath, 'utf8')));
  let changed = 0;

  for (const group of data.groups) {
    const edits = group.slots.filter((s) => s.text !== s.original);
    if (!edits.length) continue;
    const full = path.join(ROOT, group.source);
    let src = fs.readFileSync(full, 'utf8');

    if (group.source === 'config.js') {
      const lines = src.split('\n');
      for (const e of edits) {
        const line = lines[e.line];
        if (line === undefined || !line.includes(e.original)) {
          console.error(`SKIP ${e.id}: config line moved or original text not found`);
          continue;
        }
        /* JSON.stringify gives a valid JS string literal — quotes, backslashes
           and newlines all escaped — so a multi-line or backslashed edit can't
           produce an unterminated string or silently change the value. */
        lines[e.line] = line.replace('"' + e.original + '"', JSON.stringify(e.text));
        changed++;
      }
      fs.writeFileSync(full, lines.join('\n'));
      continue;
    }

    /* Replace by ordinal, back to front, so earlier offsets stay valid. */
    const byOrdinal = new Map(edits.map((e) => [e.ordinal, e]));
    const patches = [];
    walk(src, (hit) => {
      const e = byOrdinal.get(hit.ordinal);
      if (!e) return;
      if (hit.type === 'text') {
        const raw = hit.token.raw;
        if (collapse(decodeEntities(raw)) !== e.original) {
          console.error(`SKIP ${e.id}: file changed under the edit`);
          return;
        }
        /* Keep the surrounding whitespace exactly as the file had it. */
        const lead = raw.match(/^\s*/)[0];
        const tail = raw.match(/\s*$/)[0];
        patches.push({ start: hit.token.start, end: hit.token.end, text: lead + encodeText(e.text) + tail });
      } else {
        if (collapse(hit.value) !== e.original) {
          console.error(`SKIP ${e.id}: file changed under the edit`);
          return;
        }
        const m = hit.match;
        const q = m[2];
        const attrStart = hit.token.start + m.index;
        const value = encodeText(e.text).replace(new RegExp(q, 'g'), q === '"' ? '&quot;' : '&#39;');
        patches.push({
          start: attrStart,
          end: attrStart + m[0].length,
          text: m[1] + q + value + q
        });
      }
    });

    patches.sort((a, b) => b.start - a.start);
    for (const p of patches) {
      src = src.slice(0, p.start) + p.text + src.slice(p.end);
      changed++;
    }
    fs.writeFileSync(full, src);
  }

  console.log(`${changed} slot(s) written`);
}

/* ---- preview ------------------------------------------------------------ */
/* Rebuild each page with every text slot wrapped in a marker, so the copy
   desk can paint an edit straight into a real rendering of the page. The
   markers are `display: contents`, so they add nothing to the layout.
   Attribute slots (meta, alt, placeholder) cannot be wrapped and simply do
   not light up in the preview. */
function preview() {
  const pages = {};
  for (const [file, label] of PAGES) {
    const full = path.join(ROOT, file);
    if (!fs.existsSync(full)) continue;
    let src = fs.readFileSync(full, 'utf8');

    const marks = [];
    walk(src, (hit) => {
      if (hit.type !== 'text') return;
      if (!collapse(hit.value)) return;
      if (!/[A-Za-z]/.test(collapse(hit.value))) return;
      marks.push({ start: hit.token.start, end: hit.token.end, id: `${file}:${hit.ordinal}`, raw: hit.token.raw });
    });
    marks.sort((a, b) => b.start - a.start);
    for (const m of marks) {
      const lead = m.raw.match(/^\s*/)[0];
      const tail = m.raw.match(/\s*$/)[0];
      const body = m.raw.slice(lead.length, m.raw.length - tail.length);
      src = src.slice(0, m.start)
        + lead + `<span class="tslot" data-slot="${m.id}">` + body + '</span>' + tail
        + src.slice(m.end);
    }

    /* Behaviour is out of scope for a copy preview: the page's own scripts
       would fight the editor for the DOM, and the hero video is 25MB. */
    let out = src
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<canvas[\s\S]*?<\/canvas>/gi, '')
      .replace(/<video[\s\S]*?<\/video>/gi, '')
      .replace(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/gi, '');

    const styles = [...out.matchAll(/<style>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n');
    void styles;
    const bodyMatch = /<body[^>]*>([\s\S]*)<\/body>/i.exec(out);
    pages[file] = {
      label,
      css: scopeCss(styles),
      html: bodyMatch ? bodyMatch[1] : out
    };
  }
  return {
    css: scopeCss(fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8')),
    pages
  };
}

/* The preview renders inside a shadow root, so the page's own document-level
   selectors have to be re-pointed at the two wrapper elements that stand in
   for <html> and <body> there. Custom properties on :root become :host, from
   where they still inherit down the whole tree. */
function scopeCss(css) {
  return css
    .replace(/(^|[},{;>\s])(:root)(?=[\s,{:])/g, '$1:host')
    .replace(/(^|[},{;>\s])(html)(?=[\s,{:.])/g, '$1.pv-html')
    .replace(/(^|[},{;>\s])(body)(?=[\s,{:.\[])/g, '$1.pv-body');
}

/* ---- cli ---------------------------------------------------------------- */
const [, , cmd, arg] = process.argv;
if (cmd === 'extract') {
  process.stdout.write(JSON.stringify(extract(), null, 2) + '\n');
} else if (cmd === 'preview') {
  process.stdout.write(JSON.stringify(preview()) + '\n');
} else if (cmd === 'apply') {
  if (!arg) { console.error('usage: textslots.js apply <file.json>'); process.exit(1); }
  apply(arg);
} else {
  console.error('usage: textslots.js extract | preview | apply <file.json>');
  process.exit(1);
}
