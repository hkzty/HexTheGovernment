(function () {
  const canvas = document.getElementById('matrix-rain');
  if (!canvas) return;
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;

  const GLYPHS =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<>/\\|=+-*[]{}:;.?!$#%&@' +
    'アカサタナハマヤラワイキシチニヒミリヰウクスツヌフムユルエケセテネヘメレヱオコソトノホモヨロヲ';
  const FONT_SIZE = 16;
  const SPEED_MIN = 0.35;
  const SPEED_MAX = 0.95;
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
     Each deck runs its own colour dominant with the landing white mixed in;
     the landing keeps white dominant over all four.

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
    orange: ['orange', 'orange', 'orange', 'orange', 'orange', 'white', 'cyan'],
    cyan:   ['cyan', 'cyan', 'cyan', 'cyan', 'cyan', 'white', 'orange'],
    mixed:  ['white', 'purple', 'green', 'pair'],
  };
  const PARTNER = { orange: 'cyan', cyan: 'orange' };

  /* ---- Pointer proximity ---------------------------------------------------
     Columns whose head glyph is near the cursor briefly run faster and burn
     brighter, then settle back. Mouse-only and animation-only: the listener is
     never attached on a touch device or under reduced motion, so the still
     frame stays exactly as still as it was.                                 */
  const POINTER_RADIUS = 120;      // px from the head glyph
  const POINTER_SPEED_BOOST = 0.5; // +50% fall speed at full charge
  const POINTER_HEAD_ALPHA = 0.45; // overdraw strength at full charge
  const POINTER_DECAY_TAU = 0.18;  // ~0.5s back to rest
  const CHARGE_FLOOR = 0.01;       // below this a column is simply at rest

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

  /* Reduced motion stills the rain, it does not delete it. Hiding the canvas
     outright took every colour off every page for anyone with the OS setting
     on — the site's whole backdrop, gone, with nothing in its place. What the
     setting asks for is no animation, so we paint one still frame of the same
     rain and never start the loop. */
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let stillOnly = reduceMotion.matches;

  /* Fine-pointer devices only. A touch screen has no hover, so the effect
     would either never fire or stick wherever the last tap landed. */
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  let pointerX = 0;
  let pointerY = 0;
  let pointerLive = false;
  let pointerBound = false;

  /* The listener stores two numbers and nothing else — no canvas reads, no
     layout, no per-event drawing. Everything else happens in the frame. */
  const onPointerMove = (e) => {
    pointerX = e.clientX;
    pointerY = e.clientY;
    pointerLive = true;
  };
  const onPointerLeave = () => { pointerLive = false; };

  function bindPointer() {
    if (pointerBound || stillOnly || !finePointer.matches) return;
    window.addEventListener('mousemove', onPointerMove, { passive: true });
    document.addEventListener('mouseleave', onPointerLeave, { passive: true });
    pointerBound = true;
  }
  function unbindPointer() {
    if (!pointerBound) return;
    window.removeEventListener('mousemove', onPointerMove);
    document.removeEventListener('mouseleave', onPointerLeave);
    pointerBound = false;
    pointerLive = false;
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
      charge: 0,
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

  function frame(t) {
    if (paused) { rafId = 0; return; }
    const dt = lastT ? Math.min((t - lastT) / 1000, 0.1) : 0;
    lastT = t;
    const step = dt * 60;

    const fadeAlpha = Math.min(1, FADE_ALPHA_PER_SEC * dt);
    ctx.fillStyle = 'rgba(10, 10, 10, ' + fadeAlpha.toFixed(3) + ')';
    ctx.fillRect(0, 0, width, height);
    const resetChance = 1 - Math.exp(-RESET_CHANCE_PER_SEC * dt);
    // One exp() for the whole frame rather than one per column.
    const chargeDecay = Math.exp(-dt / POINTER_DECAY_TAU);
    const radius2 = POINTER_RADIUS * POINTER_RADIUS;

    for (let i = 0; i < columns.length; i++) {
      const col = columns[i];
      const x = i * FONT_SIZE;

      /* Charge always decays; proximity only ever tops it up, so a column
         leaving the cursor eases out instead of snapping back. */
      let charge = col.charge > CHARGE_FLOOR ? col.charge * chargeDecay : 0;
      if (pointerLive) {
        const dx = x + FONT_SIZE * 0.5 - pointerX;
        if (dx > -POINTER_RADIUS && dx < POINTER_RADIUS) {
          const dy = col.y + FONT_SIZE * 0.5 - pointerY;
          const d2 = dx * dx + dy * dy;
          if (d2 < radius2) {
            const near = 1 - Math.sqrt(d2) / POINTER_RADIUS;
            if (near > charge) charge = near;
          }
        }
      }
      col.charge = charge;

      ctx.fillStyle = col.ink.head;
      ctx.fillText(col.glyph, x, col.y);
      if (charge > CHARGE_FLOOR) {
        // Second pass over the head only, in the ink's own lightened tone —
        // the column keeps its deck colour, it just leans into it.
        ctx.globalAlpha = charge * POINTER_HEAD_ALPHA;
        ctx.fillStyle = col.ink.bright;
        ctx.fillText(col.glyph, x, col.y);
        ctx.globalAlpha = 1;
      }

      ctx.fillStyle = col.ink.tail;
      ctx.fillText(col.glyph, x, col.y - FONT_SIZE);

      col.y += col.speed * (1 + POINTER_SPEED_BOOST * charge) * FONT_SIZE * 0.6 * step;
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

    rafId = requestAnimationFrame(frame);
  }

  function start() {
    if (rafId || stillOnly) return;
    if (document.body.classList.contains('game-active')) return;
    paused = false;
    lastT = 0;
    rafId = requestAnimationFrame(frame);
  }
  function stop() {
    paused = true;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  }

  resize();
  start();
  bindPointer();

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

  const suppressObserver = new MutationObserver(() => {
    if (document.body.classList.contains('game-active')) stop();
    else start();
  });
  suppressObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
})();
