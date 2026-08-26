/*
  ABRAXAS // SUIT PURGE
  Original raycaster. No engine, no libraries, no external assets.
  Walls, sprites and sounds are all generated in code at runtime.
*/
(function () {
  'use strict';

  const display = document.getElementById('gameCanvas');
  if (!display || !display.getContext) return;

  const TAU = Math.PI * 2;
  const TEX = 64;
  const SPR = 64;
  const WORLD_H = 200;

  // ---------------------------------------------------------------- map

  const MAP_SRC = [
    '########################',
    '#......................#',
    '#..####..........####..#',
    '#..#..#..........#..#..#',
    '#.....#..######..#.....#',
    '#..##....#....#....##..#',
    '#..##....#....#....##..#',
    '#........#....#........#',
    '#..####..#....#..####..#',
    '#..#..#..###.##..#..#..#',
    '#..#................#..#',
    '#..#..#..........#..#..#',
    '#..####..######..####..#',
    '#......................#',
    '#..####..######..####..#',
    '#..#..#..........#..#..#',
    '#..#..#..######..#..#..#',
    '#..#..#..#....#..#..#..#',
    '#.....#..#....#..#.....#',
    '#..##....#....#....##..#',
    '#..##....###.##....##..#',
    '#......................#',
    '#......................#',
    '########################'
  ];

  const MAP_W = MAP_SRC[0].length;
  const MAP_H = MAP_SRC.length;
  const grid = new Uint8Array(MAP_W * MAP_H);

  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const ch = MAP_SRC[y][x];
      // Wall variant is derived from position so the maze is not one flat colour.
      grid[y * MAP_W + x] = ch === '#' ? 1 + ((x * 3 + y * 5) % 3) : 0;
    }
  }

  const cellAt = (x, y) => {
    const ix = x | 0;
    const iy = y | 0;
    if (ix < 0 || iy < 0 || ix >= MAP_W || iy >= MAP_H) return 1;
    return grid[iy * MAP_W + ix];
  };

  const isWall = (x, y) => cellAt(x, y) !== 0;

  const hasLineOfSight = (x0, y0, x1, y1) => {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const steps = Math.ceil(Math.hypot(dx, dy) * 8);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (isWall(x0 + dx * t, y0 + dy * t)) return false;
    }
    return true;
  };

  // ----------------------------------------------------------- textures

  const clamp255 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);

  const makeTexture = (fn) => {
    const data = new Uint8ClampedArray(TEX * TEX * 4);
    for (let y = 0; y < TEX; y++) {
      for (let x = 0; x < TEX; x++) {
        const rgb = fn(x, y);
        const i = (y * TEX + x) * 4;
        data[i] = clamp255(rgb[0]);
        data[i + 1] = clamp255(rgb[1]);
        data[i + 2] = clamp255(rgb[2]);
        data[i + 3] = 255;
      }
    }
    return data;
  };

  const noise = (x, y, spread) => (((x * 73856093) ^ (y * 19349663)) % spread) - spread / 2;

  const textures = [
    null,
    // Purple brick.
    makeTexture((x, y) => {
      const row = (y / 16) | 0;
      const bx = (x + (row % 2) * 16) % 32;
      const by = y % 16;
      const n = noise(x, y, 14);
      if (bx < 2 || by < 2) return [30 + n, 12 + n, 44 + n];
      return [74 + n, 32 + n, 104 + n];
    }),
    // Panelled wall with an accent band.
    makeTexture((x, y) => {
      const n = noise(x, y, 10);
      if (y > 28 && y < 34) return [140 + n, 20 + n, 240 + n];
      if (x % 16 < 2) return [24 + n, 10 + n, 36 + n];
      return [46 + n, 24 + n, 66 + n];
    }),
    // Pitted concrete.
    makeTexture((x, y) => {
      const n = noise(x, y, 22);
      const band = ((y / 8) | 0) % 2 === 0 ? 6 : 0;
      return [58 + n + band, 44 + n + band, 72 + n + band];
    })
  ];

  // ------------------------------------------------------------ sprites

  const spriteCanvas = document.createElement('canvas');
  spriteCanvas.width = SPR;
  spriteCanvas.height = SPR;
  const sctx = spriteCanvas.getContext('2d', { willReadFrequently: true });

  const shade = (hex, amount) => {
    const n = parseInt(hex.slice(1), 16);
    return 'rgb(' + clamp255(((n >> 16) & 255) + amount) + ',' +
      clamp255(((n >> 8) & 255) + amount) + ',' +
      clamp255((n & 255) + amount) + ')';
  };

  const makeSprite = (draw) => {
    sctx.clearRect(0, 0, SPR, SPR);
    draw(sctx);
    return sctx.getImageData(0, 0, SPR, SPR).data;
  };

  /*
    Four archetypes of the ruling class, all of them invented. Each is a class
    caricature built from costume - no real person, no name, no likeness, no
    resemblance to any specific figure living or dead. They are told apart by
    silhouette first, because at this resolution the outline is all you get:
    bare head, headset, top hat, peaked cap.
  */

  const drawLegs = (ctx, colour, shoe, stride) => {
    ctx.fillStyle = colour;
    ctx.fillRect(26 - stride, 43, 6, 17);
    ctx.fillRect(32 + stride, 43, 6, 17);
    ctx.fillStyle = shoe;
    ctx.fillRect(24 - stride, 59, 9, 4);
    ctx.fillRect(31 + stride, 59, 9, 4);
  };

  const drawFace = (ctx, skin, radius) => {
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(32, 14, radius, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#15100f';
    ctx.fillRect(28, 15, 2, 2);
    ctx.fillRect(34, 15, 2, 2);
    ctx.fillRect(30, 19, 4, 1);
  };

  // 1. The politician - suit, tie, lapel rosette, briefcase.
  const drawPolitician = (ctx, pose) => {
    const stride = pose === 'walk1' ? 4 : 1;
    const armOut = pose === 'attack' ? 7 : 0;
    const suit = '#232742';

    drawLegs(ctx, shade(suit, -16), '#0b0b0d', stride);

    ctx.fillStyle = suit;
    ctx.fillRect(22, 21, 20, 24);
    ctx.fillStyle = '#f0efe9';
    ctx.fillRect(28, 21, 8, 17);
    ctx.fillStyle = shade(suit, 14);
    ctx.beginPath();
    ctx.moveTo(28, 21); ctx.lineTo(24, 21); ctx.lineTo(28, 38); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(36, 21); ctx.lineTo(40, 21); ctx.lineTo(36, 38); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(31, 22, 3, 15);

    // Campaign rosette.
    ctx.beginPath();
    ctx.arc(26, 26, 2.4, 0, TAU);
    ctx.fill();

    ctx.fillStyle = shade(suit, 8);
    ctx.fillRect(18 - armOut, 23, 5, 16);
    ctx.fillRect(41 + armOut, 23, 5, 16);
    ctx.fillStyle = '#d9a066';
    ctx.fillRect(18 - armOut, 39, 5, 4);
    ctx.fillRect(41 + armOut, 39, 5, 4);

    // Briefcase.
    ctx.fillStyle = '#3b2416';
    ctx.fillRect(13 - armOut, 43, 11, 8);
    ctx.fillStyle = '#1d110a';
    ctx.fillRect(13 - armOut, 46, 11, 1);

    drawFace(ctx, '#d9a066', 7.5);
    ctx.fillStyle = '#2b2b2b';
    ctx.beginPath();
    ctx.arc(32, 13, 7.5, Math.PI, TAU);
    ctx.fill();
    ctx.fillRect(24.5, 12, 15, 2);
  };

  // 2. The billionaire - gilet over a tee, jeans, headset, glowing phone.
  const drawBillionaire = (ctx, pose) => {
    const stride = pose === 'walk1' ? 4 : 1;
    const armOut = pose === 'attack' ? 7 : 0;

    drawLegs(ctx, '#3b4a63', '#9aa0a6', stride);

    // Pale tee, then the vest over the top of it.
    ctx.fillStyle = '#cfd3d8';
    ctx.fillRect(22, 21, 20, 24);
    ctx.fillStyle = '#2b3b34';
    ctx.fillRect(22, 21, 7, 24);
    ctx.fillRect(35, 21, 7, 24);
    ctx.fillStyle = shade('#2b3b34', -14);
    ctx.fillRect(22, 21, 20, 2);

    ctx.fillStyle = '#cfd3d8';
    ctx.fillRect(18 - armOut, 23, 5, 16);
    ctx.fillRect(41 + armOut, 23, 5, 16);
    ctx.fillStyle = '#e2b184';
    ctx.fillRect(18 - armOut, 39, 5, 4);
    ctx.fillRect(41 + armOut, 39, 5, 4);

    // Phone, screen-side out.
    ctx.fillStyle = '#101014';
    ctx.fillRect(15 - armOut, 41, 7, 11);
    ctx.fillStyle = '#7fe4ff';
    ctx.fillRect(16 - armOut, 42, 5, 8);

    drawFace(ctx, '#e2b184', 7.5);
    /*
      Bald, so the silhouette reads apart from the politician's full head of
      hair. The headset is a thin arc clear of the skull plus one earpiece and
      a boom - drawn as a filled band it turned into a dark helmet blob.
    */
    ctx.strokeStyle = '#1b1b1f';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(32, 14, 8.5, Math.PI * 1.12, Math.PI * 1.88);
    ctx.stroke();
    ctx.fillStyle = '#1b1b1f';
    ctx.fillRect(23, 13, 3, 4);
    ctx.beginPath();
    ctx.moveTo(24, 17);
    ctx.lineTo(29, 20);
    ctx.lineTo(29, 21);
    ctx.lineTo(24, 18);
    ctx.closePath();
    ctx.fill();
  };

  // 3. The trillionaire - top hat, tailcoat, monocle, cigar, money bag.
  const drawTrillionaire = (ctx, pose) => {
    const stride = pose === 'walk1' ? 3 : 1;
    const armOut = pose === 'attack' ? 6 : 0;
    const coat = '#141319';

    drawLegs(ctx, '#22212a', '#08080a', stride);

    // Bulkier body than the rest.
    ctx.fillStyle = coat;
    ctx.fillRect(19, 20, 26, 26);
    // Coat tails.
    ctx.beginPath();
    ctx.moveTo(19, 44); ctx.lineTo(24, 44); ctx.lineTo(21, 56); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(45, 44); ctx.lineTo(40, 44); ctx.lineTo(43, 56); ctx.closePath(); ctx.fill();

    // Shirt front and bow tie.
    ctx.fillStyle = '#f2efe6';
    ctx.fillRect(28, 20, 8, 16);
    ctx.fillStyle = '#8a0f1c';
    ctx.fillRect(29, 21, 3, 3);
    ctx.fillRect(33, 21, 3, 3);

    // Watch chain.
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(27, 32, 10, 1);

    ctx.fillStyle = shade(coat, 12);
    ctx.fillRect(15 - armOut, 22, 5, 17);
    ctx.fillRect(45 + armOut, 22, 5, 17);
    ctx.fillStyle = '#c98d5a';
    ctx.fillRect(15 - armOut, 39, 5, 4);
    ctx.fillRect(45 + armOut, 39, 5, 4);

    // Money bag.
    ctx.fillStyle = '#c8b48a';
    ctx.beginPath();
    ctx.arc(15 - armOut, 48, 6, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#6b5a3a';
    ctx.fillRect(12 - armOut, 42, 7, 2);

    drawFace(ctx, '#c98d5a', 7.5);
    // Monocle.
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(34, 16, 3.2, 0, TAU);
    ctx.stroke();
    // Cigar with an ember.
    ctx.fillStyle = '#4a3524';
    ctx.fillRect(36, 19, 7, 2);
    ctx.fillStyle = '#ff7a2f';
    ctx.fillRect(43, 19, 2, 2);
    // Top hat - the silhouette that sells it.
    ctx.fillStyle = '#0a0a0c';
    ctx.fillRect(21, 7, 22, 3);
    ctx.fillRect(25, 0, 14, 8);
    ctx.fillStyle = '#5c1020';
    ctx.fillRect(25, 5, 14, 2);
  };

  // 4. High command - peaked cap, epaulettes, medal rack, sash.
  const drawBrass = (ctx, pose) => {
    const stride = pose === 'walk1' ? 4 : 1;
    const armOut = pose === 'attack' ? 7 : 0;
    const dress = '#2f3a2c';

    drawLegs(ctx, shade(dress, -14), '#0a0a0a', stride);

    ctx.fillStyle = dress;
    ctx.fillRect(22, 21, 20, 24);
    ctx.fillStyle = shade(dress, -20);
    ctx.fillRect(22, 21, 20, 2);

    // Sash.
    ctx.fillStyle = '#8a1230';
    ctx.beginPath();
    ctx.moveTo(23, 22); ctx.lineTo(27, 22); ctx.lineTo(41, 44); ctx.lineTo(37, 44);
    ctx.closePath();
    ctx.fill();

    // Medal rack.
    const medals = ['#d4af37', '#c0392b', '#2f6fb0', '#3f9d5a'];
    for (let i = 0; i < medals.length; i++) {
      ctx.fillStyle = medals[i];
      ctx.fillRect(24 + (i % 2) * 4, 26 + ((i / 2) | 0) * 3, 3, 2);
    }

    ctx.fillStyle = shade(dress, 10);
    ctx.fillRect(18 - armOut, 23, 5, 16);
    ctx.fillRect(41 + armOut, 23, 5, 16);
    ctx.fillStyle = '#a9744a';
    ctx.fillRect(18 - armOut, 39, 5, 4);
    ctx.fillRect(41 + armOut, 39, 5, 4);

    // Epaulettes.
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(19 - armOut, 21, 6, 3);
    ctx.fillRect(39 + armOut, 21, 6, 3);

    drawFace(ctx, '#a9744a', 7.5);
    // Peaked cap.
    ctx.fillStyle = '#26301f';
    ctx.fillRect(24, 6, 16, 6);
    ctx.fillStyle = '#16180f';
    ctx.fillRect(22, 12, 20, 2);
    ctx.fillStyle = '#d4af37';
    ctx.fillRect(30, 7, 4, 3);
  };

  const drawFallen = (ctx, draw, progress) => {
    ctx.save();
    ctx.translate(32, 58);
    ctx.rotate((Math.PI / 2) * progress);
    ctx.translate(-32, -58);
    ctx.globalAlpha = 1 - progress * 0.35;
    ctx.translate(0, 12 * progress);
    draw(ctx, 'walk0');
    ctx.restore();
  };

  const TYPES = [
    { id: 'politician', label: 'Politician', hp: 100, speed: 1, draw: drawPolitician },
    { id: 'billionaire', label: 'Billionaire', hp: 80, speed: 1.35, draw: drawBillionaire },
    { id: 'trillionaire', label: 'Trillionaire', hp: 220, speed: 0.68, draw: drawTrillionaire },
    { id: 'brass', label: 'High Command', hp: 140, speed: 0.95, draw: drawBrass }
  ];

  const enemyFrames = TYPES.map((type) => ({
    walk: [
      makeSprite((ctx) => type.draw(ctx, 'walk0')),
      makeSprite((ctx) => type.draw(ctx, 'walk1'))
    ],
    attack: makeSprite((ctx) => type.draw(ctx, 'attack')),
    die: [0.34, 0.67, 1].map((p) => makeSprite((ctx) => drawFallen(ctx, type.draw, p)))
  }));

  // Later waves bring out the heavier end of the roster.
  const pickType = (wave) => {
    const pool = [0, 0, 1];
    if (wave >= 2) pool.push(3);
    if (wave >= 3) pool.push(2, 0);
    if (wave >= 4) pool.push(1, 3, 2);
    return pool[(Math.random() * pool.length) | 0];
  };

  // Weapon sprite. Square, with every part inside the box at full recoil.
  const GUN_W = 64;
  const GUN_H = 64;
  const gunCanvas = document.createElement('canvas');
  gunCanvas.width = GUN_W;
  gunCanvas.height = GUN_H;
  const gctx = gunCanvas.getContext('2d', { willReadFrequently: true });

  const makeGun = (recoil) => {
    gctx.clearRect(0, 0, GUN_W, GUN_H);
    const y = recoil * 3;
    const cx = 32;

    // Barrel.
    gctx.fillStyle = '#26262c';
    gctx.fillRect(cx - 6, 6 + y, 12, 24);
    gctx.fillStyle = '#3d3d46';
    gctx.fillRect(cx - 4, 6 + y, 3, 24);
    gctx.fillStyle = '#131317';
    gctx.fillRect(cx - 7, 6 + y, 2, 24);

    // Receiver, with the site's accent as a heat strip.
    gctx.fillStyle = '#232329';
    gctx.fillRect(cx - 11, 30 + y, 22, 14);
    gctx.fillStyle = '#ffffff';
    gctx.fillRect(cx - 9, 33 + y, 18, 2);

    // Grip.
    gctx.fillStyle = '#1a1a1f';
    gctx.fillRect(cx - 7, 44 + y, 14, 18);

    // Hands wrapped around the grip.
    gctx.fillStyle = '#c98d5a';
    gctx.fillRect(cx - 16, 46 + y, 10, 14);
    gctx.fillRect(cx + 6, 46 + y, 10, 14);
    gctx.fillStyle = '#a5713f';
    gctx.fillRect(cx - 16, 46 + y, 10, 3);
    gctx.fillRect(cx + 6, 46 + y, 10, 3);
    return gctx.getImageData(0, 0, GUN_W, GUN_H).data;
  };

  const gunFrames = [makeGun(0), makeGun(1)];

  // ---------------------------------------------------------------- audio

  let audio = null;
  let muted = false;

  const initAudio = () => {
    if (audio) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    try {
      audio = new Ctx();
    } catch (err) {
      audio = null;
    }
  };

  const blip = (type, freq, duration, gainValue) => {
    if (!audio || muted) return;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audio.currentTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(freq * 0.25, 40), audio.currentTime + duration);
    gain.gain.setValueAtTime(gainValue, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration);
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + duration);
  };

  const sfx = {
    shoot: () => blip('square', 320, 0.12, 0.16),
    hit: () => blip('triangle', 180, 0.16, 0.14),
    hurt: () => blip('sawtooth', 130, 0.24, 0.16),
    empty: () => blip('sine', 90, 0.08, 0.07),
    pickup: () => blip('sine', 620, 0.18, 0.12)
  };

  // ----------------------------------------------------------- game state

  // West end of the open bottom corridor, looking east down its full length,
  // so the first frame shows depth rather than a wall two feet away.
  const START = { x: 2.5, y: 21.5, dirX: 1, dirY: 0, planeX: 0, planeY: 0.66 };
  const SPAWNS = [
    [11.5, 2.5], [18.5, 3.5], [4.5, 7.5], [19.5, 7.5], [11.5, 10.5],
    [3.5, 13.5], [11.5, 13.5], [20.5, 13.5], [11.5, 18.5], [7.5, 18.5],
    [19.5, 22.5], [7.5, 21.5]
  ];

  const state = {
    running: false,
    over: false,
    wave: 1,
    kills: 0,
    health: 100,
    ammo: 60,
    posX: START.x,
    posY: START.y,
    dirX: START.dirX,
    dirY: START.dirY,
    planeX: START.planeX,
    planeY: START.planeY,
    bob: 0,
    fireCooldown: 0,
    muzzle: 0,
    hurtFlash: 0,
    enemies: [],
    pickups: []
  };

  const spawnWave = () => {
    state.enemies = [];
    state.pickups = [];
    const count = Math.min(3 + state.wave * 2, SPAWNS.length);
    const speed = 0.9 + state.wave * 0.12;
    const shuffled = SPAWNS.slice().sort(() => Math.random() - 0.5);

    for (let i = 0; i < count; i++) {
      const spot = shuffled[i];
      const typeIndex = pickType(state.wave);
      const type = TYPES[typeIndex];
      state.enemies.push({
        x: spot[0],
        y: spot[1],
        type: typeIndex,
        hp: type.hp,
        speed: Math.min(speed * type.speed, 2.1),
        alive: true,
        dying: 0,
        dead: false,
        anim: Math.random() * TAU,
        attackT: 0,
        hitT: 0,
        sideT: 0,
        sideDir: 1
      });
    }

    // Two ammo crates per wave, on spawn points nobody occupies.
    for (let i = count; i < Math.min(count + 2, shuffled.length); i++) {
      state.pickups.push({ x: shuffled[i][0], y: shuffled[i][1], taken: false });
    }
  };

  const resetGame = () => {
    state.over = false;
    state.wave = 1;
    state.kills = 0;
    state.health = 100;
    state.ammo = 60;
    state.posX = START.x;
    state.posY = START.y;
    state.dirX = START.dirX;
    state.dirY = START.dirY;
    state.planeX = START.planeX;
    state.planeY = START.planeY;
    state.hurtFlash = 0;
    spawnWave();
  };

  // ---------------------------------------------------------------- input

  const keys = Object.create(null);
  const KEY_MAP = {
    KeyW: 'up', ArrowUp: 'up',
    KeyS: 'down', ArrowDown: 'down',
    KeyA: 'strafeLeft', KeyD: 'strafeRight',
    ArrowLeft: 'turnLeft', ArrowRight: 'turnRight',
    KeyQ: 'turnLeft', KeyE: 'turnRight',
    Space: 'fire', ShiftLeft: 'run', ShiftRight: 'run'
  };

  let mouseTurn = 0;
  let pointerLocked = false;

  const touch = {
    moveId: null, moveX: 0, moveY: 0, moveDX: 0, moveDY: 0,
    lookId: null, lookX: 0, lookDX: 0
  };

  window.addEventListener('keydown', (event) => {
    const action = KEY_MAP[event.code];
    if (!action || !state.running) return;
    keys[action] = true;
    if (event.code === 'Space') {
      event.preventDefault();
      // Edge-triggered so a quick tap always registers, not just a held key.
      fire();
    }
  });

  window.addEventListener('keyup', (event) => {
    const action = KEY_MAP[event.code];
    if (action) keys[action] = false;
  });

  display.addEventListener('click', () => {
    if (!state.running) return;
    if (!pointerLocked && window.matchMedia('(pointer: fine)').matches && display.requestPointerLock) {
      display.requestPointerLock();
      return;
    }
    fire();
  });

  document.addEventListener('pointerlockchange', () => {
    pointerLocked = document.pointerLockElement === display;
  });

  window.addEventListener('mousemove', (event) => {
    if (pointerLocked && state.running) mouseTurn += event.movementX * 0.0022;
  });

  const touchStart = (event) => {
    if (!state.running) return;
    const rect = display.getBoundingClientRect();
    for (const t of event.changedTouches) {
      const local = t.clientX - rect.left;
      if (local < rect.width * 0.5 && touch.moveId === null) {
        touch.moveId = t.identifier;
        touch.moveX = t.clientX;
        touch.moveY = t.clientY;
      } else if (local >= rect.width * 0.5 && touch.lookId === null) {
        touch.lookId = t.identifier;
        touch.lookX = t.clientX;
      }
    }
    event.preventDefault();
  };

  const touchMove = (event) => {
    if (!state.running) return;
    for (const t of event.changedTouches) {
      if (t.identifier === touch.moveId) {
        touch.moveDX = Math.max(-1, Math.min(1, (t.clientX - touch.moveX) / 48));
        touch.moveDY = Math.max(-1, Math.min(1, (t.clientY - touch.moveY) / 48));
      } else if (t.identifier === touch.lookId) {
        touch.lookDX += (t.clientX - touch.lookX) * 0.006;
        touch.lookX = t.clientX;
      }
    }
    event.preventDefault();
  };

  const touchEnd = (event) => {
    for (const t of event.changedTouches) {
      if (t.identifier === touch.moveId) {
        touch.moveId = null;
        touch.moveDX = 0;
        touch.moveDY = 0;
      } else if (t.identifier === touch.lookId) {
        touch.lookId = null;
      }
    }
  };

  display.addEventListener('touchstart', touchStart, { passive: false });
  display.addEventListener('touchmove', touchMove, { passive: false });
  display.addEventListener('touchend', touchEnd);
  display.addEventListener('touchcancel', touchEnd);

  // ---------------------------------------------------------------- combat

  function fire() {
    if (!state.running || state.over || state.fireCooldown > 0) return;
    if (state.ammo <= 0) {
      state.fireCooldown = 0.3;
      sfx.empty();
      return;
    }

    state.ammo--;
    state.fireCooldown = 0.19;
    state.muzzle = 0.08;
    sfx.shoot();

    const facing = Math.atan2(state.dirY, state.dirX);
    let target = null;
    let targetDist = Infinity;

    for (const e of state.enemies) {
      if (!e.alive) continue;
      const dx = e.x - state.posX;
      const dy = e.y - state.posY;
      const dist = Math.hypot(dx, dy);
      let diff = Math.atan2(dy, dx) - facing;
      while (diff > Math.PI) diff -= TAU;
      while (diff < -Math.PI) diff += TAU;
      // Hit box narrows with distance, the way a real sight picture would.
      const tolerance = Math.atan2(0.42, Math.max(dist, 0.6));
      if (Math.abs(diff) < tolerance && dist < targetDist && hasLineOfSight(state.posX, state.posY, e.x, e.y)) {
        target = e;
        targetDist = dist;
      }
    }

    if (!target) return;
    target.hp -= 50;
    target.hitT = 0.12;
    if (target.hp <= 0) {
      target.alive = false;
      target.dying = 0.0001;
      state.kills++;
      sfx.hit();
    } else {
      sfx.hit();
    }
  }

  const tryMove = (nx, ny) => {
    const pad = 0.24;
    if (!isWall(nx + (nx > state.posX ? pad : -pad), state.posY)) state.posX = nx;
    if (!isWall(state.posX, ny + (ny > state.posY ? pad : -pad))) state.posY = ny;
  };

  const rotate = (angle) => {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const dx = state.dirX;
    state.dirX = dx * cos - state.dirY * sin;
    state.dirY = dx * sin + state.dirY * cos;
    const px = state.planeX;
    state.planeX = px * cos - state.planeY * sin;
    state.planeY = px * sin + state.planeY * cos;
  };

  // ---------------------------------------------------------------- update

  const update = (dt) => {
    if (state.over) return;

    const run = keys.run ? 1.7 : 1;
    const speed = 2.6 * run * dt;
    const turn = 2.4 * dt;

    let forward = 0;
    let strafe = 0;
    if (keys.up) forward += 1;
    if (keys.down) forward -= 1;
    if (keys.strafeLeft) strafe -= 1;
    if (keys.strafeRight) strafe += 1;
    if (keys.turnLeft) rotate(-turn);
    if (keys.turnRight) rotate(turn);
    if (keys.fire) fire();

    if (touch.moveId !== null) {
      forward -= touch.moveDY;
      strafe += touch.moveDX;
    }

    if (mouseTurn) {
      rotate(mouseTurn);
      mouseTurn = 0;
    }
    if (touch.lookDX) {
      rotate(touch.lookDX);
      touch.lookDX = 0;
    }

    if (forward || strafe) {
      const len = Math.hypot(forward, strafe) || 1;
      const fx = (forward / len) * speed;
      const sx = (strafe / len) * speed;
      tryMove(
        state.posX + state.dirX * fx + state.planeX * sx,
        state.posY + state.dirY * fx + state.planeY * sx
      );
      state.bob += dt * 9 * run;
    } else {
      state.bob += dt * 1.5;
    }

    state.fireCooldown = Math.max(0, state.fireCooldown - dt);
    state.muzzle = Math.max(0, state.muzzle - dt);
    state.hurtFlash = Math.max(0, state.hurtFlash - dt * 2);

    // Pickups.
    for (const p of state.pickups) {
      if (p.taken) continue;
      if (Math.hypot(p.x - state.posX, p.y - state.posY) < 0.5) {
        p.taken = true;
        state.ammo += 25;
        sfx.pickup();
      }
    }

    // Enemies.
    let alive = 0;
    for (const e of state.enemies) {
      if (!e.alive) {
        if (e.dying > 0 && !e.dead) {
          e.dying += dt;
          if (e.dying > 0.9) e.dead = true;
        }
        continue;
      }

      alive++;
      e.hitT = Math.max(0, e.hitT - dt);
      e.attackT = Math.max(0, e.attackT - dt);
      const dx = state.posX - e.x;
      const dy = state.posY - e.y;
      const dist = Math.hypot(dx, dy);

      /*
        They hunt from anywhere on the floor rather than waiting for line of
        sight - gating on LOS left them standing in rooms the player never
        walked into. Axis-separated movement makes them slide along walls
        instead of jamming on corners, which is enough to get them there.
      */
      {
        e.anim += dt * 6;
        if (dist > 0.75) {
          const step = e.speed * dt;
          let ux = dx / dist;
          let uy = dy / dist;

          /*
            Straight-line chasing deadlocks whenever the wall sits square in
            front: with dx or dy at zero the axis-slide has nothing to slide
            along. On a blocked frame, commit to a perpendicular sidestep for
            a moment so they walk around the obstruction.
          */
          if (e.sideT > 0) {
            e.sideT -= dt;
            const sx = -uy * e.sideDir;
            const sy = ux * e.sideDir;
            ux = sx;
            uy = sy;
          }

          const pad = 0.2;
          const beforeX = e.x;
          const beforeY = e.y;
          const nx = e.x + ux * step;
          const ny = e.y + uy * step;
          if (!isWall(nx + Math.sign(ux) * pad, e.y)) e.x = nx;
          if (!isWall(e.x, ny + Math.sign(uy) * pad)) e.y = ny;

          if (Math.hypot(e.x - beforeX, e.y - beforeY) < step * 0.4 && e.sideT <= 0) {
            e.sideT = 0.5;
            e.sideDir = Math.random() < 0.5 ? -1 : 1;
          }
        } else if (e.attackT <= 0) {
          e.attackT = 1;
          state.health -= 9;
          state.hurtFlash = 1;
          sfx.hurt();
          if (state.health <= 0) {
            state.health = 0;
            state.over = true;
          }
        }
      }
    }

    if (alive === 0 && !state.over) {
      state.wave++;
      state.ammo += 20;
      state.health = Math.min(100, state.health + 15);
      spawnWave();
    }
  };

  // ---------------------------------------------------------------- render

  const bufferCanvas = document.createElement('canvas');
  const bufferCtx = bufferCanvas.getContext('2d');
  const displayCtx = display.getContext('2d');

  let W = 320;
  let H = WORLD_H;
  let frame = null;
  let zBuffer = null;

  // Ceiling and floor are a pure function of screen row, so bake them once.
  let skyR = null;
  let skyG = null;
  let skyB = null;
  let florR = null;
  let florG = null;
  let florB = null;

  const resize = () => {
    const rect = display.getBoundingClientRect();
    const cssW = Math.max(rect.width, 1);
    const cssH = Math.max(rect.height, 1);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    display.width = Math.round(cssW * dpr);
    display.height = Math.round(cssH * dpr);

    H = WORLD_H;
    W = Math.max(200, Math.min(520, Math.round(H * (cssW / cssH))));
    bufferCanvas.width = W;
    bufferCanvas.height = H;
    frame = bufferCtx.createImageData(W, H);
    zBuffer = new Float32Array(W);
    displayCtx.imageSmoothingEnabled = false;

    // Alpha never changes, so write it once instead of every frame.
    const d = frame.data;
    for (let i = 3; i < d.length; i += 4) d[i] = 255;

    skyR = new Uint8Array(H);
    skyG = new Uint8Array(H);
    skyB = new Uint8Array(H);
    florR = new Uint8Array(H);
    florG = new Uint8Array(H);
    florB = new Uint8Array(H);
    const half = H / 2;
    for (let y = 0; y < H; y++) {
      const t = Math.abs(y - half) / half;
      skyR[y] = 14 + t * 12;
      skyG[y] = 4 + t * 3;
      skyB[y] = 26 + t * 26;
      florR[y] = 26 + t * 34;
      florG[y] = 12 + t * 18;
      florB[y] = 38 + t * 44;
    }
  };

  const blit = (src, srcW, srcH, dstX, dstY, dstW, dstH, tint) => {
    const data = frame.data;
    for (let x = 0; x < dstW; x++) {
      const sx = ((x * srcW / dstW) | 0);
      const px = dstX + x;
      if (px < 0 || px >= W) continue;
      for (let y = 0; y < dstH; y++) {
        const sy = ((y * srcH / dstH) | 0);
        const si = (sy * srcW + sx) * 4;
        if (src[si + 3] < 128) continue;
        const py = dstY + y;
        if (py < 0 || py >= H) continue;
        const di = (py * W + px) * 4;
        if (tint) {
          data[di] = clamp255(src[si] * tint[0] + tint[3]);
          data[di + 1] = clamp255(src[si + 1] * tint[1] + tint[3]);
          data[di + 2] = clamp255(src[si + 2] * tint[2] + tint[3]);
        } else {
          data[di] = src[si];
          data[di + 1] = src[si + 1];
          data[di + 2] = src[si + 2];
        }
      }
    }
  };

  const render = () => {
    const data = frame.data;

    // Walls, with ceiling and floor filled per column so no pixel is written twice.
    for (let x = 0; x < W; x++) {
      const cameraX = (2 * x) / W - 1;
      const rayX = state.dirX + state.planeX * cameraX;
      const rayY = state.dirY + state.planeY * cameraX;

      let mapX = state.posX | 0;
      let mapY = state.posY | 0;

      const deltaX = Math.abs(1 / (rayX || 1e-9));
      const deltaY = Math.abs(1 / (rayY || 1e-9));

      let stepX;
      let stepY;
      let sideX;
      let sideY;

      if (rayX < 0) {
        stepX = -1;
        sideX = (state.posX - mapX) * deltaX;
      } else {
        stepX = 1;
        sideX = (mapX + 1 - state.posX) * deltaX;
      }
      if (rayY < 0) {
        stepY = -1;
        sideY = (state.posY - mapY) * deltaY;
      } else {
        stepY = 1;
        sideY = (mapY + 1 - state.posY) * deltaY;
      }

      let hit = 0;
      let side = 0;
      let guard = 0;
      while (!hit && guard++ < 256) {
        if (sideX < sideY) {
          sideX += deltaX;
          mapX += stepX;
          side = 0;
        } else {
          sideY += deltaY;
          mapY += stepY;
          side = 1;
        }
        if (mapX < 0 || mapY < 0 || mapX >= MAP_W || mapY >= MAP_H) {
          hit = 1;
          break;
        }
        hit = grid[mapY * MAP_W + mapX];
      }

      const perp = side === 0 ? sideX - deltaX : sideY - deltaY;
      const dist = Math.max(perp, 0.0001);
      zBuffer[x] = dist;

      const lineH = Math.round(H / dist);
      const drawStart = Math.max(0, ((-lineH / 2 + H / 2) | 0));
      const drawEnd = Math.min(H - 1, ((lineH / 2 + H / 2) | 0));

      let wallX = side === 0 ? state.posY + dist * rayY : state.posX + dist * rayX;
      wallX -= Math.floor(wallX);
      let texX = (wallX * TEX) | 0;
      if ((side === 0 && rayX > 0) || (side === 1 && rayY < 0)) texX = TEX - texX - 1;

      const tex = textures[hit] || textures[1];
      const fog = Math.max(0.18, Math.min(1, 5.2 / dist));
      const sideDim = side === 1 ? 0.68 : 1;
      const light = fog * sideDim;
      const texStep = TEX / lineH;
      let texPos = (drawStart - H / 2 + lineH / 2) * texStep;

      for (let y = 0; y < drawStart; y++) {
        const di = (y * W + x) * 4;
        data[di] = skyR[y];
        data[di + 1] = skyG[y];
        data[di + 2] = skyB[y];
      }

      for (let y = drawStart; y <= drawEnd; y++) {
        const texY = texPos & (TEX - 1);
        texPos += texStep;
        const si = ((texY | 0) * TEX + texX) * 4;
        const di = (y * W + x) * 4;
        data[di] = tex[si] * light;
        data[di + 1] = tex[si + 1] * light;
        data[di + 2] = tex[si + 2] * light;
      }

      for (let y = drawEnd + 1; y < H; y++) {
        const di = (y * W + x) * 4;
        data[di] = florR[y];
        data[di + 1] = florG[y];
        data[di + 2] = florB[y];
      }
    }

    // Sprites, far to near.
    const visible = [];
    for (const e of state.enemies) {
      if (e.dead) continue;
      visible.push({ ref: e, kind: 'enemy', d: (e.x - state.posX) ** 2 + (e.y - state.posY) ** 2 });
    }
    for (const p of state.pickups) {
      if (p.taken) continue;
      visible.push({ ref: p, kind: 'ammo', d: (p.x - state.posX) ** 2 + (p.y - state.posY) ** 2 });
    }
    visible.sort((a, b) => b.d - a.d);

    const invDet = 1 / (state.planeX * state.dirY - state.dirX * state.planeY);

    for (const item of visible) {
      const obj = item.ref;
      const relX = obj.x - state.posX;
      const relY = obj.y - state.posY;
      const transformX = invDet * (state.dirY * relX - state.dirX * relY);
      const transformY = invDet * (-state.planeY * relX + state.planeX * relY);
      if (transformY <= 0.12) continue;

      const screenX = ((W / 2) * (1 + transformX / transformY)) | 0;
      const scale = item.kind === 'ammo' ? 0.42 : 1;
      const spriteH = Math.abs((H / transformY) | 0) * scale;
      const spriteW = spriteH;
      const vOffset = item.kind === 'ammo' ? (H / transformY) * 0.36 : 0;

      const startX = Math.max(0, ((-spriteW / 2 + screenX) | 0));
      const endX = Math.min(W - 1, ((spriteW / 2 + screenX) | 0));
      const startY = Math.max(0, (((-spriteH / 2 + H / 2) + vOffset) | 0));
      const endY = Math.min(H - 1, (((spriteH / 2 + H / 2) + vOffset) | 0));

      let src;
      let tint = null;
      const fog = Math.max(0.2, Math.min(1, 5.2 / transformY));

      if (item.kind === 'enemy') {
        const frames = enemyFrames[obj.type];
        if (!obj.alive) {
          const idx = Math.min(frames.die.length - 1, Math.floor((obj.dying / 0.9) * frames.die.length));
          src = frames.die[idx];
        } else if (obj.attackT > 0.72) {
          src = frames.attack;
        } else {
          src = frames.walk[(obj.anim | 0) % 2];
        }
        tint = obj.hitT > 0 ? [1.4, 0.5, 0.5, 60] : [fog, fog, fog, 0];
      } else {
        src = null;
      }

      if (item.kind === 'ammo') {
        // Ammo crate is simple enough to rasterise inline.
        const dataArr = frame.data;
        for (let x = startX; x <= endX; x++) {
          if (transformY >= zBuffer[x]) continue;
          for (let y = startY; y <= endY; y++) {
            const di = (y * W + x) * 4;
            const edge = x === startX || x === endX || y === startY || y === endY;
            dataArr[di] = (edge ? 200 : 90) * fog;
            dataArr[di + 1] = (edge ? 40 : 20) * fog;
            dataArr[di + 2] = (edge ? 250 : 130) * fog;
          }
        }
        continue;
      }

      const dataArr = frame.data;
      for (let x = startX; x <= endX; x++) {
        if (transformY >= zBuffer[x]) continue;
        const texX = (((x - (-spriteW / 2 + screenX)) * SPR) / spriteW) | 0;
        if (texX < 0 || texX >= SPR) continue;
        for (let y = startY; y <= endY; y++) {
          const texY = (((y - vOffset - (-spriteH / 2 + H / 2)) * SPR) / spriteH) | 0;
          if (texY < 0 || texY >= SPR) continue;
          const si = (texY * SPR + texX) * 4;
          if (src[si + 3] < 128) continue;
          const di = (y * W + x) * 4;
          dataArr[di] = clamp255(src[si] * tint[0] + tint[3]);
          dataArr[di + 1] = clamp255(src[si + 1] * tint[1] + tint[3]);
          dataArr[di + 2] = clamp255(src[si + 2] * tint[2] + tint[3]);
        }
      }
    }

    // Muzzle flash lights the scene.
    if (state.muzzle > 0) {
      for (let i = 0; i < data.length; i += 4) {
        data[i] = clamp255(data[i] + 34);
        data[i + 1] = clamp255(data[i + 1] + 18);
        data[i + 2] = clamp255(data[i + 2] + 46);
      }
    }

    // Damage flash.
    if (state.hurtFlash > 0) {
      const amt = state.hurtFlash * 70;
      for (let i = 0; i < data.length; i += 4) {
        data[i] = clamp255(data[i] + amt);
      }
    }

    // Weapon, with walk bob.
    const gunW = Math.round(W * 0.26);
    const gunH = Math.round(gunW * (GUN_H / GUN_W));
    const bobX = Math.sin(state.bob) * W * 0.012;
    const bobY = Math.abs(Math.cos(state.bob)) * H * 0.02;
    blit(
      gunFrames[state.muzzle > 0 ? 1 : 0], GUN_W, GUN_H,
      Math.round((W - gunW) / 2 + bobX), Math.round(H - gunH + bobY),
      gunW, gunH, null
    );

    // Crosshair.
    const cx = (W / 2) | 0;
    const cy = (H / 2) | 0;
    for (let i = -4; i <= 4; i++) {
      if (Math.abs(i) < 2) continue;
      const h = ((cy * W) + cx + i) * 4;
      const v = (((cy + i) * W) + cx) * 4;
      data[h] = 220; data[h + 1] = 120; data[h + 2] = 255;
      data[v] = 220; data[v + 1] = 120; data[v + 2] = 255;
    }

    bufferCtx.putImageData(frame, 0, 0);
    displayCtx.drawImage(bufferCanvas, 0, 0, W, H, 0, 0, display.width, display.height);
  };

  // -------------------------------------------------------------- lifecycle

  const hud = {
    root: document.getElementById('gameHud'),
    health: document.getElementById('hudHealth'),
    ammo: document.getElementById('hudAmmo'),
    kills: document.getElementById('hudKills'),
    wave: document.getElementById('hudWave')
  };

  const overlay = document.getElementById('gameOverlay');
  const overlayTitle = document.getElementById('gameOverlayTitle');
  const overlayText = document.getElementById('gameOverlayText');
  const playButton = document.getElementById('gamePlay');
  const exitButton = document.getElementById('gameExit');
  const fireButton = document.getElementById('gameFire');
  const muteButton = document.getElementById('gameMute');
  const touchLayer = document.getElementById('gameTouch');

  let last = 0;
  let raf = 0;

  /*
    Written every frame this used to push four text nodes 60 times a second,
    forcing a layout pass per frame for numbers that change a few times a
    minute. Only touch the DOM when a value actually moves.
  */
  const hudShown = { health: null, ammo: null, kills: null, wave: null };

  const setHud = (key, value) => {
    if (hudShown[key] === value) return;
    hudShown[key] = value;
    if (hud[key]) hud[key].textContent = value;
  };

  const updateHud = () => {
    if (!hud.root) return;
    setHud('health', String(Math.max(0, Math.round(state.health))));
    setHud('ammo', String(state.ammo));
    setHud('kills', String(state.kills));
    setHud('wave', String(state.wave));
  };

  const showOverlay = (title, text, button) => {
    if (!overlay) return;
    overlayTitle.textContent = title;
    overlayText.textContent = text;
    playButton.textContent = button;
    overlay.hidden = false;
  };

  const loop = (now) => {
    raf = requestAnimationFrame(loop);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (state.running) update(dt);
    render();
    updateHud();

    if (state.over && state.running) {
      stop();
      showOverlay(
        'FLATLINED',
        'Wave ' + state.wave + '. ' + state.kills + ' suits cleared before they got you.',
        'Run it back'
      );
    }
  };

  function stop() {
    state.running = false;
    if (document.pointerLockElement === display && document.exitPointerLock) document.exitPointerLock();
    display.classList.remove('is-playing');
    document.body.classList.remove('game-active');
    if (touchLayer) touchLayer.hidden = true;
    if (exitButton) exitButton.hidden = true;
    for (const key of Object.keys(keys)) keys[key] = false;
    touch.moveId = null;
    touch.lookId = null;
    touch.moveDX = 0;
    touch.moveDY = 0;
  }

  const start = () => {
    initAudio();
    if (audio && audio.state === 'suspended') audio.resume();
    if (state.over || state.enemies.length === 0) resetGame();
    state.running = true;
    if (overlay) overlay.hidden = true;
    display.classList.add('is-playing');
    document.body.classList.add('game-active');
    if (touchLayer) touchLayer.hidden = false;
    if (exitButton) exitButton.hidden = false;
    last = performance.now();
  };

  const pause = () => {
    if (!state.running) return;
    stop();
    showOverlay('PAUSED', 'The suits are still down there.', 'Resume');
  };

  if (playButton) playButton.addEventListener('click', start);

  if (exitButton) {
    exitButton.addEventListener('click', () => {
      stop();
      showOverlay('SUIT PURGE', 'Wave ' + state.wave + '. ' + state.kills + ' cleared.', 'Resume');
      const music = document.getElementById('out-now');
      if (music) music.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  if (fireButton) {
    const press = (event) => {
      event.preventDefault();
      fire();
    };
    fireButton.addEventListener('touchstart', press, { passive: false });
    fireButton.addEventListener('mousedown', press);
  }

  if (muteButton) {
    muteButton.addEventListener('click', () => {
      muted = !muted;
      muteButton.setAttribute('aria-pressed', String(muted));
      muteButton.textContent = muted ? 'Sound off' : 'Sound on';
    });
  }

  window.addEventListener('keydown', (event) => {
    if (event.code === 'Escape' && state.running) pause();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause();
  });

  // Stop burning frames once the player scrolls down to the music.
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting && state.running) pause();
      }
    }, { threshold: 0.35 }).observe(display);
  }

  window.addEventListener('resize', resize);
  resize();
  resetGame();
  updateHud();
  render();
  raf = requestAnimationFrame(loop);
})();
