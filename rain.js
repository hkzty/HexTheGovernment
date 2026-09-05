/*
  HTG // JARS
  The glyph rain from matrix.js, but you can catch it. A jar on a rail
  fills with whatever falls into it; full jars sell for cash; cash buys
  walls, turrets and a wider rim while the hordes walk in from both edges.
  No engine, no libraries, no external assets — everything is drawn and
  sounded in code at runtime, same rules as Suit Purge (game.js).

  Enemies are the same four fictional class archetypes as Suit Purge. No
  real person is depicted and none should ever be added.
*/
(function () {
  'use strict';

  const display = document.getElementById('jarCanvas');
  if (!display || !display.getContext) return;
  const ctx = display.getContext('2d');
  if (!ctx) return;
  // The rain keeps its fade trail on its own buffer; the display is cleared
  // and re-composed every frame so the jar, fort and hordes never smear.
  const rainCanvas = document.createElement('canvas');
  const rctx = rainCanvas.getContext('2d');
  if (!rctx) return;

  const hud = {
    cash: document.getElementById('hudCash'),
    jars: document.getElementById('hudJars'),
    fort: document.getElementById('hudFort'),
    wave: document.getElementById('hudWave'),
  };
  const overlay = document.getElementById('jarOverlay');
  const overlayTitle = document.getElementById('jarOverlayTitle');
  const overlayText = document.getElementById('jarOverlayText');
  const playButton = document.getElementById('jarPlay');
  const keysNote = document.getElementById('jarKeys');
  const muteButton = document.getElementById('jarMute');
  const shop = document.getElementById('jarShop');
  const sellButton = document.getElementById('jarSell');
  const stage = display.parentElement;

  const TAU = Math.PI * 2;
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const rand = (a, b) => Math.random() * (b - a) + a;

  // ------------------------------------------------------------- rain
  // Same glyph set, inks and fall/fade rates as matrix.js so the two rains
  // read as one. Only the catch value per ink is new.
  const GLYPHS =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<>/\\|=+-*[]{}:;.?!$#%&@' +
    'アカサタナハマヤラワイキシチニヒミリヰウクスツヌフムユルエケセテネヘメレヱオコソトノホモヨロヲ';
  const FONT_SIZE = 16;
  const SPEED_MIN = 0.35;
  const SPEED_MAX = 0.95;
  const FADE_ALPHA_PER_SEC = 4.8;
  const INKS = {
    white:  { head: 'rgba(240, 240, 240, 0.95)', tail: 'rgba(170, 170, 170, 0.55)', fill: '#dedede', value: 1.0 },
    purple: { head: 'rgba(190, 120, 255, 0.95)', tail: 'rgba(140, 3, 252, 0.75)',   fill: '#8c03fc', value: 2.5 },
    green:  { head: 'rgba(150, 255, 170, 0.95)', tail: 'rgba(20, 200, 90, 0.70)',   fill: '#14c85a', value: 1.5 },
    orange: { head: 'rgba(255, 200, 140, 0.95)', tail: 'rgba(255, 155, 61, 0.70)',  fill: '#ff9b3d', value: 1.5 },
    cyan:   { head: 'rgba(160, 245, 252, 0.95)', tail: 'rgba(47, 212, 224, 0.70)',  fill: '#2fd4e0', value: 1.5 },
  };
  const BAG = ['white', 'white', 'white', 'white', 'purple', 'green', 'orange', 'cyan'];
  const pickGlyph = () => GLYPHS.charAt((Math.random() * GLYPHS.length) | 0);
  function pickInk(cloudLevel) {
    // The Cloud upgrade tilts the bag toward purple, the richest ink.
    if (Math.random() < cloudLevel * 0.08) return INKS.purple;
    return INKS[BAG[(Math.random() * BAG.length) | 0]];
  }

  // ------------------------------------------------------------ tuning
  const JAR_CAPACITY = 16;         // catch units per full jar
  const JAR_BASE_WIDTH = 64;       // px, before Rim upgrades
  const JAR_HEIGHT = 40;
  const RAIL_FROM_GROUND = 110;    // the jar rail floats above the horde lane
  const GROUND_H = 34;             // ground band height
  const FORT_W = 120;
  const FORT_BASE_HP = 200;
  const BASE_PRICE = 12;           // cash per jar at Market level 0
  const WAVE_SECONDS = 28;
  const THROW_DAMAGE = 90;
  const THROW_RADIUS = 64;

  const UPGRADES = [
    { key: 'walls',  name: 'Walls',  cost: 40, hint: 'Fort HP +80, repaired' },
    { key: 'turret', name: 'Turret', cost: 60, hint: 'Faster, harder shots' },
    { key: 'rim',    name: 'Rim',    cost: 35, hint: 'Wider jar' },
    { key: 'cloud',  name: 'Cloud',  cost: 50, hint: 'Denser, richer rain' },
    { key: 'market', name: 'Market', cost: 45, hint: 'Jars sell for more' },
  ];
  const COST_GROWTH = 1.55;

  // Four fictional class archetypes — same table as Suit Purge, scaled
  // down to a 26px silhouette. Told apart by the hat / tie / headset.
  const ENEMY_TYPES = {
    politician:   { hp: 40,  speed: 34, damage: 6,  colour: '#2b2b3a', tell: 'tie',     minWave: 1 },
    billionaire:  { hp: 30,  speed: 50, damage: 5,  colour: '#3a3a3a', tell: 'headset', minWave: 1 },
    highcommand:  { hp: 60,  speed: 32, damage: 9,  colour: '#2a3524', tell: 'cap',     minWave: 2 },
    trillionaire: { hp: 110, speed: 22, damage: 14, colour: '#1c1c1c', tell: 'tophat',  minWave: 3 },
  };
  function pickType(wave) {
    const pool = Object.keys(ENEMY_TYPES).filter((k) => ENEMY_TYPES[k].minWave <= wave);
    return pool[(Math.random() * pool.length) | 0];
  }

  // ------------------------------------------------------------- sound
  let muted = false;
  let audio = null;
  function ensureAudio() {
    if (audio) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    try { audio = new Ctx(); } catch (e) { audio = null; }
  }
  function blip(freq, dur, type, gain) {
    if (muted || !audio) return;
    try {
      const t = audio.currentTime;
      const osc = audio.createOscillator();
      const g = audio.createGain();
      osc.type = type || 'square';
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.6), t + dur);
      g.gain.setValueAtTime(gain || 0.05, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g).connect(audio.destination);
      osc.start(t);
      osc.stop(t + dur);
    } catch (e) { /* audio is a garnish */ }
  }
  const sfx = {
    catchDrop: (ink) => blip(700 + ink.value * 260, 0.06, 'triangle', 0.03),
    jarFull:   () => { blip(520, 0.12, 'square', 0.05); setTimeout(() => blip(780, 0.16, 'square', 0.05), 90); },
    sell:      () => { blip(880, 0.08, 'square', 0.05); setTimeout(() => blip(1320, 0.14, 'square', 0.05), 70); },
    buy:       () => blip(330, 0.14, 'sawtooth', 0.04),
    shot:      () => blip(1400, 0.04, 'square', 0.02),
    smash:     () => blip(140, 0.28, 'sawtooth', 0.07),
    hit:       () => blip(90, 0.18, 'square', 0.05),
    fall:      () => blip(60, 0.9, 'sawtooth', 0.09),
    deny:      () => blip(180, 0.12, 'square', 0.03),
  };

  // ------------------------------------------------------------- state
  let W = 0, H = 0, dpr = 1;
  let groundY = 0, railY = 0;
  let columns = [];
  let running = false;
  let paused = false;
  let over = false;
  let lastT = 0;
  let rafId = 0;

  const S = {};
  function reset() {
    S.cash = 0;
    S.earned = 0;
    S.jars = 0;
    S.fill = 0;
    S.fillInks = [];          // fill values of what is in the jar, for the paint
    S.levels = { walls: 0, turret: 0, rim: 0, cloud: 0, market: 0 };
    S.fortMax = FORT_BASE_HP;
    S.fortHp = FORT_BASE_HP;
    S.wave = 1;
    S.waveT = 0;
    S.spawnT = 1.5;
    S.enemies = [];
    S.shots = [];
    S.throws = [];
    S.bursts = [];
    S.turretT = 0;
    S.jarX = W / 2;
    S.jarTarget = W / 2;
    S.hudCache = {};
    S.shake = 0;
  }

  const jarWidth = () => JAR_BASE_WIDTH + S.levels.rim * 14;
  const jarPrice = () => Math.round(BASE_PRICE * (1 + S.levels.market * 0.35));
  const upgradeCost = (u) => Math.round(u.cost * Math.pow(COST_GROWTH, S.levels[u.key]));
  const fortLeft = () => W / 2 - FORT_W / 2;
  const fortRight = () => W / 2 + FORT_W / 2;

  // ------------------------------------------------------------ resize
  function resize() {
    const rect = stage.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(1, Math.round(rect.width));
    H = Math.max(1, Math.round(rect.height));
    display.width = Math.floor(W * dpr);
    display.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    rainCanvas.width = display.width;
    rainCanvas.height = display.height;
    rctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // The horde lane ends where the shop row begins (it wraps on a phone).
    const shopTop = shop && !shop.hidden && shop.offsetHeight ? shop.offsetTop : H - 48;
    groundY = Math.min(H - GROUND_H, shopTop - 12);
    railY = groundY - RAIL_FROM_GROUND;
    const colCount = Math.ceil(W / FONT_SIZE);
    columns = new Array(colCount).fill(0).map(() => ({
      y: rand(-H, 0),
      speed: rand(SPEED_MIN, SPEED_MAX),
      glyph: pickGlyph(),
      swapT: Math.random() * 0.3,
      ink: pickInk(S.levels ? S.levels.cloud : 0),
      dead: false,
    }));
    rctx.fillStyle = '#0a0a0a';
    rctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, W, H);
    if (S.levels) {
      S.jarX = clamp(S.jarX, jarWidth() / 2, W - jarWidth() / 2);
      S.jarTarget = S.jarX;
    }
  }

  // --------------------------------------------------------------- HUD
  function setHud(key, value) {
    if (S.hudCache[key] === value) return;
    S.hudCache[key] = value;
    if (hud[key]) hud[key].textContent = value;
  }
  function updateHud() {
    setHud('cash', '$' + S.cash);
    setHud('jars', String(S.jars));
    setHud('fort', Math.max(0, Math.ceil(S.fortHp)) + '/' + S.fortMax);
    setHud('wave', String(S.wave));
    if (sellButton) {
      const label = S.jars > 0 ? 'Sell ' + S.jars + ' × $' + jarPrice() : 'Sell $' + jarPrice();
      if (sellButton.textContent !== label) sellButton.textContent = label;
      sellButton.disabled = S.jars === 0;
    }
    if (shop) {
      UPGRADES.forEach((u, i) => {
        const btn = shopButtons[i];
        if (!btn) return;
        const cost = upgradeCost(u);
        const label = u.name + ' ' + (S.levels[u.key] + 1) + ' · $' + cost;
        if (btn.textContent !== label) btn.textContent = label;
        btn.disabled = S.cash < cost;
      });
    }
  }

  // --------------------------------------------------------------- shop
  const shopButtons = [];
  if (shop) {
    UPGRADES.forEach((u, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'game-chip';
      btn.title = u.hint + ' (' + (i + 1) + ')';
      btn.addEventListener('click', () => { buy(u); display.focus({ preventScroll: true }); });
      shop.appendChild(btn);
      shopButtons.push(btn);
    });
  }
  function buy(u) {
    if (!running || over) return;
    const cost = upgradeCost(u);
    if (S.cash < cost) { sfx.deny(); return; }
    S.cash -= cost;
    S.levels[u.key] += 1;
    if (u.key === 'walls') {
      S.fortMax += 80;
      S.fortHp = S.fortMax;
    }
    if (u.key === 'rim') S.jarX = clamp(S.jarX, jarWidth() / 2, W - jarWidth() / 2);
    sfx.buy();
    updateHud();
  }
  function sell() {
    if (!running || over || S.jars === 0) { if (running && !over) sfx.deny(); return; }
    const gain = S.jars * jarPrice();
    S.cash += gain;
    S.earned += gain;
    S.jars = 0;
    sfx.sell();
    burst(W / 2, groundY - 60, '#f2f2f2', 14);
    updateHud();
  }
  if (sellButton) sellButton.addEventListener('click', () => { sell(); display.focus({ preventScroll: true }); });

  // ------------------------------------------------------------ enemies
  function spawnEnemy() {
    const key = pickType(S.wave);
    const t = ENEMY_TYPES[key];
    const fromLeft = Math.random() < 0.5;
    const scale = 1 + (S.wave - 1) * 0.16;
    S.enemies.push({
      type: key,
      x: fromLeft ? -16 : W + 16,
      dir: fromLeft ? 1 : -1,
      hp: t.hp * scale,
      maxHp: t.hp * scale,
      speed: t.speed * (1 + (S.wave - 1) * 0.03),
      damage: t.damage,
      colour: t.colour,
      tell: t.tell,
      attackT: rand(0, 0.6),
      step: Math.random() * TAU,
      hurt: 0,
    });
  }
  function burst(x, y, colour, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const sp = rand(40, 160);
      S.bursts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, life: rand(0.3, 0.7), colour, glyph: pickGlyph() });
    }
  }
  function damageEnemy(e, amount) {
    e.hp -= amount;
    e.hurt = 0.12;
    if (e.hp <= 0) {
      burst(e.x, groundY - 14, '#f2f2f2', 8);
      const idx = S.enemies.indexOf(e);
      if (idx >= 0) S.enemies.splice(idx, 1);
    }
  }
  function throwJar(tx) {
    if (!running || over) return;
    if (S.jars === 0) { sfx.deny(); return; }
    S.jars -= 1;
    const x0 = W / 2;
    const y0 = groundY - 70;
    const dx = tx - x0;
    const flight = clamp(Math.abs(dx) / 420, 0.35, 0.9);
    S.throws.push({ x: x0, y: y0, vx: dx / flight, vy: -(groundY - 6 - y0) / flight - 0.5 * 900 * flight, t: 0, flight });
    sfx.shot();
    updateHud();
  }

  // -------------------------------------------------------------- step
  function step(dt) {
    // Jar rail
    const half = jarWidth() / 2;
    S.jarTarget = clamp(S.jarTarget, half, W - half);
    if (keys.left) S.jarTarget -= 420 * dt;
    if (keys.right) S.jarTarget += 420 * dt;
    S.jarTarget = clamp(S.jarTarget, half, W - half);
    S.jarX += (S.jarTarget - S.jarX) * Math.min(1, dt * 18);

    // Rain — falls, and the jar takes whatever crosses the rail under it.
    const stepMul = dt * 60;
    const density = 1 + S.levels.cloud * 0.25;
    const resetChance = 1 - Math.exp(-1.5 * density * dt);
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i];
      const x = i * FONT_SIZE;
      const prevY = col.y;
      col.y += col.speed * FONT_SIZE * 0.6 * stepMul * (1 + S.levels.cloud * 0.08);
      col.swapT -= dt;
      if (col.swapT <= 0) { col.glyph = pickGlyph(); col.swapT = 0.08 + Math.random() * 0.3; }
      if (!col.dead && prevY < railY && col.y >= railY) {
        const cx = x + FONT_SIZE / 2;
        if (cx > S.jarX - half && cx < S.jarX + half && S.fill < JAR_CAPACITY) {
          S.fill += col.ink.value;
          S.fillInks.push(col.ink.fill);
          col.dead = true; // caught: the column stops painting until it resets
          sfx.catchDrop(col.ink);
          S.bursts.push({ x: cx, y: railY, vx: rand(-30, 30), vy: -60, life: 0.25, colour: col.ink.fill, glyph: col.glyph });
          if (S.fill >= JAR_CAPACITY) {
            S.jars += 1;
            S.fill = 0;
            S.fillInks = [];
            sfx.jarFull();
            burst(S.jarX, railY, '#f2f2f2', 10);
          }
        }
      }
      if (col.y > H + FONT_SIZE * 2 && Math.random() < resetChance) {
        col.y = rand(-H * 0.5, -FONT_SIZE);
        col.speed = rand(SPEED_MIN, SPEED_MAX);
        col.ink = pickInk(S.levels.cloud);
        col.dead = false;
      }
    }

    // Waves
    S.waveT += dt;
    if (S.waveT >= WAVE_SECONDS) { S.waveT = 0; S.wave += 1; }
    S.spawnT -= dt;
    if (S.spawnT <= 0) {
      spawnEnemy();
      S.spawnT = Math.max(0.55, 3.2 - S.wave * 0.28) * rand(0.7, 1.3);
    }

    // Hordes walk in and hit the walls.
    for (let i = S.enemies.length - 1; i >= 0; i--) {
      const e = S.enemies[i];
      e.hurt = Math.max(0, e.hurt - dt);
      const reach = e.dir > 0 ? fortLeft() - 8 : fortRight() + 8;
      const arrived = e.dir > 0 ? e.x >= reach : e.x <= reach;
      if (!arrived) {
        e.x += e.dir * e.speed * dt;
        e.step += dt * 9;
      } else {
        e.attackT -= dt;
        if (e.attackT <= 0) {
          e.attackT = 0.8;
          S.fortHp -= e.damage;
          S.shake = 0.18;
          sfx.hit();
          if (S.fortHp <= 0) { gameOver(); return; }
        }
      }
    }

    // Turret on the fort roof: one shot per interval at the nearest walker.
    const rate = 1.1 / (1 + S.levels.turret * 0.6);
    const dmg = 10 + S.levels.turret * 9;
    S.turretT -= dt;
    if (S.turretT <= 0 && S.enemies.length) {
      S.turretT = rate;
      let best = null, bestD = Infinity;
      for (const e of S.enemies) {
        const d = Math.abs(e.x - W / 2);
        if (d < bestD) { bestD = d; best = e; }
      }
      if (best) {
        S.shots.push({ x0: W / 2, y0: groundY - 84, x1: best.x, y1: groundY - 14, life: 0.08 });
        damageEnemy(best, dmg);
        sfx.shot();
      }
    }
    for (let i = S.shots.length - 1; i >= 0; i--) {
      S.shots[i].life -= dt;
      if (S.shots[i].life <= 0) S.shots.splice(i, 1);
    }

    // Thrown jars: an arc, then a smash that hurts everything near it.
    for (let i = S.throws.length - 1; i >= 0; i--) {
      const j = S.throws[i];
      j.t += dt;
      j.x += j.vx * dt;
      j.vy += 900 * dt;
      j.y += j.vy * dt;
      if (j.y >= groundY - 6) {
        S.throws.splice(i, 1);
        sfx.smash();
        S.shake = 0.12;
        burst(j.x, groundY - 8, '#8c03fc', 18);
        for (let k = S.enemies.length - 1; k >= 0; k--) {
          const e = S.enemies[k];
          if (Math.abs(e.x - j.x) < THROW_RADIUS) damageEnemy(e, THROW_DAMAGE);
        }
      }
    }

    // Debris
    for (let i = S.bursts.length - 1; i >= 0; i--) {
      const b = S.bursts[i];
      b.life -= dt;
      b.x += b.vx * dt;
      b.vy += 500 * dt;
      b.y += b.vy * dt;
      if (b.life <= 0) S.bursts.splice(i, 1);
    }
    S.shake = Math.max(0, S.shake - dt);
    updateHud();
  }

  // -------------------------------------------------------------- draw
  function drawRain(dt) {
    const fadeAlpha = Math.min(1, FADE_ALPHA_PER_SEC * dt);
    rctx.fillStyle = 'rgba(10, 10, 10, ' + fadeAlpha.toFixed(3) + ')';
    rctx.fillRect(0, 0, W, H);
    rctx.font = FONT_SIZE + 'px "IBM Plex Mono", monospace';
    rctx.textBaseline = 'top';
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i];
      if (col.dead) continue;
      const x = i * FONT_SIZE;
      rctx.fillStyle = col.ink.head;
      rctx.fillText(col.glyph, x, col.y);
      rctx.fillStyle = col.ink.tail;
      rctx.fillText(col.glyph, x, col.y - FONT_SIZE);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(rainCanvas, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function drawGround() {
    ctx.fillStyle = '#0e0e0e';
    ctx.fillRect(0, groundY, W, H - groundY);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(0, groundY, W, 1);
    // rail
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(0, railY + JAR_HEIGHT * 0.5, W, 1);
  }

  function drawFort() {
    const x = fortLeft();
    const top = groundY - 78;
    const hpFrac = clamp(S.fortHp / S.fortMax, 0, 1);
    const shakeX = S.shake > 0 ? Math.sin(S.shake * 90) * 3 : 0;
    ctx.save();
    ctx.translate(shakeX, 0);
    // body
    ctx.fillStyle = '#171717';
    ctx.fillRect(x, top, FORT_W, groundY - top);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, top + 0.5, FORT_W - 1, groundY - top - 1);
    // brick courses — one more course per Walls level
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    const courses = 4 + S.levels.walls;
    for (let c = 1; c < courses; c++) {
      const yy = top + ((groundY - top) * c) / courses;
      ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + FORT_W, yy); ctx.stroke();
    }
    // crenellations
    ctx.fillStyle = '#171717';
    for (let c = 0; c < 6; c++) {
      if (c % 2) continue;
      ctx.fillRect(x + c * (FORT_W / 6), top - 10, FORT_W / 6, 10);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.strokeRect(x + c * (FORT_W / 6) + 0.5, top - 9.5, FORT_W / 6 - 1, 10);
    }
    // gate
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(W / 2 - 12, groundY - 30, 24, 30);
    // turret
    const ty = top - 10;
    ctx.fillStyle = '#8c03fc';
    ctx.fillRect(W / 2 - 6 - S.levels.turret, ty - 8, 12 + S.levels.turret * 2, 8);
    ctx.fillStyle = '#f2f2f2';
    ctx.fillRect(W / 2 - 1, ty - 16, 2, 8);
    // hp bar
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(x, top - 26, FORT_W, 4);
    ctx.fillStyle = hpFrac > 0.35 ? '#14c85a' : '#ff9b3d';
    ctx.fillRect(x, top - 26, FORT_W * hpFrac, 4);
    ctx.restore();
  }

  function drawJar() {
    const w = jarWidth();
    const x = S.jarX - w / 2;
    const y = railY - JAR_HEIGHT * 0.5;
    const frac = clamp(S.fill / JAR_CAPACITY, 0, 1);
    // liquid: banded by what was caught, bottom up
    const inner = { x: x + 3, y: y + 3, w: w - 6, h: JAR_HEIGHT - 6 };
    const liquidH = inner.h * frac;
    if (S.fillInks.length) {
      const bandH = liquidH / S.fillInks.length;
      for (let i = 0; i < S.fillInks.length; i++) {
        ctx.fillStyle = S.fillInks[i];
        ctx.globalAlpha = 0.85;
        ctx.fillRect(inner.x, inner.y + inner.h - bandH * (i + 1), inner.w, bandH + 0.5);
      }
      ctx.globalAlpha = 1;
    }
    // glass
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + JAR_HEIGHT);
    ctx.lineTo(x + w, y + JAR_HEIGHT);
    ctx.lineTo(x + w, y);
    ctx.stroke();
    // rim
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillRect(x - 3, y - 2, w + 6, 3);
    // stored jars stack beside the fort gate
    const shown = Math.min(S.jars, 12);
    for (let i = 0; i < shown; i++) {
      const jx = fortRight() + 8 + (i % 6) * 12;
      const jy = groundY - 12 - Math.floor(i / 6) * 14;
      ctx.fillStyle = '#8c03fc';
      ctx.globalAlpha = 0.8;
      ctx.fillRect(jx, jy, 9, 11);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 1;
      ctx.strokeRect(jx + 0.5, jy + 0.5, 9, 11);
    }
  }

  function drawEnemy(e) {
    const y = groundY;
    const bob = Math.abs(Math.sin(e.step)) * 2;
    ctx.save();
    ctx.translate(e.x, y - bob);
    ctx.scale(e.dir, 1);
    if (e.hurt > 0) ctx.globalAlpha = 0.5;
    // legs
    ctx.fillStyle = e.colour;
    const stride = Math.sin(e.step) * 3;
    ctx.fillRect(-5 + stride, -10, 3, 10);
    ctx.fillRect(2 - stride, -10, 3, 10);
    // body
    ctx.fillRect(-6, -24, 12, 14);
    // shirt / tie
    ctx.fillStyle = '#f2f2f2';
    ctx.fillRect(-2, -24, 4, 9);
    if (e.tell === 'tie') { ctx.fillStyle = '#c0182f'; ctx.fillRect(-1, -23, 2, 8); }
    // head
    ctx.fillStyle = '#d9c2a8';
    ctx.fillRect(-4, -32, 8, 8);
    // tells
    ctx.fillStyle = '#f2f2f2';
    if (e.tell === 'headset') { ctx.fillRect(4, -30, 3, 2); ctx.fillStyle = '#111'; ctx.fillRect(-5, -33, 10, 2); }
    if (e.tell === 'cap') { ctx.fillStyle = '#0f120d'; ctx.fillRect(-5, -35, 10, 3); ctx.fillRect(-5, -33, 12, 1); ctx.fillStyle = '#ffd24a'; ctx.fillRect(-4, -22, 2, 2); ctx.fillRect(-1, -22, 2, 2); }
    if (e.tell === 'tophat') { ctx.fillStyle = '#0a0a0a'; ctx.fillRect(-4, -42, 8, 10); ctx.fillRect(-6, -33, 12, 2); ctx.fillStyle = '#ffd24a'; ctx.fillRect(2, -29, 2, 2); }
    ctx.restore();
    // hp pip
    if (e.hp < e.maxHp) {
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(e.x - 8, y - 46, 16, 2);
      ctx.fillStyle = '#ff9b3d';
      ctx.fillRect(e.x - 8, y - 46, 16 * clamp(e.hp / e.maxHp, 0, 1), 2);
    }
  }

  function drawFx() {
    ctx.lineWidth = 1;
    for (const s of S.shots) {
      ctx.strokeStyle = 'rgba(255,255,255,' + (s.life / 0.08).toFixed(2) + ')';
      ctx.beginPath(); ctx.moveTo(s.x0, s.y0); ctx.lineTo(s.x1, s.y1); ctx.stroke();
    }
    for (const j of S.throws) {
      ctx.fillStyle = '#8c03fc';
      ctx.fillRect(j.x - 4, j.y - 5, 8, 10);
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.strokeRect(j.x - 3.5, j.y - 4.5, 8, 10);
    }
    ctx.font = '12px "IBM Plex Mono", monospace';
    for (const b of S.bursts) {
      ctx.globalAlpha = clamp(b.life * 2, 0, 1);
      ctx.fillStyle = b.colour;
      ctx.fillText(b.glyph, b.x, b.y);
    }
    ctx.globalAlpha = 1;
  }

  function drawFrame(dt) {
    drawRain(dt);
    drawGround();
    drawFort();
    for (const e of S.enemies) drawEnemy(e);
    drawJar();
    drawFx();
  }

  // -------------------------------------------------------------- loop
  function frame() {
    if (!running || paused) { rafId = 0; return; }
    const t = performance.now();
    let dt = lastT ? (t - lastT) / 1000 : 1 / 60;
    if (!(dt > 0)) dt = 1 / 60;
    dt = Math.min(dt, 0.1);
    lastT = t;
    step(dt);
    if (!over) drawFrame(dt);
    rafId = requestAnimationFrame(frame);
  }
  function schedule() {
    if (!rafId) { lastT = 0; rafId = requestAnimationFrame(frame); }
  }

  // ---------------------------------------------------------- lifecycle
  const BEST_KEY = 'htg-jars-best';
  function readBest() { try { return JSON.parse(localStorage.getItem(BEST_KEY) || 'null'); } catch (e) { return null; } }
  function writeBest(b) { try { localStorage.setItem(BEST_KEY, JSON.stringify(b)); } catch (e) { /* private mode */ } }

  function showOverlay(title, text, button) {
    if (overlayTitle) overlayTitle.textContent = title;
    if (overlayText) overlayText.textContent = text;
    if (playButton) playButton.textContent = button;
    if (overlay) overlay.hidden = false;
  }
  function start() {
    ensureAudio();
    if (audio && audio.state === 'suspended') audio.resume().catch(() => {});
    if (shop) shop.hidden = false;
    if (sellButton) sellButton.hidden = false;
    reset();
    updateHud();  // labels first: the shop row wraps on a phone and resize() measures it
    resize();
    over = false;
    running = true;
    paused = false;
    if (overlay) overlay.hidden = true;
    if (keysNote) keysNote.hidden = true;
    display.classList.add('is-playing');
    document.body.classList.add('game-active');
    updateHud();
    display.focus({ preventScroll: true });
    schedule();
  }
  function pause() {
    if (!running || paused || over) return;
    paused = true;
    showOverlay('PAUSED', 'Wave ' + S.wave + ' · $' + S.cash, 'Resume');
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
    if (sellButton) sellButton.hidden = true;
    const best = readBest();
    const mine = { wave: S.wave, earned: S.earned };
    const isBest = !best || mine.wave > best.wave || (mine.wave === best.wave && mine.earned > best.earned);
    if (isBest) writeBest(mine);
    const bestLine = best && !isBest ? ' · Best wave ' + best.wave + ', $' + best.earned : (isBest && best ? ' · New best' : '');
    showOverlay('THE FORT FELL', 'Wave ' + S.wave + ' · $' + S.earned + ' earned' + bestLine, 'Again');
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
  const keys = { left: false, right: false };
  display.tabIndex = 0;
  const pointerX = (ev) => {
    const r = display.getBoundingClientRect();
    return (ev.clientX - r.left) * (W / r.width);
  };
  display.addEventListener('pointermove', (ev) => {
    if (!running || paused) return;
    S.jarTarget = pointerX(ev);
  }, { passive: true });
  display.addEventListener('pointerdown', (ev) => {
    if (!running || paused) return;
    ev.preventDefault();
    S.jarTarget = pointerX(ev);
    // A tap on the horde lane throws a jar there; a tap on the rain just moves the jar.
    const r = display.getBoundingClientRect();
    const y = (ev.clientY - r.top) * (H / r.height);
    if (y > railY + JAR_HEIGHT) throwJar(pointerX(ev));
  });
  window.addEventListener('keydown', (ev) => {
    const el = ev.target;
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
    if (ev.code === 'Escape') { if (paused) resume(); else pause(); return; }
    if (!running) return;
    if (ev.code === 'ArrowLeft' || ev.code === 'KeyA') { keys.left = true; ev.preventDefault(); }
    if (ev.code === 'ArrowRight' || ev.code === 'KeyD') { keys.right = true; ev.preventDefault(); }
    if (ev.code === 'Space' || ev.code === 'KeyS') { sell(); ev.preventDefault(); }
    if (ev.code === 'KeyF') { throwJar(S.jarX); }
    const n = parseInt(ev.key, 10);
    if (n >= 1 && n <= UPGRADES.length) buy(UPGRADES[n - 1]);
  });
  window.addEventListener('keyup', (ev) => {
    if (ev.code === 'ArrowLeft' || ev.code === 'KeyA') keys.left = false;
    if (ev.code === 'ArrowRight' || ev.code === 'KeyD') keys.right = false;
  });

  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (!en.isIntersecting) pause(); });
    }, { threshold: 0.2 }).observe(stage);
  }

  resize();
  reset();
  drawFrame(1 / 60);
})();
