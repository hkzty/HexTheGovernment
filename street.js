/* ============================================================
   HEX STREET — open-world night drive through a low-poly Canberra.
   Self-contained IIFE.

   Original game: the city, both cars, every mesh, shader and sound are
   generated in code at runtime. Nothing is downloaded and no third-party
   assets, names or badges ship. The map is a stylised Canberra at about
   one third scale — public places and street names only, no business,
   brand or person. See CLAUDE.md.

   Layout: world is the (x, z) plane, y up; x runs east, z runs south.
   A car's forward vector is (cos psi, sin psi); its side vector
   (-sin psi, cos psi) is the driver's RIGHT on screen. Steering, slip
   angles and lateral forces are all positive toward that side.
   ============================================================ */
(function () {
  'use strict';

  var canvas = document.getElementById('streetCanvas');
  if (!canvas) return;
  var stage = canvas.parentNode;
  var $ = function (id) { return document.getElementById(id); };
  var overlay = $('streetOverlay'), overlayTitle = $('streetOverlayTitle'), overlayText = $('streetOverlayText');
  var playBtn = $('streetPlay'), muteBtn = $('streetMute'), resetBtn = $('streetReset');
  var mapCanvas = $('streetMap');
  var DEBUG = /[?&]streetdebug/.test(location.search);

  var gl = null;
  try {
    gl = canvas.getContext('webgl', { antialias: true, alpha: false, powerPreference: 'high-performance' }) ||
         canvas.getContext('experimental-webgl');
  } catch (e) { gl = null; }
  if (!gl) {
    if (overlayText) overlayText.textContent = 'WebGL is off in this browser.';
    if (playBtn) playBtn.hidden = true;
    return;
  }

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function wrapPi(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }

  /* ---------- seeded random: the city is the same every load ---------- */
  var seed = 93;
  function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }


  /* ============================================================
     WORLD — a low-poly Canberra at about one third scale.
     Origin is on Lake Burley Griffin between the two bridges; x east,
     z south, metres. Roads are polylines resampled every 2 m. Junctions
     are found from the geometry: where one road runs into another the
     road quads are cut back and a plain asphalt patch covers the join.
     ============================================================ */
  var SHOULDER = 1.6;      // kerb strip beyond the asphalt, metres
  var LAMP = 28;           // lamp spacing along a road, metres
  var BOUND = 1350;        // half size of the drivable square
  var CITY = [0, -360], CAP = [210, 520], RUS = [720, -110], WAR = [560, -600], WODEN = [-520, 1000];
  var BLACKMT = [-640, -720], AINSLIE = [720, -880], REDHILL = [260, 900];
  function toward(a, b, d) { var dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz); return [a[0] + dx / l * d, a[1] + dz / l * d]; }
  function ray(a, b, r0, r1) { var l = Math.hypot(b[0] - a[0], b[1] - a[1]); return [toward(a, b, r0), toward(a, b, l - r1)]; }
  function ring(c, r) { var p = [], i; for (i = 0; i < 16; i++) p.push([c[0] + Math.cos(i / 16 * 6.2832) * r, c[1] + Math.sin(i / 16 * 6.2832) * r]); return p; }
  function along(a, b, s) { return toward(a, b, s); }
  var COMM = ray(CITY, CAP, 40, 85), KINGS = ray(CAP, RUS, 85, 26), CONST = ray(CITY, RUS, 40, 26);
  var ANZAC0 = [385, -40], ANZAC1 = toward(WAR, ANZAC0, 24);
  /* name, half width, points, loop. Avenues wider than 8.5 m get a median. */
  var ROADS = [
    { name: 'Vernon Circle', hw: 7, pts: ring(CITY, 40), loop: true },
    { name: 'London Circuit', hw: 6, pts: ring(CITY, 115), loop: true },
    { name: 'Capital Circle', hw: 6, pts: ring(CAP, 85), loop: true },
    { name: 'State Circle', hw: 7, pts: ring(CAP, 150), loop: true },
    { name: 'Russell', hw: 6, pts: ring(RUS, 26), loop: true },
    { name: 'Anzac Parade', hw: 6, pts: ring(WAR, 24), loop: true },
    { name: 'Woden', hw: 6, pts: ring(WODEN, 30), loop: true },
    { name: 'Northbourne Avenue', hw: 9, pts: [[0, -400], [0, -700], [0, -1050], [0, -1150]] },
    { name: 'Federal Highway', hw: 6, pts: [[0, -1050], [120, -1140], [260, -1240]] },
    { name: 'Barton Highway', hw: 6, pts: [[0, -1050], [-150, -1150], [-300, -1240]] },
    { name: 'Commonwealth Avenue', hw: 9, pts: COMM },
    { name: 'Kings Avenue', hw: 9, pts: KINGS },
    { name: 'Constitution Avenue', hw: 9, pts: CONST },
    { name: 'Anzac Parade', hw: 12, pts: [ANZAC0, ANZAC1] },
    { name: 'Parkes Way', hw: 8, pts: [[-900, -140], [-650, -150], [-350, -150], [-100, -175], [100, -150], [300, -110], [480, -70], [650, -60], toward(RUS, [650, -60], 26)] },
    { name: 'Lady Denman Drive', hw: 6, pts: [[145, 250], [0, 290], [-200, 260], [-420, 230], [-650, 170], [-880, 120]] },
    { name: 'King Edward Terrace', hw: 6, pts: [[145, 250], [270, 275], [387, 300]] },
    { name: 'Adelaide Avenue', hw: 9, pts: [toward(CAP, [-520, 1000], 150), [-60, 700], [-250, 830], toward(WODEN, [-250, 830], 30)] },
    { name: 'Canberra Avenue', hw: 8, pts: [toward(CAP, [820, 900], 150), [560, 780], [820, 900], [980, 980]] },
    { name: 'Brisbane Avenue', hw: 6, pts: [toward(CAP, [600, 560], 150), [600, 560]] },
    { name: 'Wentworth Avenue', hw: 6, pts: [[600, 560], [520, 420], [387, 300]] },
    { name: 'Giles Street', hw: 5, pts: [[520, 640], [820, 640]] },
    { name: 'Eyre Street', hw: 5, pts: [[520, 720], [820, 720]] },
    { name: 'Kennedy Street', hw: 5, pts: [[560, 560], [560, 780]] },
    { name: 'Jardine Street', hw: 5, pts: [[680, 540], [680, 780]] },
    { name: 'Cunningham Street', hw: 5, pts: [[760, 560], [760, 820]] },
    { name: 'Bowen Drive', hw: 6, pts: [toward(RUS, [760, 100], 26), [760, 100], [720, 260], [680, 420], [680, 540]] },
    { name: 'Morshead Drive', hw: 6, pts: [toward(RUS, [1000, -170], 26), [1000, -170]] },
    { name: 'Limestone Avenue', hw: 6, pts: [toward(WAR, [400, -760], 24), [400, -760], [200, -900], [0, -1050]] },
    { name: 'Ainslie Avenue', hw: 6, pts: [toward(CITY, WAR, 115), [300, -480], toward(WAR, CITY, 24)] },
    { name: 'Fairbairn Avenue', hw: 6, pts: [toward(WAR, [900, -480], 24), [900, -480], [1100, -440]] },
    { name: 'Barry Drive', hw: 7, pts: [toward(CITY, [-400, -380], 115), [-400, -380], [-520, -440]] },
    { name: 'Lonsdale Street', hw: 5, pts: [[70, -470], [70, -920]] },
    { name: 'Mort Street', hw: 5, pts: [[140, -480], [140, -900]] },
    { name: 'Condamine Street', hw: 5, pts: [[-70, -470], [-70, -920]] },
    { name: 'Watson Street', hw: 5, pts: [[-140, -480], [-140, -900]] },
    { name: 'Girrahween Street', hw: 5, pts: [[-170, -620], [170, -620]] },
    { name: 'Elouera Street', hw: 5, pts: [[-170, -760], [170, -760]] },
    { name: 'Wakefield Avenue', hw: 5, pts: [[-170, -880], [170, -880]] },
    { name: 'Lawson Crescent', hw: 5, pts: [[-300, -150], [-330, -60], [-290, 10]] },
    { name: 'Dunrossil Drive', hw: 5, pts: [[-650, 170], [-600, 330], [-500, 420]] },
    { name: 'Novar Street', hw: 5, pts: [[-300, 260], [-300, 560]] },
    { name: 'Hopetoun Circuit', hw: 5, pts: [[-420, 230], [-420, 520]] },
    { name: 'Schlich Street', hw: 5, pts: [[-500, 400], [-200, 400]] },
    { name: 'Bentham Street', hw: 5, pts: [[-500, 500], [-200, 500]] },
    { name: 'Melrose Drive', hw: 6, pts: [toward(WODEN, [-200, 1150], 30), [-200, 1150], [0, 1200]] },
    { name: 'Yamba Drive', hw: 6, pts: [toward(WODEN, [-700, 1150], 30), [-700, 1150]] },
    { name: 'Lake shore', hw: 5, pts: [[-880, 120], [-920, 0], [-900, -140]] }
  ];
  /* Lake Burley Griffin, clockwise from the dam. Point-in-polygon decides water. */
  var LAKE = [[-900, 60], [-760, -20], [-600, -60], [-430, -80], [-330, 20], [-250, 40], [-200, -60], [-60, -120], [60, -90], [200, -60], [330, -20], [420, 0],
    [520, 60], [600, 60], [680, 20], [760, 20], [820, 80], [860, 180], [800, 300], [700, 360], [600, 330], [520, 300], [460, 290], [400, 230], [330, 200],
    [240, 220], [150, 230], [40, 250], [-100, 220], [-300, 200], [-450, 180], [-650, 120], [-820, 110]];
  function inLake(x, z) {
    var inside = false, i, j, n = LAKE.length;
    for (i = 0, j = n - 1; i < n; j = i++) {
      var a = LAKE[i], b = LAKE[j];
      if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
  }
  var HILLS = [[BLACKMT[0], BLACKMT[1], 280, 150], [AINSLIE[0], AINSLIE[1], 260, 115], [REDHILL[0], REDHILL[1], 150, 70]]; // x z radius height

  /* ---------- roads: sample, hash, find junctions ---------- */
  var roads = [], CELL = 16, rgrid = {};
  function cellKey(x, z) { return (Math.floor((x + 2000) / CELL) << 10) + Math.floor((z + 2000) / CELL); }
  function sampleRoad(def) {
    var P = def.pts, n = P.length, dense = [], i, j;
    function cr(p0, p1, p2, p3, t) {
      var t2 = t * t, t3 = t2 * t;
      return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
    }
    var segs = def.loop ? n : n - 1;
    for (i = 0; i < segs; i++) {
      var a = P[def.loop ? (i + n - 1) % n : Math.max(0, i - 1)], b = P[i], c = P[(i + 1) % n], d = P[def.loop ? (i + 2) % n : Math.min(n - 1, i + 2)];
      var steps = Math.max(4, Math.round(Math.hypot(c[0] - b[0], c[1] - b[1]) / 8));
      for (j = 0; j < steps; j++) dense.push([cr(a[0], b[0], c[0], d[0], j / steps), cr(a[1], b[1], c[1], d[1], j / steps)]);
    }
    if (!def.loop) dense.push([P[n - 1][0], P[n - 1][1]]);
    var m = dense.length, cum = [0], len = 0, last = def.loop ? m : m - 1;
    for (i = 1; i <= last; i++) { var p = dense[i % m], q = dense[i - 1]; len += Math.hypot(p[0] - q[0], p[1] - q[1]); cum.push(len); }
    var N = Math.max(2, Math.round(len / 2)), ds = len / N, k = 0;
    if (!def.loop) N++;
    var x = new Float32Array(N), z = new Float32Array(N), tx = new Float32Array(N), tz = new Float32Array(N), fl = new Uint8Array(N);
    for (i = 0; i < N; i++) {
      var s = Math.min(i * ds, len - 1e-6);
      while (cum[k + 1] < s) k++;
      var f = (s - cum[k]) / (cum[k + 1] - cum[k]), p0 = dense[k % m], p1 = dense[(k + 1) % m];
      x[i] = lerp(p0[0], p1[0], f); z[i] = lerp(p0[1], p1[1], f);
    }
    for (i = 0; i < N; i++) {
      var i0 = def.loop ? (i + N - 1) % N : Math.max(0, i - 1), i1 = def.loop ? (i + 1) % N : Math.min(N - 1, i + 1);
      var ax = x[i1] - x[i0], az = z[i1] - z[i0], l = Math.hypot(ax, az) || 1;
      tx[i] = ax / l; tz[i] = az / l;
    }
    return { name: def.name, hw: def.hw, loop: !!def.loop, N: N, ds: ds, len: len, x: x, z: z, tx: tx, tz: tz, fl: fl };
  }
  // fl bits: 1 covered by a junction patch, 2 bridge
  var patches = [];   // [x, z, r]
  (function buildRoads() {
    var i, r, R;
    ROADS.forEach(function (def) { roads.push(sampleRoad(def)); });
    for (r = 0; r < roads.length; r++) {
      R = roads[r];
      for (i = 0; i < R.N; i++) {
        var k = cellKey(R.x[i], R.z[i]);
        (rgrid[k] || (rgrid[k] = [])).push(r, i);
        if (inLake(R.x[i], R.z[i])) R.fl[i] |= 2;
      }
    }
    // union-find over samples that lie on another road
    var ids = [], base = [];
    for (r = 0; r < roads.length; r++) { base.push(ids.length); for (i = 0; i < roads[r].N; i++) ids.push(ids.length); }
    function find(a) { while (ids[a] !== a) { ids[a] = ids[ids[a]]; a = ids[a]; } return a; }
    function union(a, b) { a = find(a); b = find(b); if (a !== b) ids[a] = b; }
    for (r = 0; r < roads.length; r++) {
      R = roads[r];
      for (i = 0; i < R.N; i++) {
        var cx = Math.floor((R.x[i] + 2000) / CELL), cz = Math.floor((R.z[i] + 2000) / CELL), dx, dz;
        for (dx = -1; dx <= 1; dx++) for (dz = -1; dz <= 1; dz++) {
          var cell = rgrid[((cx + dx) << 10) + cz + dz], q;
          if (!cell) continue;
          for (q = 0; q < cell.length; q += 2) {
            var r2 = cell[q], i2 = cell[q + 1];
            if (r2 === r) continue;
            var O = roads[r2], d = Math.hypot(R.x[i] - O.x[i2], R.z[i] - O.z[i2]);
            if (d < O.hw + 1.5) { R.fl[i] |= 1; union(base[r] + i, base[r2] + i2); }
            else if (d < R.hw + 1.5) union(base[r] + i, base[r2] + i2);
          }
        }
      }
    }
    for (r = 0; r < roads.length; r++) {
      R = roads[r];
      for (i = 1; i < R.N; i++) if ((R.fl[i] & 1) && (R.fl[i - 1] & 1)) union(base[r] + i, base[r] + i - 1);
      if (R.loop && (R.fl[0] & 1) && (R.fl[R.N - 1] & 1)) union(base[r], base[r] + R.N - 1);
    }
    var cl = {};
    for (r = 0; r < roads.length; r++) {
      R = roads[r];
      for (i = 0; i < R.N; i++) if (R.fl[i] & 1) {
        var root = find(base[r] + i), c = cl[root] || (cl[root] = { sx: 0, sz: 0, n: 0, m: [] });
        c.sx += R.x[i]; c.sz += R.z[i]; c.n++; c.m.push(r, i);
      }
    }
    Object.keys(cl).forEach(function (key) {
      var c = cl[key], cx = c.sx / c.n, cz = c.sz / c.n, rad = 0, q;
      for (q = 0; q < c.m.length; q += 2) {
        var Q = roads[c.m[q]], j = c.m[q + 1];
        rad = Math.max(rad, Math.hypot(Q.x[j] - cx, Q.z[j] - cz) + Q.hw + Q.ds + 0.4);
      }
      patches.push([cx, cz, rad]);
    });
  })();

  /* nearest road sample to a point: [road, index, distance] or null */
  var nrOut = [0, 0, 0];
  function nearestRoad(px, pz, reach) {
    var cx = Math.floor((px + 2000) / CELL), cz = Math.floor((pz + 2000) / CELL), best = 1e18, br = -1, bi = 0, dx, dz, q;
    reach = reach || 1;
    for (dx = -reach; dx <= reach; dx++) for (dz = -reach; dz <= reach; dz++) {
      var cell = rgrid[((cx + dx) << 10) + cz + dz];
      if (!cell) continue;
      for (q = 0; q < cell.length; q += 2) {
        var R = roads[cell[q]], i = cell[q + 1], ex = px - R.x[i], ez = pz - R.z[i], d = ex * ex + ez * ez;
        if (d < best) { best = d; br = cell[q]; bi = i; }
      }
    }
    if (br < 0) {
      if (reach < 8) return nearestRoad(px, pz, reach * 2);
      for (q = 0; q < roads.length; q++) { var S = roads[q], j; for (j = 0; j < S.N; j += 3) { var fx = px - S.x[j], fz = pz - S.z[j], e = fx * fx + fz * fz; if (e < best) { best = e; br = q; bi = j; } } }
    }
    nrOut[0] = br; nrOut[1] = bi; nrOut[2] = Math.sqrt(best);
    return nrOut;
  }
  // 1 on asphalt, 0 on grass
  function surfaceAt(px, pz) {
    var n = nearestRoad(px, pz), i;
    if (n[0] >= 0 && n[2] < roads[n[0]].hw + 0.9) return 1;
    for (i = 0; i < patches.length; i++) { var p = patches[i], dx = px - p[0], dz = pz - p[1]; if (dx * dx + dz * dz < p[2] * p[2]) return 1; }
    return 0;
  }

  /* ---------- obstacles: boxes in a grid, big discs in a list ---------- */
  var OCELL = 32, ogrid = {}, boxes = [], discs = [], bigDiscs = []; // bigDiscs: too large for the grid, checked every step
  function addBox(cx, cz, tx, tz, hl, hd) {
    var id = boxes.length; boxes.push(cx, cz, tx, tz, hl, hd);
    var e = Math.max(hl, hd) + 2, x0 = Math.floor((cx - e + 2000) / OCELL), x1 = Math.floor((cx + e + 2000) / OCELL), z0 = Math.floor((cz - e + 2000) / OCELL), z1 = Math.floor((cz + e + 2000) / OCELL), x, z;
    for (x = x0; x <= x1; x++) for (z = z0; z <= z1; z++) (ogrid[(x << 10) + z] || (ogrid[(x << 10) + z] = [])).push(id);
  }
  function addDisc(cx, cz, r) {
    if (r > OCELL - 4) { bigDiscs.push(cx, cz, r); return; }
    var id = -1 - discs.length; discs.push(cx, cz, r);
    var x0 = Math.floor((cx - r - 2 + 2000) / OCELL), x1 = Math.floor((cx + r + 2 + 2000) / OCELL), z0 = Math.floor((cz - r - 2 + 2000) / OCELL), z1 = Math.floor((cz + r + 2 + 2000) / OCELL), x, z;
    for (x = x0; x <= x1; x++) for (z = z0; z <= z1; z++) (ogrid[(x << 10) + z] || (ogrid[(x << 10) + z] = [])).push(id);
  }
  // push a disc (px, pz, rad) out of the obstacles; returns [nx, nz, depth] or null
  var hitOut = [0, 0, 0];
  function pushOut(px, pz, rad) {
    var cx = Math.floor((px + 2000) / OCELL), cz = Math.floor((pz + 2000) / OCELL), dx, dz, q, best = 0, bx = 0, bz = 0;
    function disc(ox, oz, r) {
      var ex = px - ox, ez = pz - oz, d = Math.hypot(ex, ez), pen = r + rad - d;
      if (pen > best && d > 1e-6) { best = pen; bx = ex / d; bz = ez / d; }
    }
    for (dx = -1; dx <= 1; dx++) for (dz = -1; dz <= 1; dz++) {
      var cell = ogrid[((cx + dx) << 10) + cz + dz];
      if (!cell) continue;
      for (q = 0; q < cell.length; q++) {
        var id = cell[q];
        if (id < 0) { id = -1 - id; disc(discs[id], discs[id + 1], discs[id + 2]); continue; }
        var ox = boxes[id], oz = boxes[id + 1], tx = boxes[id + 2], tz = boxes[id + 3], hl = boxes[id + 4], hd = boxes[id + 5];
        var ex = px - ox, ez = pz - oz, l = ex * tx + ez * tz, d = -ex * tz + ez * tx;
        var pl = hl + rad - Math.abs(l), pd = hd + rad - Math.abs(d);
        if (pl <= 0 || pd <= 0) continue;
        if (pl < pd) { if (pl > best) { best = pl; bx = l > 0 ? tx : -tx; bz = l > 0 ? tz : -tz; } }
        else if (pd > best) { best = pd; bx = d > 0 ? -tz : tz; bz = d > 0 ? tx : -tx; }
      }
    }
    for (q = 0; q < bigDiscs.length; q += 3) disc(bigDiscs[q], bigDiscs[q + 1], bigDiscs[q + 2]);
    if (best <= 0) return null;
    hitOut[0] = bx; hitOut[1] = bz; hitOut[2] = best;
    return hitOut;
  }

  /* ============================================================
     CARS — original designs. Figures are in SI units.
     ============================================================ */
  var CARS = {
    sedan: {
      label: 'V6 Sedan', paint: [0.42, 0.74, 0.93], glow: [0.62, 0.36, 1.0],
      m: 1350, a: 1.25, b: 1.48, h: 0.55, iz: 2550, width: 1.81, track: 1.52, rw: 0.324, hub: [0.62, 0.63, 0.66],
      front: 2.20, rear: -2.66, mu: 1.04, cda: 0.44, steer: 0.56,
      // four-speed automatic: 3.06 / 1.63 / 1.00 / 0.70 on a 3.08 axle, 205/65R15
      gears: [3.06, 1.63, 1.0, 0.70], fd: 3.08, eff: 0.82, idle: 700, stall: 2000, red: 5400, up: 5100,
      tq: [[700, 225], [1500, 262], [2400, 284], [3200, 293], [4000, 284], [4800, 253], [5400, 205]],
      cyl: 3.0, voice: 'v6', ute: false, gf: 0.95, gr: 1.06
    },
    ute: {
      label: 'I6 Ute', paint: [0.8, 0.8, 0.78], glow: [0.12, 0.8, 0.9],
      m: 1560, a: 1.36, b: 1.74, h: 0.58, iz: 3350, width: 1.87, track: 1.56, rw: 0.332, hub: [0.2, 0.2, 0.22],
      front: 2.29, rear: -2.79, mu: 1.02, cda: 0.50, steer: 0.54,
      // five-speed: 3.25 / 1.99 / 1.29 / 1.00 / 0.73 on a 3.23 axle, 215/60R16
      gears: [3.25, 1.99, 1.29, 1.0, 0.73], fd: 3.23, eff: 0.86, idle: 650, stall: 1700, red: 5600, up: 5200,
      tq: [[650, 280], [1500, 332], [3000, 357], [3800, 348], [4900, 306], [5600, 255]],
      cyl: 3.0, voice: 'i6', ute: true, gf: 0.93, gr: 1.12   // an empty tub: more rear bias to stay driveable
    }
  };
  var G = 9.81;

  /* Upgrades. Each has three levels; tuned() folds them into a car's figures. */
  var PARTS = [
    { id: 'exhaust', name: 'Exhaust' }, { id: 'turbo', name: 'Turbo' }, { id: 'gearbox', name: 'Gearbox' },
    { id: 'tyres', name: 'Tyres' }, { id: 'weight', name: 'Weight' }, { id: 'brakes', name: 'Brakes' }, { id: 'nitrous', name: 'Nitrous' }
  ];
  var COST = [300, 700, 1500];
  var garage = { cash: 0, up: { sedan: {}, ute: {} } };
  try {
    var gsv = JSON.parse(localStorage.getItem('htg.street.garage') || 'null');
    if (gsv && typeof gsv.cash === 'number' && gsv.up) { garage.cash = Math.max(0, Math.floor(gsv.cash)); garage.up.sedan = gsv.up.sedan || {}; garage.up.ute = gsv.up.ute || {}; }
  } catch (e) {}
  function saveGarage() { try { localStorage.setItem('htg.street.garage', JSON.stringify(garage)); } catch (e) {} }
  function lvl(key, id) { return clamp(Math.floor((garage.up[key] || {})[id] || 0), 0, 3); }
  function tuned(key) {
    var B = CARS[key], S = {}, k;
    for (k in B) S[k] = B[k];
    var ex = lvl(key, 'exhaust'), tb = lvl(key, 'turbo'), gb = lvl(key, 'gearbox'), ty = lvl(key, 'tyres'), wt = lvl(key, 'weight'), bk = lvl(key, 'brakes'), n2 = lvl(key, 'nitrous');
    S.ex = ex; S.turbo = tb; S.tqMul = 1 + ex * 0.04; S.boostGain = tb * 0.14;
    S.fd = B.fd * (1 + gb * 0.05); S.shift = 0.22 - gb * 0.05; S.red = B.red + gb * 150; S.up = B.up + gb * 150;
    S.mu = B.mu + ty * 0.05; S.m = B.m * (1 - wt * 0.04); S.iz = B.iz * (1 - wt * 0.04);
    S.bk = 1 + bk * 0.09; S.nos = n2; S.nosTime = n2 ? 1.5 + n2 * 0.9 : 0;
    return S;
  }

  function torque(S, rpm) {
    var c = S.tq, i;
    if (rpm <= c[0][0]) return c[0][1];
    for (i = 1; i < c.length; i++) if (rpm <= c[i][0]) return lerp(c[i - 1][1], c[i][1], (rpm - c[i - 1][0]) / (c[i][0] - c[i - 1][0]));
    return c[c.length - 1][1];
  }
  // Magic-formula lateral force. D carries a mild load sensitivity.
  function tyre(alpha, fz, mu, fz0) {
    var x = 11.5 * alpha, m = mu * (1 - 0.07 * (fz / fz0 - 1));
    return m * fz * Math.sin(1.38 * Math.atan(x - 0.2 * (x - Math.atan(x))));
  }

  function newCar(key) {
    return { key: key, S: tuned(key), da: 0, bt: 0, pb: 0, dbf: 0, boost: 0, tank: 1, nosOn: 0, x: 0, z: 0, psi: 0, vx: 0, vz: 0, r: 0, delta: 0, af: 0, ar: 0,
             ax: 0, ay: 0, gear: 1, rpm: 800, shiftT: 0, rev: false, slip: 0, spin: 0, wheelRot: 0, rearRot: 0, burnout: 0,
             idx: 0, rd: 0, lat: 0, hit: 0, thr: 0, brk: 0, beta: 0, speed: 0, sf: 1, sr: 1, wet: 0, sink: 0, y: 0, road: '' };
  }
  function placeAt(car, x, z, psi) {
    car.x = x; car.z = z; car.psi = psi;
    car.vx = car.vz = car.r = car.delta = car.af = car.ar = car.ax = car.ay = 0;
    car.gear = 1; car.rpm = car.S.idle; car.rev = false; car.lat = 0; car.slip = 0; car.shiftT = 0; car.sink = 0; car.y = 0; car.wet = 0; car.sf = car.sr = 1;
    car.da = car.bt = car.pb = car.dbf = 0;
    var n = nearestRoad(x, z); car.rd = n[0]; car.idx = n[1]; car.road = roads[n[0]].name;
  }

  /* One fixed physics step. inp: {steer -1..1, thr 0..1, brk 0..1, hb bool} */
  function stepCar(car, inp, dt) {
    var S = car.S, L = S.a + S.b;
    var c = Math.cos(car.psi), s = Math.sin(car.psi);
    var vx = car.vx * c + car.vz * s, vy = -car.vx * s + car.vz * c, r = car.r;
    var spd = Math.hypot(vx, vy), sgn = vx >= 0 ? 1 : -1;
    var beta = spd > 2 ? Math.atan2(vy, Math.abs(vx)) : 0;

    // Drift assist. Keys are on or off, so a slide is flown by angle, not by wheel: the
    // handbrake with steering (or a real slide) engages it, the steering key then asks for
    // an angle toward that side, letting go lets it straighten, the other key swings it
    // across. `da` is how engaged it is, `bt` the slip angle being asked for.
    var stIn = clamp(inp.steer, -1, 1), thrIn = clamp(inp.thr, 0, 1), brkIn = clamp(inp.brk, 0, 1);
    var wantD = (inp.hb && spd > 7 && Math.abs(stIn) > 0.2) || Math.abs(beta) > 0.26 || (car.da > 0.1 && (Math.abs(car.bt) > 0.07 || Math.abs(beta) > 0.07));
    if (spd < 5 || car.rev || inp.hold || vx < 0) wantD = false;
    car.da += ((wantD ? 1 : 0) - car.da) * Math.min(1, dt * (wantD ? 9 : 3.5));
    if (car.da < 0.04) { car.bt = beta; car.pb = beta; }
    else {
      var amp = brkIn > 0.3 ? 0 : thrIn > 0.2 ? 0.68 : 0.3, tgtB = -stIn * amp;
      var grow = Math.abs(tgtB) > Math.abs(car.bt) && tgtB * car.bt >= 0;
      var br = (grow ? 1.7 : stIn !== 0 ? 2.4 : thrIn > 0.2 ? 0.5 : 1.0) * dt;
      car.bt += clamp(tgtB - car.bt, -br, br);
    }

    // steering: less lock with speed, but always enough to catch a slide
    var lock = Math.min(S.steer, Math.atan(L * S.mu * G * 1.1 / Math.max(spd * spd, 1)) + 0.1);
    lock = Math.max(lock, Math.min(S.steer, Math.abs(beta) + 0.12));
    var target = stIn * lock;
    // in a slide the front wheels do what a driver's hands would: point down the road the
    // car is travelling, a few degrees into the corner (opposite lock), so they keep pulling
    if (car.da > 0.04 && spd > 5) {
      var thF = Math.atan2(vy + S.a * r, Math.max(Math.abs(vx), 2)), side = car.bt < -0.02 ? 1 : car.bt > 0.02 ? -1 : 0;
      var assistD = clamp(thF + side * (0.06 + 0.1 * Math.abs(stIn)), -S.steer, S.steer);
      target += (assistD - target) * car.da;
    }
    var rate = (2.2 + 1.6 * clamp(1 - spd / 40, 0, 1) + 3 * car.da) * dt;
    car.delta += clamp(target - car.delta, -rate, rate);
    var dl = car.delta, cd = Math.cos(dl), sd = Math.sin(dl);

    // reverse: hold the brake at a standstill
    var thr = clamp(inp.thr, 0, 1), brk = clamp(inp.brk, 0, 1);
    // reverse needs the brake held at a standstill for a moment, so stopping is not selecting reverse
    car.revT = (!car.rev && spd < 0.6 && brk > 0.2 && thr < 0.05 && !inp.hold) ? (car.revT || 0) + dt : 0;
    if (car.revT > 0.45) { car.rev = true; car.revT = 0; }
    if (inp.hold) { car.rev = false; brk = 0; }
    if (car.rev && (thr > 0.05 || vx > 1)) car.rev = false;

    // engine and gearbox
    var ratio = S.gears[car.gear - 1] * S.fd;
    var wheelRpm = Math.abs(vx) / S.rw * ratio * 9.5493;
    // torque converter: revs flare off the line and sit a little above the wheels under load
    var rpm = Math.max(wheelRpm + thr * 420 * clamp(1 - wheelRpm / 4200, 0, 1), S.idle + (S.stall - S.idle) * thr);
    if (car.shiftT > 0) car.shiftT -= dt;
    if (!car.rev && car.shiftT <= 0) {
      if (rpm > S.up && car.gear < S.gears.length) { car.gear++; car.shiftT = S.shift; }
      else if (car.gear > 1) {
        var down = Math.abs(vx) / S.rw * S.gears[car.gear - 2] * S.fd * 9.5493;
        if (down < S.up * 0.86 && (wheelRpm < 1500 || (thr > 0.7 && wheelRpm < 2500))) { car.gear--; car.shiftT = S.shift * 0.8; }
      }
    }
    if (car.rev) car.gear = 1;
    rpm = Math.min(rpm, S.red);
    car.rpm += (rpm - car.rpm) * Math.min(1, dt * 14);
    var drive = 0;
    if (car.rev) {
      drive = vx > -8 ? -brk * 3800 : 0; brk = 0;
    } else {
      var want = thr * clamp((rpm - 1700) / 1800, 0, 1);
      car.boost += (want - car.boost) * Math.min(1, dt * (want > car.boost ? 2.4 : 7));
      car.nosOn = inp.nos && S.nos && car.tank > 0 && thr > 0.5 ? 1 : 0;
      if (car.nosOn) car.tank = Math.max(0, car.tank - dt / S.nosTime); else car.tank = Math.min(1, car.tank + dt / 22);
      var tq = wheelRpm >= S.red ? 0 : torque(S, rpm) * thr * (car.shiftT > 0 ? 0.55 : 1) * S.tqMul * (1 + S.boostGain * car.boost) * (car.nosOn ? 1.38 : 1);
      if (thr < 0.02 && vx > 1) tq = -(8 + rpm * 0.0035);   // an automatic coasts: it barely engine-brakes
      drive = tq * ratio * S.eff / S.rw;
    }

    // axle loads with longitudinal transfer
    var fzf0 = S.m * G * S.b / L, fzr0 = S.m * G * S.a / L;
    var tr = S.m * car.ax * S.h / L;
    var fzf = Math.max(600, fzf0 - tr), fzr = Math.max(600, fzr0 + tr);
    var muF = S.mu * S.gf * (car.sf ? 1 : 0.6), muR = S.mu * S.gr * (car.sr ? 1 : 0.6);   // per-car bias; grass under an axle takes its grip

    // slip angles, relaxed for stability
    var fvx = vx * cd + (vy + S.a * r) * sd, fvy = (vy + S.a * r) * cd - vx * sd;
    var afT = -Math.atan2(fvy, Math.max(Math.abs(fvx), 2.2));
    var arT = -Math.atan2(vy - S.b * r, Math.max(Math.abs(vx), 2.2));
    var rel = Math.min(1, (spd + 1.5) * dt / 0.34);
    car.af += (afT - car.af) * rel; car.ar += (arT - car.ar) * rel;

    // longitudinal forces at each axle
    var bmax = S.m * G * 1.12 * S.bk;
    // Handbrake with throttle never locks the rears: it lights them up (a clutch kick), so
    // the car keeps driving through the slide instead of stopping in it. Add the brake and
    // it is a brake stand: fronts only part hold, the car creeps and swings on the spot.
    var kick = inp.hb && thr > 0.3 && !car.rev && !inp.hold, burnout = kick && brk > 0.2;
    var fxf = -sgn * brk * bmax * 0.64 * (burnout ? 0.28 : 1), fxr = kick ? drive * 1.6 : drive - sgn * brk * bmax * 0.36;
    if (car.rev) fxf = thr > 0 ? 0 : fxf;
    var capF = muF * fzf, capR = muR * fzr, spin = 0;
    fxf = clamp(fxf, -capF, capF);
    var locked = inp.hb && spd > 0.5 && !kick;
    if (inp.hold) { vx *= 0.8; vy *= 0.8; r *= 0.8; }
    if (locked) fxr = -sgn * capR * 0.5;
    if (kick) spin = 1;
    if (Math.abs(fxr) > capR * 0.97) { spin = 1; fxr = clamp(fxr, -capR * 0.93, capR * 0.93); }
    // friction circle: what the tyre spends on drive or braking it cannot spend sideways
    var kf = Math.sqrt(Math.max(0.06, 1 - (fxf / capF) * (fxf / capF)));
    var ur = 0.86 * fxr / capR;
    var kr = locked ? 0.3 : kick ? 0.5 : spin ? 0.46 : Math.sqrt(Math.max(0.2, 1 - ur * ur));
    var slide = clamp((Math.abs(beta) - 0.17) / 0.2, 0, 1);
    if (!locked && !kick) kr *= 1 - Math.max(0.42 * slide * thr, 0.38 * car.da * (0.45 + 0.55 * thr));  // sideways, the rear stays loose (a kick already has the rears lit)
    var fyf = tyre(car.af, fzf, muF, fzf0) * kf;
    var fyr = tyre(car.ar, fzr, muR, fzr0) * kr;

    var drag = S.cda * vx * Math.abs(vx) + (spd > 0.3 ? sgn * (0.011 + 0.02 * (2 - car.sf - car.sr)) * S.m * G : 0);
    var FX = fxr + fxf * cd - fyf * sd - drag;
    var FY = fyr + fyf * cd + fxf * sd;
    var MZ = S.a * (fyf * cd + fxf * sd) - S.b * fyr;
    MZ -= S.iz * r * (0.7 + 0.9 * clamp((Math.abs(beta) - 0.7) / 0.5, 0, 1)) * clamp(Math.abs(beta) * 2.2 - 0.15, 0, 1);   // damping once it is properly sideways, hard past 40 degrees
    if (car.da > 0.04) {
      var dB = (beta - car.pb) / dt; car.dbf = (car.dbf || 0) + (dB - (car.dbf || 0)) * Math.min(1, dt * 25);
      MZ += S.iz * car.da * (8 * (beta - car.bt) + 3.2 * car.dbf);
    }
    car.pb = beta;
    // Tyres at a big angle scrub speed hard. Give most of that back while sliding so the
    // car carries its momentum through a drift instead of stopping in it.
    var carry = Math.max(slide, car.da * clamp((Math.abs(beta) - 0.08) / 0.15, 0, 1));
    if (spd > 4 && carry > 0 && (brk < 0.05 || kick)) {
      var alongV = (FX * vx + FY * vy) / spd;
      if (alongV < 0) { var back = -alongV * 0.62 * carry; FX += back * vx / spd; FY += back * vy / spd; }
    }
    var axB = FX / S.m, ayB = FY / S.m;
    vx += (axB + vy * r) * dt; vy += (ayB - vx * r) * dt; r += MZ / S.iz * dt;

    // below walking pace the tyre model is ill-conditioned: blend to pure rolling
    var w = clamp((Math.abs(vx) - 0.5) / 3.5, 0, 1), kq = (1 - w) * Math.min(1, 12 * dt);
    if (burnout) kq *= 0.12;   // spinning rears can swing the car on the spot
    r += (vx * Math.tan(dl) / L - r) * kq; vy += -vy * kq;
    if (spd < 0.35 && thr < 0.02 && !car.rev) { vx *= 0.8; vy *= 0.8; r *= 0.8; }

    car.psi = wrapPi(car.psi + r * dt);
    c = Math.cos(car.psi); s = Math.sin(car.psi);
    car.vx = vx * c - vy * s; car.vz = vx * s + vy * c; car.r = r;
    car.x += car.vx * dt; car.z += car.vz * dt;
    car.ax += (axB - car.ax) * Math.min(1, dt * 10); car.ay += (ayB - car.ay) * Math.min(1, dt * 10);
    car.wheelRot -= vx / S.rw * dt;
    // rear wheels: frozen on the handbrake, spinning faster than the road in a burnout or wheelspin
    car.rearRot -= (locked ? 0 : spin ? Math.max(Math.abs(vx), 9) + 4 : vx) / S.rw * dt * (spin && vx < 0 ? -1 : 1);
    car.speed = Math.hypot(vx, vy); car.beta = car.speed > 3 ? Math.atan2(vy, Math.abs(vx)) : 0;
    car.thr = thr; car.brk = car.rev ? 0 : brk; car.spin = spin; car.burnout = burnout ? 1 : 0;
    var sl = Math.max(Math.abs(car.af), Math.abs(car.ar)) - 0.09;
    car.slip = clamp(sl * 5 + (spin || locked ? 0.5 : 0), 0, 1) * clamp(car.speed / 6, 0, 1);
    if (kick) car.slip = Math.max(car.slip, 0.8);

    // surface under each axle for the next step: grass takes grip and adds drag
    car.sf = surfaceAt(car.x + c * S.a, car.z + s * S.a); car.sr = surfaceAt(car.x - c * S.b, car.z - s * S.b);
    car.hit = 0;
    var nr = nearestRoad(car.x, car.z); car.rd = nr[0]; car.idx = nr[1];
    var R = roads[car.rd], i = car.idx;
    car.road = R.name;
    car.lat = (car.x - R.x[i]) * -R.tz[i] + (car.z - R.z[i]) * R.tx[i];
    // bridges: rails keep the car on the deck
    if ((R.fl[i] & 2) && nr[2] < R.hw + SHOULDER + 2) {
      var nx = -R.tz[i], nz = R.tx[i], lat = car.lat, lim = R.hw + SHOULDER - 1.05;
      if (Math.abs(lat) > lim) {
        var sd2 = lat > 0 ? 1 : -1, over = Math.abs(lat) - lim, vn = (car.vx * nx + car.vz * nz) * sd2;
        car.x -= nx * sd2 * over; car.z -= nz * sd2 * over;
        if (vn > 0) {
          car.vx -= nx * sd2 * vn * 1.25; car.vz -= nz * sd2 * vn * 1.25;
          car.vx *= 0.97; car.vz *= 0.97; car.r *= 0.6; car.hit = vn;
          var alongA = Math.atan2(R.tz[i], R.tx[i]);
          if (Math.cos(car.psi - alongA) < 0) alongA += Math.PI;
          car.psi = wrapPi(car.psi + wrapPi(alongA - car.psi) * Math.min(0.25, vn * 0.03));
        }
      }
    }
    // buildings, trees, monuments, hills: two discs, one over each axle
    var k;
    for (k = 0; k < 2; k++) {
      var off = k ? -S.b : S.a, px = car.x + c * off, pz = car.z + s * off, h = pushOut(px, pz, 0.95);
      if (!h) continue;
      var hx = h[0], hz = h[1], dep = h[2];
      car.x += hx * dep; car.z += hz * dep;
      var vn2 = car.vx * hx + car.vz * hz;
      if (vn2 < 0) {
        car.vx -= hx * vn2 * 1.4; car.vz -= hz * vn2 * 1.4; car.vx *= 0.96; car.vz *= 0.96;
        var side = -s * hx + c * hz;              // which flank took it
        car.r += off * side * -vn2 * 0.22 * S.m / S.iz; car.r *= 0.7;
        car.hit = Math.max(car.hit, -vn2);
      }
    }
    // the edge of the map
    if (Math.abs(car.x) > BOUND) { var ex = car.x > 0 ? 1 : -1; car.x = ex * BOUND; if (car.vx * ex > 0) { car.hit = Math.max(car.hit, Math.abs(car.vx)); car.vx *= -0.4; } }
    if (Math.abs(car.z) > BOUND) { var ez = car.z > 0 ? 1 : -1; car.z = ez * BOUND; if (car.vz * ez > 0) { car.hit = Math.max(car.hit, Math.abs(car.vz)); car.vz *= -0.4; } }
    // water: off a bridge or over the bank and the car goes under
    car.wet = inLake(car.x, car.z) && !car.sf && !car.sr ? 1 : 0;
    if (car.wet) { car.sink += dt; car.vx *= 1 - 2.5 * dt; car.vz *= 1 - 2.5 * dt; car.r *= 1 - 3 * dt; car.y = -Math.min(1.6, car.sink * 1.1); }
    else { car.sink = 0; car.y = 0; }
  }

  /* ============================================================
     MESH BUILDING — 13 floats per vertex:
     pos3 normal3 uv2 colour4 (a = per-object seed) material1
     ============================================================ */
  var MAT = { PAINT: 0, ROAD: 1, BUILDING: 2, EMISSIVE: 3, GROUND: 4, BRAKE: 5, BARRIER: 6, GLASS: 7, WATER: 8 };
  function Mesh() { this.v = []; }
  Mesh.prototype.vert = function (p, n, u, v, col, mat) {
    this.v.push(p[0], p[1], p[2], n[0], n[1], n[2], u, v, col[0], col[1], col[2], col.length > 3 ? col[3] : 0, mat);
  };
  Mesh.prototype.quad = function (a, b, c, d, n, col, mat, uv) {
    uv = uv || [0, 0, 1, 0, 1, 1, 0, 1];
    this.vert(a, n, uv[0], uv[1], col, mat); this.vert(b, n, uv[2], uv[3], col, mat); this.vert(c, n, uv[4], uv[5], col, mat);
    this.vert(a, n, uv[0], uv[1], col, mat); this.vert(c, n, uv[4], uv[5], col, mat); this.vert(d, n, uv[6], uv[7], col, mat);
  };
  // box aligned to a track tangent; walls carry (metres along wall, height) as uv
  Mesh.prototype.box = function (cx, cz, tx, tz, hl, hd, y0, y1, col, mat, top) {
    var nx = -tz, nz = tx, self = this;
    function P(l, d, y) { return [cx + tx * l + nx * d, y, cz + tz * l + nz * d]; }
    function wall(l0, d0, l1, d1, n, len) {
      self.quad(P(l0, d0, y0), P(l1, d1, y0), P(l1, d1, y1), P(l0, d0, y1), n, col, mat, [0, y0, len, y0, len, y1, 0, y1]);
    }
    wall(-hl, -hd, hl, -hd, [-nx, 0, -nz], hl * 2); wall(hl, hd, -hl, hd, [nx, 0, nz], hl * 2);
    wall(hl, -hd, hl, hd, [tx, 0, tz], hd * 2); wall(-hl, hd, -hl, -hd, [-tx, 0, -tz], hd * 2);
    this.quad(P(-hl, -hd, y1), P(hl, -hd, y1), P(hl, hd, y1), P(-hl, hd, y1), [0, 1, 0], top || col, top ? MAT.GROUND : mat, [0, 0, 0, 0, 0, 0, 0, 0]);
  };
  // extrude a side profile (x forward, y up) across the car's width
  Mesh.prototype.extrude = function (pts, zh, colFn, matFn, capCol, capMat) {
    var n = pts.length, cx = 0, cy = 0, i;
    for (i = 0; i < n; i++) { cx += pts[i][0] / n; cy += pts[i][1] / n; }
    for (i = 0; i < n; i++) {
      var p = pts[i], q = pts[(i + 1) % n], ex = q[0] - p[0], ey = q[1] - p[1], l = Math.hypot(ex, ey) || 1;
      var nx = ey / l, ny = -ex / l;
      if (nx * ((p[0] + q[0]) / 2 - cx) + ny * ((p[1] + q[1]) / 2 - cy) < 0) { nx = -nx; ny = -ny; }
      this.quad([p[0], p[1], -zh], [q[0], q[1], -zh], [q[0], q[1], zh], [p[0], p[1], zh], [nx, ny, 0], colFn(i), matFn(i));
      for (var sgn = -1; sgn <= 1; sgn += 2) {
        var nn = [0, 0, sgn];
        this.vert([cx, cy, sgn * zh], nn, 0, 0, capCol, capMat);
        this.vert([p[0], p[1], sgn * zh], nn, 0, 0, capCol, capMat);
        this.vert([q[0], q[1], sgn * zh], nn, 0, 0, capCol, capMat);
      }
    }
  };
  Mesh.prototype.poly = function (pts, z, col, mat) { // flat polygon on a car's flank
    var n = [0, 0, z > 0 ? 1 : -1], i;
    for (i = 1; i < pts.length - 1; i++) {
      this.vert([pts[0][0], pts[0][1], z], n, 0, 0, col, mat);
      this.vert([pts[i][0], pts[i][1], z], n, 0, 0, col, mat);
      this.vert([pts[i + 1][0], pts[i + 1][1], z], n, 0, 0, col, mat);
    }
  };

  Mesh.prototype.fan = function (cx, cz, r, y, n, col, mat) {
    var i;
    for (i = 0; i < n; i++) {
      var a0 = i / n * 6.2832, a1 = (i + 1) / n * 6.2832;
      this.vert([cx, y, cz], [0, 1, 0], 0, 0, col, mat);
      this.vert([cx + Math.cos(a0) * r, y, cz + Math.sin(a0) * r], [0, 1, 0], 0, 0, col, mat);
      this.vert([cx + Math.cos(a1) * r, y, cz + Math.sin(a1) * r], [0, 1, 0], 0, 0, col, mat);
    }
  };
  // tapered cylinder, open at the bottom, lid on top when r1 > 0
  Mesh.prototype.cyl = function (cx, cz, r0, r1, y0, y1, n, col, mat) {
    var i;
    for (i = 0; i < n; i++) {
      var a0 = i / n * 6.2832, a1 = (i + 1) / n * 6.2832, c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      var nx = (c0 + c1) / 2, nz = (s0 + s1) / 2, ny = (r0 - r1) / Math.max(1e-3, y1 - y0), nl = Math.hypot(nx, ny, nz);
      this.quad([cx + c0 * r0, y0, cz + s0 * r0], [cx + c1 * r0, y0, cz + s1 * r0], [cx + c1 * r1, y1, cz + s1 * r1], [cx + c0 * r1, y1, cz + s0 * r1],
                [nx / nl, ny / nl, nz / nl], col, mat, [0, y0, (a1 - a0) * r0, y0, (a1 - a0) * r0, y1, 0, y1]);
    }
    if (r1 > 0) this.fan(cx, cz, r1, y1, n, col, mat);
  };

  /* Sprints: a start gate and checkpoints, best time and ghost kept per car. */
  var ROUTES = [
    { id: 'northbourne', name: 'Northbourne Run', pts: [[0, -980], [0, -760], [0, -560], [40, -360], along(CITY, CAP, 160), along(CITY, CAP, 460), along(CITY, CAP, 700)] },
    { id: 'triangle', name: 'The Triangle', loop: true,
      pts: [along(CITY, CAP, 110), along(CITY, CAP, 460), along(CITY, CAP, 700), [249, 375], along(CAP, RUS, 290), along(CAP, RUS, 580),
            along(CITY, RUS, 500), along(CITY, RUS, 250)] },
    { id: 'anzac', name: 'Anzac Dash', pts: [along(ANZAC0, WAR, 500), along(ANZAC0, WAR, 300), along(ANZAC0, WAR, 100), [399, -87], [300, -110], [100, -150], [-100, -175], [-350, -150], [-600, -150]] }
  ];

  var GREEN = [0.02, 0.05, 0.022, 0], DARKGREEN = [0.015, 0.04, 0.018, 0];
  function buildWorld() {
    var m = new Mesh(), fl = new Mesh(), lamps = [], i, j, r, R, q;
    var ROADC = function (hw, patch) { return [hw, patch, 0, 0]; };

    /* ground and water on one grid: 48 m cells, split to 8 m along the shore */
    var BIG = 48, SMALL = 8, gx, gz, G = BOUND + 150;
    function groundCell(x0, z0, size) {
      var inside = 0, corners = [[x0, z0], [x0 + size, z0], [x0, z0 + size], [x0 + size, z0 + size], [x0 + size / 2, z0 + size / 2]], c;
      for (c = 0; c < 5; c++) if (inLake(corners[c][0], corners[c][1])) inside++;
      if (inside === 0 || size <= SMALL) {
        var water = inside >= 3 || (size <= SMALL && inside >= 1 && inLake(x0 + size / 2, z0 + size / 2));
        var y = water ? -0.01 : -0.03, col = water ? [0, 0, 0, 0] : [0, 0, 0, 0], mat = water ? MAT.WATER : MAT.GROUND;
        fl.quad([x0, y, z0], [x0 + size, y, z0], [x0 + size, y, z0 + size], [x0, y, z0 + size], [0, 1, 0], col, mat);
        return;
      }
      if (inside === 5) { fl.quad([x0, -0.01, z0], [x0 + size, -0.01, z0], [x0 + size, -0.01, z0 + size], [x0, -0.01, z0 + size], [0, 1, 0], [0, 0, 0, 0], MAT.WATER); return; }
      var n = size / SMALL, a, b;
      for (a = 0; a < n; a++) for (b = 0; b < n; b++) groundCell(x0 + a * SMALL, z0 + b * SMALL, SMALL);
    }
    for (gx = -G; gx < G; gx += BIG) for (gz = -G; gz < G; gz += BIG) groundCell(gx, gz, BIG);

    /* roads: surface quads where no junction covers them, rails on the bridges, lamps */
    for (r = 0; r < roads.length; r++) {
      R = roads[r];
      var edge = R.hw + SHOULDER, last = R.loop ? R.N : R.N - 1, rc = ROADC(R.hw, 0);
      for (i = 0; i < last; i++) {
        j = (i + 1) % R.N;
        if ((R.fl[i] & 1) || (R.fl[j] & 1)) continue;
        var s0 = i * R.ds, s1 = (i + 1) * R.ds, ax = R.x[i], az = R.z[i], bx = R.x[j], bz = R.z[j];
        var anx = -R.tz[i], anz = R.tx[i], bnx = -R.tz[j], bnz = R.tx[j];
        fl.quad([ax - anx * edge, 0, az - anz * edge], [ax + anx * edge, 0, az + anz * edge], [bx + bnx * edge, 0, bz + bnz * edge], [bx - bnx * edge, 0, bz - bnz * edge],
                [0, 1, 0], rc, MAT.ROAD, [-edge, s0, edge, s0, edge, s1, -edge, s1]);
        if ((R.fl[i] & 2) && (R.fl[j] & 2)) {
          for (var sd = -1; sd <= 1; sd += 2) {
            var a0 = [ax + anx * edge * sd, 0, az + anz * edge * sd], b0 = [bx + bnx * edge * sd, 0, bz + bnz * edge * sd];
            m.quad(a0, b0, [b0[0], 0.95, b0[2]], [a0[0], 0.95, a0[2]], [-anx * sd, 0, -anz * sd], [0.3, 0.3, 0.32, sd], MAT.BARRIER, [s0, 0, s1, 0, s1, 0.95, s0, 0.95]);
          }
          // deck face down to the water
          fl.quad([ax - anx * edge, -0.6, az - anz * edge], [ax - anx * edge, 0, az - anz * edge], [bx - bnx * edge, 0, bz - bnz * edge], [bx - bnx * edge, -0.6, bz - bnz * edge], [-anx, 0, -anz], [0.05, 0.05, 0.06, 0], MAT.GROUND);
          fl.quad([ax + anx * edge, 0, az + anz * edge], [ax + anx * edge, -0.6, az + anz * edge], [bx + bnx * edge, -0.6, bz + bnz * edge], [bx + bnx * edge, 0, bz + bnz * edge], [anx, 0, anz], [0.05, 0.05, 0.06, 0], MAT.GROUND);
        }
      }
      var per = Math.round(LAMP / R.ds);
      for (i = Math.round(per / 2); i < R.N; i += per) {
        if (R.fl[i] & 1) continue;
        var side = (Math.floor((i * R.ds) / LAMP) % 2) * 2 - 1;
        var lx = R.x[i] - R.tz[i] * (edge + 0.5) * side, lz = R.z[i] + R.tx[i] * (edge + 0.5) * side;
        m.box(lx, lz, R.tx[i], R.tz[i], 0.09, 0.09, 0, 6.2, [0.12, 0.12, 0.14, 0], MAT.GROUND);
        var hx = lx + R.tz[i] * 1.3 * side, hz = lz - R.tx[i] * 1.3 * side;
        m.box(hx, hz, R.tx[i], R.tz[i], 0.35, 0.7, 6.1, 6.28, [1.0, 0.66, 0.3, 0], MAT.EMISSIVE);
        lamps.push([hx, hz]);
      }
    }
    for (i = 0; i < patches.length; i++) fl.fan(patches[i][0], patches[i][1], patches[i][2], 0.02, 28, ROADC(0, 1), MAT.ROAD);
    // roundabout islands: raised grass inside the small rings
    for (r = 0; r < roads.length; r++) {
      R = roads[r];
      if (!R.loop || R.len > 2 * Math.PI * 92) continue;
      var rr = R.len / (2 * Math.PI), cx0 = 0, cz0 = 0;
      for (i = 0; i < R.N; i++) { cx0 += R.x[i] / R.N; cz0 += R.z[i] / R.N; }
      var ri = rr - R.hw - 2.6;   // room to turn in off a road that ends on the ring
      if (rr > 80) continue;                     // Capital Circle holds Parliament House
      m.cyl(cx0, cz0, ri, ri, 0, 0.22, 24, GREEN, MAT.GROUND);
      addDisc(cx0, cz0, ri);
      if (rr < 30) m.cyl(cx0, cz0, 0.5, 0.5, 0, 9, 6, [0.55, 0.55, 0.6, 0], MAT.EMISSIVE); // a floodlit mast
    }

    /* hills: low-poly cones, solid to drive against */
    for (i = 0; i < HILLS.length; i++) {
      var H = HILLS[i];
      m.cyl(H[0], H[1], H[2], H[2] * 0.55, 0, H[3] * 0.55, 14, DARKGREEN, MAT.GROUND);
      m.cyl(H[0], H[1], H[2] * 0.55, H[2] * 0.12, H[3] * 0.55, H[3], 14, [0.012, 0.03, 0.015, 0], MAT.GROUND);
      addDisc(H[0], H[1], H[2] - 6);
    }
    var STONE = [0.5, 0.48, 0.42, 0], WHITE = [0.62, 0.62, 0.6, 0], STEEL = [0.42, 0.44, 0.5, 0];
    // the tower on Black Mountain
    var bm = BLACKMT, bt = HILLS[0][3];
    m.cyl(bm[0], bm[1], 7, 5, bt, bt + 70, 10, [0.16, 0.16, 0.18, 0], MAT.GROUND);
    m.cyl(bm[0], bm[1], 16, 16, bt + 40, bt + 52, 12, [0.2, 0.2, 0.24, 0], MAT.BUILDING);
    m.cyl(bm[0], bm[1], 11, 11, bt + 52, bt + 58, 12, STEEL, MAT.GROUND);
    m.cyl(bm[0], bm[1], 0.6, 0.6, bt + 70, bt + 118, 6, [0.7, 0.7, 0.75, 0], MAT.EMISSIVE);
    m.box(bm[0], bm[1], 1, 0, 0.9, 0.9, bt + 118, bt + 120, [1.0, 0.12, 0.1, 0], MAT.EMISSIVE);

    /* Parliament House on Capital Hill: a grassed mound, a low pale block, the four-legged mast */
    m.cyl(CAP[0], CAP[1], 72, 58, 0, 9, 24, GREEN, MAT.GROUND);
    m.box(CAP[0], CAP[1], 1, 0, 36, 30, 9, 15, STONE, MAT.EMISSIVE, [0.08, 0.08, 0.09, 0]);
    m.box(CAP[0], CAP[1], 1, 0, 12, 34, 9, 17, WHITE, MAT.EMISSIVE, [0.08, 0.08, 0.09, 0]);
    addDisc(CAP[0], CAP[1], 72);
    var apex = [CAP[0], 15 + 70, CAP[1]], leg;
    for (leg = 0; leg < 4; leg++) {
      var lx0 = CAP[0] + (leg & 1 ? 30 : -30), lz0 = CAP[1] + (leg & 2 ? 30 : -30), w = 0.9;
      m.quad([lx0 - w, 9, lz0], [lx0 + w, 9, lz0], [apex[0] + w * 0.3, apex[1], apex[2]], [apex[0] - w * 0.3, apex[1], apex[2]], [0, 0, 1], STEEL, MAT.EMISSIVE);
      m.quad([lx0, 9, lz0 - w], [lx0, 9, lz0 + w], [apex[0], apex[1], apex[2] + w * 0.3], [apex[0], apex[1], apex[2] - w * 0.3], [1, 0, 0], STEEL, MAT.EMISSIVE);
    }
    m.box(CAP[0], CAP[1], 1, 0, 0.3, 0.3, apex[1], apex[1] + 12, STEEL, MAT.EMISSIVE);
    m.box(CAP[0] + 4, CAP[1], 1, 0, 4, 0.1, apex[1] + 7, apex[1] + 11, [0.05, 0.12, 0.5, 0], MAT.EMISSIVE);

    /* the land axis: Old Parliament House, the lake and the War Memorial */
    var AX = toward(CAP, WAR, 1), ad = [(WAR[0] - CAP[0]), (WAR[1] - CAP[1])], al = Math.hypot(ad[0], ad[1]); ad = [ad[0] / al, ad[1] / al];
    var oph = toward(CAP, WAR, 200);
    m.box(oph[0], oph[1], -ad[1], ad[0], 42, 11, 0, 9, WHITE, MAT.EMISSIVE, [0.1, 0.1, 0.1, 0]);
    m.box(oph[0], oph[1], -ad[1], ad[0], 14, 16, 0, 12, WHITE, MAT.EMISSIVE, [0.1, 0.1, 0.1, 0]);
    addBox(oph[0], oph[1], -ad[1], ad[0], 42, 16);
    void AX;
    var wm = toward(WAR, AINSLIE, 72);
    m.box(wm[0], wm[1], -ad[1], ad[0], 26, 20, 0, 10, STONE, MAT.EMISSIVE, [0.14, 0.14, 0.13, 0]);
    m.box(wm[0], wm[1], -ad[1], ad[0], 14, 14, 10, 15, STONE, MAT.EMISSIVE, [0.14, 0.14, 0.13, 0]);
    m.cyl(wm[0], wm[1], 11, 7, 15, 20, 12, [0.3, 0.42, 0.36, 0], MAT.EMISSIVE);
    m.cyl(wm[0], wm[1], 7, 0, 20, 25, 12, [0.3, 0.42, 0.36, 0], MAT.EMISSIVE);
    addBox(wm[0], wm[1], -ad[1], ad[0], 26, 20);
    // the carillon on its island, and the jet in the central basin
    var cari = [430, 150];
    m.cyl(cari[0], cari[1], 18, 18, -0.4, 0.5, 16, GREEN, MAT.GROUND);
    for (q = 0; q < 3; q++) { var ca = q / 3 * 6.2832 + 0.5, px = cari[0] + Math.cos(ca) * 4.5, pz = cari[1] + Math.sin(ca) * 4.5; m.box(px, pz, Math.cos(ca), Math.sin(ca), 2.2, 1.6, 0.5, 50, WHITE, MAT.EMISSIVE); }
    addDisc(cari[0], cari[1], 18);
    m.cyl(200, 60, 1.4, 0.4, -0.3, 95, 8, [0.62, 0.7, 0.8, 0], MAT.EMISSIVE);
    m.cyl(200, 60, 9, 6, -0.3, 1.2, 12, [0.3, 0.36, 0.42, 0], MAT.EMISSIVE);
    // the column at Russell
    m.cyl(RUS[0], RUS[1], 1.8, 1.4, 0.2, 52, 8, STEEL, MAT.EMISSIVE);
    m.box(RUS[0], RUS[1], 1, 0, 3, 1.2, 52, 55, [0.55, 0.5, 0.35, 0], MAT.EMISSIVE);
    // library, gallery and court on the south shore
    m.box(90, 310, 1, 0, 26, 15, 0, 13, WHITE, MAT.EMISSIVE, [0.1, 0.1, 0.1, 0]); addBox(90, 310, 1, 0, 26, 15);
    m.box(330, 245, 0.96, 0.27, 20, 15, 0, 20, [0.11, 0.12, 0.15, 0.4], MAT.BUILDING, [0.05, 0.05, 0.07, 0]); addBox(330, 245, 0.96, 0.27, 20, 15);
    m.box(255, 232, 0.96, 0.27, 16, 10, 0, 9, [0.13, 0.11, 0.1, 0.1], MAT.BUILDING, [0.05, 0.05, 0.07, 0]); addBox(255, 232, 0.96, 0.27, 16, 10);
    // Scrivener Dam at the west end of the lake
    m.box(-895, 35, 0.3, 0.95, 45, 3, -0.5, 1.5, [0.2, 0.2, 0.21, 0], MAT.GROUND); addBox(-895, 35, 0.3, 0.95, 45, 3);

    /* sprint gates: two pillars across the road at each start */
    for (i = 0; i < ROUTES.length; i++) {
      var g = ROUTES[i].pts[0], nr = nearestRoad(g[0], g[1]), GR = roads[nr[0]], gi = nr[1], gw = GR.hw + 1.0;
      for (q = -1; q <= 1; q += 2) m.box(g[0] - GR.tz[gi] * gw * q, g[1] + GR.tx[gi] * gw * q, GR.tx[gi], GR.tz[gi], 0.35, 0.35, 0, 7, [0.71, 0.47, 1.0, 0], MAT.EMISSIVE);
      var fwd = (ROUTES[i].pts[1][0] - g[0]) * GR.tx[gi] + (ROUTES[i].pts[1][1] - g[1]) * GR.tz[gi] < 0 ? -1 : 1;
      ROUTES[i].tx = GR.tx[gi] * fwd; ROUTES[i].tz = GR.tz[gi] * fwd;   // points the way the sprint runs
    }

    /* buildings and trees on a jittered grid, each kept clear of the roads, the lake and the hills */
    var tints = [[0.16, 0.14, 0.2], [0.12, 0.13, 0.17], [0.2, 0.16, 0.16], [0.1, 0.1, 0.13]];
    var houseT = [[0.14, 0.1, 0.09], [0.12, 0.11, 0.1], [0.1, 0.09, 0.1], [0.15, 0.13, 0.11]];
    var placed = [], trees = 0, pgrid = {};
    function pkey(x, z) { return (Math.floor((x + 2000) / 40) << 10) + Math.floor((z + 2000) / 40); }
    function clearOf(x, z, rad) {
      var cx = Math.floor((x + 2000) / 40), cz = Math.floor((z + 2000) / 40), dx, dz, k;
      for (dx = -1; dx <= 1; dx++) for (dz = -1; dz <= 1; dz++) {
        var cell = pgrid[((cx + dx) << 10) + cz + dz];
        if (!cell) continue;
        for (k = 0; k < cell.length; k++) { var p = placed[cell[k]]; if (Math.hypot(x - p[0], z - p[1]) < rad + p[2]) return false; }
      }
      return true;
    }
    function mark(x, z, rad) { placed.push([x, z, rad]); (pgrid[pkey(x, z)] || (pgrid[pkey(x, z)] = [])).push(placed.length - 1); }
    function zoneAt(x, z) {
      var dc = Math.hypot(x - CITY[0], z - CITY[1]), dp = Math.hypot(x - CAP[0], z - CAP[1]);
      if (inLake(x, z)) return null;
      for (var h = 0; h < HILLS.length; h++) if (Math.hypot(x - HILLS[h][0], z - HILLS[h][1]) < HILLS[h][2] + 14) return null;
      if (dp < 180) return null;
      if (dc < 150) return 'civic';
      if (dc < 330 && z < -380) return 'town';
      if (Math.hypot(x - WODEN[0], z - WODEN[1]) < 170) return 'civic';
      if (Math.hypot(x - RUS[0], z - RUS[1]) < 170) return 'offices';
      if (z > 230 && z < 500 && x > -20 && x < 520) return 'offices';
      if (x > 480 && x < 860 && z > 470 && z < 800) return 'town';
      if (z > -150 && z < 20 && x > -480 && x < 760) return 'park';
      if (Math.hypot(x - WAR[0], z - WAR[1]) < 160) return 'park';
      return 'suburb';
    }
    var STEP = 20;
    for (gx = -BOUND; gx < BOUND; gx += STEP) for (gz = -BOUND; gz < BOUND; gz += STEP) {
      var x = gx + rnd() * STEP, z = gz + rnd() * STEP, zone = zoneAt(x, z);
      if (!zone) continue;
      var nr2 = nearestRoad(x, z), RR = roads[nr2[0]], d = nr2[2] - RR.hw - SHOULDER, ti = nr2[1], tx = RR.tx[ti], tz = RR.tz[ti];
      if (d < 2.5) continue;
      var hl, hd, ht, col, t2, dens, isHouse = false;
      if (zone === 'civic') { hl = 7 + rnd() * 8; hd = 7 + rnd() * 8; ht = 12 + Math.pow(rnd(), 1.8) * 46; dens = 0.9; }
      else if (zone === 'town') { hl = 6 + rnd() * 6; hd = 5 + rnd() * 6; ht = 6 + rnd() * 9; dens = 0.75; }
      else if (zone === 'offices') { hl = 12 + rnd() * 16; hd = 9 + rnd() * 10; ht = 10 + rnd() * 14; dens = 0.35; }
      else if (zone === 'park') { hl = 0; dens = 0; }
      else { hl = 4 + rnd() * 3.5; hd = 3.5 + rnd() * 3; ht = 3.4 + rnd() * 1.6; dens = 0.42; isHouse = true; }
      var treeP = zone === 'park' ? 0.5 : zone === 'suburb' ? 0.3 : zone === 'offices' ? 0.25 : 0.06;
      if (hl && rnd() < dens) {
        // sit the block back from the kerb, long side along the road
        var off = RR.hw + SHOULDER + 2.5 + hd, nx = -tz, nz = tx, sgn = (x - RR.x[ti]) * nx + (z - RR.z[ti]) * nz > 0 ? 1 : -1;
        var cx = RR.x[ti] + nx * off * sgn, cz = RR.z[ti] + nz * off * sgn;
        if (nr2[2] > 70) { cx = x; cz = z; }
        var rad = Math.max(hl, hd), okP = clearOf(cx, cz, rad + 1.5) && zoneAt(cx, cz) === zone;
        for (q = -1; q <= 1 && okP; q += 2) for (var q2 = -1; q2 <= 1 && okP; q2 += 2) {
          var kx = cx + tx * hl * q + nx * hd * q2, kz = cz + tz * hl * q + nz * hd * q2, n2 = nearestRoad(kx, kz);
          if (n2[2] < roads[n2[0]].hw + SHOULDER + 1.2 || inLake(kx, kz)) okP = false;
        }
        for (q = 0; q < patches.length && okP; q++) if (Math.hypot(cx - patches[q][0], cz - patches[q][1]) < patches[q][2] + rad) okP = false;
        if (okP) {
          {
            if (isHouse) {
              t2 = houseT[Math.floor(rnd() * houseT.length)];
              m.box(cx, cz, tx, tz, hl, hd, 0, ht, [t2[0], t2[1], t2[2], 0], MAT.GROUND, [0.06, 0.045, 0.04, 0]);
              if (rnd() < 0.45) m.box(cx - nx * (hd + 0.1) * sgn, cz - nz * (hd + 0.1) * sgn, tx, tz, 0.5, 0.08, 1.4, 2.2, [1.0, 0.8, 0.5, 0], MAT.EMISSIVE);
            } else {
              t2 = tints[Math.floor(rnd() * tints.length)];
              m.box(cx, cz, tx, tz, hl, hd, 0, ht, [t2[0], t2[1], t2[2], 0.05 + rnd() * 0.95], MAT.BUILDING, [0.05, 0.05, 0.07, 0]);
              if (zone === 'civic' && ht > 34) m.box(cx, cz, tx, tz, 0.3, 0.3, ht, ht + 0.6, [1.0, 0.12, 0.1, 0], MAT.EMISSIVE);
              if (zone === 'town' && rnd() < 0.4) {
                var inks = [[0.71, 0.47, 1.0], [0.18, 0.83, 0.88], [1.0, 0.2, 0.6], [0.3, 1.0, 0.55]], ik = inks[Math.floor(rnd() * 4)];
                var so = (rnd() - 0.5) * hl * 1.2, sx = cx + tx * so - nx * (hd + 0.3) * sgn, sz = cz + tz * so - nz * (hd + 0.3) * sgn;
                m.box(sx, sz, tx, tz, 0.5 + rnd() * 0.5, 0.14, 3.6, Math.min(ht - 0.4, 5.5 + rnd() * 3), [ik[0], ik[1], ik[2], 0], MAT.EMISSIVE);
              }
            }
            addBox(cx, cz, tx, tz, hl, hd); mark(cx, cz, rad);
            continue;
          }
        }
      }
      if (trees < 1500 && rnd() < treeP && d > 3 && clearOf(x, z, 3)) {
        var okT = true;
        for (q = 0; q < patches.length; q++) if (Math.hypot(x - patches[q][0], z - patches[q][1]) < patches[q][2] + 3) { okT = false; break; }
        if (!okT) continue;
        var th = 5 + rnd() * 5, cw = 1.6 + rnd() * 1.8, ang = rnd() * 3.14, ctx = Math.cos(ang), ctz = Math.sin(ang);
        m.cyl(x, z, 0.3, 0.22, 0, th * 0.4, 4, [0.09, 0.07, 0.06, 0], MAT.GROUND);
        m.cyl(x, z, cw, cw * 0.18, th * 0.32, th, 6, [0.024, 0.062, 0.027, 0], MAT.GROUND);
        addDisc(x, z, 0.55); mark(x, z, cw); trees++;
      }
    }
    return { mesh: m, flat: fl, lamps: lamps };
  }

  Mesh.prototype.lbox = function (x0, x1, y0, y1, z0, z1, col, mat) { // box in car-local axes
    this.quad([x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [0, 0, -1], col, mat);
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], col, mat);
    this.quad([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], [0, 1, 0], col, mat);
    this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], col, mat);
    this.quad([x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1], [-1, 0, 0], col, mat);
    this.quad([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], [1, 0, 0], col, mat);
  };
  // Skin between cross-sections. Each station is a list of [x, y, z>=0] points,
  // bottom to top-centre; the other flank is mirrored. pick(i, j) -> [colour, material].
  Mesh.prototype.loft = function (st, pick) {
    var i, j, sg, n = st[0].length;
    for (i = 0; i < st.length - 1; i++) for (j = 0; j < n - 1; j++) for (sg = -1; sg <= 1; sg += 2) {
      var a = st[i][j], b = st[i + 1][j], c = st[i + 1][j + 1], d = st[i][j + 1];
      a = [a[0], a[1], a[2] * sg]; b = [b[0], b[1], b[2] * sg]; c = [c[0], c[1], c[2] * sg]; d = [d[0], d[1], d[2] * sg];
      var ux = c[0] - a[0], uy = c[1] - a[1], uz = c[2] - a[2], vx = d[0] - b[0], vy = d[1] - b[1], vz = d[2] - b[2];
      var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz);
      if (l < 1e-7) continue;
      nx /= l; ny /= l; nz /= l;
      var mx = (a[0] + b[0] + c[0] + d[0]) / 4, my = (a[1] + b[1] + c[1] + d[1]) / 4 - 0.7, mz = (a[2] + b[2] + c[2] + d[2]) / 4;
      if (ny * my + nz * mz + nx * 0 < 0 && Math.abs(ny * my + nz * mz) > 1e-4) { nx = -nx; ny = -ny; nz = -nz; }
      var cm = pick(i, j);
      this.quad(a, b, c, d, [nx, ny, nz], cm[0], cm[1]);
    }
  };
  Mesh.prototype.cap = function (stn, nx, col, mat) { // close an end of a loft
    var pts = stn.slice(), i;
    for (i = stn.length - 2; i >= 0; i--) pts.push([stn[i][0], stn[i][1], -stn[i][2]]);
    for (i = 1; i < pts.length - 1; i++) {
      this.vert(pts[0], [nx, 0, 0], 0, 0, col, mat); this.vert(pts[i], [nx, 0, 0], 0, 0, col, mat); this.vert(pts[i + 1], [nx, 0, 0], 0, 0, col, mat);
    }
  };
  /* Two original cars in two familiar body styles: an early-90s wedge-nosed
     six-window sedan and a late-90s round-nosed single-cab ute with a separate
     tub. No badge, name or livery of any manufacturer is drawn. */
  function buildCar(S) {
    var m = new Mesh(), W = S.width / 2, P = [S.paint[0], S.paint[1], S.paint[2], 0];
    var dark = [0.03, 0.03, 0.04, 0], trim = [0.07, 0.07, 0.08, 0], glass = [0.02, 0.03, 0.05, 0];
    var lamp = [1, 0.96, 0.84, 0], amber = [0.95, 0.5, 0.06, 0], red = [1, 0.07, 0.05, 0], chrome = [0.5, 0.52, 0.56, 0];
    var f = S.front, r = S.rear, sgn, i;
    function sec(x, w, yb, belt, top) { return [[x, yb, w - 0.06], [x, yb + 0.11, w], [x, belt - 0.06, w], [x, belt, w - 0.08], [x, top, 0]]; }
    function cab(x, wb, yb, wr, yr, yc) { return [[x, yb, wb], [x, yr, wr], [x, yc, 0]]; }
    var PA = [P, MAT.PAINT], GL = [glass, MAT.GLASS], TR = [trim, MAT.GLASS];
    if (!S.ute) {
      var body = [sec(f, 0.70, 0.36, 0.58, 0.62), sec(f - 0.12, 0.85, 0.3, 0.63, 0.68), sec(f - 0.36, W, 0.27, 0.7, 0.76), sec(1.0, W, 0.26, 0.86, 0.91),
                  sec(-1.55, W, 0.26, 0.9, 0.95), sec(r + 0.34, W, 0.27, 0.92, 0.96), sec(r + 0.1, 0.86, 0.3, 0.9, 0.93), sec(r, 0.76, 0.36, 0.86, 0.88)];
      m.loft(body, function (i, j) { return j === 0 ? TR : PA; });
      m.cap(body[0], 1, P, MAT.PAINT); m.cap(body[body.length - 1], -1, P, MAT.PAINT);
      // six-window glasshouse: screen, front door, B-pillar, rear door, quarter light, C-pillar, rear screen
      var wc = W - 0.07, wr = W - 0.25;
      var cs = [cab(1.0, wc, 0.86, wc, 0.86, 0.91), cab(0.3, wc, 0.875, wr, 1.335, 1.385), cab(-0.3, wc, 0.885, wr, 1.35, 1.4), cab(-0.38, wc, 0.886, wr, 1.35, 1.4),
                cab(-0.95, wc, 0.895, wr, 1.34, 1.39), cab(-1.02, wc, 0.896, wr, 1.335, 1.385), cab(-1.25, wc, 0.9, wr + 0.02, 1.2, 1.3), cab(-1.72, wc, 0.9, wc, 0.9, 0.95)];
      var side = [GL, GL, TR, GL, TR, GL, PA], top = [GL, PA, PA, PA, PA, GL, GL];
      m.loft(cs, function (i, j) { return j === 0 ? side[i] : top[i]; });
      // slim wrap-around lamps either side of a narrow slot
      m.quad([f + 0.005, 0.49, -0.24], [f + 0.005, 0.49, 0.24], [f + 0.005, 0.555, 0.24], [f + 0.005, 0.555, -0.24], [1, 0, 0], dark, MAT.GLASS);
      for (sgn = -1; sgn <= 1; sgn += 2) {
        m.quad([f + 0.005, 0.485, sgn * 0.26], [f + 0.005, 0.485, sgn * 0.68], [f + 0.005, 0.57, sgn * 0.68], [f + 0.005, 0.57, sgn * 0.26], [1, 0, 0], lamp, MAT.EMISSIVE);
        m.quad([f + 0.002, 0.485, sgn * 0.7], [f - 0.12, 0.5, sgn * 0.855], [f - 0.12, 0.585, sgn * 0.855], [f + 0.002, 0.57, sgn * 0.7], [0.6, 0, sgn * 0.8], amber, MAT.EMISSIVE);
        m.quad([r - 0.006, 0.62, sgn * 0.22], [r - 0.006, 0.62, sgn * 0.74], [r - 0.006, 0.78, sgn * 0.74], [r - 0.006, 0.78, sgn * 0.22], [-1, 0, 0], red, MAT.BRAKE);
        m.quad([r - 0.002, 0.62, sgn * 0.76], [r + 0.1, 0.63, sgn * 0.865], [r + 0.1, 0.79, sgn * 0.865], [r - 0.002, 0.78, sgn * 0.76], [-0.6, 0, sgn * 0.8], red, MAT.BRAKE);
        m.lbox(-S.b + 0.5, S.a - 0.5, 0.5, 0.54, sgn > 0 ? W - 0.005 : -W - 0.012, sgn > 0 ? W + 0.012 : -W + 0.005, chrome, MAT.GLASS);
        m.lbox(0.74, 0.92, 0.9, 1.0, sgn > 0 ? W - 0.1 : -W - 0.08, sgn > 0 ? W + 0.08 : -W + 0.1, dark, MAT.GLASS);
      }
      m.quad([r - 0.006, 0.63, -0.2], [r - 0.006, 0.63, 0.2], [r - 0.006, 0.77, 0.2], [r - 0.006, 0.77, -0.2], [-1, 0, 0], [0.16, 0.02, 0.03, 0], MAT.GLASS);
      m.lbox(f - 0.02, f + 0.012, 0.4, 0.43, -0.66, 0.66, chrome, MAT.GLASS);
      m.quad([f + 0.008, 0.3, -0.26], [f + 0.008, 0.3, 0.26], [f + 0.008, 0.4, 0.26], [f + 0.008, 0.4, -0.26], [1, 0, 0], [0.5, 0.5, 0.46, 0], MAT.EMISSIVE);
      m.quad([r - 0.008, 0.46, -0.26], [r - 0.008, 0.46, 0.26], [r - 0.008, 0.57, 0.26], [r - 0.008, 0.57, -0.26], [-1, 0, 0], [0.5, 0.5, 0.46, 0], MAT.EMISSIVE);
    } else {
      var cb = -0.5;
      var nose = [sec(f, 0.56, 0.38, 0.6, 0.67), sec(f - 0.1, 0.78, 0.31, 0.66, 0.75), sec(f - 0.3, 0.9, 0.28, 0.74, 0.83), sec(1.1, W, 0.28, 0.9, 0.95), sec(cb, W, 0.28, 0.95, 0.97)];
      m.loft(nose, function (i, j) { return j === 0 ? TR : PA; });
      m.cap(nose[0], 1, P, MAT.PAINT); m.cap(nose[nose.length - 1], -1, P, MAT.PAINT);
      var uw = W - 0.07, ur = W - 0.24;
      var uc = [cab(1.1, uw, 0.9, uw, 0.9, 0.95), cab(0.42, uw, 0.92, ur, 1.36, 1.42), cab(-0.16, uw, 0.94, ur, 1.4, 1.45), cab(cb + 0.06, uw, 0.95, ur, 1.37, 1.41), cab(cb, uw, 0.95, uw - 0.02, 0.97, 0.99)];
      var uside = [GL, GL, PA, PA], utop = [GL, PA, PA, GL];
      m.loft(uc, function (i, j) { return j === 0 ? uside[i] : utop[i]; });
      // separate tub with a soft cover, upright lamps on its corners
      m.lbox(r, cb - 0.05, 0.3, 1.02, -W, W, P, MAT.PAINT);
      m.quad([cb - 0.08, 1.026, -W + 0.03], [r + 0.03, 1.026, -W + 0.03], [r + 0.03, 1.026, W - 0.03], [cb - 0.08, 1.026, W - 0.03], [0, 1, 0], dark, MAT.GLASS);
      m.lbox(cb - 0.05, cb, 0.3, 0.95, -W + 0.02, W - 0.02, dark, MAT.GLASS);
      m.lbox(r - 0.05, r + 0.03, 0.32, 0.48, -W + 0.04, W - 0.04, P, MAT.PAINT);
      m.quad([f + 0.005, 0.5, -0.27], [f + 0.005, 0.5, 0.27], [f + 0.005, 0.63, 0.27], [f + 0.005, 0.63, -0.27], [1, 0, 0], dark, MAT.GLASS);
      for (i = -2; i <= 2; i++) m.quad([f + 0.008, 0.51, i * 0.1 - 0.012], [f + 0.008, 0.51, i * 0.1 + 0.012], [f + 0.008, 0.62, i * 0.1 + 0.012], [f + 0.008, 0.62, i * 0.1 - 0.012], [1, 0, 0], chrome, MAT.GLASS);
      for (sgn = -1; sgn <= 1; sgn += 2) {
        // teardrop lamps: across the corner and swept back along the wing
        m.quad([f + 0.005, 0.5, sgn * 0.29], [f + 0.005, 0.52, sgn * 0.55], [f + 0.005, 0.66, sgn * 0.55], [f + 0.005, 0.63, sgn * 0.29], [1, 0, 0], lamp, MAT.EMISSIVE);
        m.quad([f + 0.002, 0.52, sgn * 0.565], [f - 0.1, 0.55, sgn * 0.785], [f - 0.1, 0.7, sgn * 0.785], [f + 0.002, 0.66, sgn * 0.565], [0.65, 0, sgn * 0.76], lamp, MAT.EMISSIVE);
        m.quad([f - 0.102, 0.57, sgn * 0.79], [f - 0.3, 0.66, sgn * 0.905], [f - 0.3, 0.76, sgn * 0.905], [f - 0.102, 0.7, sgn * 0.79], [0.45, 0, sgn * 0.9], lamp, MAT.EMISSIVE);
        m.quad([1.45, 0.62, sgn * (W + 0.004)], [1.56, 0.62, sgn * (W + 0.004)], [1.56, 0.67, sgn * (W + 0.004)], [1.45, 0.67, sgn * (W + 0.004)], [0, 0, sgn], amber, MAT.EMISSIVE);
        m.quad([r - 0.006, 0.6, sgn * (W - 0.2)], [r - 0.006, 0.6, sgn * (W - 0.02)], [r - 0.006, 0.98, sgn * (W - 0.02)], [r - 0.006, 0.98, sgn * (W - 0.2)], [-1, 0, 0], red, MAT.BRAKE);
        m.lbox(-S.b + 0.5, S.a - 0.5, 0.5, 0.55, sgn > 0 ? W - 0.005 : -W - 0.014, sgn > 0 ? W + 0.014 : -W + 0.005, trim, MAT.GLASS);
        m.lbox(0.8, 0.98, 0.94, 1.05, sgn > 0 ? W - 0.1 : -W - 0.1, sgn > 0 ? W + 0.1 : -W + 0.1, dark, MAT.GLASS);
      }
      m.quad([f + 0.008, 0.3, -0.26], [f + 0.008, 0.3, 0.26], [f + 0.008, 0.4, 0.26], [f + 0.008, 0.4, -0.26], [1, 0, 0], [0.6, 0.52, 0.1, 0], MAT.EMISSIVE);
      m.quad([r - 0.056, 0.34, -0.26], [r - 0.056, 0.34, 0.26], [r - 0.056, 0.45, 0.26], [r - 0.056, 0.45, -0.26], [-1, 0, 0], [0.6, 0.52, 0.1, 0], MAT.EMISSIVE);
    }
    // wheel arches
    var arch = [], a;
    for (a = 0; a < 12; a++) arch.push([Math.cos(a / 12 * 6.2832) * 0.4, Math.sin(a / 12 * 6.2832) * 0.4]);
    [S.a, -S.b].forEach(function (wx) {
      var pts = arch.map(function (q) { return [wx + q[0], S.rw + 0.02 + q[1]]; });
      m.poly(pts, W + 0.004, dark, MAT.GLASS); m.poly(pts, -W - 0.004, dark, MAT.GLASS);
    });
    return m;
  }
  function buildWheel(S) { // axis along z, centred on the origin
    var m = new Mesh(), n = 12, w = 0.11, R = S.rw, i, tyreC = [0.035, 0.035, 0.04, 0], hub = [S.hub[0], S.hub[1], S.hub[2], 0];
    for (i = 0; i < n; i++) {
      var a0 = i / n * 6.2832, a1 = (i + 1) / n * 6.2832, c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      m.quad([c0 * R, s0 * R, -w], [c1 * R, s1 * R, -w], [c1 * R, s1 * R, w], [c0 * R, s0 * R, w], [(c0 + c1) / 2, (s0 + s1) / 2, 0], tyreC, MAT.GLASS);
      for (var sg = -1; sg <= 1; sg += 2) {
        var nn = [0, 0, sg], zz = sg * w, col = i % 4 === 0 ? tyreC : hub, hr = R * 0.66;
        m.vert([0, 0, zz], nn, 0, 0, col, MAT.GLASS); m.vert([c0 * hr, s0 * hr, zz], nn, 0, 0, col, MAT.GLASS); m.vert([c1 * hr, s1 * hr, zz], nn, 0, 0, col, MAT.GLASS);
        m.quad([c0 * hr, s0 * hr, zz], [c1 * hr, s1 * hr, zz], [c1 * R, s1 * R, zz], [c0 * R, s0 * R, zz], nn, tyreC, MAT.GLASS);
      }
    }
    return m;
  }

  /* ============================================================
     RENDERER
     ============================================================ */
  var VS = 'attribute vec3 aP;attribute vec3 aN;attribute vec2 aU;attribute vec4 aC;attribute float aM;' +
    'uniform mat4 uVP;uniform mat4 uM;uniform float uMirror;varying vec3 vP;varying vec3 vN;varying vec2 vU;varying vec4 vC;varying float vM;' +
    'void main(){vec4 w=uM*vec4(aP,1.0);w.y*=uMirror;vP=w.xyz;vN=mat3(uM)*aN;vN.y*=uMirror;vU=aU;vC=aC;vM=aM;gl_Position=uVP*w;}';
  var FS = '#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n' +
    'varying vec3 vP;varying vec3 vN;varying vec2 vU;varying vec4 vC;varying float vM;' +
    'uniform vec3 uCam;uniform vec3 uCar;uniform vec2 uFwd;uniform float uBrake;uniform float uHW;uniform float uLamp;uniform float uGhost;uniform vec3 uNear;uniform vec3 uGlow;uniform float uWet;' +
    'float h(vec2 p){return fract(sin(dot(mod(p,289.0),vec2(127.1,311.7)))*43758.5453);}' +
    'vec3 ink(float s){float k=floor(s*4.0);if(k<1.0)return vec3(0.71,0.47,1.0);if(k<2.0)return vec3(0.18,0.83,0.88);if(k<3.0)return vec3(1.0,0.2,0.6);return vec3(0.3,1.0,0.55);}' +
    // a city that is not there: what glossy paint and glass pick up
    'vec3 env(vec3 R){float az=atan(R.z,R.x)*5.0;float c=floor(az);float b=step(0.55,h(vec2(c,1.0)))*exp(-abs(R.y-0.1)*11.0);' +
    'return vec3(0.1,0.06,0.2)*smoothstep(-0.2,0.5,R.y)+b*ink(h(vec2(c,2.0)))*0.9+vec3(1.0,0.62,0.3)*exp(-abs(R.y-0.45)*7.0)*0.25;}' +
    'void main(){vec3 n=normalize(vN);vec3 V=normalize(uCam-vP);vec3 col;float emis=0.0;float alpha=1.0;float dist=length(vP-uCam);' +
    'vec3 amb=vec3(0.10,0.08,0.165);float dif=max(dot(n,normalize(vec3(0.3,0.8,0.4))),0.0)*0.22;' +
    'vec2 d=vP.xz-(uCar.xz+uFwd*1.9);float al=dot(d,uFwd);float la=dot(d,vec2(-uFwd.y,uFwd.x));float w=0.9+al*0.4;' +
    'float hl=step(0.0,al)*exp(-(la*la)/(w*w))*exp(-al*0.026)*2.3*clamp(al*0.4,0.0,1.0)*clamp(1.0-abs(vP.y)*0.1,0.0,1.0);' +
    'vec2 nd=vP.xz-uNear.xz;float nl=1.6/(1.0+dot(nd,nd)*0.012);' +
    'vec3 light=amb+dif*vec3(0.5,0.5,0.85)+hl*vec3(1.0,0.94,0.8);' +
    'if(vM<0.5){float fr=pow(1.0-max(dot(n,V),0.0),3.0);light+=vec3(0.24,0.24,0.28)+nl*vec3(1.0,0.62,0.3)*(0.2+0.5*max(n.y,0.0));' +
    'col=min(vC.rgb*light,vec3(0.8))+env(reflect(-V,n))*(0.16+0.7*fr);}' +
    'else if(vM<1.5){float u=vU.x;float v=vU.y;float au=abs(u);float hw=vC.r;float mk=1.0-vC.g;float base=0.055+0.03*h(floor(vP.xz*5.0));' +
    'float k=floor(v/uLamp);float dv=v-(k+0.5)*uLamp;float sd=mod(k,2.0)*2.0-1.0;float du=u-sd*(hw+0.8);' +
    'light+=mk*1.5*exp(-(du*du+dv*dv)/75.0)*vec3(1.0,0.62,0.28)+(1.0-mk)*nl*0.45*vec3(1.0,0.62,0.3);' +
    // underglow and brake light spill
    'vec2 cd=vP.xz-uCar.xz;float ca=dot(cd,uFwd);float cl=dot(cd,vec2(-uFwd.y,uFwd.x));' +
    'light+=uGlow*1.1*exp(-(ca*ca/6.5+cl*cl/1.5));light+=vec3(1.0,0.08,0.05)*uBrake*0.5*exp(-((ca+3.6)*(ca+3.6)/3.0+cl*cl/1.6));' +
    // markings: a dashed centre line on streets, lane dashes and a grassed median on the avenues
    'float wide=step(8.5,hw);float dash=step(fract(v/9.0),0.42);' +
    'float line=(1.0-wide)*step(au,0.09)*dash+wide*step(abs(au-hw*0.52),0.07)*dash+step(abs(au-(hw-0.3)),0.08);float med=wide*step(au,1.7);' +
    'float sh=step(hw,au);float kerb=sh*step(0.5,fract(v/3.0));' +
    'vec3 alb=mix(vec3(base),vec3(0.55),clamp(line*mk,0.0,1.0));alb=mix(alb,vec3(0.03,0.06,0.03),med*mk);alb=mix(alb,mix(vec3(0.11),vec3(0.32,0.07,0.16),kerb),sh*mk);col=alb*light;' +
    // wet asphalt: the shallower the view, the more it mirrors
    'alpha=mix(0.93,0.46,pow(1.0-max(V.y,0.0),2.5))+0.1*h(floor(vP.xz*3.0));alpha=mix(1.0,clamp(alpha+(sh*0.3+line*0.4)*mk,0.0,1.0),uWet);}' +
    'else if(vM<2.5){float sv=floor(vC.a*997.0+0.5);vec2 g=vec2(vU.x/2.4,vU.y/3.2);vec2 c=floor(g);vec2 f=fract(g);' +
    'float win=step(0.18,f.x)*step(f.x,0.82)*step(0.24,f.y)*step(f.y,0.78)*step(1.0,c.y)*step(abs(n.y),0.5);' +
    'float far=clamp((dist-70.0)/150.0,0.0,1.0);win=mix(win,0.36*step(1.0,c.y)*step(abs(n.y),0.5),far);float lit=mix(step(0.7,h(c+sv)),0.3,far);vec3 wc=mix(vec3(1.0,0.76,0.42),vec3(0.55,0.72,1.0),h(c.yx+sv*3.0));' +
    'float band=step(3.3,vU.y)*step(vU.y,3.75)*step(0.45,vC.a)*step(abs(n.y),0.5);' +
    'col=vC.rgb*light*0.8+win*(lit*wc*0.85+(1.0-lit)*vec3(0.012,0.014,0.03))+band*ink(fract(sv*0.137))*1.1;emis=max(win*lit,band)*0.6;}' +
    'else if(vM<3.5){col=vC.rgb*1.12;emis=1.0;}' +
    'else if(vM<4.5){col=(vC.rgb+vec3(0.025,0.04,0.025)*(0.7+0.6*h(floor(vP.xz*2.0))))*light;alpha=0.93;}' +
    'else if(vM<5.5){col=vC.rgb*(0.4+1.7*uBrake);emis=1.0;}' +
    'else if(vM<6.5){float st=step(0.5,vU.y)*step(vU.y,0.74)*step(0.5,fract(vU.x/3.0+0.25*vC.a));' +
    'col=vC.rgb*light*0.6+st*vec3(1.0,0.2,0.62)*(0.1+hl*0.9);emis=st*0.3;}' +
    'else if(vM<7.5){float fr=pow(1.0-max(dot(n,V),0.0),3.0);col=vC.rgb*light+env(reflect(-V,n))*(0.12+0.88*fr)+vC.rgb*nl*vec3(1.0,0.62,0.3)*0.6;}' +
    // the lake: near black, the mirrored city showing through where the road pass is on
    'else{float fr=pow(1.0-max(dot(n,V),0.0),2.0);col=vec3(0.012,0.02,0.05)*light*2.0+env(reflect(-V,n))*(0.06+0.3*fr);alpha=mix(0.96,0.3,uWet)+0.03*h(floor(vP.xz*2.0));}' +
    'float fog=1.0-exp(-dist*0.0034);col=mix(col,vec3(0.045,0.02,0.085),fog*(1.0-emis*0.45));' +
    'if(uGhost>0.5){gl_FragColor=vec4(vec3(0.3,0.9,1.0)*(0.35+0.4*max(n.y,0.0)),0.3);}else{gl_FragColor=vec4(col,alpha);}}';
  var SKY_VS = 'attribute vec2 aP;varying vec2 vQ;void main(){vQ=aP;gl_Position=vec4(aP,0.999,1.0);}';
  var SKY_FS = 'precision mediump float;varying vec2 vQ;uniform float uYaw;uniform float uHor;' +
    'float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}' +
    'void main(){float y=vQ.y-uHor;vec3 top=vec3(0.012,0.006,0.035);vec3 glow=vec3(0.26,0.08,0.36);' +
    'vec3 col=mix(glow,top,clamp(pow(max(y,0.0)*1.4,0.5),0.0,1.0));' +
    'vec2 g=floor(vec2(vQ.x*90.0+uYaw*153.0,vQ.y*60.0));float st=step(0.995,h(g))*step(0.2,y);col+=st*vec3(0.6,0.6,0.8)*h(g+1.0);' +
    // a skyline that turns with the camera
    'float cx=floor(vQ.x*34.0+uYaw*58.0);float ht=0.03+0.1*pow(h(vec2(cx,3.0)),2.0);float tw=step(y,ht)*step(0.0,y);' +
    'vec2 wq=vec2(fract(vQ.x*34.0+uYaw*58.0)*5.0,y*70.0);float wl=step(0.82,h(floor(wq)+cx))*step(0.25,fract(wq.x))*step(0.3,fract(wq.y));' +
    'col=mix(col,vec3(0.02,0.012,0.045)+wl*vec3(0.5,0.38,0.22),tw);col=mix(col,vec3(0.045,0.02,0.085),step(y,0.0));gl_FragColor=vec4(col,1.0);}';
  var BLOOM_FS = 'precision mediump float;varying vec2 vQ;uniform sampler2D uS;uniform vec2 uDir;uniform float uThr;' +
    'vec3 t(vec2 uv){vec3 c=texture2D(uS,uv).rgb;return mix(c,max(c-0.66,0.0)*2.9,uThr);}' +
    'void main(){vec2 uv=vQ*0.5+0.5;vec3 c=t(uv)*0.227;c+=(t(uv+uDir*1.38)+t(uv-uDir*1.38))*0.316;c+=(t(uv+uDir*3.23)+t(uv-uDir*3.23))*0.07;gl_FragColor=vec4(c,1.0);}';
  var POST_FS = 'precision mediump float;varying vec2 vQ;uniform sampler2D uS;uniform sampler2D uB;uniform vec2 uPx;uniform float uSpd;' +
    'float lum(vec3 c){return dot(c,vec3(0.299,0.587,0.114));}' +
    'vec3 aa(vec2 uv){vec3 c=texture2D(uS,uv).rgb;float n=lum(texture2D(uS,uv+vec2(0.0,uPx.y)).rgb);float s=lum(texture2D(uS,uv-vec2(0.0,uPx.y)).rgb);' +
    'float e=lum(texture2D(uS,uv+vec2(uPx.x,0.0)).rgb);float w=lum(texture2D(uS,uv-vec2(uPx.x,0.0)).rgb);' +
    'float rng=max(max(n,s),max(e,w))-min(min(n,s),min(e,w));if(rng<0.05)return c;' +
    'vec2 dir=normalize(vec2(s-n,e-w)+vec2(0.00001));return 0.5*(texture2D(uS,uv+dir*uPx*0.8).rgb+texture2D(uS,uv-dir*uPx*0.8).rgb);}' +
    'void main(){vec2 uv=vQ*0.5+0.5;vec2 d=uv-vec2(0.5,0.46);vec3 c=aa(uv);' +
    // speed: the edges of the frame smear toward the vanishing point
    'float k=uSpd*dot(d,d)*0.09;c=c*0.4+texture2D(uS,uv-d*k).rgb*0.25+texture2D(uS,uv-d*k*2.0).rgb*0.2+texture2D(uS,uv-d*k*3.0).rgb*0.15;' +
    'c+=texture2D(uB,uv).rgb*0.85;c*=1.0-dot(d,d)*0.75;c=pow(c,vec3(0.9))*vec3(1.02,0.97,1.07);gl_FragColor=vec4(c,1.0);}';

  function compile(type, src) {
    var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('street shader: ' + gl.getShaderInfoLog(s));
    return s;
  }
  function program(vs, fs, attrs) {
    var p = gl.createProgram(); gl.attachShader(p, compile(gl.VERTEX_SHADER, vs)); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    attrs.forEach(function (n, i) { gl.bindAttribLocation(p, i, n); });
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('street link: ' + gl.getProgramInfoLog(p));
    return p;
  }
  function locs(p, names) { var o = {}; names.forEach(function (n) { o[n] = gl.getUniformLocation(p, n); }); return o; }
  var prog, sky, bloomP, postP, U = {}, skyU = {}, bloomU = {}, postU = {}, skyBuf, worldBuf, flatBuf, carBufs = {}, lamps = [], beaconBuf = null;
  var rt = { scene: null, a: null, b: null, w: 0, h: 0 };
  var STRIDE = 13 * 4;
  function upload(mesh) {
    var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.v), gl.STATIC_DRAW);
    return { buf: b, n: mesh.v.length / 13 };
  }
  function bind(o) {
    gl.bindBuffer(gl.ARRAY_BUFFER, o.buf);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, STRIDE, 0);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, STRIDE, 12);
    gl.vertexAttribPointer(2, 2, gl.FLOAT, false, STRIDE, 24);
    gl.vertexAttribPointer(3, 4, gl.FLOAT, false, STRIDE, 32);
    gl.vertexAttribPointer(4, 1, gl.FLOAT, false, STRIDE, 48);
  }
  function target(w, h, depth) {
    var tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    var fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    var rb = null;
    if (depth) {
      rb = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { fb: fb, tex: tex, rb: rb, w: w, h: h };
  }
  function freeTarget(t) { if (!t) return; gl.deleteFramebuffer(t.fb); gl.deleteTexture(t.tex); if (t.rb) gl.deleteRenderbuffer(t.rb); }
  function sizeTargets(w, h) {
    if (rt.w === w && rt.h === h && rt.scene) return;
    freeTarget(rt.scene); freeTarget(rt.a); freeTarget(rt.b);
    var bw = Math.max(2, w >> 2), bh = Math.max(2, h >> 2);
    rt.scene = target(w, h, true); rt.a = target(bw, bh, false); rt.b = target(bw, bh, false); rt.w = w; rt.h = h;
  }
  function initGL() {
    prog = program(VS, FS, ['aP', 'aN', 'aU', 'aC', 'aM']); sky = program(SKY_VS, SKY_FS, ['aP']);
    bloomP = program(SKY_VS, BLOOM_FS, ['aP']); postP = program(SKY_VS, POST_FS, ['aP']);
    U = locs(prog, ['uVP', 'uM', 'uMirror', 'uCam', 'uCar', 'uFwd', 'uBrake', 'uLamp', 'uGhost', 'uNear', 'uGlow', 'uWet']);
    skyU = locs(sky, ['uYaw', 'uHor']); bloomU = locs(bloomP, ['uS', 'uDir', 'uThr']); postU = locs(postP, ['uS', 'uB', 'uPx', 'uSpd']);
    skyBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, skyBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var w = buildWorld(); worldBuf = upload(w.mesh); flatBuf = upload(w.flat); lamps = w.lamps;
    Object.keys(CARS).forEach(function (k) { carBufs[k] = { body: upload(buildCar(CARS[k])), wheel: upload(buildWheel(CARS[k])) }; });
    var bm = new Mesh(); bm.box(0, 0, 1, 0, 0.45, 0.45, 0, 60, [0.3, 1.0, 0.55, 0], MAT.EMISSIVE); bm.cyl(0, 0, 18, 18, 0.05, 0.45, 24, [0.3, 1.0, 0.55, 0], MAT.EMISSIVE); beaconBuf = upload(bm);
    rt.scene = rt.a = rt.b = null; rt.w = rt.h = 0;
  }

  // column-major 4x4
  function mul(a, b) {
    var o = new Float32Array(16), c, r;
    for (c = 0; c < 4; c++) for (r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    return o;
  }
  function persp(fov, asp, n, f) { var t = 1 / Math.tan(fov / 2), nf = 1 / (n - f); return [t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) * nf, -1, 0, 0, 2 * f * n * nf, 0]; }
  function lookAt(e, c) {
    var zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2], l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
    var xx = zz, xz = -zx, xl = Math.hypot(xx, xz); xx /= xl; xz /= xl;      // up x z, with up = (0,1,0)
    var yx = zy * xz, yy = zz * xx - zx * xz, yz = -zy * xx;
    return [xx, yx, zx, 0, 0, yy, zy, 0, xz, yz, zz, 0, -(xx * e[0] + xz * e[2]), -(yx * e[0] + yy * e[1] + yz * e[2]), -(zx * e[0] + zy * e[1] + zz * e[2]), 1];
  }
  function yawM(psi, x, y, z) { var c = Math.cos(psi), s = Math.sin(psi); return [c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0, x, y, z, 1]; }
  function pitchRoll(p, q) {
    var cp = Math.cos(p), sp = Math.sin(p), cq = Math.cos(q), sq = Math.sin(q);
    return mul([cp, sp, 0, 0, -sp, cp, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], [1, 0, 0, 0, 0, cq, sq, 0, 0, -sq, cq, 0, 0, 0, 0, 1]);
  }
  function spinM(a, x, y, z) { var c = Math.cos(a), s = Math.sin(a); return [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, x, y, z, 1]; }

  var cam = { yaw: 0, x: 0, y: 3, z: 0 };
  // 0 full, 1 no road reflections, 2 also three-quarter resolution. Steps down by itself on a slow device.
  var quality = 0, slowT = 0, frames = 0;
  function drawCar(pose, S, ghost, brake) {
    var bufs = carBufs[pose.key];
    var base = yawM(pose.psi, pose.x, pose.y || 0, pose.z);
    var lean = pitchRoll(clamp((pose.ax || 0) * 0.0035, -0.04, 0.04), clamp(-(pose.ay || 0) * 0.005, -0.05, 0.05));
    gl.uniform1f(U.uGhost, ghost ? 1 : 0); gl.uniform1f(U.uBrake, brake);
    gl.uniformMatrix4fv(U.uM, false, mul(base, lean)); bind(bufs.body); gl.drawArrays(gl.TRIANGLES, 0, bufs.body.n);
    bind(bufs.wheel);
    var zw = S.width / 2 - 0.09, pos = [[S.a, zw, 1], [S.a, -zw, 1], [-S.b, zw, 0], [-S.b, -zw, 0]], i;
    for (i = 0; i < 4; i++) {
      var w = mul(base, mul(yawM(pos[i][2] ? (pose.delta || 0) : 0, pos[i][0], S.rw, pos[i][1]), spinM((pos[i][2] ? pose.wheelRot : pose.rearRot) || 0, 0, 0, 0)));
      gl.uniformMatrix4fv(U.uM, false, w); gl.drawArrays(gl.TRIANGLES, 0, bufs.wheel.n);
    }
  }

  var ID = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  function fullscreen(n) { // one triangle over the whole target, attribute slot 0 only
    var i; for (i = 1; i < 5; i++) gl.disableVertexAttribArray(i);
    gl.bindBuffer(gl.ARRAY_BUFFER, skyBuf); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3); void n;
  }
  function render(car, ghostPose, dt, orbit, beacon) {
    var W = canvas.width, H = canvas.height, i;
    sizeTargets(W, H);
    // chase camera: follows the direction of travel, so a slide shows as a slide
    var aim = car.psi;
    if (car.speed > 4) aim = car.psi + clamp(wrapPi(Math.atan2(car.vz, car.vx) - car.psi), -0.6, 0.6) * 0.55;
    cam.yaw = wrapPi(cam.yaw + wrapPi(aim - cam.yaw) * Math.min(1, dt * 5.5));
    var fx = Math.cos(cam.yaw), fz = Math.sin(cam.yaw), back = 7.6 + car.speed * 0.035;
    var sh = car.speed * 0.0006, eye = [car.x - fx * back, 3.0 + Math.sin(car.wheelRot * 0.7) * sh, car.z - fz * back], tgt = [car.x + fx * 3.5, 1.15 + car.y * 0.5, car.z + fz * 3.5];
    var fov = (58 + clamp(car.speed / 45, 0, 1) * 18) * Math.PI / 180;
    var pitch = Math.atan2(eye[1] - tgt[1], back + 3.5);
    if (orbit !== undefined && orbit !== null) {
      var oa = car.psi + orbit, od = W < H ? 9.5 : 6.6;
      eye = [car.x + Math.cos(oa) * od, 1.75, car.z + Math.sin(oa) * od]; tgt = [car.x, 0.72, car.z];
      fov = 40 * Math.PI / 180; pitch = Math.atan2(eye[1] - tgt[1], od); cam.yaw = wrapPi(oa + Math.PI);
    }
    var vp = mul(persp(fov, W / H, 0.3, 1600), lookAt(eye, tgt));

    gl.bindFramebuffer(gl.FRAMEBUFFER, rt.scene.fb); gl.viewport(0, 0, W, H);
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
    gl.useProgram(sky); gl.uniform1f(skyU.uYaw, cam.yaw); gl.uniform1f(skyU.uHor, Math.tan(pitch) / Math.tan(fov / 2));
    fullscreen();

    gl.enable(gl.DEPTH_TEST); gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.useProgram(prog);
    for (i = 0; i < 5; i++) gl.enableVertexAttribArray(i);
    var near = lamps[0], best = 1e9;
    for (i = 0; i < lamps.length; i++) { var d = Math.hypot(lamps[i][0] - car.x, lamps[i][1] - car.z); if (d < best) { best = d; near = lamps[i]; } }
    gl.uniformMatrix4fv(U.uVP, false, vp);
    gl.uniform3f(U.uCam, eye[0], eye[1], eye[2]); gl.uniform3f(U.uCar, car.x, 0, car.z);
    gl.uniform2f(U.uFwd, Math.cos(car.psi), Math.sin(car.psi));
    gl.uniform1f(U.uLamp, LAMP); gl.uniform3f(U.uNear, near[0], 6, near[1]);
    gl.uniform3f(U.uGlow, car.S.glow[0], car.S.glow[1], car.S.glow[2]);
    var brake = car.brk > 0.05 ? 1 : 0;
    function solids(mirror) {
      gl.uniform1f(U.uMirror, mirror); gl.uniform1f(U.uGhost, 0); gl.uniform1f(U.uBrake, brake);
      gl.uniformMatrix4fv(U.uM, false, ID); bind(worldBuf); gl.drawArrays(gl.TRIANGLES, 0, worldBuf.n);
      drawCar(car, car.S, false, brake);
      if (beacon) { gl.uniformMatrix4fv(U.uM, false, yawM(0, beacon[0], 0, beacon[1])); bind(beaconBuf); gl.drawArrays(gl.TRIANGLES, 0, beaconBuf.n); }
    }
    // 1. the city upside down, 2. the wet road over it, 3. the city
    gl.uniform1f(U.uWet, quality < 1 ? 1 : 0);
    if (quality < 1) { solids(-1); gl.clear(gl.DEPTH_BUFFER_BIT); }
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.uniform1f(U.uMirror, 1); gl.uniform1f(U.uGhost, 0); gl.uniform1f(U.uBrake, brake);
    gl.uniformMatrix4fv(U.uM, false, ID); bind(flatBuf); gl.drawArrays(gl.TRIANGLES, 0, flatBuf.n);
    gl.disable(gl.BLEND);
    solids(1);
    if (ghostPose) {
      gl.enable(gl.BLEND); gl.depthMask(false);
      drawCar(ghostPose, car.S, true, 0);
      gl.depthMask(true); gl.disable(gl.BLEND);
    }

    // bloom: threshold and blur at quarter size, twice
    gl.disable(gl.DEPTH_TEST); gl.useProgram(bloomP); gl.activeTexture(gl.TEXTURE0); gl.uniform1i(bloomU.uS, 0);
    var bw = rt.a.w, bh = rt.a.h;
    function blur(src, dst, dx, dy, thr) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb); gl.viewport(0, 0, bw, bh); gl.bindTexture(gl.TEXTURE_2D, src.tex);
      gl.uniform2f(bloomU.uDir, dx / bw, dy / bh); gl.uniform1f(bloomU.uThr, thr); fullscreen();
    }
    blur(rt.scene, rt.a, 1, 0, 1); blur(rt.a, rt.b, 0, 1, 0); blur(rt.b, rt.a, 2.2, 0, 0); blur(rt.a, rt.b, 0, 2.2, 0);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H);
    gl.useProgram(postP);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, rt.b.tex);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, rt.scene.tex);
    gl.uniform1i(postU.uS, 0); gl.uniform1i(postU.uB, 1); gl.uniform2f(postU.uPx, 1 / W, 1 / H);
    gl.uniform1f(postU.uSpd, orbit !== undefined && orbit !== null ? 0 : clamp((car.speed - 12) / 30 + car.nosOn * 0.6, 0, 1.4));
    fullscreen();
  }

  /* ============================================================
     SOUND — engine, tyres and barrier, all synthesised
     ============================================================ */
  var actx = null, eng = null, muted = false;
  function initAudio() {
    if (actx || muted) return;
    var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    try {
      actx = new AC();
      var master = actx.createGain(); master.gain.value = 0.5; master.connect(actx.destination);
      // The oscillator runs once per engine cycle (two revs); harmonic 6 is the firing note of
      // a six. A 90-degree V6 leans on the half orders (3, 9) for its gruff, lumpy burble, with
      // some unevenness lower down; an inline six is almost all firing note and its octaves.
      function wave(amps) {
        var n = 26, re = new Float32Array(n), im = new Float32Array(n), q;
        for (q = 1; q < n; q++) im[q] = (amps[q] || 0) * (q % 2 ? 1 : -1);
        return actx.createPeriodicWave(re, im);
      }
      var waves = {
        v6: wave({ 1: 0.2, 2: 0.14, 3: 0.95, 4: 0.12, 5: 0.1, 6: 1.0, 7: 0.1, 9: 0.6, 12: 0.42, 15: 0.3, 18: 0.2, 21: 0.12, 24: 0.08 }),
        i6: wave({ 3: 0.12, 6: 1.0, 12: 0.55, 18: 0.34, 24: 0.2 })
      };
      var o1 = actx.createOscillator(), o2 = actx.createOscillator(), lp = actx.createBiquadFilter(), g = actx.createGain();
      var sh = actx.createWaveShaper(), cv = new Float32Array(257), ci;
      for (ci = 0; ci < 257; ci++) { var xx = ci / 128 - 1; cv[ci] = Math.tanh(xx * 2.4); }
      sh.curve = cv;
      o1.setPeriodicWave(waves.v6); o2.type = 'sine'; lp.type = 'lowpass'; lp.Q.value = 1.6; g.gain.value = 0;
      var og = actx.createGain(); og.gain.value = 0.35;                      // sub: the body of the exhaust
      o1.connect(sh); sh.connect(lp); o2.connect(og); og.connect(lp); lp.connect(g); g.connect(master); o1.start(); o2.start();
      // induction and valvetrain thrash that comes in with revs and throttle
      var th = actx.createBiquadFilter(), tg = actx.createGain(); th.type = 'bandpass'; th.frequency.value = 900; th.Q.value = 0.8; tg.gain.value = 0;
      var len = actx.sampleRate, nb = actx.createBuffer(1, len, len), d = nb.getChannelData(0), i;
      for (i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      var ns = actx.createBufferSource(), bp = actx.createBiquadFilter(), sg = actx.createGain();
      ns.buffer = nb; ns.loop = true; bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 3; sg.gain.value = 0;
      ns.connect(bp); bp.connect(sg); sg.connect(master); ns.connect(th); th.connect(tg); tg.connect(master); ns.start();
      var wh = actx.createOscillator(), wg = actx.createGain(); wh.type = 'sine'; wg.gain.value = 0; wh.connect(wg); wg.connect(master); wh.start();
      eng = { master: master, o1: o1, o2: o2, lp: lp, g: g, sg: sg, bp: bp, noise: nb, wh: wh, wg: wg, lastBoost: 0, waves: waves, voice: 'v6', th: th, tg: tg, lastThr: 0 };
    } catch (e) { actx = null; eng = null; }
  }
  function audioFrame(car, live) {
    if (!eng) return;
    var t = actx.currentTime, cyc = car.rpm / 120, rv = clamp(car.rpm / car.S.red, 0, 1);
    if (eng.voice !== car.S.voice) { eng.voice = car.S.voice; eng.o1.setPeriodicWave(eng.waves[car.S.voice]); }
    eng.o1.frequency.setTargetAtTime(cyc, t, 0.03); eng.o2.frequency.setTargetAtTime(cyc * 3, t, 0.03);
    // closed throttle is muffled; opening it and a freer exhaust both let the top end out
    eng.lp.frequency.setTargetAtTime(170 + car.rpm * 0.22 + car.thr * (520 + car.rpm * 0.2) + car.S.ex * 380 + car.nosOn * 500, t, 0.05);
    eng.g.gain.setTargetAtTime(live ? (0.07 + car.thr * 0.1 + rv * 0.03) * (1 + car.S.ex * 0.25) : 0, t, 0.06);
    eng.th.frequency.setTargetAtTime(600 + car.rpm * 0.28, t, 0.08);
    eng.tg.gain.setTargetAtTime(live ? rv * rv * (0.012 + car.thr * 0.045) * (car.S.voice === 'v6' ? 1.5 : 0.8) : 0, t, 0.08);
    // a freer exhaust pops when you lift at revs
    if (live && car.S.ex > 1 && eng.lastThr > 0.6 && car.thr < 0.1 && rv > 0.55) pop(car.S.ex);
    eng.lastThr = car.thr;
    eng.wh.frequency.setTargetAtTime(2200 + car.boost * 3800, t, 0.08);
    eng.wg.gain.setTargetAtTime(live && car.S.turbo ? car.boost * car.boost * 0.012 * car.S.turbo : 0, t, 0.08);
    if (live && car.S.turbo && eng.lastBoost > 0.55 && car.thr < 0.1) { vent(); eng.lastBoost = 0; } else if (car.thr > 0.1) eng.lastBoost = car.boost;
    eng.sg.gain.setTargetAtTime(live ? car.slip * 0.16 : 0, t, 0.06);
    eng.bp.frequency.setTargetAtTime(1100 + car.speed * 22, t, 0.1);
  }
  function vent() { // blow-off valve
    if (!eng || muted) return;
    var s2 = actx.createBufferSource(), g2 = actx.createGain(), hp = actx.createBiquadFilter(), t = actx.currentTime;
    s2.buffer = eng.noise; hp.type = 'highpass'; hp.frequency.value = 2600;
    g2.gain.setValueAtTime(0.16, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    s2.connect(hp); hp.connect(g2); g2.connect(eng.master); s2.start(t); s2.stop(t + 0.32);
  }
  function pop(level) { // overrun crackle
    if (!eng || muted) return;
    var n = 1 + level, q, t = actx.currentTime;
    for (q = 0; q < n; q++) {
      var s3 = actx.createBufferSource(), g3 = actx.createGain(), f3 = actx.createBiquadFilter(), at = t + 0.05 + q * (0.07 + Math.random() * 0.08);
      s3.buffer = eng.noise; f3.type = 'bandpass'; f3.frequency.value = 260 + Math.random() * 300; f3.Q.value = 1.2;
      g3.gain.setValueAtTime(0.22, at); g3.gain.exponentialRampToValueAtTime(0.001, at + 0.06);
      s3.connect(f3); f3.connect(g3); g3.connect(eng.master); s3.start(at, Math.random() * 0.5); s3.stop(at + 0.07);
    }
  }
  function thud(v) {
    if (!eng || muted) return;
    var s = actx.createBufferSource(), g = actx.createGain(), lp = actx.createBiquadFilter(), t = actx.currentTime;
    s.buffer = eng.noise; lp.type = 'lowpass'; lp.frequency.value = 220;
    g.gain.setValueAtTime(clamp(v * 0.06, 0.05, 0.5), t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    s.connect(lp); lp.connect(g); g.connect(eng.master); s.start(t); s.stop(t + 0.26);
  }

  /* ============================================================
     INPUT — keyboard, touch pads, gamepad
     ============================================================ */
  var keys = {}, pad = { l: 0, r: 0, gas: 0, brk: 0, hb: 0, nos: 0 }, steerK = 0;
  var CODES = { ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r', ArrowUp: 'gas', KeyW: 'gas', ArrowDown: 'brk', KeyS: 'brk', Space: 'hb', ShiftLeft: 'nos', ShiftRight: 'nos', KeyN: 'nos' };
  window.addEventListener('keydown', function (e) {
    if (state === 'menu') return;
    if (e.code === 'Escape') { if (state === 'run' || state === 'count') pause(); else if (state === 'pause') resume(); return; }
    if (e.code === 'KeyR' && state === 'run') { resetCar(); return; }
    if (CODES[e.code]) { keys[CODES[e.code]] = 1; e.preventDefault(); }
  });
  window.addEventListener('keyup', function (e) { if (CODES[e.code]) keys[CODES[e.code]] = 0; });
  function touchPad(id, key) {
    var el = $(id); if (!el) return;
    var on = function (e) { pad[key] = 1; e.preventDefault(); try { el.setPointerCapture(e.pointerId); } catch (x) {} };
    var off = function () { pad[key] = 0; };
    el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off);
    el.addEventListener('pointercancel', off); el.addEventListener('lostpointercapture', off);
    el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }
  touchPad('streetLeft', 'l'); touchPad('streetRight', 'r'); touchPad('streetGas', 'gas'); touchPad('streetBrake', 'brk'); touchPad('streetHb', 'hb'); touchPad('streetNos', 'nos');
  function readInput(dt) {
    var l = keys.l || pad.l, r = keys.r || pad.r, raw = (r ? 1 : 0) - (l ? 1 : 0);
    var kr2 = dt * (raw === 0 || raw * steerK < 0 ? 11 : 6.5);
    steerK += clamp(raw - steerK, -kr2, kr2);
    var inp = { steer: steerK, thr: (keys.gas || pad.gas) ? 1 : 0, brk: (keys.brk || pad.brk) ? 1 : 0, hb: !!(keys.hb || pad.hb), nos: !!(keys.nos || pad.nos) };
    var gps = navigator.getGamepads ? navigator.getGamepads() : [], i;
    for (i = 0; i < gps.length; i++) {
      var g = gps[i]; if (!g || !g.connected || g.axes.length < 2) continue;
      var sx = Math.abs(g.axes[0]) > 0.08 ? g.axes[0] : 0;
      if (sx) inp.steer = sx * Math.abs(sx);
      var b = g.buttons;
      if (b[7] && b[7].value > 0.03) inp.thr = b[7].value;
      if (b[6] && b[6].value > 0.03) inp.brk = b[6].value;
      if ((b[0] && b[0].pressed) || (b[1] && b[1].pressed)) inp.hb = true;
      if (b[2] && b[2].pressed) inp.nos = true;
      break;
    }
    return inp;
  }

  /* ============================================================
     GAME — free roam, drift runs, sprints against your own ghost
     ============================================================ */
  var state = 'menu', carKey = 'sedan', car = newCar('sedan');
  var SPAWN = along(CITY, CAP, 150), SPAWN_PSI = Math.atan2(CAP[1] - CITY[1], CAP[0] - CITY[0]);
  var count = 0, drift = 0, driftRun = 0, driftCool = 0, driftZone = 0, acc = 0, last = 0, visible = true, raf = 0;
  var route = null, cp = 0, runT = 0, rec = [], recT = 0, ghost = null, best = 0, cooldown = 0;
  var hud = { speed: $('hudSpeed'), gear: $('hudGear'), lap: $('hudLap'), best: $('hudBest'), drift: $('hudDrift'), nos: $('hudNos'), cash: $('hudCash') }, hudV = {};
  var shopEl = $('streetShop'), cashEl = $('streetCash'), toastEl = $('streetToast'), nosCell = $('hudNosCell'), nosPad = $('streetNos'), placeEl = $('streetPlace');
  var toastT = 0;
  function toast(msg) { if (!toastEl) return; toastEl.textContent = msg; toastEl.hidden = false; toastT = 3; }
  function drawShop() {
    if (cashEl) cashEl.textContent = '$' + garage.cash;
    if (!shopEl) return;
    shopEl.textContent = '';
    PARTS.forEach(function (part) {
      var l = lvl(carKey, part.id), b = document.createElement('button');
      b.type = 'button'; b.className = 'game-chip';
      b.textContent = part.name + ' ' + l + '/3' + (l < 3 ? ' · $' + COST[l] : '');
      b.disabled = l >= 3 || garage.cash < COST[l];
      b.addEventListener('click', function () {
        var cur = lvl(carKey, part.id);
        if (cur >= 3 || garage.cash < COST[cur]) return;
        garage.cash -= COST[cur]; garage.up[carKey][part.id] = cur + 1; saveGarage(); drawShop();
        if (state === 'menu') { car = newCar(carKey); placeAt(car, SPAWN[0], SPAWN[1], SPAWN_PSI); cam.yaw = car.psi; }
      });
      shopEl.appendChild(b);
    });
  }
  function setHud(k, v) { if (hudV[k] !== v && hud[k]) { hudV[k] = v; hud[k].textContent = v; } }
  function fmt(t) { if (!t) return '--:--.--'; var m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(2); }
  function storeKey(rt) { return 'htg.street.' + carKey + '.' + rt.id; }
  function loadBest(rt) {
    best = 0; ghost = null;
    try {
      var d = JSON.parse(localStorage.getItem(storeKey(rt)) || 'null');
      if (d && d.t > 0 && d.g && d.g.length > 30) { best = d.t; ghost = d.g; }
    } catch (e) {}
  }
  function saveBest(rt) { try { localStorage.setItem(storeKey(rt), JSON.stringify({ t: best, g: ghost })); } catch (e) {} }
  function ghostAt(t) {
    if (!ghost || !route) return null;
    var f = t / 0.1, i = Math.floor(f) * 3; if (i + 5 >= ghost.length) return null;
    var k = f - Math.floor(f);
    return { key: carKey, x: lerp(ghost[i], ghost[i + 3], k), z: lerp(ghost[i + 1], ghost[i + 4], k),
             psi: ghost[i + 2] + wrapPi(ghost[i + 5] - ghost[i + 2]) * k };
  }
  function endSprint(msg) { route = null; cp = 0; ghost = null; best = 0; setHud('lap', '--'); setHud('best', '--'); if (msg) toast(msg); }
  function resetCar() {
    // back onto the nearest road, facing the way you were going
    var n = nearestRoad(car.x, car.z), R = roads[n[0]], i = n[1], psi = Math.atan2(R.tz[i], R.tx[i]);
    if (Math.cos(car.psi - psi) < 0) psi += Math.PI;
    placeAt(car, R.x[i], R.z[i], psi); steerK = 0; driftRun = 0;
    if (route) endSprint('SPRINT OFF');
  }
  function startRun() {
    car = newCar(carKey); placeAt(car, SPAWN[0], SPAWN[1], SPAWN_PSI); cam.yaw = car.psi;
    endSprint(); drift = 0; driftRun = 0; rec = []; recT = 0; steerK = 0; cooldown = 0;
    count = 3.2; state = 'count'; acc = 0; hudV = {}; px = car.x; pz = car.z; ppsi = car.psi;
    overlay.hidden = true; canvas.classList.add('is-playing'); document.body.classList.add('game-active'); stage.classList.add('is-live'); stage.classList.remove('is-menu');
    initAudio(); if (actx && actx.state === 'suspended') actx.resume();
    frameStage();
    setHud('best', '--'); setHud('lap', '--'); setHud('drift', '0');
    if (nosCell) nosCell.hidden = !car.S.nos; if (nosPad) nosPad.hidden = !car.S.nos;
    loop(true);
  }
  function frameStage() { // on a phone the stage can sit half below the fold: bring all of it on screen
    var r = stage.getBoundingClientRect(), vh = window.innerHeight;
    if (r.top < 0 || r.bottom > vh + 1) { try { stage.scrollIntoView({ block: r.height >= vh ? 'start' : 'center' }); } catch (e) { stage.scrollIntoView(); } }
  }
  function toMenu() { // Exit: back to the garage, not the home page
    if (state === 'menu') return;
    if (state === 'run' && driftRun > 0) bankDrift();
    state = 'menu'; overlay.hidden = false; overlayTitle.textContent = 'HEX STREET'; overlayText.textContent = 'Canberra, after dark.';
    playBtn.textContent = 'Play'; canvas.classList.remove('is-playing'); stage.classList.remove('is-live'); stage.classList.add('is-menu');
    document.body.classList.remove('game-active'); audioFrame(car, false);
    if (toastEl) toastEl.hidden = true;
    endSprint(); car = newCar(carKey); placeAt(car, SPAWN[0], SPAWN[1], SPAWN_PSI); cam.yaw = car.psi; hudV = {}; drawShop(); menuLoop();
  }
  function pause() {
    if (state !== 'run' && state !== 'count') return;
    state = 'pause'; overlay.hidden = false; overlayTitle.textContent = 'PAUSED'; overlayText.textContent = route ? route.name + (best ? ' · best ' + fmt(best) : '') : '';
    drawShop();
    playBtn.textContent = 'Resume'; canvas.classList.remove('is-playing'); stage.classList.remove('is-live');
    document.body.classList.remove('game-active'); audioFrame(car, false);
  }
  function resume() {
    if (state !== 'pause') return;
    car.S = tuned(car.key); if (nosCell) nosCell.hidden = !car.S.nos; if (nosPad) nosPad.hidden = !car.S.nos;
    state = count > 0 ? 'count' : 'run'; overlay.hidden = true; canvas.classList.add('is-playing'); stage.classList.add('is-live');
    document.body.classList.add('game-active'); if (actx && actx.state === 'suspended') actx.resume(); frameStage(); loop(true);
  }
  // roundabouts double the drift rate: inside a small ring's asphalt
  function zoneMul(x, z) {
    var r;
    for (r = 0; r < roads.length; r++) {
      var R = roads[r];
      if (!R.loop || R.len > 2 * Math.PI * 92) continue;
      var rr = R.len / (2 * Math.PI), d = Math.hypot(x - R.cx, z - R.cz);
      if (d > rr - R.hw - 3 && d < rr + R.hw + 4) return 2;
    }
    return 1;
  }
  (function () { var r, i; for (r = 0; r < roads.length; r++) { var R = roads[r], sx = 0, sz = 0; for (i = 0; i < R.N; i++) { sx += R.x[i]; sz += R.z[i]; } R.cx = sx / R.N; R.cz = sz / R.N; } })();
  function bankDrift() { // a finished slide turns into points and cash
    var pts = Math.round(driftRun), pay = Math.round(pts / 6), zone = driftZone > 1;
    driftRun = 0; driftZone = 1; if (pts <= 0) return;
    drift += pts;
    if (pay > 0) { garage.cash += pay; saveGarage(); if (pay >= 5) toast('DRIFT ' + pts + (zone ? ' · ROUNDABOUT' : '') + ' · +$' + pay); }
  }

  function gameStep(inp, dt) {
    stepCar(car, inp, dt);
    if (car.hit > 1.5) { thud(car.hit); if (driftRun > 0) { driftRun = 0; driftZone = 1; } }
    if (car.sink > 1.6) { resetCar(); toast('IN THE LAKE'); if (driftRun > 0) { driftRun = 0; driftZone = 1; } }
    // sprints: a gate starts one, checkpoints in order, the last one stops the clock
    var i, g;
    if (cooldown > 0) cooldown -= dt;
    if (!route && cooldown <= 0 && car.speed > 3) {
      for (i = 0; i < ROUTES.length; i++) {
        g = ROUTES[i].pts[0];
        var ax = car.x - g[0], az = car.z - g[1], alongG = ax * ROUTES[i].tx + az * ROUTES[i].tz, across = -ax * ROUTES[i].tz + az * ROUTES[i].tx;
        if (Math.abs(alongG) < 3 && Math.abs(across) < roads[nearestRoad(g[0], g[1])[0]].hw + 1) {
          route = ROUTES[i]; cp = 1; runT = 0; rec = []; recT = 0; loadBest(route);
          toast(route.name.toUpperCase()); setHud('best', fmt(best)); hudV.lap = null;
          break;
        }
      }
    }
    if (route) {
      runT += dt; recT -= dt;
      if (recT <= 0) { recT += 0.1; rec.push(Math.round(car.x * 100) / 100, Math.round(car.z * 100) / 100, Math.round(car.psi * 1000) / 1000); }
      var tgt = route.loop && cp === route.pts.length ? route.pts[0] : route.pts[cp];
      if (Math.hypot(car.x - tgt[0], car.z - tgt[1]) < 18) {
        cp++;
        if (cp >= route.pts.length + (route.loop ? 1 : 0)) {
          var pb = !best || runT < best, pay = 400 + (pb ? 300 : 0);
          garage.cash += pay; saveGarage();
          if (pb) { best = runT; ghost = rec.slice(); saveBest(route); }
          toast((pb ? 'BEST ' : '') + fmt(runT) + ' · +$' + pay);
          var done = route.name; route = null; cp = 0; cooldown = 4; void done;
          setHud('lap', fmt(runT)); setHud('best', fmt(best)); ghost = null; best = 0;
        }
      } else if (Math.hypot(car.x - tgt[0], car.z - tgt[1]) > 650) endSprint('SPRINT OFF');
    }
    // drift points: angle times speed, doubled on a roundabout, banked when the slide ends clean
    if (Math.abs(car.beta) > 0.16 && car.speed > 9 && !car.wet) {
      var zm = zoneMul(car.x, car.z); if (zm > driftZone) driftZone = zm;
      driftRun += Math.abs(car.beta) * car.speed * dt * 12 * zm; driftCool = 1.4;
    } else if (driftRun > 0) { driftCool -= dt; if (driftCool <= 0) bankDrift(); }
  }

  function adapt(dt) { // step quality down after 2.5 s of slow frames
    if (lockQ || quality > 1 || ++frames <= 30) return;
    slowT = dt > 0.03 ? slowT + dt : 0;
    if (slowT > 2.5) { quality++; slowT = 0; frames = 0; resize(); }
  }
  var orbitA = 2.4, orbitFix = null, menuRaf = 0, menuLast = 0, lockQ = false;
  function menuFrame(now) {
    menuRaf = 0;
    if (state !== 'menu' && state !== 'pause') return;
    var dt = Math.min(0.1, (now - menuLast) / 1000 || 0); menuLast = now;
    if (state === 'menu') { orbitA = wrapPi(orbitA + dt * 0.35); render(car, null, dt, orbitFix === null ? orbitA : orbitFix, null); adapt(dt); }
    menuLoop();
  }
  function menuLoop() { if (!menuRaf && state === 'menu' && visible && !document.hidden) { menuLast = performance.now(); menuRaf = requestAnimationFrame(menuFrame); } }
  var px = 0, pz = 0, ppsi = 0;
  var IDLE = { steer: 0, thr: 0, brk: 0, hb: true, nos: false, hold: true };   // countdown: parked on the handbrake
  function nextCp() {
    if (!route) return null;
    return route.loop && cp === route.pts.length ? route.pts[0] : route.pts[cp];
  }
  function frame(now) {
    raf = 0;
    if (state !== 'run' && state !== 'count') return;
    var dt = Math.min(0.1, (now - last) / 1000 || 0); last = now;
    var inp = readInput(dt);
    if (state === 'count') { count -= dt; if (count <= 0) { state = 'run'; } }
    acc += dt;
    while (acc >= 1 / 120) { px = car.x; pz = car.z; ppsi = car.psi; gameStep(state === 'run' ? inp : IDLE, 1 / 120); acc -= 1 / 120; }
    // The physics ticks at 120 Hz and the screen at whatever it likes: draw the car where it
    // is between ticks, or a 144 Hz display shows an uneven shuffle.
    var k = acc * 120, cx0 = car.x, cz0 = car.z, cp0 = car.psi;
    car.x = px + (cx0 - px) * k; car.z = pz + (cz0 - pz) * k; car.psi = ppsi + wrapPi(cp0 - ppsi) * k;
    render(car, ghostAt(runT), dt, undefined, nextCp());
    car.x = cx0; car.z = cz0; car.psi = cp0;
    adapt(dt);
    audioFrame(car, true);
    setHud('speed', String(Math.round(car.speed * 3.6)));
    setHud('gear', state === 'count' ? String(Math.max(1, Math.ceil(count))) : car.rev ? 'R' : String(car.gear));
    if (route) setHud('lap', fmt(runT));
    setHud('drift', String(drift + Math.round(driftRun)));
    setHud('cash', '$' + garage.cash);
    if (car.S.nos) setHud('nos', String(Math.round(car.tank * 100)));
    if (placeEl && hudV.place !== car.road) { hudV.place = car.road; placeEl.textContent = car.road || ''; }
    if (toastT > 0) { toastT -= dt; if (toastT <= 0 && toastEl) toastEl.hidden = true; }
    drawMap();
    loop(false);
  }
  function loop(restart) {
    if (restart) last = performance.now();
    if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame);
  }

  /* ---------- minimap: north up, centred on the car ---------- */
  var mapCtx = mapCanvas ? mapCanvas.getContext('2d') : null, mapTick = 0, MAPS = 0.3;   // px per metre on the backing store
  function drawMap() {
    if (!mapCtx || (mapTick++ % 3)) return;
    var w = mapCanvas.width, h = mapCanvas.height, ox = w / 2 - car.x * MAPS, oz = h / 2 - car.z * MAPS, i, r;
    mapCtx.clearRect(0, 0, w, h);
    mapCtx.fillStyle = 'rgba(40, 60, 120, 0.55)'; mapCtx.beginPath();
    for (i = 0; i < LAKE.length; i++) mapCtx[i ? 'lineTo' : 'moveTo'](LAKE[i][0] * MAPS + ox, LAKE[i][1] * MAPS + oz);
    mapCtx.closePath(); mapCtx.fill();
    mapCtx.fillStyle = 'rgba(60, 90, 50, 0.45)';
    for (i = 0; i < HILLS.length; i++) { mapCtx.beginPath(); mapCtx.arc(HILLS[i][0] * MAPS + ox, HILLS[i][1] * MAPS + oz, HILLS[i][2] * MAPS, 0, 6.2832); mapCtx.fill(); }
    mapCtx.lineJoin = 'round'; mapCtx.lineCap = 'round'; mapCtx.strokeStyle = 'rgba(180,120,255,0.8)';
    for (r = 0; r < roads.length; r++) {
      var R = roads[r], step = 4;
      if (Math.abs(R.cx - car.x) > 1200 || Math.abs(R.cz - car.z) > 1200) continue;
      mapCtx.lineWidth = Math.max(1.2, R.hw * 2 * MAPS); mapCtx.beginPath();
      for (i = 0; i < R.N; i += step) mapCtx[i ? 'lineTo' : 'moveTo'](R.x[i] * MAPS + ox, R.z[i] * MAPS + oz);
      if (R.loop) mapCtx.closePath(); else mapCtx.lineTo(R.x[R.N - 1] * MAPS + ox, R.z[R.N - 1] * MAPS + oz);
      mapCtx.stroke();
    }
    mapCtx.fillStyle = 'rgba(180,120,255,0.9)';
    for (i = 0; i < ROUTES.length; i++) { var g = ROUTES[i].pts[0]; mapCtx.beginPath(); mapCtx.arc(g[0] * MAPS + ox, g[1] * MAPS + oz, 3, 0, 6.2832); mapCtx.fill(); }
    var t = nextCp();
    if (t) {
      var tx = clamp(t[0] * MAPS + ox, 5, w - 5), tz = clamp(t[1] * MAPS + oz, 5, h - 5);
      mapCtx.fillStyle = '#4dff8c'; mapCtx.beginPath(); mapCtx.arc(tx, tz, 4, 0, 6.2832); mapCtx.fill();
    }
    mapCtx.fillStyle = '#fff'; mapCtx.beginPath();
    mapCtx.moveTo(w / 2 + Math.cos(car.psi) * 6, h / 2 + Math.sin(car.psi) * 6);
    mapCtx.lineTo(w / 2 + Math.cos(car.psi + 2.5) * 4.5, h / 2 + Math.sin(car.psi + 2.5) * 4.5);
    mapCtx.lineTo(w / 2 + Math.cos(car.psi - 2.5) * 4.5, h / 2 + Math.sin(car.psi - 2.5) * 4.5);
    mapCtx.closePath(); mapCtx.fill();
  }

  /* ---------- sizing, visibility, buttons ---------- */
  function resize() {
    var r = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, r.width < 700 ? 1.5 : 2) * (quality > 1 ? 0.7 : 1);
    var w = Math.max(2, Math.round(r.width * dpr)), h = Math.max(2, Math.round(r.height * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    if (state === 'menu') render(car, null, 0.016, orbitFix === null ? orbitA : orbitFix, null); else if (state === 'pause') render(car, null, 0.016, undefined, nextCp());
  }
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', function () { if (document.hidden) pause(); else menuLoop(); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (!visible) pause(); else menuLoop(); }, { threshold: 0.15 }).observe(stage);
  }
  canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); pause(); });
  canvas.addEventListener('webglcontextrestored', function () { initGL(); resize(); });

  Array.prototype.forEach.call(document.querySelectorAll('[data-street-car]'), function (b) {
    b.addEventListener('click', function () {
      if (state !== 'menu') return;
      carKey = b.getAttribute('data-street-car');
      Array.prototype.forEach.call(document.querySelectorAll('[data-street-car]'), function (o) { o.setAttribute('aria-pressed', o === b ? 'true' : 'false'); });
      car = newCar(carKey); placeAt(car, SPAWN[0], SPAWN[1], SPAWN_PSI); cam.yaw = car.psi;
      drawShop();
    });
  });
  if (playBtn) playBtn.addEventListener('click', function () { if (state === 'pause') resume(); else startRun(); });
  if (resetBtn) resetBtn.addEventListener('click', function () { if (state === 'run') resetCar(); });
  var exitBtn = $('streetExit');
  if (exitBtn) exitBtn.addEventListener('click', toMenu);
  if (muteBtn) muteBtn.addEventListener('click', function () {
    muted = !muted; muteBtn.setAttribute('aria-pressed', muted ? 'true' : 'false'); muteBtn.textContent = muted ? 'Sound off' : 'Sound on';
    if (eng) eng.master.gain.value = muted ? 0 : 0.5; else if (!muted && state !== 'menu') initAudio();
  });

  try { initGL(); } catch (e) {
    if (overlayText) overlayText.textContent = 'WebGL is off in this browser.';
    if (playBtn) playBtn.hidden = true;
    if (window.console) console.error(e);
    return;
  }
  stage.classList.add('is-menu');
  placeAt(car, SPAWN[0], SPAWN[1], SPAWN_PSI); cam.yaw = car.psi; resize(); drawShop(); menuLoop();

  if (DEBUG) {
    window.__street = {
      roads: roads, patches: patches, ROUTES: ROUTES, CARS: CARS, garage: garage, tuned: tuned, newCar: newCar, placeAt: placeAt, stepCar: stepCar,
      nearestRoad: nearestRoad, surfaceAt: surfaceAt, inLake: inLake, pushOut: pushOut, SPAWN: SPAWN,
      get car() { return car; }, get state() { return state; }, get route() { return route; }, get cp() { return cp; }, get best() { return best; },
      get runT() { return runT; }, get drift() { return drift; }, get quality() { return quality; }, get audioOk() { return !!eng; }, get boxes() { return boxes.length / 6; }, get verts() { return worldBuf.n + flatBuf.n; },
      set orbit(a) { orbitFix = a; }, lockQuality: function () { lockQ = true; quality = 0; resize(); }, step: function (inp, dt) { gameStep(inp, dt); }, resetRoute: function () { endSprint(); cooldown = 0; }
    };
  }
})();
