/*
  HTG // HEX KEEP
  A tower defence on a night field: a court marches down the road to the
  keep, and towers bought with their own gold stop them. Five towers, three
  levels each, endless waves.

  No engine, no libraries, no external assets: the field, the keep, every
  tower, every figure and every sound is drawn or synthesised in code at
  runtime, same rules as Suit Purge (game.js) and Jars (rain.js).

  The marchers are four invented medieval archetypes (Courtier, Merchant,
  Knight, King). No real person is depicted and none should ever be added.

  All game logic runs in "landscape" cell units (16 x 9). A stage taller
  than it is wide is drawn transposed (9 x 16); only toScreen()/toCell()
  know which.
*/
(function () {
  'use strict';

  const display = document.getElementById('keepCanvas');
  if (!display || !display.getContext) return;
  const ctx = display.getContext('2d');
  if (!ctx) return;
  const bgCanvas = document.createElement('canvas');
  const bctx = bgCanvas.getContext('2d');
  if (!bctx) return;

  const hud = {
    gold: document.getElementById('hudGold'),
    lives: document.getElementById('hudLives'),
    wave: document.getElementById('hudWave'),
  };
  const hudBox = document.getElementById('keepHud');
  const overlay = document.getElementById('keepOverlay');
  const overlayTitle = document.getElementById('keepOverlayTitle');
  const overlayText = document.getElementById('keepOverlayText');
  const playButton = document.getElementById('keepPlay');
  const keysNote = document.getElementById('keepKeys');
  const muteButton = document.getElementById('keepMute');
  const shop = document.getElementById('keepShop');
  const stage = display.parentElement;
  const bar = stage.querySelector('.game-bar');

  const TAU = Math.PI * 2;
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const hash = (x, y, n) => {
    const s = Math.sin(x * 127.1 + y * 311.7 + n * 74.7) * 43758.5453;
    return s - Math.floor(s);
  };

  // --------------------------------------------------------------- map
  const COLS = 16;
  const ROWS = 9;
  // The road, cell to cell. Starts one cell off the field, ends on the keep.
  const WAY = [[-1, 1], [3, 1], [3, 6], [7, 6], [7, 2], [11, 2], [11, 7], [14, 7], [14, 4], [15, 4]];
  const KEEP = WAY[WAY.length - 1];
  const pts = WAY.map((p) => [p[0] + 0.5, p[1] + 0.5]);
  const segLen = [];
  let PATH_LEN = 0;
  const blocked = new Set();   // road, keep and its two flanking cells
  const road = new Set();
  for (let i = 0; i < pts.length - 1; i++) {
    const a = WAY[i], b = WAY[i + 1];
    const len = Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]);
    segLen.push(len);
    PATH_LEN += len;
    const dx = Math.sign(b[0] - a[0]), dy = Math.sign(b[1] - a[1]);
    for (let k = 0; k <= len; k++) {
      const key = (a[0] + dx * k) + ',' + (a[1] + dy * k);
      road.add(key);
      blocked.add(key);
    }
  }
  blocked.add(KEEP[0] + ',' + (KEEP[1] - 1));
  blocked.add(KEEP[0] + ',' + (KEEP[1] + 1));

  function posAt(d, out) {
    let i = 0;
    while (i < segLen.length - 1 && d > segLen[i]) { d -= segLen[i]; i++; }
    const t = clamp(d / segLen[i], 0, 1);
    out.x = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t;
    out.y = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t;
  }

  // ------------------------------------------------------------ tuning
  const START_GOLD = 170;
  const START_LIVES = 20;
  const SELL_BACK = 0.7;

  // Ranges and splash in cells, rate in seconds between shots.
  const TOWERS = {
    archer: {
      name: 'Archer', hint: 'Fast arrows, one target',
      levels: [
        { cost: 50, dmg: 9, rate: 0.6, range: 2.7 },
        { cost: 45, dmg: 14, rate: 0.55, range: 3.1 },
        { cost: 100, dmg: 18, rate: 0.3, range: 3.3 },
      ],
    },
    mage: {
      name: 'Hex', hint: 'Hex bolts burst and ignore armour',
      levels: [
        { cost: 90, dmg: 14, rate: 1.1, range: 2.4, splash: 0.8 },
        { cost: 80, dmg: 24, rate: 1.1, range: 2.6, splash: 1.0 },
        { cost: 170, dmg: 42, rate: 0.95, range: 2.8, splash: 1.2 },
      ],
    },
    bombard: {
      name: 'Bombard', hint: 'Slow, heavy, wide blast',
      levels: [
        { cost: 130, dmg: 38, rate: 2.4, range: 3.3, splash: 1.2 },
        { cost: 110, dmg: 62, rate: 2.2, range: 3.6, splash: 1.35 },
        { cost: 230, dmg: 110, rate: 1.9, range: 3.9, splash: 1.6 },
      ],
    },
    totem: {
      name: 'Totem', hint: 'Curse: everything near it walks slower',
      levels: [
        { cost: 70, slow: 0.35, range: 1.7 },
        { cost: 60, slow: 0.45, range: 2.0 },
        { cost: 140, slow: 0.55, range: 2.3, dps: 8 },
      ],
    },
    ballista: {
      name: 'Ballista', hint: 'Long bolt through a whole line',
      levels: [
        { cost: 110, dmg: 40, rate: 1.7, range: 4.6, pierce: 2 },
        { cost: 95, dmg: 65, rate: 1.6, range: 5.0, pierce: 3 },
        { cost: 200, dmg: 110, rate: 1.4, range: 5.5, pierce: 5 },
      ],
    },
  };
  const TOWER_KEYS = Object.keys(TOWERS);

  // Speed in cells per second. Armour comes off every non-hex hit.
  const ENEMIES = {
    courtier: { hp: 34, spd: 1.15, armour: 0, bounty: 4, lives: 1, minWave: 1, weight: 5, size: 1 },
    merchant: { hp: 24, spd: 1.95, armour: 0, bounty: 5, lives: 1, minWave: 2, weight: 3, size: 1 },
    knight:   { hp: 95, spd: 0.9, armour: 5, bounty: 10, lives: 2, minWave: 4, weight: 2, size: 1.1 },
    king:     { hp: 380, spd: 0.55, armour: 3, bounty: 70, lives: 6, minWave: 99, weight: 0, size: 1.5 },
  };

  const hpScale = (w) => (1 + 0.16 * (w - 1)) * Math.pow(1.055, w - 1);

  function buildWave(w) {
    const pool = Object.keys(ENEMIES).filter((k) => ENEMIES[k].weight > 0 && ENEMIES[k].minWave <= w);
    let total = 0;
    for (const k of pool) total += ENEMIES[k].weight;
    const count = 8 + Math.floor(w * 1.8);
    const gap = Math.max(0.28, 0.9 - w * 0.02);
    const q = [];
    let t = 0.5;
    for (let i = 0; i < count; i++) {
      let r = Math.random() * total;
      let type = pool[0];
      for (const k of pool) { r -= ENEMIES[k].weight; if (r <= 0) { type = k; break; } }
      q.push({ type, t });
      t += gap * (0.7 + Math.random() * 0.6);
    }
    // A king every fifth wave, one more each time; from wave 12 one may ride with any wave.
    let kings = w % 5 === 0 ? w / 5 : 0;
    if (w > 12 && w % 5 !== 0 && Math.random() < 0.5) kings = 1 + Math.floor((w - 12) / 8);
    for (let i = 0; i < kings; i++) { t += 1.6; q.push({ type: 'king', t }); }
    return q;
  }

  // ------------------------------------------------------------- sound
  let muted = false;
  let audio = null;
  let lastShotAt = 0;
  function ensureAudio() {
    if (audio) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    try { audio = new Ctx(); } catch (e) { audio = null; }
  }
  function blip(freq, dur, type, gain, endMul) {
    if (muted || !audio) return;
    try {
      const t = audio.currentTime;
      const osc = audio.createOscillator();
      const g = audio.createGain();
      osc.type = type || 'square';
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq * (endMul || 0.6)), t + dur);
      g.gain.setValueAtTime(gain || 0.05, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g).connect(audio.destination);
      osc.start(t);
      osc.stop(t + dur);
    } catch (e) { /* audio is a garnish */ }
  }
  // Towers fire many times a second between them: one shot voice per 45 ms.
  function shotVoice(fn) {
    const now = performance.now();
    if (now - lastShotAt < 45) return;
    lastShotAt = now;
    fn();
  }
  const sfx = {
    arrow:    () => shotVoice(() => blip(1500, 0.04, 'triangle', 0.02)),
    hex:      () => shotVoice(() => blip(520, 0.14, 'sine', 0.04, 1.8)),
    cannon:   () => blip(110, 0.3, 'sawtooth', 0.07, 0.35),
    bolt:     () => shotVoice(() => blip(300, 0.1, 'square', 0.035, 0.4)),
    build:    () => { blip(220, 0.08, 'square', 0.04); setTimeout(() => blip(330, 0.12, 'square', 0.04), 70); },
    upgrade:  () => { blip(440, 0.08, 'triangle', 0.05, 1.5); setTimeout(() => blip(660, 0.14, 'triangle', 0.05, 1.5), 80); },
    sell:     () => blip(880, 0.1, 'square', 0.04),
    horn:     () => { blip(147, 0.5, 'sawtooth', 0.05, 1); setTimeout(() => blip(196, 0.6, 'sawtooth', 0.05, 1), 240); },
    clear:    () => { blip(523, 0.1, 'triangle', 0.05, 1); setTimeout(() => blip(784, 0.2, 'triangle', 0.05, 1), 110); },
    leak:     () => blip(90, 0.3, 'square', 0.07),
    fall:     () => blip(60, 1.0, 'sawtooth', 0.09),
    deny:     () => blip(180, 0.1, 'square', 0.03),
  };

  // ------------------------------------------------------------- state
  let W = 0, H = 0, dpr = 1;
  let cs = 32, ox = 0, oy = 0, portrait = false;
  let running = false, paused = false, over = false;
  let lastT = 0, rafId = 0, acc = 0, clock = 0;
  let S = null;

  function reset() {
    S = {
      gold: START_GOLD, lives: START_LIVES, wave: 0, active: false,
      queue: [], spawnT: 0,
      enemies: [], towers: [], shots: [], fx: [],
      grid: {},            // "x,y" -> tower
      build: null,         // tower key being placed
      sel: null,           // selected tower
      hover: null,         // [cx, cy] under a mouse
      speed: 1, flash: 0,
    };
  }

  // -------------------------------------------------------------- rules
  const tmp = { x: 0, y: 0 };

  function spawn(type) {
    const d = ENEMIES[type];
    const hp = Math.round(d.hp * hpScale(S.wave));
    posAt(0, tmp);
    S.enemies.push({ type, d: 0, def: d, hp, max: hp, x: tmp.x, y: tmp.y, slow: 0, slowT: 0, hurt: 0, step: Math.random() * 6, face: 1 });
  }

  function hurt(e, dmg, magic) {
    if (e.hp <= 0) return;
    if (!magic) dmg = Math.max(1, dmg - e.def.armour);
    e.hp -= dmg;
    e.hurt = 0.1;
    if (e.hp <= 0) {
      S.gold += e.def.bounty;
      S.fx.push({ kind: 'coin', x: e.x, y: e.y, life: 0.7, text: '+' + e.def.bounty });
    }
  }

  function blast(x, y, r, dmg, magic) {
    const r2 = r * r;
    for (const e of S.enemies) {
      const dx = e.x - x, dy = e.y - y;
      if (dx * dx + dy * dy <= r2) hurt(e, dmg, magic);
    }
    S.fx.push({ kind: magic ? 'hexburst' : 'boom', x, y, r, life: 0.3 });
  }

  function firstInRange(t, range) {
    let best = null;
    const r2 = range * range;
    for (const e of S.enemies) {
      if (e.hp <= 0) continue;
      const dx = e.x - t.x, dy = e.y - t.y;
      if (dx * dx + dy * dy <= r2 && (!best || e.d > best.d)) best = e;
    }
    return best;
  }

  function fire(t, L, e) {
    t.ax = e.x - t.x;
    t.ay = e.y - t.y;
    t.kick = 0.12;
    if (t.key === 'archer') {
      S.shots.push({ kind: 'arrow', x: t.x, y: t.y, tx: e.x, ty: e.y, target: e, spd: 13, dmg: L.dmg });
      sfx.arrow();
    } else if (t.key === 'mage') {
      S.shots.push({ kind: 'hex', x: t.x, y: t.y - 0.3, tx: e.x, ty: e.y, target: e, spd: 8, dmg: L.dmg, splash: L.splash, magic: true });
      sfx.hex();
    } else if (t.key === 'bombard') {
      S.shots.push({ kind: 'ball', x: t.x, y: t.y, tx: e.x, ty: e.y, target: e, spd: 7, dmg: L.dmg, splash: L.splash });
      sfx.cannon();
    } else if (t.key === 'ballista') {
      const len = Math.hypot(t.ax, t.ay) || 1;
      const ux = t.ax / len, uy = t.ay / len;
      const hits = [];
      for (const o of S.enemies) {
        if (o.hp <= 0) continue;
        const rx = o.x - t.x, ry = o.y - t.y;
        const along = rx * ux + ry * uy;
        if (along > 0 && along <= L.range + 0.3 && Math.abs(rx * uy - ry * ux) < 0.42) hits.push([along, o]);
      }
      hits.sort((a, b) => a[0] - b[0]);
      let reach = len;
      for (let i = 0; i < hits.length && i < L.pierce; i++) { hurt(hits[i][1], L.dmg, false); reach = hits[i][0]; }
      reach = Math.min(L.range, reach + 0.6);
      S.fx.push({ kind: 'streak', x: t.x, y: t.y, x2: t.x + ux * reach, y2: t.y + uy * reach, life: 0.16 });
      sfx.bolt();
    }
  }

  function step(dt) {
    clock += dt;
    if (S.flash > 0) S.flash -= dt;

    // spawns
    if (S.active) {
      S.spawnT += dt;
      while (S.queue.length && S.queue[0].t <= S.spawnT) spawn(S.queue.shift().type);
    }

    // totems first: they set this step's slow
    for (const t of S.towers) {
      if (t.key !== 'totem') continue;
      const L = TOWERS.totem.levels[t.lvl];
      const r2 = L.range * L.range;
      for (const e of S.enemies) {
        const dx = e.x - t.x, dy = e.y - t.y;
        if (dx * dx + dy * dy > r2) continue;
        const s = e.type === 'king' ? L.slow * 0.5 : L.slow;
        if (s > e.slow) e.slow = s;
        e.slowT = 0.2;
        if (L.dps) hurt(e, L.dps * dt, true);
      }
    }

    // march
    for (const e of S.enemies) {
      if (e.hp <= 0) continue;
      if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) e.slow = 0; }
      if (e.hurt > 0) e.hurt -= dt;
      const v = e.def.spd * (1 - e.slow);
      e.d += v * dt;
      e.step += v * dt * 9;
      const px = e.x, py = e.y;
      posAt(e.d, e);
      const sdx = portrait ? e.y - py : e.x - px;
      if (sdx > 0.0005) e.face = 1; else if (sdx < -0.0005) e.face = -1;
      if (e.d >= PATH_LEN) {
        e.hp = 0;
        e.leaked = true;
        S.lives -= e.def.lives;
        S.flash = 0.25;
        sfx.leak();
      }
    }

    // towers
    for (const t of S.towers) {
      if (t.kick > 0) t.kick -= dt;
      if (t.key === 'totem') continue;
      t.cd -= dt;
      if (t.cd > 0) continue;
      const L = TOWERS[t.key].levels[t.lvl];
      const e = firstInRange(t, L.range);
      if (!e) { t.cd = 0; continue; }
      fire(t, L, e);
      t.cd = L.rate;
    }

    // shots in flight
    for (const s of S.shots) {
      if (s.target && s.target.hp > 0) { s.tx = s.target.x; s.ty = s.target.y; }
      const dx = s.tx - s.x, dy = s.ty - s.y;
      const dist = Math.hypot(dx, dy);
      const move = s.spd * dt;
      if (dist <= move) {
        s.done = true;
        if (s.splash) blast(s.tx, s.ty, s.splash, s.dmg, !!s.magic);
        else if (s.target && s.target.hp > 0) hurt(s.target, s.dmg, !!s.magic);
      } else {
        s.x += (dx / dist) * move;
        s.y += (dy / dist) * move;
      }
    }

    // sweep
    if (S.shots.some((s) => s.done)) S.shots = S.shots.filter((s) => !s.done);
    if (S.enemies.some((e) => e.hp <= 0)) S.enemies = S.enemies.filter((e) => e.hp > 0);
    for (const f of S.fx) f.life -= dt;
    if (S.fx.some((f) => f.life <= 0)) S.fx = S.fx.filter((f) => f.life > 0);

    if (S.lives <= 0) { S.lives = 0; gameOver(); return; }

    if (S.active && !S.queue.length && !S.enemies.length) {
      S.active = false;
      S.gold += 20 + 4 * S.wave;
      sfx.clear();
    }
  }

  // ------------------------------------------------------------ actions
  function sendWave() {
    if (!running || paused || S.active) return;
    S.wave += 1;
    S.queue = buildWave(S.wave);
    S.spawnT = 0;
    S.active = true;
    sfx.horn();
    updateHud();
  }

  function canBuild(cx, cy) {
    if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) return false;
    const key = cx + ',' + cy;
    return !blocked.has(key) && !S.grid[key];
  }

  function place(key, cx, cy) {
    const cost = TOWERS[key].levels[0].cost;
    if (!canBuild(cx, cy) || S.gold < cost) { sfx.deny(); return false; }
    S.gold -= cost;
    const t = { key, lvl: 0, cx, cy, x: cx + 0.5, y: cy + 0.5, cd: 0.2, ax: 1, ay: 0, kick: 0, spent: cost };
    S.towers.push(t);
    S.grid[cx + ',' + cy] = t;
    sfx.build();
    if (S.gold < cost) S.build = null;
    updateHud();
    return true;
  }

  function upgradeCost(t) {
    const next = TOWERS[t.key].levels[t.lvl + 1];
    return next ? next.cost : 0;
  }

  function upgrade() {
    const t = S.sel;
    if (!t) return;
    const cost = upgradeCost(t);
    if (!cost || S.gold < cost) { sfx.deny(); return; }
    S.gold -= cost;
    t.spent += cost;
    t.lvl += 1;
    sfx.upgrade();
    updateHud();
  }

  function sell() {
    const t = S.sel;
    if (!t) return;
    S.gold += Math.floor(t.spent * SELL_BACK);
    S.towers = S.towers.filter((o) => o !== t);
    delete S.grid[t.cx + ',' + t.cy];
    S.sel = null;
    sfx.sell();
    updateHud();
  }

  function pickBuild(key) {
    if (!running || paused) return;
    S.sel = null;
    S.build = S.build === key ? null : key;
    if (S.build && S.gold < TOWERS[key].levels[0].cost) { S.build = null; sfx.deny(); }
    updateHud();
  }

  function toggleSpeed() {
    S.speed = S.speed === 1 ? 2 : 1;
    updateHud();
  }

  // ------------------------------------------------------ HUD and shop
  // Only written on change: a per-frame write forces a layout pass per frame.
  const shown = new Map();
  function setText(el, v) { if (el && shown.get(el) !== v) { shown.set(el, v); el.textContent = v; } }
  function setFlag(el, prop, v) {
    if (!el) return;
    const k = prop + ':' + v;
    const map = el.__flags || (el.__flags = {});
    if (map[prop] === k) return;
    map[prop] = k;
    if (prop === 'pressed') el.setAttribute('aria-pressed', String(v));
    else el[prop] = v;
  }

  const chips = { build: {}, upgrade: null, sell: null, wave: null, speed: null };
  function chip(label, onClick, title) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'game-chip';
    b.textContent = label;
    if (title) b.title = title;
    b.addEventListener('click', () => { onClick(); display.focus({ preventScroll: true }); });
    shop.appendChild(b);
    return b;
  }
  if (shop) {
    TOWER_KEYS.forEach((key) => {
      const T = TOWERS[key];
      chips.build[key] = chip(T.name + ' ' + T.levels[0].cost, () => pickBuild(key), T.hint);
      chips.build[key].setAttribute('aria-pressed', 'false');
    });
    chips.upgrade = chip('Upgrade', upgrade);
    chips.sell = chip('Sell', sell);
    chips.wave = chip('Send wave', sendWave);
    chips.wave.classList.add('keep-wave');
    chips.speed = chip('x1', toggleSpeed);
  }

  function updateHud() {
    setText(hud.gold, String(S.gold));
    setText(hud.lives, String(S.lives));
    setText(hud.wave, String(S.wave));
    if (!shop) return;
    const sel = S.sel;
    for (const key of TOWER_KEYS) {
      const b = chips.build[key];
      setFlag(b, 'hidden', !!sel);
      setFlag(b, 'disabled', S.gold < TOWERS[key].levels[0].cost);
      setFlag(b, 'pressed', S.build === key);
    }
    setFlag(chips.upgrade, 'hidden', !sel);
    setFlag(chips.sell, 'hidden', !sel);
    if (sel) {
      const cost = upgradeCost(sel);
      setText(chips.upgrade, cost ? TOWERS[sel.key].name + ' ' + (sel.lvl + 2) + ' · ' + cost : 'Max');
      setFlag(chips.upgrade, 'disabled', !cost || S.gold < cost);
      setText(chips.sell, 'Sell ' + Math.floor(sel.spent * SELL_BACK));
    }
    setFlag(chips.wave, 'disabled', S.active);
    setText(chips.speed, 'x' + S.speed);
  }

  // ------------------------------------------------------------ layout
  function toScreenX(x, y) { return ox + (portrait ? y : x) * cs; }
  function toScreenY(x, y) { return oy + (portrait ? x : y) * cs; }
  function toCell(px, py) {
    const u = Math.floor((px - ox) / cs), v = Math.floor((py - oy) / cs);
    return portrait ? [v, u] : [u, v];
  }

  function resize() {
    const r = stage.getBoundingClientRect();
    W = Math.max(200, Math.round(r.width));
    H = Math.max(200, Math.round(r.height));
    dpr = Math.min(2, window.devicePixelRatio || 1);
    display.width = Math.round(W * dpr);
    display.height = Math.round(H * dpr);

    // The field sits between the HUD (and the bar, when it is up top) and
    // the shop row, which wraps on a phone: measure, don't assume.
    let top = 8;
    const under = (el) => {
      if (!el || el.hidden) return;
      const b = el.getBoundingClientRect();
      if (b.height && b.top - r.top < H / 2) top = Math.max(top, b.bottom - r.top + 6);
    };
    under(hudBox);
    under(bar);
    let bottom = H - 8;
    if (shop && !shop.hidden) {
      const b = shop.getBoundingClientRect();
      if (b.height) bottom = Math.min(bottom, b.top - r.top - 6);
    }
    const availW = W - 12, availH = Math.max(60, bottom - top);
    const land = Math.min(availW / COLS, availH / ROWS);
    const port = Math.min(availW / ROWS, availH / COLS);
    portrait = port > land * 1.05;
    cs = Math.floor(Math.max(8, portrait ? port : land));
    const mw = cs * (portrait ? ROWS : COLS), mh = cs * (portrait ? COLS : ROWS);
    ox = Math.round((W - mw) / 2);
    oy = Math.round(top + (availH - mh) / 2);
    paintField();
  }

  // ----------------------------------------------------------- drawing
  // Sprites are authored in a 32-unit box and scaled to the cell.
  function paintField() {
    bgCanvas.width = display.width;
    bgCanvas.height = display.height;
    const b = bctx;
    b.setTransform(dpr, 0, 0, dpr, 0, 0);
    b.fillStyle = '#07060a';
    b.fillRect(0, 0, W, H);
    const GRASS = ['#0d1911', '#0f1c13', '#0b160f', '#101e15'];
    for (let cy = 0; cy < ROWS; cy++) {
      for (let cx = 0; cx < COLS; cx++) {
        const X = toScreenX(cx, cy), Y = toScreenY(cx, cy);
        if (road.has(cx + ',' + cy)) {
          b.fillStyle = '#2a2018';
          b.fillRect(X, Y, cs, cs);
          for (let i = 0; i < 5; i++) {
            b.fillStyle = hash(cx, cy, i) > 0.5 ? '#3a2d22' : '#1f1711';
            const s = Math.max(2, cs * 0.09);
            b.fillRect(X + hash(cx, cy, i + 10) * (cs - s), Y + hash(cx, cy, i + 20) * (cs - s), s, s);
          }
        } else {
          b.fillStyle = GRASS[(hash(cx, cy, 1) * GRASS.length) | 0];
          b.fillRect(X, Y, cs, cs);
          b.fillStyle = '#1a3021';
          for (let i = 0; i < 3; i++) {
            const tx = X + hash(cx, cy, i + 30) * (cs - 3), ty = Y + hash(cx, cy, i + 40) * (cs - 5);
            b.fillRect(tx, ty, 1, Math.max(2, cs * 0.12));
          }
        }
      }
    }
    // road verges
    b.fillStyle = '#140e0a';
    const e = Math.max(1, Math.round(cs * 0.06));
    const N = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const key of road) {
      const c = key.split(',').map(Number);
      if (c[0] < 0 || c[0] >= COLS) continue;
      const X = toScreenX(c[0], c[1]), Y = toScreenY(c[0], c[1]);
      for (const n of N) {
        const nx = c[0] + n[0], ny = c[1] + n[1];
        if (road.has(nx + ',' + ny) || nx < 0) continue;
        const sx = portrait ? n[1] : n[0], sy = portrait ? n[0] : n[1];
        if (sx === 1) b.fillRect(X + cs - e, Y, e, cs);
        else if (sx === -1) b.fillRect(X, Y, e, cs);
        else if (sy === 1) b.fillRect(X, Y + cs - e, cs, e);
        else b.fillRect(X, Y, cs, e);
      }
    }
    b.strokeStyle = 'rgba(180, 120, 255, 0.28)';
    b.lineWidth = 1;
    b.strokeRect(ox + 0.5, oy + 0.5, cs * (portrait ? ROWS : COLS) - 1, cs * (portrait ? COLS : ROWS) - 1);
    paintKeep(b);
  }

  function paintKeep(b) {
    const X = toScreenX(KEEP[0] + 0.5, KEEP[1] + 0.5), Y = toScreenY(KEEP[0] + 0.5, KEEP[1] + 0.5);
    const k = (cs * 1.45) / 32;
    b.save();
    b.translate(X, Y);
    b.scale(k, k);
    const R = (x, y, w, h, c) => { b.fillStyle = c; b.fillRect(x, y, w, h); };
    R(-13, -4, 26, 17, '#4d4a57');            // curtain wall
    R(-13, 11, 26, 2, '#2c2a33');
    for (let x = -13; x < 13; x += 6) R(x, -8, 4, 4, '#4d4a57');
    R(-16, -12, 8, 25, '#5d5a68');            // towers
    R(8, -12, 8, 25, '#5d5a68');
    for (const tx of [-16, 8]) { R(tx, -15, 3, 3, '#5d5a68'); R(tx + 5, -15, 3, 3, '#5d5a68'); R(tx + 3, -4, 2, 5, '#0b0a0f'); }
    R(-4, 2, 8, 11, '#0b0a0f');               // gate
    R(-4, 0, 8, 2, '#2c2a33');
    R(-1, -22, 1.5, 14, '#2c2a33');           // banner
    R(0.5, -22, 8, 6, '#8c03fc');
    R(3, -20.5, 3, 3, '#e9dcff');
    b.restore();
  }

  function sprite(x, y, scale) {
    ctx.save();
    ctx.translate(toScreenX(x, y), toScreenY(x, y));
    const k = (cs / 32) * (scale || 1);
    ctx.scale(k, k);
  }
  const R = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  function aimAngle(t) {
    return portrait ? Math.atan2(t.ax, t.ay) : Math.atan2(t.ay, t.ax);
  }

  function drawTower(t) {
    sprite(t.x, t.y);
    const key = t.key;
    // footing shared by every tower
    R(-11, 6, 22, 6, '#3b3944');
    R(-11, 11, 22, 2, '#23212a');
    if (key === 'archer') {
      R(-8, -6, 16, 13, '#5a4630');
      R(-10, -9, 20, 4, '#6d563a');
      for (let x = -10; x < 10; x += 6) R(x, -12, 4, 3, '#6d563a');
      R(-2.5, -19, 5, 5, '#d9c2a8');
      R(-3.5, -21, 7, 3, '#2f5d3a');
      R(-3, -14, 6, 6, '#2f5d3a');
      ctx.save();
      ctx.translate(0, -12);
      ctx.rotate(aimAngle(t));
      ctx.strokeStyle = '#c9a36a'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(3, 0, 6, -1.2, 1.2); ctx.stroke();
      ctx.restore();
    } else if (key === 'mage') {
      R(-6, -8, 12, 15, '#2a1b3d');
      R(-4, -15, 8, 8, '#34224b');
      R(-2, -19, 4, 5, '#3f2a5b');
      const pulse = 0.6 + 0.4 * Math.sin(clock * 4 + t.cx);
      ctx.fillStyle = 'rgba(180, 120, 255, ' + (0.25 + 0.2 * pulse).toFixed(2) + ')';
      ctx.beginPath(); ctx.arc(0, -23, 6.5, 0, TAU); ctx.fill();
      ctx.fillStyle = t.kick > 0 ? '#ffffff' : '#c79bff';
      ctx.beginPath(); ctx.arc(0, -23, 3.2, 0, TAU); ctx.fill();
    } else if (key === 'bombard') {
      R(-10, -2, 20, 9, '#4d4a57');
      for (let x = -10; x < 10; x += 7) R(x, -5, 5, 3, '#4d4a57');
      ctx.save();
      ctx.translate(0, -4);
      ctx.rotate(aimAngle(t));
      const back = t.kick > 0 ? -3 : 0;
      R(-5 + back, -4, 17, 8, '#141318');
      R(10 + back, -5, 3, 10, '#2b2932');
      R(-7 + back, -3, 3, 6, '#2b2932');
      ctx.restore();
    } else if (key === 'totem') {
      R(-3, -18, 6, 25, '#4a3520');
      R(-7, -20, 14, 11, '#d8d2c2');
      R(-5, -10, 10, 3, '#d8d2c2');
      R(-5, -17, 3, 4, '#0b0a0f'); R(2, -17, 3, 4, '#0b0a0f');
      const glow = 0.5 + 0.5 * Math.sin(clock * 3 + t.cy);
      ctx.fillStyle = 'rgba(80, 255, 140, ' + (0.5 + 0.5 * glow).toFixed(2) + ')';
      ctx.fillRect(-4, -16, 1.5, 2); ctx.fillRect(3, -16, 1.5, 2);
      R(-4, -9, 2, 2, '#0b0a0f'); R(-1, -9, 2, 2, '#0b0a0f'); R(2, -9, 2, 2, '#0b0a0f');
    } else {
      R(-8, -1, 16, 8, '#5a4630');
      ctx.save();
      ctx.translate(0, -4);
      ctx.rotate(aimAngle(t));
      R(-8, -1.5, 20, 3, '#6d563a');
      ctx.strokeStyle = '#c9a36a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(6, -10); ctx.quadraticCurveTo(11, 0, 6, 10); ctx.stroke();
      ctx.strokeStyle = 'rgba(230,230,230,0.7)'; ctx.lineWidth = 0.8;
      const pull = t.kick > 0 ? 6 : -4;
      ctx.beginPath(); ctx.moveTo(6, -10); ctx.lineTo(pull, 0); ctx.lineTo(6, 10); ctx.stroke();
      ctx.restore();
    }
    for (let i = 0; i <= t.lvl; i++) R(-5 + i * 4, 13.5, 2.5, 2, '#ffd24a');
    ctx.restore();
  }

  function drawEnemy(e) {
    const bob = Math.abs(Math.sin(e.step)) * 1.5;
    sprite(e.x, e.y, 0.82 * e.def.size);
    ctx.translate(0, -bob);
    ctx.scale(e.face, 1);
    if (e.hurt > 0) ctx.globalAlpha = 0.55;
    const stride = Math.sin(e.step) * 3;
    const type = e.type;
    const skin = '#d9c2a8';
    if (type === 'courtier') {
      R(-5 + stride, 4, 3, 9, '#e9dcff'); R(2 - stride, 4, 3, 9, '#e9dcff');
      R(-6, -8, 12, 13, '#6b3fa0');
      R(-6, -8, 12, 2, '#e9dcff');
      R(-4, -16, 8, 8, skin);
      R(-5, -19, 10, 4, '#2a1b3d');
      R(3, -25, 2, 7, '#f2f2f2');
      R(6, -4, 5, 3, '#f1e6c8');
    } else if (type === 'merchant') {
      R(-5 + stride, 4, 3, 9, '#3a2d22'); R(2 - stride, 4, 3, 9, '#3a2d22');
      R(-6, -8, 12, 13, '#2f7d4f');
      R(-4, -16, 8, 8, skin);
      R(-5, -18, 10, 4, '#1f5235');
      ctx.fillStyle = '#7a5a34';
      ctx.beginPath(); ctx.arc(-9, -3, 6, 0, TAU); ctx.fill();
      R(-10, -5, 3, 3, '#ffd24a');
    } else if (type === 'knight') {
      R(-5 + stride, 4, 3, 9, '#7b828c'); R(2 - stride, 4, 3, 9, '#7b828c');
      R(-7, -9, 14, 14, '#9aa0a8');
      R(-7, -2, 14, 2, '#6b7079');
      R(-5, -18, 10, 10, '#b3b9c1');
      R(-1, -14, 6, 2, '#0b0a0f');
      R(-1, -24, 2, 6, '#c0182f');
      R(4, -8, 7, 11, '#7a1424'); R(6, -5, 3, 5, '#ffd24a');
    } else {
      R(-5 + stride, 4, 3, 9, '#3a1018'); R(2 - stride, 4, 3, 9, '#3a1018');
      R(-9, -9, 18, 16, '#a01830');
      R(-9, 5, 18, 3, '#f2f2f2');
      R(-2, -9, 4, 14, '#f2f2f2');
      R(-4, -17, 8, 8, skin);
      R(-4, -11, 8, 3, '#e8e8e8');
      R(-5, -21, 10, 4, '#ffd24a');
      R(-5, -24, 2, 3, '#ffd24a'); R(-1, -25, 2, 4, '#ffd24a'); R(3, -24, 2, 3, '#ffd24a');
      R(-0.5, -20, 1.5, 1.5, '#c0182f');
    }
    ctx.globalAlpha = 1;
    if (e.slow > 0) { ctx.fillStyle = 'rgba(80, 255, 140, 0.8)'; ctx.fillRect(-6, 13, 12, 1.5); }
    ctx.restore();
    if (e.hp < e.max) {
      const X = toScreenX(e.x, e.y), Y = toScreenY(e.x, e.y);
      const w = cs * 0.5 * e.def.size, h = Math.max(2, cs * 0.06);
      const top = Y - cs * 0.78 * e.def.size;
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(X - w / 2, top, w, h);
      ctx.fillStyle = '#ff9b3d';
      ctx.fillRect(X - w / 2, top, w * clamp(e.hp / e.max, 0, 1), h);
    }
  }

  function ring(x, y, r, stroke, fill) {
    ctx.beginPath();
    ctx.arc(toScreenX(x, y), toScreenY(x, y), r * cs, 0, TAU);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke();
  }

  const order = [];
  function drawFrame() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.drawImage(bgCanvas, 0, 0, W, H);

    // the gate the court walks in through
    const gx = toScreenX(0, 1.5), gy = toScreenY(0, 1.5);
    const pulse = 0.5 + 0.5 * Math.sin(clock * 2);
    ctx.fillStyle = 'rgba(140, 3, 252, ' + (0.25 + 0.2 * pulse).toFixed(2) + ')';
    ctx.beginPath();
    if (portrait) ctx.ellipse(gx, gy, cs * 0.45, cs * 0.18, 0, 0, TAU);
    else ctx.ellipse(gx, gy, cs * 0.18, cs * 0.45, 0, 0, TAU);
    ctx.fill();

    for (const t of S.towers) {
      if (t.key === 'totem') ring(t.x, t.y, TOWERS.totem.levels[t.lvl].range, 'rgba(80, 255, 140, 0.16)', 'rgba(80, 255, 140, 0.04)');
    }

    // painter's order down the screen
    order.length = 0;
    for (const t of S.towers) order.push(t);
    for (const e of S.enemies) order.push(e);
    order.sort((a, b) => (portrait ? a.x - b.x : a.y - b.y));
    for (const o of order) { if (o.def) drawEnemy(o); else drawTower(o); }

    for (const s of S.shots) {
      const X = toScreenX(s.x, s.y), Y = toScreenY(s.x, s.y);
      if (s.kind === 'arrow') {
        const X2 = toScreenX(s.tx, s.ty), Y2 = toScreenY(s.tx, s.ty);
        const a = Math.atan2(Y2 - Y, X2 - X), l = cs * 0.3;
        ctx.strokeStyle = '#e8dcc0'; ctx.lineWidth = Math.max(1, cs * 0.04);
        ctx.beginPath(); ctx.moveTo(X - Math.cos(a) * l, Y - Math.sin(a) * l); ctx.lineTo(X, Y); ctx.stroke();
      } else if (s.kind === 'hex') {
        ctx.fillStyle = 'rgba(180, 120, 255, 0.35)';
        ctx.beginPath(); ctx.arc(X, Y, cs * 0.2, 0, TAU); ctx.fill();
        ctx.fillStyle = '#e9dcff';
        ctx.beginPath(); ctx.arc(X, Y, cs * 0.09, 0, TAU); ctx.fill();
      } else {
        ctx.fillStyle = '#0b0a0f';
        ctx.beginPath(); ctx.arc(X, Y, cs * 0.12, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#6b6877'; ctx.lineWidth = 1; ctx.stroke();
      }
    }

    ctx.font = Math.max(9, Math.round(cs * 0.3)) + 'px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    for (const f of S.fx) {
      const X = toScreenX(f.x, f.y), Y = toScreenY(f.x, f.y);
      if (f.kind === 'coin') {
        ctx.globalAlpha = clamp(f.life * 2, 0, 1);
        ctx.fillStyle = '#ffd24a';
        ctx.fillText(f.text, X, Y - cs * (0.6 + (0.7 - f.life) * 0.8));
      } else if (f.kind === 'streak') {
        ctx.globalAlpha = clamp(f.life / 0.16, 0, 1);
        ctx.strokeStyle = '#f2ead8'; ctx.lineWidth = Math.max(1.5, cs * 0.07);
        ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(toScreenX(f.x2, f.y2), toScreenY(f.x2, f.y2)); ctx.stroke();
      } else {
        const k = 1 - f.life / 0.3;
        ctx.globalAlpha = 1 - k;
        ctx.fillStyle = f.kind === 'boom' ? '#ff9b3d' : '#b478ff';
        ctx.beginPath(); ctx.arc(X, Y, f.r * cs * (0.35 + 0.65 * k), 0, TAU); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'start';

    if (S.sel) {
      const L = TOWERS[S.sel.key].levels[S.sel.lvl];
      ring(S.sel.x, S.sel.y, L.range, 'rgba(233, 220, 255, 0.7)', 'rgba(180, 120, 255, 0.08)');
    }
    if (S.build && S.hover) {
      const cx = S.hover[0], cy = S.hover[1];
      if (cx >= 0 && cy >= 0 && cx < COLS && cy < ROWS) {
        const ok = canBuild(cx, cy);
        ring(cx + 0.5, cy + 0.5, TOWERS[S.build].levels[0].range, ok ? 'rgba(233, 220, 255, 0.7)' : 'rgba(255, 80, 80, 0.7)', ok ? 'rgba(180, 120, 255, 0.08)' : 'rgba(255, 60, 60, 0.08)');
        ctx.fillStyle = ok ? 'rgba(180, 120, 255, 0.3)' : 'rgba(255, 60, 60, 0.3)';
        ctx.fillRect(toScreenX(cx, cy), toScreenY(cx, cy), cs, cs);
      }
    }
    if (S.flash > 0) {
      ctx.fillStyle = 'rgba(192, 24, 47, ' + (S.flash * 0.9).toFixed(2) + ')';
      ctx.fillRect(0, 0, W, H);
    }
  }

  // -------------------------------------------------------------- loop
  const STEP = 1 / 60;
  function frame() {
    if (!running || paused) { rafId = 0; return; }
    const t = performance.now();
    let dt = lastT ? (t - lastT) / 1000 : STEP;
    if (!(dt > 0)) dt = STEP;
    dt = Math.min(dt, 0.1);
    lastT = t;
    acc += dt * S.speed;
    while (acc >= STEP && running) { step(STEP); acc -= STEP; }
    if (!over) { updateHud(); drawFrame(); }
    rafId = requestAnimationFrame(frame);
  }
  function schedule() {
    if (!rafId) { lastT = 0; rafId = requestAnimationFrame(frame); }
  }

  // ---------------------------------------------------------- lifecycle
  const BEST_KEY = 'htg.keep.best';
  function readBest() { try { return parseInt(localStorage.getItem(BEST_KEY), 10) || 0; } catch (e) { return 0; } }
  function writeBest(n) { try { localStorage.setItem(BEST_KEY, String(n)); } catch (e) { /* private mode */ } }

  function showOverlay(title, text, button) {
    if (overlayTitle) overlayTitle.textContent = title;
    if (overlayText) overlayText.textContent = text;
    if (playButton) playButton.textContent = button;
    if (overlay) overlay.hidden = false;
  }
  function start() {
    ensureAudio();
    if (audio && audio.state !== 'running') audio.resume().catch(() => {});
    reset();
    if (shop) shop.hidden = false;
    over = false;
    running = true;
    paused = false;
    acc = 0;
    if (overlay) overlay.hidden = true;
    if (keysNote) keysNote.hidden = true;
    display.classList.add('is-playing');
    document.body.classList.add('game-active');
    updateHud();   // chip labels first: the row wraps on a phone and resize() measures it
    if (stage.scrollIntoView) stage.scrollIntoView({ block: 'start' });   // the stage is taller than what is left under the heading on a phone
    resize();
    display.focus({ preventScroll: true });
    schedule();
  }
  function pause() {
    if (!running || paused || over) return;
    paused = true;
    showOverlay('PAUSED', 'Wave ' + S.wave + ' · ' + S.gold + ' gold', 'Resume');
  }
  function resume() {
    if (!running || !paused) return;
    paused = false;
    if (overlay) overlay.hidden = true;
    schedule();
  }
  function gameOver() {
    over = true;
    running = false;
    sfx.fall();
    display.classList.remove('is-playing');
    document.body.classList.remove('game-active');
    if (shop) shop.hidden = true;
    const best = readBest();
    const held = Math.max(0, S.wave - 1);   // the wave that broke the keep does not count
    if (held > best) writeBest(held);
    const line = held > best && best ? ' · New best' : (best ? ' · Best ' + Math.max(best, held) : '');
    showOverlay('THE KEEP FELL', held + (held === 1 ? ' wave held' : ' waves held') + line, 'Again');
  }

  if (playButton) playButton.addEventListener('click', () => {
    if (paused) resume(); else start();
  });
  if (muteButton) muteButton.addEventListener('click', () => {
    muted = !muted;
    muteButton.textContent = muted ? 'Sound off' : 'Sound on';
    muteButton.setAttribute('aria-pressed', String(muted));
  });

  // ---------------------------------------------------------------- input
  display.tabIndex = 0;
  function cellAt(ev) {
    const r = display.getBoundingClientRect();
    return toCell((ev.clientX - r.left) * (W / r.width), (ev.clientY - r.top) * (H / r.height));
  }
  display.addEventListener('pointermove', (ev) => {
    if (!running || paused) return;
    S.hover = ev.pointerType === 'touch' ? null : cellAt(ev);
  }, { passive: true });
  display.addEventListener('pointerleave', () => { if (S) S.hover = null; });
  display.addEventListener('pointerdown', (ev) => {
    if (!running || paused) return;
    ev.preventDefault();
    if (ev.button === 2) { S.build = null; S.sel = null; updateHud(); return; }
    const c = cellAt(ev);
    const t = S.grid[c[0] + ',' + c[1]];
    if (S.build && !t) { place(S.build, c[0], c[1]); return; }
    S.build = null;
    S.sel = t && t !== S.sel ? t : null;
    updateHud();
  });
  display.addEventListener('contextmenu', (ev) => { if (running) ev.preventDefault(); });

  window.addEventListener('keydown', (ev) => {
    const el = ev.target;
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
    if (ev.code === 'Escape') {
      if (paused) resume();
      else if (running && (S.build || S.sel)) { S.build = null; S.sel = null; updateHud(); }
      else pause();
      return;
    }
    if (!running || paused) return;
    if (ev.code === 'Space') { sendWave(); ev.preventDefault(); return; }
    if (ev.code === 'KeyF') { toggleSpeed(); return; }
    if (ev.code === 'KeyU') { upgrade(); return; }
    if (ev.code === 'KeyX') { sell(); return; }
    const n = parseInt(ev.key, 10);
    if (n >= 1 && n <= TOWER_KEYS.length) pickBuild(TOWER_KEYS[n - 1]);
  });

  window.addEventListener('resize', () => { resize(); if (S && !running) drawFrame(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (!en.isIntersecting) pause(); });
    }, { threshold: 0.2 }).observe(stage);
  }

  // ?keepdebug=1 exposes the rules for balance runs in a headless page.
  if (/[?&]keepdebug=1/.test(location.search)) {
    window.__keep = {
      get S() { return S; },
      get over() { return over; },
      step, place, sendWave, canBuild, TOWERS, ENEMIES, COLS, ROWS, blocked, road,
      select: (t) => { S.sel = t; },
      upgrade, sell, start,
    };
  }

  reset();
  resize();
  drawFrame();
})();
