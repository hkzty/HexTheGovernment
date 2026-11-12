/* ============================================================
   HEX STREET — night street time attack. Self-contained IIFE.

   Original game: the circuit, both cars, every mesh, shader and sound
   are generated in code at runtime. Nothing is downloaded and no
   third-party assets, names or badges ship. See CLAUDE.md.

   Layout: world is the (x, z) plane, y up. A car's forward vector is
   (cos psi, sin psi); its side vector (-sin psi, cos psi) is the
   driver's RIGHT on screen. Steering, slip angles and lateral forces
   are all positive toward that side.
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
     TRACK — closed Catmull-Rom loop, resampled by arc length
     ============================================================ */
  var HW = 6.5;            // half road width, metres
  var SHOULDER = 1.6;      // kerb strip out to the barrier
  var LAMP = 28;           // lamp spacing along the road, metres
  var CTRL = [
    [0, 0], [220, 0], [330, 30], [380, 120], [340, 210], [240, 230], [180, 170],
    [110, 200], [60, 280], [-40, 300], [-130, 250], [-150, 150], [-90, 90],
    [-140, 30], [-80, 0]
  ];
  var T = (function () {
    var n = CTRL.length, dense = [], i, j;
    function cr(p0, p1, p2, p3, t) {
      var t2 = t * t, t3 = t2 * t;
      return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
    }
    for (i = 0; i < n; i++) {
      var a = CTRL[(i + n - 1) % n], b = CTRL[i], c = CTRL[(i + 1) % n], d = CTRL[(i + 2) % n];
      for (j = 0; j < 24; j++) dense.push([cr(a[0], b[0], c[0], d[0], j / 24), cr(a[1], b[1], c[1], d[1], j / 24)]);
    }
    var cum = [0], len = 0, m = dense.length;
    for (i = 1; i <= m; i++) {
      var p = dense[i % m], q = dense[i - 1];
      len += Math.hypot(p[0] - q[0], p[1] - q[1]); cum.push(len);
    }
    var N = Math.round(len / 2), ds = len / N;
    var x = new Float32Array(N), z = new Float32Array(N), tx = new Float32Array(N), tz = new Float32Array(N);
    var k = 0;
    for (i = 0; i < N; i++) {
      var s = i * ds;
      while (cum[k + 1] < s) k++;
      var f = (s - cum[k]) / (cum[k + 1] - cum[k]), p0 = dense[k % m], p1 = dense[(k + 1) % m];
      x[i] = lerp(p0[0], p1[0], f); z[i] = lerp(p0[1], p1[1], f);
    }
    for (i = 0; i < N; i++) {
      var ax = x[(i + 1) % N] - x[(i + N - 1) % N], az = z[(i + 1) % N] - z[(i + N - 1) % N], l = Math.hypot(ax, az);
      tx[i] = ax / l; tz[i] = az / l;
    }
    return { N: N, ds: ds, len: len, x: x, z: z, tx: tx, tz: tz };
  })();
  // side (right-hand) normal of sample i is (-tz, tx)

  function nearest(px, pz, hint) {
    var best = 1e18, bi = 0, i, j, dx, dz, d;
    if (hint < 0) {
      for (i = 0; i < T.N; i++) { dx = px - T.x[i]; dz = pz - T.z[i]; d = dx * dx + dz * dz; if (d < best) { best = d; bi = i; } }
      return bi;
    }
    for (j = -6; j <= 18; j++) {
      i = (hint + j + T.N) % T.N; dx = px - T.x[i]; dz = pz - T.z[i]; d = dx * dx + dz * dz;
      if (d < best) { best = d; bi = i; }
    }
    return bi;
  }

  /* ============================================================
     CARS — original designs. Figures are in SI units.
     ============================================================ */
  var CARS = {
    sedan: {
      label: 'V6 Sedan', paint: [0.42, 0.74, 0.93],
      m: 1350, a: 1.25, b: 1.48, h: 0.55, iz: 2550, width: 1.79, track: 1.52, rw: 0.31,
      front: 2.20, rear: -2.66, mu: 1.04, cda: 0.44, steer: 0.56,
      gears: [2.48, 1.48, 1.0, 0.70], fd: 3.08, eff: 0.86, idle: 750, stall: 2100, red: 5500, up: 5200,
      tq: [[700, 230], [1500, 265], [2600, 290], [3600, 296], [4400, 280], [4800, 253], [5500, 210]],
      cyl: 3.0, tone: 'sawtooth', ute: false
    },
    ute: {
      label: 'I6 Ute', paint: [0.86, 0.85, 0.80],
      m: 1560, a: 1.36, b: 1.74, h: 0.58, iz: 3350, width: 1.87, track: 1.56, rw: 0.32,
      front: 2.29, rear: -2.79, mu: 1.02, cda: 0.50, steer: 0.54,
      gears: [3.25, 1.99, 1.29, 1.0, 0.72], fd: 3.23, eff: 0.87, idle: 700, stall: 1900, red: 5700, up: 5300,
      tq: [[700, 280], [1500, 330], [3000, 357], [3800, 350], [4900, 306], [5700, 250]],
      cyl: 3.0, tone: 'square', ute: true
    }
  };
  var G = 9.81;

  function torque(S, rpm) {
    var c = S.tq, i;
    if (rpm <= c[0][0]) return c[0][1];
    for (i = 1; i < c.length; i++) if (rpm <= c[i][0]) return lerp(c[i - 1][1], c[i][1], (rpm - c[i - 1][0]) / (c[i][0] - c[i - 1][0]));
    return c[c.length - 1][1];
  }
  // Magic-formula lateral force. D carries a mild load sensitivity.
  function tyre(alpha, fz, mu, fz0) {
    var x = 11.5 * alpha, m = mu * (1 - 0.07 * (fz / fz0 - 1));
    return m * fz * Math.sin(1.32 * Math.atan(x - 0.2 * (x - Math.atan(x))));
  }

  function newCar(key) {
    return { key: key, S: CARS[key], x: 0, z: 0, psi: 0, vx: 0, vz: 0, r: 0, delta: 0, af: 0, ar: 0,
             ax: 0, ay: 0, gear: 1, rpm: 800, shiftT: 0, rev: false, slip: 0, spin: 0, wheelRot: 0,
             idx: 0, lat: 0, hit: 0, thr: 0, brk: 0, beta: 0, speed: 0 };
  }
  function placeCar(car, idx, back) {
    idx = ((idx % T.N) + T.N) % T.N;
    car.x = T.x[idx]; car.z = T.z[idx]; car.psi = Math.atan2(T.tz[idx], T.tx[idx]);
    car.vx = car.vz = car.r = car.delta = car.af = car.ar = car.ax = car.ay = 0;
    car.gear = 1; car.rpm = car.S.idle; car.rev = false; car.idx = idx; car.lat = 0; car.slip = 0; car.shiftT = 0;
    void back;
  }

  /* One fixed physics step. inp: {steer -1..1, thr 0..1, brk 0..1, hb bool} */
  function stepCar(car, inp, dt) {
    var S = car.S, L = S.a + S.b;
    var c = Math.cos(car.psi), s = Math.sin(car.psi);
    var vx = car.vx * c + car.vz * s, vy = -car.vx * s + car.vz * c, r = car.r;
    var spd = Math.hypot(vx, vy), sgn = vx >= 0 ? 1 : -1;
    var beta = spd > 2 ? Math.atan2(vy, Math.abs(vx)) : 0;

    // steering: less lock with speed, but always enough to catch a slide
    var lock = Math.min(S.steer, Math.atan(L * S.mu * G * 1.1 / Math.max(spd * spd, 1)) + 0.1);
    lock = Math.max(lock, Math.min(S.steer, Math.abs(beta) + 0.12));
    var target = clamp(inp.steer, -1, 1) * lock;
    var rate = (2.2 + 1.6 * clamp(1 - spd / 40, 0, 1)) * dt;
    car.delta += clamp(target - car.delta, -rate, rate);
    var dl = car.delta, cd = Math.cos(dl), sd = Math.sin(dl);

    // reverse: hold the brake at a standstill
    var thr = clamp(inp.thr, 0, 1), brk = clamp(inp.brk, 0, 1);
    if (!car.rev && spd < 0.6 && brk > 0.2 && thr < 0.05) car.rev = true;
    if (car.rev && (thr > 0.05 || vx > 1)) car.rev = false;

    // engine and gearbox
    var ratio = S.gears[car.gear - 1] * S.fd;
    var wheelRpm = Math.abs(vx) / S.rw * ratio * 9.5493;
    var rpm = Math.max(wheelRpm, S.idle + (S.stall - S.idle) * thr);
    if (car.shiftT > 0) car.shiftT -= dt;
    if (!car.rev && car.shiftT <= 0) {
      if (rpm > S.up && car.gear < S.gears.length) { car.gear++; car.shiftT = 0.22; }
      else if (car.gear > 1) {
        var down = Math.abs(vx) / S.rw * S.gears[car.gear - 2] * S.fd * 9.5493;
        if (down < S.up * 0.86 && (wheelRpm < 1500 || (thr > 0.7 && wheelRpm < 2500))) { car.gear--; car.shiftT = 0.18; }
      }
    }
    if (car.rev) car.gear = 1;
    rpm = Math.min(rpm, S.red);
    car.rpm += (rpm - car.rpm) * Math.min(1, dt * 14);
    var drive = 0;
    if (car.rev) {
      drive = vx > -8 ? -brk * 3800 : 0; brk = 0;
    } else {
      var tq = wheelRpm >= S.red ? 0 : torque(S, rpm) * thr * (car.shiftT > 0 ? 0.25 : 1);
      if (thr < 0.02 && vx > 1) tq = -(28 + rpm * 0.012);
      drive = tq * ratio * S.eff / S.rw;
    }

    // axle loads with longitudinal transfer
    var fzf0 = S.m * G * S.b / L, fzr0 = S.m * G * S.a / L;
    var tr = S.m * car.ax * S.h / L;
    var fzf = Math.max(600, fzf0 - tr), fzr = Math.max(600, fzr0 + tr);
    var muF = S.mu * 0.95, muR = S.mu * 1.06;

    // slip angles, relaxed for stability
    var fvx = vx * cd + (vy + S.a * r) * sd, fvy = (vy + S.a * r) * cd - vx * sd;
    var afT = -Math.atan2(fvy, Math.max(Math.abs(fvx), 2.2));
    var arT = -Math.atan2(vy - S.b * r, Math.max(Math.abs(vx), 2.2));
    var rel = Math.min(1, (spd + 1.5) * dt / 0.34);
    car.af += (afT - car.af) * rel; car.ar += (arT - car.ar) * rel;

    // longitudinal forces at each axle
    var bmax = S.m * G * 1.12;
    var fxf = -sgn * brk * bmax * 0.64, fxr = drive - sgn * brk * bmax * 0.36;
    if (car.rev) fxf = thr > 0 ? 0 : fxf;
    var capF = muF * fzf, capR = muR * fzr, spin = 0;
    fxf = clamp(fxf, -capF, capF);
    var locked = inp.hb && spd > 0.5;
    if (locked) fxr = -sgn * capR * 0.92;
    if (Math.abs(fxr) > capR * 0.97) { spin = 1; fxr = clamp(fxr, -capR * 0.93, capR * 0.93); }
    // friction circle: what the tyre spends on drive or braking it cannot spend sideways
    var kf = Math.sqrt(Math.max(0.06, 1 - (fxf / capF) * (fxf / capF)));
    var ur = 0.86 * fxr / capR;
    var kr = locked ? 0.3 : spin ? 0.46 : Math.sqrt(Math.max(0.2, 1 - ur * ur));
    var fyf = tyre(car.af, fzf, muF, fzf0) * kf;
    var fyr = tyre(car.ar, fzr, muR, fzr0) * kr;

    var drag = S.cda * vx * Math.abs(vx) + (spd > 0.3 ? sgn * 0.015 * S.m * G : 0);
    var FX = fxr + fxf * cd - fyf * sd - drag;
    var FY = fyr + fyf * cd + fxf * sd;
    var MZ = S.a * (fyf * cd + fxf * sd) - S.b * fyr;
    MZ -= S.iz * r * 0.9 * clamp(Math.abs(beta) * 2.2 - 0.15, 0, 1);   // damping once it is properly sideways
    var axB = FX / S.m, ayB = FY / S.m;
    vx += (axB + vy * r) * dt; vy += (ayB - vx * r) * dt; r += MZ / S.iz * dt;

    // below walking pace the tyre model is ill-conditioned: blend to pure rolling
    var w = clamp((Math.abs(vx) - 0.5) / 3.5, 0, 1), kq = (1 - w) * Math.min(1, 12 * dt);
    r += (vx * Math.tan(dl) / L - r) * kq; vy += -vy * kq;
    if (spd < 0.35 && thr < 0.02 && !car.rev) { vx *= 0.8; vy *= 0.8; r *= 0.8; }

    car.psi = wrapPi(car.psi + r * dt);
    c = Math.cos(car.psi); s = Math.sin(car.psi);
    car.vx = vx * c - vy * s; car.vz = vx * s + vy * c; car.r = r;
    car.x += car.vx * dt; car.z += car.vz * dt;
    car.ax += (axB - car.ax) * Math.min(1, dt * 10); car.ay += (ayB - car.ay) * Math.min(1, dt * 10);
    car.wheelRot -= vx / S.rw * dt;
    car.speed = Math.hypot(vx, vy); car.beta = car.speed > 3 ? Math.atan2(vy, Math.abs(vx)) : 0;
    car.thr = thr; car.brk = car.rev ? 0 : brk; car.spin = spin;
    var sl = Math.max(Math.abs(car.af), Math.abs(car.ar)) - 0.09;
    car.slip = clamp(sl * 5 + (spin || locked ? 0.5 : 0), 0, 1) * clamp(car.speed / 6, 0, 1);

    // barriers: keep the car between the walls
    car.idx = nearest(car.x, car.z, car.idx);
    var i = car.idx, nx = -T.tz[i], nz = T.tx[i];
    var lat = (car.x - T.x[i]) * nx + (car.z - T.z[i]) * nz, lim = HW + SHOULDER - 1.05;
    car.lat = lat; car.hit = 0;
    if (Math.abs(lat) > lim) {
      var sd2 = lat > 0 ? 1 : -1, over = Math.abs(lat) - lim, vn = (car.vx * nx + car.vz * nz) * sd2;
      car.x -= nx * sd2 * over; car.z -= nz * sd2 * over;
      if (vn > 0) {
        car.vx -= nx * sd2 * vn * 1.25; car.vz -= nz * sd2 * vn * 1.25;
        car.vx *= 0.97; car.vz *= 0.97; car.r *= 0.6; car.hit = vn;
        var along = Math.atan2(T.tz[i], T.tx[i]);
        if (Math.cos(car.psi - along) < 0) along += Math.PI;
        car.psi = wrapPi(car.psi + wrapPi(along - car.psi) * Math.min(0.25, vn * 0.03));
      }
    }
  }

  /* ============================================================
     MESH BUILDING — 13 floats per vertex:
     pos3 normal3 uv2 colour4 (a = per-object seed) material1
     ============================================================ */
  var MAT = { PAINT: 0, ROAD: 1, BUILDING: 2, EMISSIVE: 3, GROUND: 4, BRAKE: 5, BARRIER: 6, GLASS: 7 };
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

  function buildWorld() {
    var m = new Mesh(), i, N = T.N;
    var road = [0, 0, 0, 0], edge = HW + SHOULDER;
    // road surface and barriers
    for (i = 0; i < N; i++) {
      var j = (i + 1) % N, s0 = i * T.ds, s1 = (i + 1) * T.ds;
      var ax = T.x[i], az = T.z[i], bx = T.x[j], bz = T.z[j];
      var anx = -T.tz[i], anz = T.tx[i], bnx = -T.tz[j], bnz = T.tx[j];
      m.quad([ax - anx * edge, 0, az - anz * edge], [ax + anx * edge, 0, az + anz * edge],
             [bx + bnx * edge, 0, bz + bnz * edge], [bx - bnx * edge, 0, bz - bnz * edge],
             [0, 1, 0], road, MAT.ROAD, [-edge, s0, edge, s0, edge, s1, -edge, s1]);
      for (var sd = -1; sd <= 1; sd += 2) {
        var a0 = [ax + anx * edge * sd, 0, az + anz * edge * sd], b0 = [bx + bnx * edge * sd, 0, bz + bnz * edge * sd];
        m.quad(a0, b0, [b0[0], 0.95, b0[2]], [a0[0], 0.95, a0[2]], [-anx * sd, 0, -anz * sd], [0.3, 0.3, 0.32, sd], MAT.BARRIER,
               [s0, 0, s1, 0, s1, 0.95, s0, 0.95]);
      }
    }
    // ground
    m.quad([-700, -0.03, -500], [900, -0.03, -500], [900, -0.03, 800], [-700, -0.03, 800], [0, 1, 0], [0, 0, 0, 0], MAT.GROUND);
    // lamps: alternate sides, matching the light pools the road shader draws
    var lamps = [], per = Math.round(LAMP / T.ds), k = 0;
    for (i = Math.round(per / 2); i < N; i += per, k++) {
      var side = (Math.floor((i * T.ds) / LAMP) % 2) * 2 - 1;
      var lx = T.x[i] - T.tz[i] * (edge + 0.5) * side, lz = T.z[i] + T.tx[i] * (edge + 0.5) * side;
      m.box(lx, lz, T.tx[i], T.tz[i], 0.09, 0.09, 0, 6.2, [0.12, 0.12, 0.14, 0], MAT.GROUND);
      var hx = lx + T.tz[i] * 1.3 * side, hz = lz - T.tx[i] * 1.3 * side;
      m.box(hx, hz, T.tx[i], T.tz[i], 0.35, 0.7, 6.1, 6.28, [1.0, 0.66, 0.3, 0], MAT.EMISSIVE);
      lamps.push([hx, hz]);
    }
    // buildings on both sides, never over another stretch of road
    var placed = [], tints = [[0.16, 0.14, 0.2], [0.12, 0.13, 0.17], [0.2, 0.16, 0.16], [0.1, 0.1, 0.13]];
    for (var sdb = -1; sdb <= 1; sdb += 2) {
      var s = rnd() * 10;
      while (s < T.len - 8) {
        var hl = 5 + rnd() * 6, hd = 5 + rnd() * 6, ht = 7 + Math.pow(rnd(), 2.2) * 46;
        var ii = Math.round((s + hl) / T.ds) % N, off = edge + 3.2 + hd;
        var cx = T.x[ii] - T.tz[ii] * off * sdb, cz = T.z[ii] + T.tx[ii] * off * sdb, ok = true, q;
        for (q = 0; q < N && ok; q += 2) {
          var dx = cx - T.x[q], dz = cz - T.z[q];
          if (dx * dx + dz * dz < (off - 0.6) * (off - 0.6)) ok = false;
        }
        for (q = 0; q < placed.length && ok; q++) {
          if (Math.hypot(cx - placed[q][0], cz - placed[q][1]) < hl + placed[q][2] - 1) ok = false;
        }
        if (ok) {
          var t = tints[Math.floor(rnd() * tints.length)];
          m.box(cx, cz, T.tx[ii], T.tz[ii], hl, hd, 0, ht, [t[0], t[1], t[2], 0.05 + rnd() * 0.95], MAT.BUILDING, [0.05, 0.05, 0.07, 0]);
          placed.push([cx, cz, Math.max(hl, hd)]);
        }
        s += hl * 2 + 1.5 + rnd() * 5;
      }
    }
    return { mesh: m, lamps: lamps };
  }

  function buildCar(S) {
    var m = new Mesh(), W = S.width / 2, P = [S.paint[0], S.paint[1], S.paint[2], 0];
    var dark = [0.03, 0.03, 0.04, 0], trim = [0.07, 0.07, 0.08, 0], glass = [0.02, 0.03, 0.05, 0];
    var f = S.front, r = S.rear, body, cabin;
    if (!S.ute) {
      body = [[r + 0.06, 0.28], [f - 0.05, 0.28], [f, 0.45], [f - 0.04, 0.72], [0.95, 0.86], [-1.55, 0.9], [r + 0.04, 0.86], [r, 0.5]];
      cabin = [[0.95, 0.86], [0.25, 1.38], [-1.05, 1.38], [-1.75, 0.9]];
    } else {
      body = [[r + 0.04, 0.3], [f - 0.05, 0.3], [f, 0.46], [f - 0.04, 0.74], [1.05, 0.88], [-0.5, 0.98], [r + 0.03, 0.98], [r, 0.5]];
      cabin = [[1.05, 0.88], [0.42, 1.42], [-0.3, 1.42], [-0.5, 0.98]];
    }
    m.extrude(body, W, function (i) { return i === 0 ? dark : (i === 1 || i === 7) ? trim : P; }, function () { return MAT.PAINT; }, P, MAT.PAINT);
    var cw = W - 0.13;
    m.extrude(cabin, cw, function (i) { return i === 1 ? P : glass; }, function (i) { return i === 1 ? MAT.PAINT : MAT.GLASS; }, P, MAT.PAINT);
    // side glass, inset from the cabin outline
    var gx = 0, gy = 0, i, win = [];
    for (i = 0; i < 4; i++) { gx += cabin[i][0] / 4; gy += cabin[i][1] / 4; }
    for (i = 0; i < 4; i++) win.push([gx + (cabin[i][0] - gx) * 0.8, gy + (cabin[i][1] - gy) * 0.72 + 0.03]);
    m.poly(win, cw + 0.006, glass, MAT.GLASS); m.poly(win, -cw - 0.006, glass, MAT.GLASS);
    if (S.ute) m.quad([-0.62, 0.99, -W + 0.1], [r + 0.12, 0.99, -W + 0.1], [r + 0.12, 0.99, W - 0.1], [-0.62, 0.99, W - 0.1], [0, 1, 0], dark, MAT.GLASS);
    // lights and plate
    var hy0 = 0.54, hy1 = 0.68, sgn;
    for (sgn = -1; sgn <= 1; sgn += 2) {
      var z0 = sgn * 0.42, z1 = sgn * (W - 0.08);
      m.quad([f + 0.004, hy0, z0], [f + 0.004, hy0, z1], [f - 0.03, hy1, z1], [f - 0.03, hy1, z0], [1, 0, 0], [1, 0.95, 0.82, 0], MAT.EMISSIVE);
      m.quad([r - 0.006, 0.62, z0], [r - 0.006, 0.62, z1], [r + 0.02, 0.8, z1], [r + 0.02, 0.8, z0], [-1, 0, 0], [1, 0.06, 0.04, 0], MAT.BRAKE);
    }
    m.quad([r - 0.008, 0.5, -0.26], [r - 0.008, 0.5, 0.26], [r - 0.004, 0.61, 0.26], [r - 0.004, 0.61, -0.26], [-1, 0, 0], [0.5, 0.5, 0.46, 0], MAT.EMISSIVE);
    // wheel arches
    var arch = [], a;
    for (a = 0; a < 10; a++) arch.push([Math.cos(a / 10 * 6.2832) * 0.39, Math.sin(a / 10 * 6.2832) * 0.39]);
    [S.a, -S.b].forEach(function (wx) {
      var pts = arch.map(function (p) { return [wx + p[0], S.rw + 0.02 + p[1]]; });
      m.poly(pts, W + 0.004, dark, MAT.GLASS); m.poly(pts, -W - 0.004, dark, MAT.GLASS);
    });
    return m;
  }
  function buildWheel(S) { // axis along z, centred on the origin
    var m = new Mesh(), n = 12, w = 0.11, R = S.rw, i, tyreC = [0.035, 0.035, 0.04, 0], hub = [0.42, 0.42, 0.46, 0];
    for (i = 0; i < n; i++) {
      var a0 = i / n * 6.2832, a1 = (i + 1) / n * 6.2832, c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      m.quad([c0 * R, s0 * R, -w], [c1 * R, s1 * R, -w], [c1 * R, s1 * R, w], [c0 * R, s0 * R, w], [(c0 + c1) / 2, (s0 + s1) / 2, 0], tyreC, MAT.GLASS);
      for (var sg = -1; sg <= 1; sg += 2) {
        var nn = [0, 0, sg], zz = sg * w, col = i % 3 === 0 ? tyreC : hub, hr = R * 0.62;
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
    'uniform mat4 uVP;uniform mat4 uM;varying vec3 vP;varying vec3 vN;varying vec2 vU;varying vec4 vC;varying float vM;' +
    'void main(){vec4 w=uM*vec4(aP,1.0);vP=w.xyz;vN=mat3(uM)*aN;vU=aU;vC=aC;vM=aM;gl_Position=uVP*w;}';
  var FS = '#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n' +
    'varying vec3 vP;varying vec3 vN;varying vec2 vU;varying vec4 vC;varying float vM;' +
    'uniform vec3 uCam;uniform vec3 uCar;uniform vec2 uFwd;uniform float uBrake;uniform float uHW;uniform float uLamp;uniform float uGhost;uniform vec3 uNear;' +
    'float h(vec2 p){return fract(sin(dot(mod(p,289.0),vec2(127.1,311.7)))*43758.5453);}' +
    'vec3 ink(float s){float k=floor(s*4.0);if(k<1.0)return vec3(0.71,0.47,1.0);if(k<2.0)return vec3(0.18,0.83,0.88);if(k<3.0)return vec3(1.0,0.2,0.6);return vec3(0.3,1.0,0.55);}' +
    'void main(){vec3 n=normalize(vN);vec3 V=normalize(uCam-vP);vec3 col;float emis=0.0;float dist=length(vP-uCam);' +
    'vec3 amb=vec3(0.10,0.08,0.165);float dif=max(dot(n,normalize(vec3(0.3,0.8,0.4))),0.0)*0.22;' +
    'vec2 d=vP.xz-(uCar.xz+uFwd*1.9);float al=dot(d,uFwd);float la=dot(d,vec2(-uFwd.y,uFwd.x));float w=0.9+al*0.4;' +
    'float hl=step(0.0,al)*exp(-(la*la)/(w*w))*exp(-al*0.026)*2.3*clamp(al*0.4,0.0,1.0)*clamp(1.0-vP.y*0.1,0.0,1.0);' +
    'vec2 nd=vP.xz-uNear.xz;float nl=1.6/(1.0+dot(nd,nd)*0.012);' +
    'vec3 light=amb+dif*vec3(0.5,0.5,0.85)+hl*vec3(1.0,0.94,0.8);' +
    'if(vM<0.5){float fr=pow(1.0-max(dot(n,V),0.0),3.0);light+=vec3(0.3,0.3,0.34)+nl*vec3(1.0,0.62,0.3)*(0.25+0.75*max(n.y,0.0));' +
    'col=vC.rgb*light*1.15+fr*vec3(0.22,0.16,0.38)+pow(max(dot(reflect(-V,n),normalize(vec3(uNear.x-vP.x,6.0,uNear.z-vP.z))),0.0),24.0)*nl*0.5;}' +
    'else if(vM<1.5){float u=vU.x;float v=vU.y;float au=abs(u);float base=0.07+0.03*h(floor(vP.xz*5.0));' +
    'float k=floor(v/uLamp);float dv=v-(k+0.5)*uLamp;float sd=mod(k,2.0)*2.0-1.0;float du=u-sd*(uHW+0.8);' +
    'light+=1.5*exp(-(du*du+dv*dv)/75.0)*vec3(1.0,0.62,0.28);' +
    'float line=step(au,0.09)*step(fract(v/9.0),0.42)+step(abs(au-(uHW-0.3)),0.08);' +
    'float chk=step(abs(v-1.0),1.0)*step(au,uHW)*step(0.5,fract(floor(u)*0.5+floor(v)*0.5));' +
    'float sh=step(uHW,au);float kerb=sh*step(0.5,fract(v/3.0));' +
    'vec3 alb=mix(vec3(base),vec3(0.55),clamp(line+chk,0.0,1.0));alb=mix(alb,mix(vec3(0.11),vec3(0.32,0.07,0.16),kerb),sh);col=alb*light;}' +
    'else if(vM<2.5){float sv=floor(vC.a*997.0+0.5);vec2 g=vec2(vU.x/2.4,vU.y/3.2);vec2 c=floor(g);vec2 f=fract(g);' +
    'float win=step(0.18,f.x)*step(f.x,0.82)*step(0.24,f.y)*step(f.y,0.78)*step(1.0,c.y)*step(abs(n.y),0.5);' +
    'float far=clamp((dist-70.0)/150.0,0.0,1.0);win=mix(win,0.36*step(1.0,c.y)*step(abs(n.y),0.5),far);float lit=mix(step(0.7,h(c+sv)),0.3,far);vec3 wc=mix(vec3(1.0,0.76,0.42),vec3(0.55,0.72,1.0),h(c.yx+sv*3.0));' +
    'float band=step(3.3,vU.y)*step(vU.y,3.75)*step(0.45,vC.a)*step(abs(n.y),0.5);' +
    'col=vC.rgb*light*0.8+win*(lit*wc*0.85+(1.0-lit)*vec3(0.012,0.014,0.03))+band*ink(fract(sv*0.137))*1.3;emis=max(win*lit,band)*0.6;}' +
    'else if(vM<3.5){col=vC.rgb*1.5;emis=1.0;}' +
    'else if(vM<4.5){col=(vC.rgb+vec3(0.03+0.02*h(floor(vP.xz*2.0))))*light;}' +
    'else if(vM<5.5){col=vC.rgb*(0.4+1.7*uBrake);emis=1.0;}' +
    'else if(vM<6.5){float st=step(0.5,vU.y)*step(vU.y,0.74)*step(0.5,fract(vU.x/3.0+0.25*vC.a));' +
    'col=vC.rgb*light*0.6+st*vec3(1.0,0.2,0.62)*(0.07+hl*0.9);emis=st*0.3;}' +
    'else{float fr=pow(1.0-max(dot(n,V),0.0),3.0);col=vC.rgb*light+fr*vec3(0.2,0.16,0.36)+vC.rgb*nl*vec3(1.0,0.62,0.3)*0.6;}' +
    'float fog=1.0-exp(-dist*0.0058);col=mix(col,vec3(0.045,0.02,0.085),fog*(1.0-emis*0.45));' +
    'if(uGhost>0.5){gl_FragColor=vec4(vec3(0.3,0.9,1.0)*(0.35+0.4*max(n.y,0.0)),0.3);}else{gl_FragColor=vec4(col,1.0);}}';
  var SKY_VS = 'attribute vec2 aP;varying vec2 vQ;void main(){vQ=aP;gl_Position=vec4(aP,0.999,1.0);}';
  var SKY_FS = 'precision mediump float;varying vec2 vQ;uniform float uYaw;uniform float uHor;' +
    'float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}' +
    'void main(){float y=vQ.y-uHor;vec3 top=vec3(0.015,0.008,0.04);vec3 glow=vec3(0.22,0.07,0.32);' +
    'vec3 col=mix(glow,top,clamp(pow(max(y,0.0)*1.5,0.55),0.0,1.0));col=mix(col,vec3(0.045,0.02,0.085),step(y,0.0));' +
    'vec2 g=floor(vec2(vQ.x*90.0+uYaw*57.0,vQ.y*60.0));float st=step(0.994,h(g))*step(0.12,y);col+=st*vec3(0.6,0.6,0.8)*h(g+1.0);gl_FragColor=vec4(col,1.0);}';

  function compile(type, src) {
    var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('street shader: ' + gl.getShaderInfoLog(s));
    return s;
  }
  function program(vs, fs) {
    var p = gl.createProgram(); gl.attachShader(p, compile(gl.VERTEX_SHADER, vs)); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('street link: ' + gl.getProgramInfoLog(p));
    return p;
  }
  var prog, sky, U = {}, A = {}, skyU = {}, skyBuf, worldBuf, carBufs = {}, lamps = [];
  var STRIDE = 13 * 4;
  function upload(mesh) {
    var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.v), gl.STATIC_DRAW);
    return { buf: b, n: mesh.v.length / 13 };
  }
  function bind(o) {
    gl.bindBuffer(gl.ARRAY_BUFFER, o.buf);
    gl.vertexAttribPointer(A.aP, 3, gl.FLOAT, false, STRIDE, 0);
    gl.vertexAttribPointer(A.aN, 3, gl.FLOAT, false, STRIDE, 12);
    gl.vertexAttribPointer(A.aU, 2, gl.FLOAT, false, STRIDE, 24);
    gl.vertexAttribPointer(A.aC, 4, gl.FLOAT, false, STRIDE, 32);
    gl.vertexAttribPointer(A.aM, 1, gl.FLOAT, false, STRIDE, 48);
  }
  function initGL() {
    prog = program(VS, FS); sky = program(SKY_VS, SKY_FS);
    ['uVP', 'uM', 'uCam', 'uCar', 'uFwd', 'uBrake', 'uHW', 'uLamp', 'uGhost', 'uNear'].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
    ['aP', 'aN', 'aU', 'aC', 'aM'].forEach(function (n) { A[n] = gl.getAttribLocation(prog, n); });
    skyU.uYaw = gl.getUniformLocation(sky, 'uYaw'); skyU.uHor = gl.getUniformLocation(sky, 'uHor'); skyU.aP = gl.getAttribLocation(sky, 'aP');
    skyBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, skyBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var w = buildWorld(); worldBuf = upload(w.mesh); lamps = w.lamps;
    Object.keys(CARS).forEach(function (k) { carBufs[k] = { body: upload(buildCar(CARS[k])), wheel: upload(buildWheel(CARS[k])) }; });
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
  function drawCar(pose, S, ghost, brake) {
    var bufs = carBufs[pose.key];
    var base = yawM(pose.psi, pose.x, 0, pose.z);
    var lean = pitchRoll(clamp((pose.ax || 0) * 0.0035, -0.04, 0.04), clamp(-(pose.ay || 0) * 0.005, -0.05, 0.05));
    gl.uniform1f(U.uGhost, ghost ? 1 : 0); gl.uniform1f(U.uBrake, brake);
    gl.uniformMatrix4fv(U.uM, false, mul(base, lean)); bind(bufs.body); gl.drawArrays(gl.TRIANGLES, 0, bufs.body.n);
    bind(bufs.wheel);
    var zw = S.width / 2 - 0.09, pos = [[S.a, zw, 1], [S.a, -zw, 1], [-S.b, zw, 0], [-S.b, -zw, 0]], i;
    for (i = 0; i < 4; i++) {
      var w = mul(base, mul(yawM(pos[i][2] ? (pose.delta || 0) : 0, pos[i][0], S.rw, pos[i][1]), spinM(pose.wheelRot || 0, 0, 0, 0)));
      gl.uniformMatrix4fv(U.uM, false, w); gl.drawArrays(gl.TRIANGLES, 0, bufs.wheel.n);
    }
  }

  var ID = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  function render(car, ghostPose, dt) {
    var W = canvas.width, H = canvas.height;
    gl.viewport(0, 0, W, H);
    // chase camera: follows the direction of travel, so a slide shows as a slide
    var aim = car.psi;
    if (car.speed > 4) aim = car.psi + clamp(wrapPi(Math.atan2(car.vz, car.vx) - car.psi), -0.6, 0.6) * 0.55;
    cam.yaw = wrapPi(cam.yaw + wrapPi(aim - cam.yaw) * Math.min(1, dt * 5.5));
    var fx = Math.cos(cam.yaw), fz = Math.sin(cam.yaw), back = 6.4 + car.speed * 0.035;
    var eye = [car.x - fx * (back + 1.2), 3.0, car.z - fz * (back + 1.2)], tgt = [car.x + fx * 3.5, 1.15, car.z + fz * 3.5];
    var fov = (58 + clamp(car.speed / 45, 0, 1) * 16) * Math.PI / 180;
    var vp = mul(persp(fov, W / H, 0.3, 900), lookAt(eye, tgt));

    gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
    gl.useProgram(sky); gl.bindBuffer(gl.ARRAY_BUFFER, skyBuf);
    gl.enableVertexAttribArray(skyU.aP); gl.vertexAttribPointer(skyU.aP, 2, gl.FLOAT, false, 0, 0);
    gl.uniform1f(skyU.uYaw, cam.yaw); gl.uniform1f(skyU.uHor, 0.16);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.enable(gl.DEPTH_TEST); gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.useProgram(prog);
    for (var k in A) gl.enableVertexAttribArray(A[k]);
    var near = lamps[0], best = 1e9, i;
    for (i = 0; i < lamps.length; i++) { var d = Math.hypot(lamps[i][0] - car.x, lamps[i][1] - car.z); if (d < best) { best = d; near = lamps[i]; } }
    gl.uniformMatrix4fv(U.uVP, false, vp); gl.uniformMatrix4fv(U.uM, false, ID);
    gl.uniform3f(U.uCam, eye[0], eye[1], eye[2]); gl.uniform3f(U.uCar, car.x, 0, car.z);
    gl.uniform2f(U.uFwd, Math.cos(car.psi), Math.sin(car.psi));
    gl.uniform1f(U.uHW, HW); gl.uniform1f(U.uLamp, LAMP); gl.uniform1f(U.uGhost, 0); gl.uniform1f(U.uBrake, 0);
    gl.uniform3f(U.uNear, near[0], 6, near[1]);
    bind(worldBuf); gl.drawArrays(gl.TRIANGLES, 0, worldBuf.n);
    drawCar(car, car.S, false, car.brk > 0.05 ? 1 : 0);
    if (ghostPose) {
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
      drawCar(ghostPose, car.S, true, 0);
      gl.depthMask(true); gl.disable(gl.BLEND);
    }
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
      var o1 = actx.createOscillator(), o2 = actx.createOscillator(), lp = actx.createBiquadFilter(), g = actx.createGain();
      o1.type = 'sawtooth'; o2.type = 'square'; lp.type = 'lowpass'; lp.Q.value = 1.2; g.gain.value = 0;
      o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(master); o1.start(); o2.start();
      var len = actx.sampleRate, nb = actx.createBuffer(1, len, len), d = nb.getChannelData(0), i;
      for (i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      var ns = actx.createBufferSource(), bp = actx.createBiquadFilter(), sg = actx.createGain();
      ns.buffer = nb; ns.loop = true; bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 3; sg.gain.value = 0;
      ns.connect(bp); bp.connect(sg); sg.connect(master); ns.start();
      eng = { master: master, o1: o1, o2: o2, lp: lp, g: g, sg: sg, bp: bp, noise: nb };
    } catch (e) { actx = null; eng = null; }
  }
  function audioFrame(car, live) {
    if (!eng) return;
    var t = actx.currentTime, f = car.rpm / 60 * car.S.cyl;
    eng.o1.type = car.S.tone;
    eng.o1.frequency.setTargetAtTime(f, t, 0.03); eng.o2.frequency.setTargetAtTime(f * 0.5, t, 0.03);
    eng.lp.frequency.setTargetAtTime(300 + car.rpm * 0.45 + car.thr * 900, t, 0.05);
    eng.g.gain.setTargetAtTime(live ? 0.045 + car.thr * 0.085 : 0, t, 0.06);
    eng.sg.gain.setTargetAtTime(live ? car.slip * 0.16 : 0, t, 0.06);
    eng.bp.frequency.setTargetAtTime(1100 + car.speed * 22, t, 0.1);
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
  var keys = {}, pad = { l: 0, r: 0, gas: 0, brk: 0, hb: 0 }, steerK = 0;
  var CODES = { ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r', ArrowUp: 'gas', KeyW: 'gas', ArrowDown: 'brk', KeyS: 'brk', Space: 'hb' };
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
  touchPad('streetLeft', 'l'); touchPad('streetRight', 'r'); touchPad('streetGas', 'gas'); touchPad('streetBrake', 'brk'); touchPad('streetHb', 'hb');
  function readInput(dt) {
    var l = keys.l || pad.l, r = keys.r || pad.r, raw = (r ? 1 : 0) - (l ? 1 : 0);
    steerK += clamp(raw - steerK, -dt * 4.5, dt * (raw === 0 ? 6 : 4.5));
    var inp = { steer: steerK, thr: (keys.gas || pad.gas) ? 1 : 0, brk: (keys.brk || pad.brk) ? 1 : 0, hb: !!(keys.hb || pad.hb) };
    var gps = navigator.getGamepads ? navigator.getGamepads() : [], i;
    for (i = 0; i < gps.length; i++) {
      var g = gps[i]; if (!g || !g.connected || g.axes.length < 2) continue;
      var sx = Math.abs(g.axes[0]) > 0.08 ? g.axes[0] : 0;
      if (sx) inp.steer = sx * Math.abs(sx);
      var b = g.buttons;
      if (b[7] && b[7].value > 0.03) inp.thr = b[7].value;
      if (b[6] && b[6].value > 0.03) inp.brk = b[6].value;
      if ((b[0] && b[0].pressed) || (b[1] && b[1].pressed)) inp.hb = true;
      break;
    }
    return inp;
  }

  /* ============================================================
     GAME — time attack against your own best lap
     ============================================================ */
  var state = 'menu', carKey = 'sedan', car = newCar('sedan');
  var count = 0, lapT = 0, lap = 0, half = false, lastLap = 0, drift = 0, driftRun = 0, driftCool = 0;
  var rec = [], recT = 0, ghost = null, best = 0, acc = 0, last = 0, visible = true, raf = 0;
  var START = T.N - 14;
  var hud = { speed: $('hudSpeed'), gear: $('hudGear'), lap: $('hudLap'), best: $('hudBest'), drift: $('hudDrift') }, hudV = {};
  function setHud(k, v) { if (hudV[k] !== v && hud[k]) { hudV[k] = v; hud[k].textContent = v; } }
  function fmt(t) { if (!t) return '--:--.--'; var m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(2); }
  function storeKey() { return 'htg.street.' + carKey; }
  function loadBest() {
    best = 0; ghost = null;
    try {
      var d = JSON.parse(localStorage.getItem(storeKey()) || 'null');
      if (d && d.t > 0 && d.g && d.g.length > 30) { best = d.t; ghost = d.g; }
    } catch (e) {}
  }
  function saveBest() { try { localStorage.setItem(storeKey(), JSON.stringify({ t: best, g: ghost })); } catch (e) {} }
  function ghostAt(t) {
    if (!ghost || lap < 1) return null;
    var f = t / 0.1, i = Math.floor(f) * 3; if (i + 5 >= ghost.length) return null;
    var k = f - Math.floor(f);
    return { key: carKey, x: lerp(ghost[i], ghost[i + 3], k), z: lerp(ghost[i + 1], ghost[i + 4], k),
             psi: ghost[i + 2] + wrapPi(ghost[i + 5] - ghost[i + 2]) * k };
  }
  function resetCar() {
    var i = car.idx; placeCar(car, i); steerK = 0;
  }
  function startRun() {
    car = newCar(carKey); placeCar(car, START); cam.yaw = car.psi;
    loadBest(); lap = 0; lapT = 0; half = false; lastLap = 0; drift = 0; driftRun = 0; rec = []; recT = 0; steerK = 0;
    count = 3.2; state = 'count'; acc = 0; hudV = {};
    overlay.hidden = true; canvas.classList.add('is-playing'); document.body.classList.add('game-active'); stage.classList.add('is-live');
    initAudio(); if (actx && actx.state === 'suspended') actx.resume();
    setHud('best', fmt(best)); setHud('lap', fmt(0)); setHud('drift', '0');
    drawMapBase(); loop(true);
  }
  function pause() {
    if (state !== 'run' && state !== 'count') return;
    state = 'pause'; overlay.hidden = false; overlayTitle.textContent = 'PAUSED'; overlayText.textContent = fmt(best) === '--:--.--' ? '' : 'Best ' + fmt(best);
    playBtn.textContent = 'Resume'; canvas.classList.remove('is-playing'); stage.classList.remove('is-live');
    document.body.classList.remove('game-active'); audioFrame(car, false);
  }
  function resume() {
    if (state !== 'pause') return;
    state = count > 0 ? 'count' : 'run'; overlay.hidden = true; canvas.classList.add('is-playing'); stage.classList.add('is-live');
    document.body.classList.add('game-active'); if (actx && actx.state === 'suspended') actx.resume(); loop(true);
  }

  function gameStep(inp, dt) {
    var prev = car.idx;
    stepCar(car, inp, dt);
    if (car.hit > 1.5) { thud(car.hit); driftRun = 0; }
    var N = T.N, i = car.idx;
    if (i > N * 0.45 && i < N * 0.55) half = true;
    if (prev > N * 0.9 && i < N * 0.1) {
      if (lap === 0) { lap = 1; lapT = 0; rec = []; recT = 0; half = false; }
      else if (half) {
        lastLap = lapT;
        if (!best || lapT < best) { best = lapT; ghost = rec.slice(); saveBest(); setHud('best', fmt(best)); }
        lap++; lapT = 0; rec = []; recT = 0; half = false;
      }
    }
    if (lap > 0) {
      lapT += dt; recT -= dt;
      if (recT <= 0) { recT += 0.1; rec.push(Math.round(car.x * 100) / 100, Math.round(car.z * 100) / 100, Math.round(car.psi * 1000) / 1000); }
    }
    // drift points: angle times speed, banked when the slide ends clean
    if (Math.abs(car.beta) > 0.16 && car.speed > 9) { driftRun += Math.abs(car.beta) * car.speed * dt * 12; driftCool = 0.9; }
    else if (driftRun > 0) { driftCool -= dt; if (driftCool <= 0) { drift += Math.round(driftRun); driftRun = 0; } }
  }

  var IDLE = { steer: 0, thr: 0, brk: 1, hb: false };
  function frame(now) {
    raf = 0;
    if (state !== 'run' && state !== 'count') return;
    var dt = Math.min(0.1, (now - last) / 1000 || 0); last = now;
    var inp = readInput(dt);
    if (state === 'count') { count -= dt; if (count <= 0) { state = 'run'; } }
    acc += dt;
    while (acc >= 1 / 120) { gameStep(state === 'run' ? inp : IDLE, 1 / 120); acc -= 1 / 120; }
    render(car, ghostAt(lapT), dt);
    audioFrame(car, true);
    setHud('speed', String(Math.round(car.speed * 3.6)));
    setHud('gear', state === 'count' ? String(Math.max(1, Math.ceil(count))) : car.rev ? 'R' : String(car.gear));
    setHud('lap', fmt(lap > 0 ? lapT : 0));
    setHud('drift', String(drift + Math.round(driftRun)));
    drawMapCar();
    loop(false);
  }
  function loop(restart) {
    if (restart) last = performance.now();
    if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame);
  }

  /* ---------- minimap ---------- */
  var mapCtx = mapCanvas ? mapCanvas.getContext('2d') : null, mapBase = null, mapS = 1, mapOx = 0, mapOz = 0, mapTick = 0;
  function drawMapBase() {
    if (!mapCtx) return;
    var w = mapCanvas.width, h = mapCanvas.height, i, minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
    for (i = 0; i < T.N; i++) { minX = Math.min(minX, T.x[i]); maxX = Math.max(maxX, T.x[i]); minZ = Math.min(minZ, T.z[i]); maxZ = Math.max(maxZ, T.z[i]); }
    mapS = Math.min((w - 16) / (maxX - minX), (h - 16) / (maxZ - minZ));
    mapOx = (w - (maxX - minX) * mapS) / 2 - minX * mapS; mapOz = (h - (maxZ - minZ) * mapS) / 2 - minZ * mapS;
    mapCtx.clearRect(0, 0, w, h); mapCtx.lineJoin = 'round'; mapCtx.lineWidth = 3; mapCtx.strokeStyle = 'rgba(180,120,255,0.75)';
    mapCtx.beginPath();
    for (i = 0; i <= T.N; i += 2) { var k = i % T.N; mapCtx[i ? 'lineTo' : 'moveTo'](T.x[k] * mapS + mapOx, T.z[k] * mapS + mapOz); }
    mapCtx.closePath(); mapCtx.stroke();
    mapBase = mapCtx.getImageData(0, 0, w, h);
  }
  function drawMapCar() {
    if (!mapCtx || !mapBase || (mapTick++ % 4)) return;
    mapCtx.putImageData(mapBase, 0, 0);
    mapCtx.fillStyle = '#fff'; mapCtx.beginPath(); mapCtx.arc(car.x * mapS + mapOx, car.z * mapS + mapOz, 3.2, 0, 6.2832); mapCtx.fill();
  }

  /* ---------- sizing, visibility, buttons ---------- */
  function resize() {
    var r = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, r.width < 700 ? 1.5 : 2);
    var w = Math.max(2, Math.round(r.width * dpr)), h = Math.max(2, Math.round(r.height * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    if (state !== 'run' && state !== 'count') render(car, null, 0.016);
  }
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', function () { if (document.hidden) pause(); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (!visible) pause(); }, { threshold: 0.15 }).observe(stage);
  }
  canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); pause(); });
  canvas.addEventListener('webglcontextrestored', function () { initGL(); resize(); });

  Array.prototype.forEach.call(document.querySelectorAll('[data-street-car]'), function (b) {
    b.addEventListener('click', function () {
      carKey = b.getAttribute('data-street-car');
      Array.prototype.forEach.call(document.querySelectorAll('[data-street-car]'), function (o) { o.setAttribute('aria-pressed', o === b ? 'true' : 'false'); });
      if (state === 'menu') { car = newCar(carKey); placeCar(car, START); cam.yaw = car.psi; render(car, null, 0.016); }
    });
  });
  if (playBtn) playBtn.addEventListener('click', function () { if (state === 'pause') resume(); else startRun(); });
  if (resetBtn) resetBtn.addEventListener('click', function () { if (state === 'run') resetCar(); });
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
  placeCar(car, START); cam.yaw = car.psi; resize();

  if (DEBUG) {
    window.__street = {
      T: T, CARS: CARS, newCar: newCar, placeCar: placeCar, stepCar: stepCar, START: START, HW: HW,
      get car() { return car; }, get state() { return state; }, get lap() { return lap; }, get best() { return best; },
      get lapT() { return lapT; }, get drift() { return drift; }
    };
  }
})();
