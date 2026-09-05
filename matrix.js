(function () {
  let canvas = document.getElementById('matrix-rain');
  if (!canvas) return;
  // Some privacy-hardened builds hand back null for the options form of
  // getContext; the bare call is the widely supported one, so try it second.
  const getCtx = (c) => {
    try { return c.getContext('2d', { alpha: true }) || c.getContext('2d'); }
    catch (e) { return null; }
  };
  let ctx = getCtx(canvas);
  if (!ctx) return;
  const DEBUG = /[?&]raindebug/.test(location.search);

  const GLYPHS =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<>/\\|=+-*[]{}:;.?!$#%&@' +
    'アカサタナハマヤラワイキシチニヒミリヰウクスツヌフムユルエケセテネヘメレヱオコソトノホモヨロヲ';
  const FONT_SIZE = 16;
  // Rest speed is 30% of the original 0.35–0.95; the pointer is what makes
  // it hurry.
  const SPEED_MIN = 0.105;
  const SPEED_MAX = 0.285;
  const FADE_ALPHA_PER_SEC = 4.8;
  const RESET_CHANCE_PER_SEC = 1.5;

  /* ---- Deck palette --------------------------------------------------------
     Each column is randomly assigned one of these inks. The per-page weighting
     is read from <body data-rain="…">: white-dominant on the HTG landing,
     purple on ABRAXAS, green on Stretty, orange on Justinn.clout, cyan on
     ciggyholster, an even mix on shared pages.                              */
  const INKS = {
    white:  { head: 'rgba(240, 240, 240, 0.95)', tail: 'rgba(170, 170, 170, 0.55)' },
    purple: { head: 'rgba(190, 120, 255, 0.95)', tail: 'rgba(140, 3, 252, 0.75)' },
    green:  { head: 'rgba(150, 255, 170, 0.95)', tail: 'rgba(20, 200, 90, 0.70)' },
    orange: { head: 'rgba(255, 200, 140, 0.95)', tail: 'rgba(255, 155, 61, 0.70)' },
    cyan:   { head: 'rgba(160, 245, 252, 0.95)', tail: 'rgba(47, 212, 224, 0.70)' },
  };
  /* Weighted bags — repeated keys raise the odds of that ink for a column.
     Each deck runs its own colour dominant with every other ink mixed in, so
     all five colours fall on every page; the landing keeps white dominant
     over the other four.

     'pair' is the joined orange+cyan pair rather than a single ink: Justin
     and Ciggie came aboard together, so on every bag but their own two decks
     they rain site-wide and side by side. One 'pair' draw paints two adjacent
     columns, so it is worth two single-ink entries — that is why it replaces
     the separate 'orange' and 'cyan' keys instead of sitting alongside them,
     and why the shares below still read straight off the bags: on the shared
     'mixed' bag the five inks hold level at roughly a fifth of the columns
     each, measured over the reset loop.                                    */
  const MIXES = {
    white:  ['white', 'white', 'white', 'white', 'white', 'purple', 'green', 'pair'],
    purple: ['purple', 'purple', 'purple', 'purple', 'purple', 'white', 'green', 'pair'],
    green:  ['green', 'green', 'green', 'green', 'green', 'white', 'purple', 'pair'],
    orange: ['orange', 'orange', 'orange', 'orange', 'orange', 'white', 'cyan', 'purple', 'green'],
    cyan:   ['cyan', 'cyan', 'cyan', 'cyan', 'cyan', 'white', 'orange', 'purple', 'green'],
    mixed:  ['white', 'purple', 'green', 'pair'],
  };
  const PARTNER = { orange: 'cyan', cyan: 'orange' };

  /* The bright head is precomputed per ink, once. Building a colour string
     per column per frame would put string work in the hot loop for an effect
     that is meant to cost nothing. */
  function brighten(rgba) {
    const n = rgba.match(/[\d.]+/g).map(Number);
    const lift = (c) => Math.round(c + (255 - c) * 0.55);
    return 'rgb(' + lift(n[0]) + ',' + lift(n[1]) + ',' + lift(n[2]) + ')';
  }
  for (const key in INKS) INKS[key].bright = brighten(INKS[key].head);

  /* Half-drawn pairs, keyed by the column index that owes the partner ink —
     never a floating debt handed to whichever column happens to draw next,
     which would land the partner anywhere on screen. Cleared on resize with
     the columns it refers to. */
  let owedByColumn = [];

  function currentBag() {
    const mode = (document.body && document.body.dataset.rain) || 'purple';
    return MIXES[mode] || MIXES.mixed;
  }

  /* Ink for column i. A 'pair' draw takes one of the two and books the other
     against column i + 1 — always the neighbour, never whichever column
     happens to draw next. The neighbour is inked in the same pass during the
     left-to-right layout, so pairs start side by side; afterwards it adopts
     the partner on its own next reset, so pairs keep forming and dissolving
     as the rain re-rolls rather than standing as fixed couples. */
  function pickInk(i) {
    const owed = owedByColumn[i];
    if (owed) {
      owedByColumn[i] = null;
      return INKS[owed];
    }
    const bag = currentBag();
    const key = bag[(Math.random() * bag.length) | 0];
    if (key !== 'pair') return INKS[key];
    const mine = Math.random() < 0.5 ? 'orange' : 'cyan';
    // Last column has no right-hand neighbour, so it pairs leftward instead.
    owedByColumn[i + 1 < owedByColumn.length ? i + 1 : i - 1] = PARTNER[mine];
    return INKS[mine];
  }

  let width = 0;
  let height = 0;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let columns = [];
  let rafId = 0;
  let paused = false;
  let lastT = 0;

  /* ---- Scheduling ----------------------------------------------------------
     The loop is driven by requestAnimationFrame, but is not allowed to depend
     on it: if a second passes with no frame while the page is visible
     (seen on privacy-hardened browsers, Brave on phone and desktop, that
     throttle, coarsen or drop rAF), the loop switches to a setTimeout tick
     for the rest of the page view — at start or at any later point. Time is read from performance.now(), never the rAF argument,
     so a coarsened or repeated timestamp cannot stall the fall or the fade. */
  const FRAME_MS = 1000 / 60;
  const HEARTBEAT_MS = 1000;
  let useTimer = false;
  let framesSeen = 0;
  let heartbeat = 0;
  const now = () => (window.performance && performance.now) ? performance.now() : Date.now();
  const raf = window.requestAnimationFrame;
  function schedule() {
    if (useTimer || !raf) rafId = setTimeout(() => frame(now()), FRAME_MS);
    else rafId = raf(frame);
  }
  function unschedule() {
    if (!rafId) return;
    if (useTimer || !raf) clearTimeout(rafId); else cancelAnimationFrame(rafId);
    rafId = 0;
  }
  /* The heartbeat runs for the whole page view, not just the first second:
     Brave desktop was reported to lose the rain too, and a one-shot check at
     start cannot catch a loop that ran and then stalled (rAF throttled or
     dropped later, a callback that never came back). Every second while the
     page is visible: no frame since last beat with rAF in charge means rAF
     is not delivering, so hand the loop to the timer; a loop that has died
     outright (no callback booked, not paused) is booked again. */
  function armHeartbeat() {
    if (heartbeat) return;
    heartbeat = setInterval(() => {
      if (paused || stillOnly || document.hidden) return;
      if (document.body.classList.contains('game-active')) return;
      if (framesSeen > 0) { framesSeen = 0; return; }
      unschedule();
      useTimer = true;
      lastT = 0;
      schedule();
    }, HEARTBEAT_MS);
  }
  function disarmHeartbeat() {
    clearInterval(heartbeat);
    heartbeat = 0;
  }

  /* Reduced motion stills the rain, it does not delete it. Hiding the canvas
     outright took every colour off every page for anyone with the OS setting
     on — the site's whole backdrop, gone, with nothing in its place. What the
     setting asks for is no animation, so we paint one still frame of the same
     rain and never start the loop. */
  const mq = (q) => (window.matchMedia ? window.matchMedia(q) : { matches: false });
  const reduceMotion = mq('(prefers-reduced-motion: reduce)');
  let stillOnly = reduceMotion.matches;

  /* ---- The rain notices the visitor ----------------------------------------
     Columns near the pointer run 9.3× faster, and glyphs close to it get
     a white lift on top of their ink, so the rain reads as presence instead
     of wallpaper. Guarded three ways: it needs a real pointer (no effect on
     touch), reduced motion never runs the loop at all, and a frame-budget
     check switches it off for good if the page can't hold ~30fps — the
     effect is a garnish and never worth dropped frames. */
  const FX_RADIUS = 220;        // px each side of the pointer that reacts
  const FX_SPEED = 8.3;         // 9.3× fall speed at the pointer
  const FX_GLOW = 0.8;          // peak alpha of the white lift on the head
                                // (the canvas paints at 0.55 opacity, so the
                                // on-screen lift is roughly half of this)
  // The boost only runs while the mouse is actually moving: each mousemove
  // sets the activity to 1 and it decays back to rest within ~0.5s of
  // stillness, so a parked cursor leaves the rain at its slow pace.
  const FX_IDLE_TAU = 0.12;     // seconds; ~0.5s to fade out
  const finePointer = mq('(pointer: fine)').matches;
  let pointerX = -1e9;
  let pointerY = -1e9;
  let pointerActivity = 0;
  let fxDisabled = false;
  let fxStrikes = 0;

  const onPointerMove = (e) => {
    pointerX = e.clientX;
    pointerY = e.clientY;
    pointerActivity = 1;
  };
  // Pointer gone — park it far away so the last position doesn't keep a
  // patch of rain permanently lit.
  const onPointerLeave = () => {
    pointerX = -1e9;
    pointerY = -1e9;
    pointerActivity = 0;
  };
  let pointerBound = false;
  function bindPointer() {
    if (!finePointer || pointerBound) return;
    pointerBound = true;
    window.addEventListener('mousemove', onPointerMove, { passive: true });
    document.addEventListener('mouseleave', onPointerLeave);
  }
  function unbindPointer() {
    if (!pointerBound) return;
    pointerBound = false;
    window.removeEventListener('mousemove', onPointerMove);
    document.removeEventListener('mouseleave', onPointerLeave);
    onPointerLeave();
  }

  const rand = (min, max) => Math.random() * (max - min) + min;
  const pickGlyph = () => GLYPHS.charAt((Math.random() * GLYPHS.length) | 0);

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = FONT_SIZE + 'px "IBM Plex Mono", monospace';
    ctx.textBaseline = 'top';

    const colCount = Math.ceil(width / FONT_SIZE);
    owedByColumn = new Array(colCount).fill(null);
    columns = new Array(colCount).fill(0).map((_, i) => ({
      y: rand(-height, 0),
      speed: rand(SPEED_MIN, SPEED_MAX),
      glyph: pickGlyph(),
      swapT: Math.random() * 0.3,
      ink: pickInk(i),
      ox: 0,
      vx: 0,
    }));

    if (stillOnly) drawStill();
    else {
      ctx.fillStyle = 'rgba(10, 10, 10, 1)';
      ctx.fillRect(0, 0, width, height);
    }
  }

  /* One still frame: every column drawn where it stands, each with a short
     tail above it so the glyph trails still read as falling rain. Nothing
     moves and nothing is scheduled. */
  const STILL_TAIL = 7;
  function drawStill() {
    ctx.fillStyle = 'rgba(10, 10, 10, 1)';
    ctx.fillRect(0, 0, width, height);
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i];
      const x = i * FONT_SIZE;
      // Spread the heads over the full height — the animated loop starts them
      // above the fold and relies on falling to fill the screen.
      const headY = ((col.y % height) + height) % height;
      ctx.fillStyle = col.ink.head;
      ctx.fillText(col.glyph, x, headY);
      ctx.fillStyle = col.ink.tail;
      for (let n = 1; n <= STILL_TAIL; n++) {
        const y = headY - n * FONT_SIZE;
        if (y < -FONT_SIZE) break;
        ctx.globalAlpha = 1 - n / (STILL_TAIL + 1);
        ctx.fillText(pickGlyph(), x, y);
      }
      ctx.globalAlpha = 1;
    }
  }

  function frame() {
    if (paused) { rafId = 0; return; }
    framesSeen++;
    const t = now();
    let dt = lastT ? (t - lastT) / 1000 : 0;
    // A clock that does not advance (coarsened timers, repeated timestamps)
    // must not freeze the rain: assume a nominal frame instead of zero.
    if (!(dt > 0)) dt = lastT ? 1 / 60 : 0;
    dt = Math.min(dt, 0.1);
    lastT = t;
    const step = dt * 60;

    /* Frame budget: a run of slow frames retires the pointer effect for the
       rest of the page view. Single hitches (tab switches, GC) decay off. */
    if (!fxDisabled && dt > 1 / 30) {
      if (++fxStrikes >= 60) fxDisabled = true;
    } else if (fxStrikes > 0) {
      fxStrikes -= 2;
    }
    // One exp() per frame; below 1% the pointer counts as still.
    pointerActivity *= Math.exp(-dt / FX_IDLE_TAU);
    if (pointerActivity < 0.01) pointerActivity = 0;
    const fxOn = finePointer && !fxDisabled && pointerActivity > 0;

    const fadeAlpha = Math.min(1, FADE_ALPHA_PER_SEC * dt);
    ctx.fillStyle = 'rgba(10, 10, 10, ' + fadeAlpha.toFixed(3) + ')';
    ctx.fillRect(0, 0, width, height);
    const resetChance = 1 - Math.exp(-RESET_CHANCE_PER_SEC * dt);

    const fieldOn = fxOn && pointerX > -1e8;
    const damp = Math.pow(FIELD_DAMP, step);

    for (let i = 0; i < columns.length; i++) {
      const col = columns[i];
      const laneX = i * FONT_SIZE;

      /* Forcefield: shove the head out of the disc, spring the column back
         once it is clear. Direction is left/right by which side of the
         pointer the glyph sits, so drops split around the cursor. */
      if (fieldOn) {
        const fdx = laneX + col.ox + FONT_SIZE * 0.5 - pointerX;
        const fdy = col.y + FONT_SIZE * 0.5 - pointerY;
        const fd2 = fdx * fdx + fdy * fdy;
        if (fd2 < FIELD_RADIUS * FIELD_RADIUS) {
          const fd = Math.sqrt(fd2) || 1;
          const push = (1 - fd / FIELD_RADIUS) * FIELD_PUSH * step;
          const dir = fdx === 0 ? (i & 1 ? 1 : -1) : fdx / Math.abs(fdx);
          col.vx += push * dir;
        }
      }
      if (col.ox !== 0 || col.vx !== 0) {
        col.vx -= col.ox * FIELD_SPRING * step;
        col.vx *= damp;
        col.ox += col.vx * step;
        if (col.ox > FIELD_MAX) { col.ox = FIELD_MAX; col.vx = 0; }
        else if (col.ox < -FIELD_MAX) { col.ox = -FIELD_MAX; col.vx = 0; }
        if (Math.abs(col.ox) < 0.05 && Math.abs(col.vx) < 0.05) { col.ox = 0; col.vx = 0; }
      }
      const x = laneX + col.ox;

      /* Column proximity (horizontal) drives the speed-up; the white lift on
         the head fades with true distance so the glow pools at the pointer
         instead of lighting whole columns top to bottom. */
      let speedMul = 1;
      let glow = 0;
      if (fxOn) {
        const dx = x + FONT_SIZE * 0.5 - pointerX;
        if (dx > -FX_RADIUS && dx < FX_RADIUS) {
          const near = (1 - Math.abs(dx) / FX_RADIUS) * pointerActivity;
          speedMul = 1 + near * FX_SPEED;
          const dy = col.y - pointerY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < FX_RADIUS) glow = (1 - dist / FX_RADIUS) * FX_GLOW * pointerActivity;
        }
      }

      ctx.fillStyle = col.ink.head;
      ctx.fillText(col.glyph, x, col.y);
      if (glow > 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, ' + glow.toFixed(3) + ')';
        ctx.fillText(col.glyph, x, col.y);
      }

      ctx.fillStyle = col.ink.tail;
      ctx.fillText(col.glyph, x, col.y - FONT_SIZE);
      if (glow > 0) {
        // Lift the tail too: the sped-up columns space their trails out, so
        // without this the extra speed cancels the head glow and the pointer
        // reads as nothing at all.
        ctx.fillStyle = 'rgba(255, 255, 255, ' + (glow * 0.6).toFixed(3) + ')';
        ctx.fillText(col.glyph, x, col.y - FONT_SIZE);
      }

      col.y += col.speed * FONT_SIZE * 0.6 * step * speedMul;
      col.swapT -= dt;
      if (col.swapT <= 0) {
        col.glyph = pickGlyph();
        col.swapT = 0.08 + Math.random() * 0.3;
      }
      if (col.y > height + FONT_SIZE * 2 && Math.random() < resetChance) {
        col.y = rand(-height * 0.5, -FONT_SIZE);
        col.speed = rand(SPEED_MIN, SPEED_MAX);
        col.ink = pickInk(i);  // re-roll the ink so the mix keeps shifting
      }
    }

    if (fieldOn) {
      ctx.beginPath();
      ctx.arc(pointerX, pointerY, FIELD_RADIUS, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.10)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    schedule();
  }

  function start() {
    if (rafId || stillOnly) return;
    if (document.body.classList.contains('game-active')) return;
    paused = false;
    lastT = 0;
    framesSeen = 0;
    schedule();
    armHeartbeat();
  }
  function stop() {
    paused = true;
    disarmHeartbeat();
    unschedule();
  }

  resize();
  start();
  bindPointer();

  /* ---- Paint probe -------------------------------------------------------
     Two seconds in, read a coarse grid of pixels back. A canvas the loop
     has been drawing into for two seconds is never all ground; if it is,
     the context is not putting pixels on screen (seen as "no rain" on
     Brave desktop with the loop reporting frames). Swap in a fresh canvas
     with a fresh context, once. Readback noise from fingerprint farbling
     is a few units per channel, far under the threshold. */
  let probed = false;
  function painted() {
    try {
      const w = canvas.width, h = canvas.height;
      if (!w || !h) return false;
      for (let y = 0; y < 8; y++) {
        const d = ctx.getImageData(0, ((y + 0.5) / 8 * h) | 0, w, 1).data;
        for (let i = 0; i < d.length; i += 4 * 3) {
          if (d[i] > 40 || d[i + 1] > 40 || d[i + 2] > 40) return true;
        }
      }
      return false;
    } catch (e) {
      return true; // readback blocked outright: nothing to learn, leave it
    }
  }
  function rebuildCanvas() {
    const fresh = document.createElement('canvas');
    fresh.id = canvas.id;
    fresh.className = canvas.className;
    fresh.setAttribute('aria-hidden', 'true');
    const next = getCtx(fresh);
    if (!next) return false;
    canvas.replaceWith(fresh);
    canvas = fresh;
    ctx = next;
    stop();
    useTimer = true;   // the timer path is the one with no rAF dependency
    resize();
    start();
    return true;
  }
  setTimeout(() => {
    if (probed) return;
    probed = true;
    const ok = stillOnly || document.hidden || painted();
    const rebuilt = ok ? false : rebuildCanvas();
    if (DEBUG) {
      console.log('[rain]', JSON.stringify({
        painted: ok, rebuilt, useTimer, framesSeen, paused, stillOnly,
        size: [canvas.width, canvas.height], dpr, columns: columns.length,
        finePointer, hidden: document.hidden,
        gameActive: document.body.classList.contains('game-active'),
        ua: navigator.userAgent,
        brave: !!(navigator.brave && navigator.brave.isBrave),
      }));
    }
  }, 2000);

  const onReduceMotionChange = () => {
    stillOnly = reduceMotion.matches;
    stop();
    resize();   // repaints as a still frame or a clear ground, per the new mode
    start();    // no-op while stillOnly
    if (stillOnly) unbindPointer(); else bindPointer();
  };
  if (reduceMotion.addEventListener) reduceMotion.addEventListener('change', onReduceMotionChange);
  else if (reduceMotion.addListener) reduceMotion.addListener(onReduceMotionChange);

  window.addEventListener('resize', () => {
    resize();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop(); else start();
  });
  // Back/forward cache restores the page with the loop cancelled and the
  // canvas as it was left; repaint the ground and run again.
  window.addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    stop();
    resize();
    start();
  });
  window.addEventListener('pagehide', stop);

  const suppressObserver = new MutationObserver(() => {
    if (document.body.classList.contains('game-active')) stop();
    else start();
  });
  suppressObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
})();
