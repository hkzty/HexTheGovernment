/*
  Tax Season — HTG's lane runner. A crew marches up a boulevard, fires on its
  own, and the player only steers: through gates that grow or shrink the crew,
  around forks, into lanes that keep spawning suits, up to a boss at the end
  of each bracket who is richer, bigger and uglier than the last.

  Raw WebGL1, one program. Every mesh is built in code at load (lathes and
  ellipsoids with smooth normals); nothing is downloaded. Enemies are
  fictional class archetypes. No real person, no third-party assets.

  Conventions: x across the road (+x is screen right; the view matrix is
  mirrored to make it so), z up the road, y up. Objects live at an absolute
  track z; "rel" is z minus the distance marched.
*/
(function () {
  'use strict';

  var canvas = document.getElementById('taxCanvas');
  if (!canvas) return;
  var stage = canvas.parentNode;
  var labels = document.getElementById('taxLabels');
  var lx = labels.getContext('2d');
  var $ = function (id) { return document.getElementById(id); };
  var overlay = $('taxOverlay'), oTitle = $('taxOverlayTitle'), oText = $('taxOverlayText');
  var playBtn = $('taxPlay'), shopEl = $('taxShop'), cashEl = $('taxCash');
  var exitBtn = $('taxExit'), muteBtn = $('taxMute');
  var hud = { n: $('hudCrew'), b: $('hudBracket'), c: $('hudCash') };

  var gl = canvas.getContext('webgl', { antialias: true, alpha: false, powerPreference: 'high-performance' });
  if (!gl) { oText.textContent = 'WebGL is off in this browser.'; playBtn.hidden = true; return; }

  var TAU = Math.PI * 2;
  var HW = 6;                       // road half width
  var LANES = [-4.8, -2.4, 0, 2.4, 4.8];
  var TIERS = ['Millionaire', 'Billionaire', 'Trillionaire', 'Quadrillionaire', 'Quintillionaire',
    'Sextillionaire', 'Septillionaire', 'Octillionaire', 'Nonillionaire', 'Decillionaire'];
  function tierName(t) { return t < TIERS.length ? TIERS[t] : TIERS[TIERS.length - 1] + ' ' + (t - TIERS.length + 2); }

  /* ------------------------------------------------------------- save */
  var KEY = 'htg.tax';
  var save = { cash: 0, bracket: 1, best: 1, up: { dmg: 0, rate: 0, crew: 0, income: 0 } };
  try {
    var raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (raw && raw.up) {
      save.cash = +raw.cash || 0; save.bracket = Math.max(1, raw.bracket | 0); save.best = Math.max(1, raw.best | 0);
      for (var k in save.up) save.up[k] = Math.max(0, raw.up[k] | 0);
    }
  } catch (e) {}
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) {} }
  var UPS = [['dmg', 'Damage'], ['rate', 'Fire rate'], ['crew', 'Crew'], ['income', 'Income']];
  function upCost(k) { return Math.round(60 * Math.pow(1.55, save.up[k])); }
  function money(v) {
    v = Math.floor(v);
    if (v < 1e4) return '$' + v;
    var u = ['K', 'M', 'B', 'T'], i = -1;
    while (v >= 1000 && i < 3) { v /= 1000; i++; }
    return '$' + (v < 100 ? v.toFixed(1) : Math.round(v)) + u[i];
  }

  /* ------------------------------------------------------- mesh builder */
  function put(b, ax, p, x, y, z, nx, ny, nz, c, part) {
    var t;
    if (ax === 'z') { t = y; y = z; z = t; t = ny; ny = nz; nz = t; }
    else if (ax === 'x') { t = y; y = x; x = t; t = ny; ny = nx; nx = t; }
    b.v.push(p[0] + x, p[1] + y, p[2] + z, nx, ny, nz, c[0], c[1], c[2], part);
  }
  // Revolve a profile of [radius, height] about the axis. Normals come off the
  // profile tangent, so a smooth profile shades smooth.
  function lathe(b, prof, o) {
    var seg = o.seg || 16, c = o.c, part = o.part || 0, p = o.p || [0, 0, 0];
    var sx = o.sx || 1, sz = o.sz || 1, ax = o.ax || 'y', closed = !!o.closed;
    var n = prof.length, base = b.v.length / 10, i, j;
    for (i = 0; i < n; i++) {
      var a = prof[closed ? (i + n - 1) % n : Math.max(i - 1, 0)];
      var d = prof[closed ? (i + 1) % n : Math.min(i + 1, n - 1)];
      var tr = d[0] - a[0], ty = d[1] - a[1], l = Math.hypot(tr, ty) || 1, nr = ty / l, ny = -tr / l;
      for (j = 0; j <= seg; j++) {
        var t = j / seg * TAU, cs = Math.cos(t), sn = Math.sin(t);
        var nx = nr * cs / sx, nz = nr * sn / sz, nl = Math.hypot(nx, ny, nz) || 1;
        put(b, ax, p, prof[i][0] * cs * sx, prof[i][1], prof[i][0] * sn * sz, nx / nl, ny / nl, nz / nl, c, part);
      }
    }
    var rings = closed ? n : n - 1;
    for (i = 0; i < rings; i++) {
      var i2 = (i + 1) % n;
      for (j = 0; j < seg; j++) {
        var q = base + i * (seg + 1) + j, r = base + i2 * (seg + 1) + j;
        b.i.push(q, r, q + 1, q + 1, r, r + 1);
      }
    }
  }
  function ell(b, cx, cy, cz, rx, ry, rz, c, part, seg) {
    seg = seg || 16;
    var m = Math.max(5, seg >> 1), prof = [];
    for (var k = 0; k <= m; k++) { var t = k / m * Math.PI; prof.push([rx * Math.sin(t), -ry * Math.cos(t)]); }
    lathe(b, prof, { p: [cx, cy, cz], c: c, part: part, seg: seg, sz: rz / rx });
  }
  // Capsule from a0 to a1 along the axis; p carries the other two coordinates.
  function cap(b, p, a0, a1, r, c, part, seg, ax) {
    var prof = [], k, t;
    for (k = 0; k <= 4; k++) { t = k / 4 * Math.PI / 2; prof.push([r * Math.sin(t), a0 + r - r * Math.cos(t)]); }
    for (k = 0; k <= 4; k++) { t = k / 4 * Math.PI / 2; prof.push([r * Math.cos(t), a1 - r + r * Math.sin(t)]); }
    lathe(b, prof, { p: p, c: c, part: part, seg: seg || 12, ax: ax });
  }
  function torus(b, R, r, o) {
    var prof = [];
    for (var k = 0; k < 10; k++) { var a = k / 10 * TAU; prof.push([R + r * Math.cos(a), r * Math.sin(a)]); }
    o.closed = true; lathe(b, prof, o);
  }
  function box(b, cx, cy, cz, hx, hy, hz, c, part) {
    var F = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    for (var f = 0; f < 6; f++) {
      var n = F[f], u = [n[1], n[2], n[0]], w = [n[2], n[0], n[1]], base = b.v.length / 10;
      for (var q = 0; q < 4; q++) {
        var su = q === 0 || q === 3 ? -1 : 1, sw = q < 2 ? -1 : 1;
        b.v.push(cx + (n[0] + u[0] * su + w[0] * sw) * hx, cy + (n[1] + u[1] * su + w[1] * sw) * hy,
          cz + (n[2] + u[2] * su + w[2] * sw) * hz, n[0], n[1], n[2], c[0], c[1], c[2], part || 0);
      }
      b.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  function mesh(build, piv) {
    var b = { v: [], i: [] };
    build(b);
    var m = { vb: gl.createBuffer(), ib: gl.createBuffer(), n: b.i.length, piv: piv || [0.85, 1.42, 0] };
    gl.bindBuffer(gl.ARRAY_BUFFER, m.vb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(b.v), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(b.i), gl.STATIC_DRAW);
    return m;
  }

  /* ------------------------------------------------------------ models */
  var GOLD = [1.0, 0.74, 0.22], BLACK = [0.05, 0.05, 0.07], WHITE = [0.92, 0.92, 0.9];
  // Shared body: legs (parts 1, 2), torso, arms (parts 3, 4), head. Faces +z.
  function body(b, o) {
    var s = o.seg, g = o.g || 1;
    cap(b, [-0.17 * g, 0, 0], 0.05, 0.9, 0.13, o.legs, 1, s);
    cap(b, [0.17 * g, 0, 0], 0.05, 0.9, 0.13, o.legs, 2, s);
    ell(b, -0.17 * g, 0.08, 0.07, 0.13, 0.08, 0.22, BLACK, 1, s);
    ell(b, 0.17 * g, 0.08, 0.07, 0.13, 0.08, 0.22, BLACK, 2, s);
    lathe(b, [[0, 0.74], [0.3 * g, 0.78], [0.37 * g, 0.98], [0.35 * g, 1.22], [0.38 * g, 1.42], [0.2, 1.52], [0.1, 1.58], [0, 1.58]],
      { c: o.suit, seg: s, sz: 0.7 });
    var ax = 0.38 * g + 0.08;
    cap(b, [-ax, 0, 0], 0.82, 1.5, 0.1, o.suit, 3, s);
    cap(b, [ax, 0, 0], 0.82, 1.5, 0.1, o.suit, 4, s);
    ell(b, -ax, 0.8, 0, 0.1, 0.11, 0.1, o.skin, 3, s);
    ell(b, ax, 0.8, 0, 0.1, 0.11, 0.1, o.skin, 4, s);
    ell(b, 0, 1.8, 0.02, 0.22, 0.25, 0.23, o.skin, 0, s);
    ell(b, -0.22, 1.8, 0.02, 0.04, 0.07, 0.05, o.skin, 0, 8);
    ell(b, 0.22, 1.8, 0.02, 0.04, 0.07, 0.05, o.skin, 0, 8);
    ell(b, 0, 1.78, 0.24, 0.04, 0.05, 0.05, o.skin, 0, 8);
  }
  function buildPol(b) {
    var skin = [0.87, 0.66, 0.56], suit = [0.11, 0.14, 0.3];
    body(b, { seg: 14, suit: suit, legs: [0.09, 0.11, 0.24], skin: skin });
    ell(b, 0, 1.28, 0.2, 0.13, 0.24, 0.08, WHITE, 0, 10);
    box(b, 0, 1.26, 0.275, 0.035, 0.2, 0.012, [0.8, 0.08, 0.1]);
    ell(b, 0, 1.93, -0.03, 0.225, 0.16, 0.235, [0.3, 0.22, 0.14], 0, 12);
    ell(b, -0.08, 1.84, 0.21, 0.028, 0.034, 0.02, BLACK, 0, 8);
    ell(b, 0.08, 1.84, 0.21, 0.028, 0.034, 0.02, BLACK, 0, 8);
    ell(b, 0, 1.69, 0.2, 0.1, 0.035, 0.04, WHITE, 0, 10);
    ell(b, -0.2, 1.36, 0.22, 0.06, 0.06, 0.03, [0.9, 0.1, 0.12], 0, 10);
    box(b, 0.47, 0.6, 0.02, 0.05, 0.16, 0.22, [0.36, 0.2, 0.08], 4);
  }
  function buildHC(b) {
    var skin = [0.8, 0.6, 0.5], suit = [0.24, 0.29, 0.15];
    body(b, { seg: 14, suit: suit, legs: [0.2, 0.24, 0.13], skin: skin, g: 1.12 });
    lathe(b, [[0.2, 1.96], [0.235, 2.0], [0.24, 2.06], [0.33, 2.13], [0.3, 2.17], [0, 2.18]], { c: [0.18, 0.22, 0.11], seg: 16 });
    ell(b, 0, 1.99, 0.24, 0.17, 0.02, 0.12, BLACK, 0, 12);
    ell(b, 0, 2.08, 0.23, 0.05, 0.05, 0.02, GOLD, 0, 8);
    ell(b, -0.45, 1.5, 0, 0.13, 0.04, 0.11, GOLD, 0, 10);
    ell(b, 0.45, 1.5, 0, 0.13, 0.04, 0.11, GOLD, 0, 10);
    var md = [[1, 0.74, 0.22], [0.8, 0.1, 0.1], [0.2, 0.4, 0.9], [0.9, 0.9, 0.9]];
    for (var i = 0; i < 6; i++) ell(b, -0.26 + (i % 3) * 0.075, 1.36 - (i / 3 | 0) * 0.08, 0.235 - (i % 3) * 0.012, 0.03, 0.03, 0.015, md[i % 4], 0, 8);
    box(b, 0, 1.85, 0.215, 0.17, 0.035, 0.02, BLACK);
    ell(b, 0, 1.71, 0.21, 0.1, 0.03, 0.04, [0.2, 0.15, 0.1], 0, 8);
  }
  // The rich. Every tier adds girth, chins, warts, hats and gold.
  function buildRich(t) {
    return function (b) {
      var s = 28, u = Math.min(t, 7) / 7, g = 1 + 0.11 * t, rnd = 7 + t * 13;
      function R() { rnd = (rnd * 1103515245 + 12345) & 0x7fffffff; return rnd / 0x7fffffff; }
      var skin = [0.88 - 0.3 * u, 0.62 + 0.02 * u, 0.55 - 0.15 * u];
      var coat = [0.06, 0.05, 0.08], vest = [0.86, 0.72 - 0.2 * u, 0.3];
      cap(b, [-0.24 * g, 0, 0], 0.05, 0.8, 0.17, [0.1, 0.1, 0.13], 1, 16);
      cap(b, [0.24 * g, 0, 0], 0.05, 0.8, 0.17, [0.1, 0.1, 0.13], 2, 16);
      ell(b, -0.24 * g, 0.09, 0.1, 0.17, 0.09, 0.28, WHITE, 1, 14);
      ell(b, 0.24 * g, 0.09, 0.1, 0.17, 0.09, 0.28, WHITE, 2, 14);
      lathe(b, [[0, 0.56], [0.4 * g, 0.6], [0.6 * g, 0.82], [0.66 * g, 1.05], [0.58 * g, 1.3], [0.42 * g, 1.48], [0.24, 1.58], [0, 1.6]],
        { c: coat, seg: s, sz: 0.86 });
      ell(b, 0, 1.02, 0.2 * g, 0.5 * g, 0.42, 0.44 * g, vest, 0, s);
      for (var i = 0; i < 4; i++) ell(b, 0, 0.78 + i * 0.16, 0.2 * g + 0.44 * g * Math.cos((i - 1.5) * 0.36), 0.035, 0.035, 0.02, GOLD, 0, 8);
      // coat tails
      ell(b, -0.18 * g, 0.62, -0.42 * g, 0.16, 0.34, 0.06, coat, 0, 12);
      ell(b, 0.18 * g, 0.62, -0.42 * g, 0.16, 0.34, 0.06, coat, 0, 12);
      var ax = 0.6 * g + 0.06;
      cap(b, [-ax, 0, 0], 0.84, 1.52, 0.15, coat, 3, 16);
      cap(b, [ax, 0, 0], 0.84, 1.52, 0.15, coat, 4, 16);
      ell(b, -ax, 0.8, 0, 0.14, 0.15, 0.14, skin, 3, 14);
      ell(b, ax, 0.8, 0, 0.14, 0.15, 0.14, skin, 4, 14);
      for (i = 0; i < Math.min(t, 4); i++) torus(b, 0.11, 0.03, { p: [(i % 2 ? ax : -ax), 0.74 + (i >> 1) * 0.07, 0.08], c: GOLD, part: i % 2 ? 4 : 3, seg: 12, ax: 'z' });
      // head, jowls, chins
      var hw = 0.3 + 0.022 * t, hy = 1.9;
      ell(b, 0, hy, 0.04, hw, 0.3, 0.29, skin, 0, s);
      ell(b, -hw * 0.72, hy - 0.16, 0.1, 0.15 + 0.012 * t, 0.17, 0.16, skin, 0, 16);
      ell(b, hw * 0.72, hy - 0.18, 0.1, 0.16 + 0.016 * t, 0.19, 0.16, skin, 0, 16);
      for (i = 0; i < 1 + Math.min(t, 6); i++) ell(b, 0, hy - 0.27 - i * 0.065, 0.14 + i * 0.022, 0.24 + 0.035 * i, 0.085, 0.2 + 0.01 * i, skin, 0, 16);
      ell(b, -hw - 0.02, hy, 0, 0.06, 0.11, 0.07, skin, 0, 10);
      ell(b, hw + 0.02, hy - 0.02, 0, 0.07, 0.13, 0.07, skin, 0, 10);
      // nose, eyes, mouth
      var red = [0.85 - 0.1 * u, 0.36, 0.36];
      ell(b, 0.01, hy - 0.03, 0.33, 0.085 + 0.012 * t, 0.09 + 0.012 * t, 0.1 + 0.01 * t, red, 0, 14);
      var e2 = 0.062 + 0.011 * t;
      ell(b, -0.125, hy + 0.08, 0.26, 0.058, 0.058, 0.04, WHITE, 0, 12);
      ell(b, 0.13, hy + 0.09 + 0.008 * t, 0.25, e2, e2, 0.045, WHITE, 0, 12);
      ell(b, -0.115, hy + 0.075, 0.295, 0.024, 0.024, 0.012, BLACK, 0, 8);
      ell(b, 0.145, hy + 0.1 + 0.008 * t, 0.29, 0.02, 0.02, 0.012, BLACK, 0, 8);
      ell(b, -0.125, hy + 0.165, 0.25, 0.085, 0.022, 0.03, [0.2, 0.15, 0.12], 0, 8);
      ell(b, 0.13, hy + 0.19 + 0.012 * t, 0.24, 0.09, 0.022, 0.03, [0.2, 0.15, 0.12], 0, 8);
      var mw = 0.14 + 0.014 * t;
      ell(b, 0, hy - 0.17, 0.27, mw, 0.045, 0.05, [0.18, 0.03, 0.05], 0, 12);
      for (i = 0; i < Math.min(2 + t, 7); i++) {
        var tx = (i / Math.max(1, Math.min(1 + t, 6)) - 0.5) * mw * 1.5;
        box(b, tx, hy - 0.155 - (i % 2) * 0.012, 0.31, 0.014, 0.02 + (i % 3) * 0.006, 0.008, i % 2 ? GOLD : [0.85, 0.82, 0.6]);
      }
      // warts and boils
      for (i = 0; i < t * 3; i++) {
        var a = R() * TAU, h = R() * 1.4 - 0.5, cr = Math.sqrt(Math.max(0.05, 1 - h * h * 0.5));
        var wr = 0.018 + R() * 0.016 + 0.002 * t;
        ell(b, Math.sin(a) * hw * cr * 0.97, hy + h * 0.2, 0.04 + Math.cos(a) * 0.28 * cr, wr, wr, wr, [0.55 + R() * 0.2, 0.3, 0.32], 0, 6);
      }
      if (t >= 4) ell(b, -0.08, hy + 0.2, 0.22, 0.05, 0.045, 0.04, [0.7, 0.3, 0.3], 0, 10);
      if (t >= 5) { ell(b, 0.02, hy + 0.23, 0.2, 0.04, 0.04, 0.03, WHITE, 0, 10); ell(b, 0.02, hy + 0.23, 0.228, 0.014, 0.014, 0.008, BLACK, 0, 6); }
      if (t >= 1) torus(b, e2 + 0.012, 0.01, { p: [0.13, hy + 0.09 + 0.008 * t, 0.285], c: GOLD, seg: 20, ax: 'z' });
      if (t >= 2) { cap(b, [0.1, hy - 0.17, 0], 0.28, 0.6, 0.03, [0.35, 0.2, 0.1], 0, 10, 'z'); ell(b, 0.1, hy - 0.17, 0.6, 0.032, 0.032, 0.02, [3, 0.9, 0.2], 0, 8); }
      if (t >= 3) for (i = 0; i < Math.min(t - 2, 3); i++) torus(b, 0.33 + i * 0.05, 0.022, { p: [0, 1.5 - i * 0.07, 0.1 + i * 0.06], c: GOLD, seg: 24, sz: 0.8 });
      // hats, stacked
      var hats = 1 + (t >> 1), y = hy + 0.24, w = 0.3;
      for (i = 0; i < hats; i++) {
        var hh = 0.3 + 0.05 * t;
        lathe(b, [[0, y], [w * 1.5, y], [w * 1.55, y + 0.025], [w, y + 0.04], [w * 0.96, y + hh], [w * 1.04, y + hh + 0.02], [0, y + hh + 0.03]],
          { c: [0.04, 0.04, 0.05], seg: 24, p: [i % 2 ? 0.03 : -0.02, 0, -0.02] });
        lathe(b, [[w * 1.01, y + 0.05], [w * 1.01, y + 0.11]], { c: i % 2 ? [0.7, 0.08, 0.1] : GOLD, seg: 24, p: [i % 2 ? 0.03 : -0.02, 0, -0.02] });
        y += hh + 0.03; w *= 0.8;
      }
      if (t >= 6) for (i = 0; i < 6; i++) {
        a = i / 6 * TAU;
        lathe(b, [[0.03, y], [0, y + 0.14]], { c: GOLD, seg: 8, p: [Math.cos(a) * w * 0.9, 0, Math.sin(a) * w * 0.9 - 0.02] });
      }
    };
  }
  // The crew: a hooded robe with a hexagon on its back and a wand out front.
  function buildCrew(b) {
    var robe = [0.24, 0.09, 0.42], dark = [0.13, 0.05, 0.24];
    lathe(b, [[0, 0], [0.36, 0.02], [0.33, 0.3], [0.27, 0.9], [0.31, 1.3], [0.17, 1.46], [0, 1.5]], { c: robe, seg: 16, sz: 0.85 });
    torus(b, 0.35, 0.025, { p: [0, 0.05, 0], c: GOLD, seg: 16, sz: 0.85 });
    ell(b, 0, 1.64, -0.02, 0.23, 0.25, 0.25, dark, 0, 14);
    ell(b, 0, 1.6, 0.13, 0.15, 0.16, 0.13, BLACK, 0, 10);
    lathe(b, [[0, -0.285], [0.13, -0.285], [0.1, -0.292], [0, -0.292]], { p: [0, 1.05, 0], c: GOLD, seg: 6, ax: 'z' });
    cap(b, [-0.34, 0, 0], 0.86, 1.36, 0.09, robe, 3, 10);
    cap(b, [0.34, 0, 0], 0.86, 1.36, 0.09, robe, 4, 10);
    cap(b, [0.34, 0.74, 0], 0.62, 0.9, 0.025, GOLD, 4, 8);
    ell(b, 0.34, 0.6, 0, 0.05, 0.05, 0.05, [2.2, 1.2, 3], 4, 8);
  }
  var M = {
    pol: mesh(buildPol), hc: mesh(buildHC), crew: mesh(buildCrew, [0.85, 1.3, -1.25]),
    rich: [],
    crate: mesh(function (b) {
      box(b, 0, 0.75, 0, 0.75, 0.75, 0.75, [0.2, 0.2, 0.24]);
      box(b, 0, 0.75, 0, 0.77, 0.08, 0.77, GOLD); box(b, 0, 0.75, 0, 0.08, 0.77, 0.77, GOLD);
      torus(b, 0.22, 0.04, { p: [0, 0.75, -0.76], c: GOLD, seg: 20, ax: 'z' });
      ell(b, 0, 0.75, -0.78, 0.07, 0.07, 0.05, GOLD, 0, 12);
    }),
    lobby: mesh(function (b) {
      box(b, 0, 1.2, 0, 1.05, 1.2, 0.7, [0.1, 0.09, 0.13]);
      box(b, 0, 0.95, -0.71, 0.55, 0.95, 0.02, [2.4, 1.6, 0.5]);
      box(b, 0, 1.98, -0.72, 0.7, 0.07, 0.04, GOLD); box(b, -0.66, 0.95, -0.72, 0.06, 0.95, 0.04, GOLD); box(b, 0.66, 0.95, -0.72, 0.06, 0.95, 0.04, GOLD);
      lathe(b, [[0, 2.4], [0.5, 2.4], [0.42, 2.7], [0, 2.75]], { c: GOLD, seg: 24, sz: 0.5 });
    }),
    post: mesh(function (b) {
      lathe(b, [[0, 0], [0.2, 0], [0.2, 0.12], [0.1, 0.2], [0.1, 2.75], [0.17, 2.85], [0, 3.0]], { c: GOLD, seg: 16 });
    }),
    panel: mesh(function (b) {
      b.v.push(-0.5, 0, 0, 0, 0, -1, 0, 0, 0, 0, 0.5, 0, 0, 0, 0, -1, 1, 0, 0, 0, 0.5, 1, 0, 0, 0, -1, 1, 1, 0, 0, -0.5, 1, 0, 0, 0, -1, 0, 1, 0, 0);
      b.i.push(0, 1, 2, 0, 2, 3);
    }),
    cube: mesh(function (b) { box(b, 0, 0.5, 0, 0.5, 0.5, 0.5, [0.26, 0.25, 0.3]); }),
    lamp: mesh(function (b) {
      lathe(b, [[0, 0], [0.16, 0], [0.07, 0.3], [0.05, 4.4], [0, 4.4]], { c: [0.12, 0.12, 0.15], seg: 12 });
      cap(b, [0, 4.4, 0], 0, 1.0, 0.04, [0.12, 0.12, 0.15], 0, 8, 'x');
      ell(b, 0.95, 4.3, 0, 0.16, 0.12, 0.16, [4, 3, 1.4], 0, 12);
    }),
    tower: mesh(function (b) {
      box(b, 0, 0.5, 0, 0.5, 0.5, 0.5, [0.05, 0.045, 0.075]);
      for (var i = 0; i < 26; i++) {
        var r = (i * 7919 % 97) / 97, c = r > 0.7 ? [2.2, 1.6, 0.6] : r > 0.5 ? [1.2, 0.5, 2.2] : [0.1, 0.09, 0.14];
        box(b, -0.36 + (i % 4) * 0.24, 0.12 + (i / 4 | 0) * 0.125, -0.5, 0.07, 0.03, 0.004, c);
        box(b, -0.5, 0.12 + (i / 4 | 0) * 0.125, -0.36 + (i % 4) * 0.24, 0.004, 0.03, 0.07, c);
        box(b, 0.5, 0.12 + (i / 4 | 0) * 0.125, -0.36 + ((i + 2) % 4) * 0.24, 0.004, 0.03, 0.07, c);
      }
    }),
    bolt: mesh(function (b) { ell(b, 0, 0, 0, 0.09, 0.09, 0.5, [1, 1, 1], 0, 8); }),
    coin: mesh(function (b) { lathe(b, [[0, -0.03], [0.15, -0.03], [0.17, 0], [0.15, 0.03], [0, 0.03]], { c: GOLD, seg: 14, ax: 'z' }); }),
    blob: mesh(function (b) {
      b.v.push(-1, 0.02, -1, 0, 1, 0, -1, -1, 0, 0, 1, 0.02, -1, 0, 1, 0, 1, -1, 0, 0, 1, 0.02, 1, 0, 1, 0, 1, 1, 0, 0, -1, 0.02, 1, 0, 1, 0, -1, 1, 0, 0);
      b.i.push(0, 1, 2, 0, 2, 3);
    }),
    road: mesh(function (b) {
      b.v.push(-HW, 0, -14, 0, 1, 0, 0, 0, 0, 0, HW, 0, -14, 0, 1, 0, 0, 0, 0, 0, HW, 0, 130, 0, 1, 0, 0, 0, 0, 0, -HW, 0, 130, 0, 1, 0, 0, 0, 0, 0);
      b.i.push(0, 1, 2, 0, 2, 3);
      box(b, -HW - 0.2, 0.45, 58, 0.06, 0.05, 72, GOLD); box(b, HW + 0.2, 0.45, 58, 0.06, 0.05, 72, GOLD);
      box(b, -HW - 0.2, -0.3, 58, 0.2, 0.3, 72, [0.1, 0.1, 0.13]); box(b, HW + 0.2, -0.3, 58, 0.2, 0.3, 72, [0.1, 0.1, 0.13]);
    })
  };
  function richMesh(t) { t = Math.min(t, 8); return M.rich[t] || (M.rich[t] = mesh(buildRich(t), [0.8, 1.44, 0])); }

  /* ------------------------------------------------------------ shader */
  var VS = 'attribute vec3 aP;attribute vec3 aN;attribute vec3 aC;attribute float aPart;' +
    'uniform mat4 uVP;uniform vec4 uXf;uniform vec3 uRot;uniform vec3 uPiv;uniform vec3 uScl;' +
    'varying vec3 vN;varying vec3 vC;varying vec3 vW;' +
    'void main(){vec3 p=aP;vec3 n=aN;' +
    'if(aPart>0.5){float side=mod(aPart,2.0)<0.5?1.0:-1.0;bool leg=aPart<2.5;float py=leg?uPiv.x:uPiv.y;' +
    'float ang=sin(uRot.y)*uRot.z*side*(leg?1.0:-0.8)+(leg?0.0:uPiv.z);float c=cos(ang);float s=sin(ang);' +
    'p.y-=py;p=vec3(p.x,p.y*c-p.z*s,p.y*s+p.z*c);p.y+=py;n=vec3(n.x,n.y*c-n.z*s,n.y*s+n.z*c);}' +
    'p*=uScl;n=normalize(n/uScl);float cy=cos(uRot.x);float sy=sin(uRot.x);' +
    'p=vec3(p.x*cy+p.z*sy,p.y,-p.x*sy+p.z*cy);n=vec3(n.x*cy+n.z*sy,n.y,-n.x*sy+n.z*cy);' +
    'vec3 w=p*uXf.w+uXf.xyz;vW=w;vN=n;vC=aC;gl_Position=uVP*vec4(w,1.0);}';
  var FS = 'precision mediump float;varying vec3 vN;varying vec3 vC;varying vec3 vW;' +
    'uniform vec3 uEye;uniform vec4 uTint;uniform float uMat;uniform float uScroll;uniform float uAlpha;uniform float uFogK;' +
    'float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}' +
    'void main(){vec3 fogC=vec3(0.035,0.012,0.06);float d=length(vW-uEye);' +
    'float fog=clamp((d-26.0*uFogK)/74.0,0.0,1.0);fog=fog*sqrt(fog);vec3 col;float al=uAlpha;' +
    'if(uMat<0.5){vec3 n=normalize(vN);vec3 v=normalize(uEye-vW);vec3 L=normalize(vec3(-0.45,0.8,-0.42));' +
    'float nl=dot(n,L);float dif=max(nl*0.62+0.38,0.0);dif*=dif;' +
    'vec3 amb=mix(vec3(0.10,0.07,0.17),vec3(0.30,0.27,0.42),n.y*0.5+0.5);' +
    'vec3 base=vC*uTint.rgb;vec3 h=normalize(L+v);' +
    'float sp=pow(max(dot(n,h),0.0),56.0)*0.55*step(0.0,nl);float rim=pow(1.0-max(dot(n,v),0.0),3.0);' +
    'col=base*(amb+dif*vec3(1.0,0.95,0.86))+sp*mix(vec3(1.0),min(base*2.5,vec3(2.0)),0.6)+rim*vec3(0.42,0.2,0.75)*0.45;' +
    'col=mix(col,vec3(1.0),uTint.a);}' +
    'else if(uMat<1.5){float x=vW.x;float z=vW.z+uScroll;' +
    'float g=hash(vec2(floor(x*9.0),mod(floor(z*9.0),432.0)));col=vec3(0.075,0.07,0.095)+g*0.018;' +
    'float w=0.035+d*0.0016;float l1=abs(abs(x)-1.2);float l2=abs(abs(x)-3.6);' +
    'float line=(1.0-smoothstep(w,w*2.2,min(l1,l2)))*step(0.5,fract(z/4.0));' +
    'float edge=1.0-smoothstep(w*2.0,w*3.6,abs(abs(x)-5.72));' +
    'float lz=(fract(z/12.0)-0.5)*12.0;float pool=exp(-lz*lz/10.0)*exp(-(6.0-abs(x))*(6.0-abs(x))/9.0);' +
    'col+=line*vec3(0.45,0.36,0.14)+edge*vec3(0.8,0.6,0.2)+pool*vec3(0.34,0.24,0.1);' +
    'col+=vec3(0.05,0.02,0.09)*smoothstep(30.0,0.0,d);}' +
    'else if(uMat<2.5){col=vC*uTint.rgb;fog*=0.35;}' +
    'else if(uMat<3.5){float a=1.0-smoothstep(0.25,1.0,length(vC.xy));gl_FragColor=vec4(0.0,0.0,0.0,a*0.5*(1.0-fog));return;}' +
    'else{float st=0.75+0.25*step(0.5,fract(vC.y*7.0-uScroll*0.0));float e=smoothstep(0.0,0.06,vC.y)*0.4+0.6;' +
    'col=uTint.rgb*st*(0.8+0.6*vC.y);al=uAlpha*e;}' +
    'gl_FragColor=vec4(mix(col,fogC,fog),al);}';
  function sh(type, src) {
    var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  var prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
  ['aP', 'aN', 'aC', 'aPart'].forEach(function (n, i) { gl.bindAttribLocation(prog, i, n); });
  gl.linkProgram(prog); gl.useProgram(prog);
  var U = {};
  ['uVP', 'uXf', 'uRot', 'uPiv', 'uScl', 'uEye', 'uTint', 'uMat', 'uScroll', 'uAlpha', 'uFogK'].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
  for (var ai = 0; ai < 4; ai++) gl.enableVertexAttribArray(ai);
  gl.enable(gl.DEPTH_TEST);
  gl.clearColor(0.035, 0.012, 0.06, 1);

  var bound = null;
  function bind(m) {
    if (bound === m) return;
    bound = m;
    gl.bindBuffer(gl.ARRAY_BUFFER, m.vb); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.ib);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 40, 0); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 40, 12);
    gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 40, 24); gl.vertexAttribPointer(3, 1, gl.FLOAT, false, 40, 36);
    gl.uniform3f(U.uPiv, m.piv[0], m.piv[1], m.piv[2]);
  }
  function draw(m, x, y, z, s, yaw, ph, sw) {
    bind(m);
    gl.uniform4f(U.uXf, x, y, z, s); gl.uniform3f(U.uRot, yaw || 0, ph || 0, sw || 0);
    gl.drawElements(gl.TRIANGLES, m.n, gl.UNSIGNED_SHORT, 0);
  }
  function mat(v) { gl.uniform1f(U.uMat, v); }
  function tint(r, g, b, f) { gl.uniform4f(U.uTint, r, g, b, f || 0); }
  function scl(x, y, z) { gl.uniform3f(U.uScl, x, y, z); }

  /* ------------------------------------------------------------ camera */
  var VP = new Float32Array(16), eye = [0, 10.5, -10.5], W = 1, H = 1, dprCap = 2, fogK = 1;
  function camera(cx) {
    var as = W / H, tf = Math.max(0.4, Math.min(0.6 / as, 0.5)), n = 0.5, f = 260;
    // a narrow stage backs the camera off until the road fits; the boss pulls it back too
    var zm = S.zoom || 0, k = Math.max(1, 6.6 / (tf * as) / 14.8) * (1 + 0.42 * zm);
    eye[1] = 10.5 * k; eye[2] = -10.5 * k; fogK = k;
    var P = new Float32Array(16);
    P[0] = 1 / tf / as; P[5] = 1 / tf; P[10] = (f + n) / (n - f); P[11] = -1; P[14] = 2 * f * n / (n - f);
    eye[0] = cx;
    var tx = cx, ty = 0.5 + 1.6 * zm, tz = 11 + 3 * zm;
    var zx = eye[0] - tx, zy = eye[1] - ty, zz = eye[2] - tz, l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
    var xx = zz, xz = -zx; l = Math.hypot(xx, xz); xx /= l; xz /= l;
    var yx = zy * xz, yy = zz * xx - zx * xz, yz = -zy * xx;
    xx = -xx; xz = -xz;            // mirror: +x on screen right
    var V = [xx, yx, zx, 0, 0, yy, zy, 0, xz, yz, zz, 0,
      -(xx * eye[0] + xz * eye[2]), -(yx * eye[0] + yy * eye[1] + yz * eye[2]), -(zx * eye[0] + zy * eye[1] + zz * eye[2]), 1];
    for (var c = 0; c < 4; c++) for (var r = 0; r < 4; r++) {
      VP[c * 4 + r] = P[r] * V[c * 4] + P[4 + r] * V[c * 4 + 1] + P[8 + r] * V[c * 4 + 2] + P[12 + r] * V[c * 4 + 3];
    }
  }
  function project(x, y, z) {
    var w = VP[3] * x + VP[7] * y + VP[11] * z + VP[15];
    if (w <= 0.1) return null;
    return [((VP[0] * x + VP[4] * y + VP[8] * z + VP[12]) / w * 0.5 + 0.5) * labels.width,
      (0.5 - (VP[1] * x + VP[5] * y + VP[9] * z + VP[13]) / w * 0.5) * labels.height, w];
  }
  function resize() {
    var r = stage.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, dprCap);
    W = Math.max(2, Math.round(r.width * d)); H = Math.max(2, Math.round(r.height * d));
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; labels.width = W; labels.height = H; }
    gl.viewport(0, 0, W, H);
  }

  /* ------------------------------------------------------------- sound */
  var actx = null, muted = false, lastShot = 0;
  function tone(f, dur, type, vol, to) {
    if (!actx || muted) return;
    var o = actx.createOscillator(), g = actx.createGain(), t = actx.currentTime;
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  function sfx(n) {
    if (n === 'shot') { if (S.t - lastShot > 0.09) { lastShot = S.t; tone(620, 0.05, 'triangle', 0.025, 300); } }
    else if (n === 'kill') tone(1320, 0.09, 'sine', 0.05, 1760);
    else if (n === 'good') { tone(520, 0.1, 'triangle', 0.08); setTimeout(function () { tone(780, 0.16, 'triangle', 0.08); }, 70); }
    else if (n === 'bad') tone(160, 0.3, 'sawtooth', 0.08, 70);
    else if (n === 'lose') tone(90, 0.12, 'square', 0.05, 50);
    else if (n === 'boss') tone(70, 0.9, 'sawtooth', 0.12, 38);
    else if (n === 'clear') [392, 523, 659, 784].forEach(function (f, i) { setTimeout(function () { tone(f, 0.22, 'triangle', 0.09); }, i * 110); });
  }

  /* -------------------------------------------------------------- game */
  var S = { mode: 'menu', t: 0, objs: [], bullets: [], pops: [], coins: [], ux: [], px: 0, n: 0, dist: 0 };
  var MAXSHOW = 36, OFF = [];
  for (var oi = 0; oi < MAXSHOW; oi++) { var orr = 0.46 * Math.sqrt(oi), oa = oi * 2.39996; OFF.push([Math.cos(oa) * orr, Math.sin(oa) * orr * 0.8]); }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function crewR() { return 0.45 + 0.46 * Math.sqrt(Math.min(S.n, MAXSHOW)) * 0.8; }

  function enemy(kind, x, z, tier, boss) {
    var s = S.scale, o = { type: 'en', kind: kind, x: x, z: z, tier: tier || 0, boss: !!boss, ph: Math.random() * TAU, flash: 0, bite: 0 };
    if (kind === 'pol') { o.hp = 3 * s; o.sp = 2.6; o.size = 1; o.r = 0.45; o.hit = 1; o.pay = 2; }
    else if (kind === 'hc') { o.hp = 13 * s; o.sp = 2.0; o.size = 1.2; o.r = 0.55; o.hit = 3; o.pay = 6; }
    else if (boss) { o.hp = 650 * s; o.sp = 2.2; o.size = 2.7 + 0.22 * Math.min(tier, 9); o.r = 0.62 * o.size; o.hit = 1; o.pay = 220 * S.b; }
    else { o.hp = 70 * s; o.sp = 1.4; o.size = 1.5 + 0.1 * Math.min(tier, 9); o.r = 0.62 * o.size; o.hit = 1; o.pay = 45; }
    o.max = o.hp;
    return o;
  }
  function wave(z, x0, x1, count) {
    for (var i = 0; i < count; i++) {
      S.objs.push(enemy(S.b >= 2 && Math.random() < 0.22 ? 'hc' : 'pol', rnd(x0 + 0.6, x1 - 0.6), z + rnd(0, 9)));
    }
  }
  function gateOp(good) {
    var r = Math.random(), b = S.b;
    if (good === 2) return r < 0.5 ? { op: 'mul', v: 2 } : { op: 'add', v: 6 + b + (Math.random() * 4 | 0) };
    if (!good) return r < 0.6 ? { op: 'add', v: -(3 + (Math.random() * (3 + b) | 0)) } : { op: 'add', v: 1 };
    if (r < 0.52) return { op: 'add', v: 2 + (Math.random() * (3 + b) | 0) };
    if (r < 0.66 && S.b > 0) return { op: 'mul', v: 2 };
    return r < 0.84 ? { op: 'rate', v: 1.2 } : { op: 'dmg', v: 1.25 };
  }
  function gates(z, x0, x1, ga, gb) {
    var mid = (x0 + x1) / 2, pair = {}, flip = Math.random() < 0.5;
    [[x0, mid, flip ? ga : gb], [mid, x1, flip ? gb : ga]].forEach(function (g) {
      var o = gateOp(g[2]);
      S.objs.push({ type: 'gate', z: z, x0: g[0], x1: g[1], x: (g[0] + g[1]) / 2, op: o.op, v: o.v, cap: o.v < 0 ? 3 : o.v + 6 + S.b, acc: 0, pair: pair });
    });
  }
  function build() {
    var b = S.b, s = S.scale, z = 36, L = 280 + 30 * Math.min(b, 8), i = 0, forked = false;
    var seq = ['gate', 'wave', 'crate', 'gate', 'lobby', 'wave', 'fork', 'gate', 'elite', 'wave', 'gate', 'lobby', 'wave', 'crate'];
    S.objs = [];
    while (z < L) {
      var k = seq[i++ % seq.length], n = Math.min(26, 5 + b * 2);
      if (k === 'fork' && forked) k = 'wave';
      if (k === 'elite' && b < 2) k = 'wave';
      if (k === 'gate') gates(z, -HW, HW, 1, Math.random() < 0.6 ? 0 : 1);
      else if (k === 'wave') wave(z, -HW, HW, n);
      else if (k === 'crate') S.objs.push({ type: 'crate', x: LANES[Math.random() * 5 | 0], z: z, hp: 24 * s, max: 24 * s, r: 0.8, flash: 0, gift: Math.random() < 0.45 ? 'gun' : 'crew' });
      else if (k === 'lobby') S.objs.push({ type: 'lobby', x: LANES[Math.random() * 5 | 0], z: z + 6, hp: 42 * s, max: 42 * s, r: 1.05, flash: 0, t: 0 });
      else if (k === 'elite') S.objs.push(enemy('rich', rnd(-3, 3), z, Math.max(0, b - 2)));
      else if (k === 'fork') {
        // Two paths: the guarded one pays, the quiet one barely does.
        forked = true;
        var rich = Math.random() < 0.5 ? -1 : 1, lo = rich < 0 ? -HW : 0.4, hi = rich < 0 ? -0.4 : HW;
        S.objs.push({ type: 'wall', z: z, z1: z + 44, x: 0 });
        wave(z + 6, lo, hi, n); gates(z + 22, lo, hi, 2, 2); wave(z + 28, lo, hi, n);
        if (b >= 2) S.objs.push(enemy('rich', (lo + hi) / 2, z + 16, Math.max(0, b - 2)));
        gates(z + 22, -hi, -lo, 1, 0); wave(z + 30, -hi, -lo, Math.ceil(n / 3));
        z += 38;
      }
      z += 21;
    }
    S.len = z + 8;
  }
  function start() {
    var b = save.bracket;
    S = { mode: 'play', t: 0, b: b, scale: Math.pow(1.5, b - 1), objs: [], bullets: [], pops: [], coins: [], ux: [],
      px: 0, cam: 0, n: 4 + 2 * save.up.crew, dist: 0, fire: 0, dmgMul: 1, rateMul: 1, gun: 0, cash: 0,
      bossOn: false, boss: null, zoom: 0, addT: 0, side: 0, speed: Math.min(12, 8.7 + 0.3 * b), shake: 0, hurt: 0 };
    build();
    for (var i = 0; i < MAXSHOW; i++) S.ux.push(0);
    setOverlay(false); hudDirty();
    if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
    if (actx && actx.state === 'suspended') actx.resume();
    frameStage(); wake();
  }
  function pop(x, y, z, text, col) { S.pops.push({ x: x, y: y, z: z, text: text, col: col || '#ffd24a', life: 1 }); }
  function burst(x, z, n, big) {
    for (var i = 0; i < n && S.coins.length < 140; i++) {
      S.coins.push({ x: x, y: big ? rnd(0.6, 3) : 0.9, z: z, vx: rnd(-3, 3) * (big ? 2 : 1), vy: rnd(4, 8) * (big ? 1.3 : 1), vz: rnd(-3, 3), life: rnd(0.6, 1.1), ph: Math.random() * 6 });
    }
  }
  function lose(k, x) {
    if (k <= 0 || S.n <= 0) return;
    S.n = Math.max(0, S.n - k); S.hurt = 0.25; S.shake = 0.2;
    pop(x == null ? S.px : x, 2.4, 0.5, '-' + k, '#ff4a5a'); sfx('lose'); hudDirty();
  }
  function earn(v, x, z) {
    v *= (1 + 0.25 * save.up.income) * (1 + 0.3 * (S.b - 1));
    S.cash += v; hudDirty();
    if (v >= 20) pop(x, 2.6, z, '+' + money(v));
  }
  function kill(o) {
    o.dead = true;
    var rel = o.z - S.dist;
    earn(o.pay || 12, o.x, rel); burst(o.x, rel, o.boss ? 60 : o.kind === 'rich' ? 18 : o.type === 'en' ? 4 : 8, o.boss || o.kind === 'rich');
    sfx('kill');
    if (o.type === 'crate') {
      if (o.gift === 'gun' && S.gun < 3) { S.gun++; pop(o.x, 2.2, rel, 'WEAPON +1', '#7ff'); }
      else { var g = 4 + S.b; S.n = Math.min(150, S.n + g); pop(o.x, 2.2, rel, '+' + g, '#c79bff'); }
      sfx('good'); hudDirty();
    }
    if (o.boss) { S.shake = 0.6; clear(); }
  }
  function wallAt(rel0, rel1) {
    for (var i = 0; i < S.objs.length; i++) {
      var o = S.objs[i];
      if (o.type === 'wall' && o.z - S.dist < rel1 && o.z1 - S.dist > rel0) return o;
    }
    return null;
  }

  var keys = {}, dirty = true;
  function hudDirty() { dirty = true; }
  var hudLast = {};
  function setText(el, k, v) { if (hudLast[k] !== v) { hudLast[k] = v; el.textContent = v; } }
  function hudWrite() {
    if (!dirty) return; dirty = false;
    setText(hud.n, 'n', String(S.n || 0));
    setText(hud.b, 'b', String(S.b || save.bracket));
    setText(hud.c, 'c', money(save.cash + (S.cash || 0)));
  }

  function update(dt) {
    var i, j, o, rel, b;
    S.t += dt;
    if (S.shake > 0) S.shake -= dt;
    if (S.hurt > 0) S.hurt -= dt;
    var dir = (keys.r ? 1 : 0) - (keys.l ? 1 : 0);
    if (dir) S.px += dir * 12 * dt;
    // a fork: the crew stays on the side it entered
    var w = wallAt(-1.2, 1.8), R = crewR();
    if (w) { if (!S.side) S.side = S.px >= 0 ? 1 : -1; if (S.px * S.side < 0.9) S.px = 0.9 * S.side; } else S.side = 0;
    S.px = Math.max(-HW + 0.6, Math.min(HW - 0.6, S.px));
    S.cam += (S.px * 0.4 - S.cam) * Math.min(1, dt * 5);
    S.zoom += ((S.boss && !S.boss.dead ? 1 : 0) - S.zoom) * Math.min(1, dt * 1.5);

    var bossPhase = S.dist >= S.len;
    if (!bossPhase) S.dist += S.speed * dt;
    else if (!S.bossOn) {
      S.bossOn = true; S.boss = enemy('rich', 0, S.dist + 48, S.b - 1, true); S.objs.push(S.boss); sfx('boss');
    } else if (S.boss && !S.boss.dead) {
      S.addT -= dt;
      if (S.addT <= 0) { S.addT = Math.max(0.5, 1.5 - 0.06 * S.b); S.objs.push(enemy(S.b >= 2 && Math.random() < 0.2 ? 'hc' : 'pol', LANES[Math.random() * 5 | 0], S.dist + 52)); }
    }

    for (i = 0; i < S.objs.length; i++) {
      o = S.objs[i]; rel = o.z - S.dist;
      if (o.flash > 0) o.flash -= dt * 6;
      if (o.type === 'en') {
        if (rel < 62) {
          o.ph += dt * (o.boss ? 5 : 9);
          var stop = o.boss ? R + o.r + 2.2 : -99;
          if (rel > stop) o.z -= (o.sp + (bossPhase && !o.boss ? 6.5 : 0)) * dt;
          if (rel < 16 || o.boss) {
            var nx = o.x + Math.max(-1, Math.min(1, S.px - o.x)) * (o.boss ? 2.6 : 1.5) * dt;
            var ww = wallAt(rel - 0.5, rel + 0.5);
            if (!ww || nx * o.x > 0 && Math.abs(nx) > 0.6) o.x = nx;
          }
          rel = o.z - S.dist;
          var touch = rel < R + o.r && rel > -1.5 && Math.abs(o.x - S.px) < R + o.r;
          if (o.boss) {
            // the boss stomps: stay in front of it and it eats the crew
            o.bite -= dt;
            if (rel < R + o.r + 3 && Math.abs(o.x - S.px) < R + o.r + 0.3 && o.bite <= 0) { o.bite = 0.42; lose(2 + (S.b >> 1), o.x); o.flash = 0.6; }
          } else if (touch) {
            if (o.kind === 'rich') { o.bite -= dt; if (o.bite <= 0) { o.bite = 0.12; lose(1, o.x); } }
            else { lose(o.hit, o.x); o.dead = true; burst(o.x, rel, 2); }
          }
        }
      } else if (o.type === 'lobby') {
        if (rel < 56 && rel > 9) { o.t -= dt; if (o.t <= 0) { o.t = Math.max(0.45, 1.0 - 0.04 * S.b); S.objs.push(enemy('pol', o.x + rnd(-0.5, 0.5), o.z - 1.4)); } }
        if (rel < R + 0.7 && rel > -1 && Math.abs(o.x - S.px) < R + 1.05) { lose(4, o.x); o.dead = true; burst(o.x, rel, 6); }
      } else if (o.type === 'crate') {
        if (rel < R + 0.75 && rel > -1 && Math.abs(o.x - S.px) < R + 0.75) { lose(2, o.x); o.dead = true; burst(o.x, rel, 3); }
      } else if (o.type === 'gate') {
        if (rel <= 0 && !o.pair.used && S.px >= o.x0 && S.px < o.x1) {
          o.pair.used = true; o.lit = 1;
          if (o.op === 'add') {
            if (o.v >= 0) { S.n = Math.min(150, S.n + o.v); pop(S.px, 2.6, 1, '+' + o.v, '#c79bff'); sfx('good'); }
            else { lose(-o.v); sfx('bad'); }
          } else if (o.op === 'mul') { var add = Math.min(150, S.n * o.v) - S.n; S.n += add; pop(S.px, 2.6, 1, '+' + add, '#c79bff'); sfx('good'); }
          else if (o.op === 'rate') { S.rateMul *= o.v; pop(S.px, 2.6, 1, 'FIRE RATE', '#ffd24a'); sfx('good'); }
          else { S.dmgMul *= o.v; pop(S.px, 2.6, 1, 'DAMAGE', '#ffd24a'); sfx('good'); }
          hudDirty();
        }
      }
      if (rel < -7 && o.type !== 'wall' || o.type === 'wall' && o.z1 - S.dist < -7) o.dead = true;
    }

    // fire: up to ten bolts a volley carry the whole crew's damage
    S.fire -= dt;
    if (S.fire <= 0 && S.n > 0) {
      S.fire += 0.27 / ((1 + 0.1 * save.up.rate) * S.rateMul);
      if (S.fire < 0) S.fire = 0;
      var shown = Math.min(S.n, MAXSHOW), kk = Math.min(shown, 10);
      var dmg = (1 + 0.25 * save.up.dmg) * S.dmgMul * (1 + 0.6 * S.gun) * S.n / kk;
      for (i = 0; i < kk; i++) {
        j = shown <= 10 ? i : Math.random() * shown | 0;
        var vx = S.gun >= 2 ? (i % 3 - 1) * 3.2 : 0;
        if (S.bullets.length < 160) S.bullets.push({ x: S.ux[j] + OFF[j][0] + 0.25, z: OFF[j][1] + 0.6, vx: vx, dmg: dmg });
      }
      sfx('shot');
    }
    for (i = 0; i < S.bullets.length; i++) {
      b = S.bullets[i];
      var z0 = b.z; b.z += 46 * dt; b.x += b.vx * dt;
      if (b.z > 50 || Math.abs(b.x) > HW) { b.dead = true; continue; }
      for (j = 0; j < S.objs.length; j++) {
        o = S.objs[j]; if (o.dead) continue;
        rel = o.z - S.dist;
        if (o.type === 'wall') { if (Math.abs(b.x) < 0.3 && b.z > rel && z0 < o.z1 - S.dist) { b.dead = true; break; } continue; }
        if (rel < z0 - 1.2 || rel > b.z + 1.2) continue;
        if (o.type === 'gate') {
          if (o.op === 'add' && !o.pair.used && rel > z0 && rel <= b.z && b.x >= o.x0 && b.x < o.x1) {
            b.dead = true;
            if (o.v < o.cap) { o.acc += b.dmg; var step = 5 * S.scale * (1 + Math.max(0, o.v) * 0.25); while (o.acc >= step && o.v < o.cap) { o.acc -= step; o.v++; o.lit = 0.5; } }
            break;
          }
          continue;
        }
        if (rel > z0 - o.r && rel < b.z + o.r && Math.abs(b.x - o.x) < o.r + 0.14) {
          b.dead = true; o.hp -= b.dmg; o.flash = 1;
          if (o.hp <= 0) kill(o);
          break;
        }
      }
    }
    for (i = 0; i < S.coins.length; i++) {
      var c = S.coins[i]; c.life -= dt; c.vy -= 20 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.z += (c.vz - (bossPhase ? 0 : S.speed)) * dt;
      if (c.y < 0.15) { c.y = 0.15; c.vy *= -0.45; }
    }
    for (i = 0; i < S.pops.length; i++) { S.pops[i].life -= dt; S.pops[i].y += dt * 1.6; }
    S.objs = S.objs.filter(alive); S.bullets = S.bullets.filter(alive);
    S.coins = S.coins.filter(living); S.pops = S.pops.filter(living);
    // each shown body eases after the pointer on its own lag
    for (i = 0; i < MAXSHOW; i++) S.ux[i] += (S.px - S.ux[i]) * Math.min(1, dt * (16 - i * 0.22));
    if (S.n <= 0 && S.mode === 'play') die();
  }
  function alive(o) { return !o.dead; }
  function living(o) { return o.life > 0; }

  function bank() { save.cash += S.cash || 0; S.cash = 0; persist(); }
  function die() {
    S.mode = 'dead'; bank(); sfx('bad');
    showOverlay('BOUGHT OUT', 'Bracket ' + S.b + ' · ' + tierName(S.b - 1), 'Again');
  }
  function clear() {
    S.mode = 'clear'; S.cash += 100 * S.b; save.bracket = S.b + 1; save.best = Math.max(save.best, save.bracket); bank(); sfx('clear');
    setTimeout(function () { if (S.mode === 'clear') showOverlay('BRACKET ' + S.b + ' PAID', 'Next: ' + tierName(S.b), 'Next bracket'); }, 1400);
  }

  /* ------------------------------------------------------------ render */
  function render() {
    var i, o, rel, t = S.t, playing = S.mode !== 'menu';
    var sh = S.shake > 0 ? (Math.random() - 0.5) * S.shake : 0;
    camera((S.cam || 0) + sh);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniformMatrix4fv(U.uVP, false, VP); gl.uniform3f(U.uEye, eye[0], eye[1], eye[2]);
    var dist = S.dist || 0;
    gl.uniform1f(U.uScroll, dist % 48); gl.uniform1f(U.uAlpha, 1); gl.uniform1f(U.uFogK, fogK);
    gl.disable(gl.BLEND); gl.depthMask(true);
    scl(1, 1, 1); tint(1, 1, 1, 0);
    mat(1); bind(M.road); gl.uniform4f(U.uXf, 0, 0, 0, 1); gl.uniform3f(U.uRot, 0, 0, 0);
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    mat(0); gl.drawElements(gl.TRIANGLES, M.road.n - 6, gl.UNSIGNED_SHORT, 12);
    // roadside: lamps every 12, towers every 16, scrolling under the march
    var k, z;
    for (k = -1; k < 10; k++) {
      z = k * 12 + 6 - dist % 12;
      draw(M.lamp, -HW - 0.7, 0, z, 1, 0); draw(M.lamp, HW + 0.7, 0, z, 1, Math.PI);
    }
    var base = Math.floor(dist / 16);
    for (k = -1; k < 8; k++) {
      z = (base + k) * 16 - dist + 8;
      var id = base + k, h1 = 9 + (id * 37 % 11) * 1.6, h2 = 9 + (id * 53 % 13) * 1.5;
      scl(5.5, h1, 7); draw(M.tower, -HW - 7 - (id * 29 % 5), -6, z, 1, 0);
      scl(5.5, h2, 7); draw(M.tower, HW + 7 + (id * 31 % 5), -6, z, 1, Math.PI);
    }
    scl(1, 1, 1);
    if (!playing) { lx.clearRect(0, 0, labels.width, labels.height); return; }

    // shadows
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
    mat(3);
    var shown = Math.min(S.n, MAXSHOW);
    for (i = 0; i < shown; i++) draw(M.blob, S.ux[i] + OFF[i][0], 0, OFF[i][1], 0.42);
    for (i = 0; i < S.objs.length; i++) {
      o = S.objs[i]; rel = o.z - dist;
      if (rel > 80 || o.type === 'gate' || o.type === 'wall') continue;
      draw(M.blob, o.x, 0, rel, o.type === 'en' ? o.r * 1.5 : 1.3);
    }
    gl.disable(gl.BLEND); gl.depthMask(true);

    // solids
    mat(0);
    for (i = 0; i < S.objs.length; i++) {
      o = S.objs[i]; rel = o.z - dist;
      if (rel > 84) continue;
      var f = Math.max(0, o.flash || 0) * 0.55;
      if (o.type === 'en') {
        tint(1, 1, 1, f);
        var m = o.kind === 'pol' ? M.pol : o.kind === 'hc' ? M.hc : richMesh(o.tier);
        var wob = o.kind === 'rich' ? Math.sin(o.ph) * 0.05 : 0;
        if (o.kind === 'rich') scl(1 + wob, 1 - wob, 1 + wob);
        draw(m, o.x, Math.abs(Math.sin(o.ph)) * 0.06 * o.size, rel, o.size, Math.PI + Math.max(-0.5, Math.min(0.5, (o.x - S.px) * 0.06)), o.ph, o.kind === 'rich' ? 0.45 : 0.75);
        if (o.kind === 'rich') scl(1, 1, 1);
      } else if (o.type === 'crate') { tint(1, 1, 1, f); draw(M.crate, o.x, 0, rel, 1, 0); }
      else if (o.type === 'lobby') { tint(1, 1, 1, f); draw(M.lobby, o.x, 0, rel, 1, 0); }
      else if (o.type === 'gate') { tint(1, 1, 1, 0); draw(M.post, o.x0 + 0.12, 0, rel, 1, 0); draw(M.post, o.x1 - 0.12, 0, rel, 1, 0); }
      else if (o.type === 'wall') {
        tint(1, 1, 1, 0); scl(0.5, 1.15, o.z1 - o.z); draw(M.cube, 0, 0, rel + (o.z1 - o.z) / 2, 1, 0);
        scl(0.56, 0.08, o.z1 - o.z); tint(4, 2.8, 0.9, 0); draw(M.cube, 0, 1.15, rel + (o.z1 - o.z) / 2, 1, 0); scl(1, 1, 1);
      }
    }
    // the crew
    var hurt = S.hurt > 0 ? 0.35 : 0;
    tint(1, 1, 1, hurt);
    for (i = 0; i < shown; i++) {
      var ph = t * 11 + i * 1.7;
      draw(M.crew, S.ux[i] + OFF[i][0], Math.abs(Math.sin(ph)) * 0.07, OFF[i][1], 0.82, (S.px - S.ux[i]) * 0.35, ph, 0.12);
    }
    tint(1, 1, 1, 0);
    for (i = 0; i < S.coins.length; i++) { var c = S.coins[i]; draw(M.coin, c.x, c.y, c.z, 1, c.ph + t * 9); }

    // gate panels, then bolts (additive)
    gl.enable(gl.BLEND); gl.depthMask(false); mat(4);
    for (i = 0; i < S.objs.length; i++) {
      o = S.objs[i]; if (o.type !== 'gate') continue;
      rel = o.z - dist; if (rel > 84) continue;
      if (o.lit > 0) o.lit -= 0.03;
      var good = o.op !== 'add' ? 2 : o.v >= 0 ? 1 : 0, lit = Math.max(0, o.lit || 0);
      if (good === 2) tint(1.0 + lit, 0.7 + lit, 0.18, 0); else if (good) tint(0.55 + lit, 0.25 + lit, 1.0, 0); else tint(1.0, 0.12 + lit, 0.2, 0);
      gl.uniform1f(U.uAlpha, o.pair.used ? 0.12 : 0.5);
      scl(o.x1 - o.x0 - 0.3, 2.7, 1); draw(M.panel, o.x, 0.1, rel, 1, 0);
    }
    scl(1, 1, 1); gl.uniform1f(U.uAlpha, 1);
    gl.blendFunc(gl.ONE, gl.ONE); mat(2);
    var bc = [[0.75, 0.4, 1.0], [0.3, 0.9, 1.0], [1.0, 0.75, 0.25], [1.0, 1.0, 1.0]][S.gun];
    tint(bc[0], bc[1], bc[2], 0);
    scl(1 + S.gun * 0.25, 1 + S.gun * 0.25, 1);
    for (i = 0; i < S.bullets.length; i++) { var b = S.bullets[i]; draw(M.bolt, b.x, 0.85, b.z, 1, 0); }
    scl(1, 1, 1);
    gl.disable(gl.BLEND); gl.depthMask(true);
    drawLabels();
  }
  function text(str, p, px, col, font) {
    lx.font = (font || '700 ') + Math.round(px) + 'px "IBM Plex Mono", ui-monospace, monospace';
    lx.lineWidth = Math.max(2, px * 0.16); lx.strokeStyle = 'rgba(5,0,12,0.85)';
    lx.strokeText(str, p[0], p[1]); lx.fillStyle = col; lx.fillText(str, p[0], p[1]);
  }
  function num(v) { v = Math.ceil(v); return v < 1e4 ? String(v) : v < 1e6 ? (v / 1e3).toFixed(1) + 'K' : v < 1e9 ? (v / 1e6).toFixed(1) + 'M' : (v / 1e9).toFixed(1) + 'B'; }
  function drawLabels() {
    var i, o, p, rel, u = labels.height;
    lx.clearRect(0, 0, labels.width, u);
    lx.textAlign = 'center'; lx.textBaseline = 'middle'; lx.lineJoin = 'round';
    for (i = 0; i < S.objs.length; i++) {
      o = S.objs[i]; rel = o.z - S.dist;
      if (rel > 70 || rel < -2) continue;
      if (o.type === 'gate') {
        if (o.pair.used) continue;
        p = project(o.x, 1.6, rel); if (!p) continue;
        var s = o.op === 'add' ? (o.v >= 0 ? '+' : '−') + Math.abs(o.v) : o.op === 'mul' ? '×' + o.v : o.op === 'rate' ? 'RATE' : 'DMG';
        text(s, p, Math.min(u * 0.09, u * 1.25 / p[2] * (s.length > 3 ? 0.62 : 1)), '#fff');
      } else if (o.type === 'crate' || o.type === 'lobby' || (o.type === 'en' && o.kind === 'rich' && !o.boss)) {
        p = project(o.x, o.type === 'crate' ? 2.0 : o.type === 'lobby' ? 3.3 : 2.75 * o.size, rel); if (!p) continue;
        text(num(o.hp), p, Math.min(u * 0.05, u * 0.62 / p[2]), '#ffd24a');
      }
    }
    if (S.n > 0) { p = project(S.px, 2.6, 0.2); if (p) text(String(S.n), p, u * 0.045, '#c79bff'); }
    for (i = 0; i < S.pops.length; i++) {
      o = S.pops[i]; p = project(o.x, o.y, o.z); if (!p) continue;
      lx.globalAlpha = Math.min(1, o.life * 2); text(o.text, p, Math.min(u * 0.06, u * 0.6 / p[2]), o.col); lx.globalAlpha = 1;
    }
    if (S.boss && !S.boss.dead) {
      var bw = Math.min(labels.width * 0.7, u * 0.8), bx = (labels.width - bw) / 2, by = u * 0.2, bh = Math.max(6, u * 0.016);
      lx.font = Math.round(u * 0.042) + 'px "New Rocker", serif';
      lx.lineWidth = 4; lx.strokeStyle = 'rgba(5,0,12,0.85)';
      lx.strokeText(tierName(S.boss.tier).toUpperCase(), labels.width / 2, by - u * 0.035);
      lx.fillStyle = '#ffd24a'; lx.fillText(tierName(S.boss.tier).toUpperCase(), labels.width / 2, by - u * 0.035);
      lx.fillStyle = 'rgba(5,0,12,0.7)'; lx.fillRect(bx - 2, by - 2, bw + 4, bh + 4);
      lx.fillStyle = '#ffd24a'; lx.fillRect(bx, by, bw * Math.max(0, S.boss.hp / S.boss.max), bh);
    } else if (S.mode === 'play' && S.len) {
      var pw = Math.min(labels.width * 0.4, u * 0.5), pxx = (labels.width - pw) / 2, py = u - Math.max(8, u * 0.02);
      lx.fillStyle = 'rgba(255,255,255,0.14)'; lx.fillRect(pxx, py, pw, 3);
      lx.fillStyle = '#b478ff'; lx.fillRect(pxx, py, pw * Math.min(1, S.dist / S.len), 3);
    }
  }

  /* ---------------------------------------------------------------- ui */
  function shop() {
    cashEl.textContent = money(save.cash);
    UPS.forEach(function (u, i) {
      var btn = shopEl.children[i], cost = upCost(u[0]);
      btn.textContent = u[1] + ' ' + (save.up[u[0]] + 1) + ' · ' + money(cost);
      btn.disabled = save.cash < cost;
    });
  }
  UPS.forEach(function (u) {
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'game-chip';
    btn.addEventListener('click', function () {
      var cost = upCost(u[0]);
      if (save.cash < cost) return;
      save.cash -= cost; save.up[u[0]]++; persist(); shop(); hudDirty(); hudWrite(); tone(880, 0.1, 'triangle', 0.07);
    });
    shopEl.appendChild(btn);
  });
  function setOverlay(on) {
    overlay.hidden = !on;
    stage.classList.toggle('is-menu', on && S.mode !== 'pause');
    canvas.classList.toggle('is-playing', !on);
    document.body.classList.toggle('game-active', !on);
  }
  function showOverlay(title, lead, btn) {
    oTitle.textContent = title; oText.textContent = lead; playBtn.textContent = btn;
    shop(); setOverlay(true); hudDirty(); hudWrite();
  }
  function toMenu() {
    if (S.mode === 'play' || S.mode === 'pause') bank();
    S.mode = 'menu'; S.dist = S.dist || 0;
    showOverlay('TAX SEASON', 'Bracket ' + save.bracket + ' · ' + tierName(save.bracket - 1), 'Play');
  }
  function pause() {
    if (S.mode !== 'play') return;
    S.mode = 'pause'; showOverlay('PAUSED', 'Bracket ' + S.b, 'Resume');
  }
  playBtn.addEventListener('click', function () {
    if (S.mode === 'pause') { S.mode = 'play'; setOverlay(false); wake(); }
    else start();
  });
  exitBtn.addEventListener('click', toMenu);
  muteBtn.addEventListener('click', function () {
    muted = !muted; muteBtn.setAttribute('aria-pressed', String(muted)); muteBtn.textContent = muted ? 'Sound off' : 'Sound on';
  });
  function frameStage() {
    var r = stage.getBoundingClientRect();
    if (r.top < 0 || r.bottom > window.innerHeight) stage.scrollIntoView({ block: 'center' });
  }

  // steering: the mouse is followed, a finger drags, the keys push
  var drag = null;
  function toX(e) { var r = canvas.getBoundingClientRect(); return (e.clientX - r.left) / r.width; }
  canvas.addEventListener('pointerdown', function (e) {
    if (S.mode !== 'play') return;
    drag = { x: toX(e), px: S.px };
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
  });
  canvas.addEventListener('pointermove', function (e) {
    if (S.mode !== 'play') return;
    var span = Math.min(14, 9 * Math.max(1, W / H));
    if (e.pointerType === 'mouse') S.px = (toX(e) - 0.5) * span;
    else if (drag) S.px = drag.px + (toX(e) - drag.x) * span * 1.15;
  });
  ['pointerup', 'pointercancel'].forEach(function (n) { canvas.addEventListener(n, function () { drag = null; }); });
  function key(e, down) {
    var c = e.code;
    if (c === 'ArrowLeft' || c === 'KeyA') keys.l = down;
    else if (c === 'ArrowRight' || c === 'KeyD') keys.r = down;
    else if (c === 'Escape' && down) { if (S.mode === 'play') pause(); return; }
    else return;
    if (S.mode === 'play') e.preventDefault();
  }
  window.addEventListener('keydown', function (e) { key(e, true); });
  window.addEventListener('keyup', function (e) { key(e, false); });
  document.addEventListener('visibilitychange', function () { if (document.hidden) pause(); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) { if (!en[0].isIntersecting) pause(); }).observe(stage);
  }
  window.addEventListener('resize', function () { resize(); if (!looping) render(); });

  /* -------------------------------------------------------------- loop */
  var looping = false, last = 0, slow = 0;
  function wake() { if (!looping) { looping = true; last = 0; requestAnimationFrame(frame); } }
  function frame(now) {
    var live = S.mode === 'play' || S.mode === 'clear' || S.mode === 'dead';
    if (!live) { looping = false; render(); return; }
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016; last = now;
    // step the resolution down on a device that cannot hold the frame
    if (dt > 0.03) { slow += dt; if (slow > 2.5 && dprCap > 0.75) { dprCap = dprCap > 1 ? 1 : 0.75; slow = 0; resize(); } } else slow = Math.max(0, slow - dt * 0.5);
    if (S.mode === 'play') update(dt);
    else {
      // after the end: let coins and pops settle
      S.t += dt; var keep = S.mode; S.fire = 9; S.mode = 'x'; var n = S.n; update(dt); S.t -= dt; S.n = n; S.mode = keep;
    }
    hudWrite(); render();
    requestAnimationFrame(frame);
  }

  resize(); toMenu();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (!looping) render(); });

  if (/[?&]taxdebug=1/.test(location.search)) {
    window.__tax = {
      get S() { return S; }, save: save, step: update, render: render, start: start, tierName: tierName,
      preview: function (tier, boss) { S.objs.push(enemy('rich', 0, S.dist + 9, tier, boss)); }
    };
  }
})();
