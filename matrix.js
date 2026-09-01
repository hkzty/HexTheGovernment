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

  /* ---- The rain notices the visitor ----------------------------------------
     Columns near the pointer run a little faster, and glyphs close to it get
     a white lift on top of their ink, so the rain reads as presence instead
     of wallpaper. Guarded three ways: it needs a real pointer (no effect on
     touch), reduced motion never runs the loop at all, and a frame-budget
     check switches it off for good if the page can't hold ~30fps — the
     effect is a garnish and never worth dropped frames. */
  const FX_RADIUS = 160;        // px each side of the pointer that reacts
  const FX_SPEED = 0.9;         // up to +90% fall speed at the pointer
  const FX_GLOW = 0.8;          // peak alpha of the white lift on the head
                                // (the canvas paints at 0.55 opacity, so the
                                // on-screen lift is roughly half of this)
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  let pointerX = -1e9;
  let pointerY = -1e9;
  let fxDisabled = false;
  let fxStrikes = 0;

  if (finePointer) {
    window.addEventListener('mousemove', (e) => {
      pointerX = e.clientX;
      pointerY = e.clientY;
    }, { passive: true });
    // Pointer gone — park it far away so the last position doesn't keep a
    // patch of rain permanently lit.
    document.addEventListener('mouseleave', () => {
      pointerX = -1e9;
      pointerY = -1e9;
    });
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

    /* Frame budget: a run of slow frames retires the pointer effect for the
       rest of the page view. Single hitches (tab switches, GC) decay off. */
    if (!fxDisabled && dt > 1 / 30) {
      if (++fxStrikes >= 60) fxDisabled = true;
    } else if (fxStrikes > 0) {
      fxStrikes -= 2;
    }
    const fxOn = finePointer && !fxDisabled;

    const fadeAlpha = Math.min(1, FADE_ALPHA_PER_SEC * dt);
    ctx.fillStyle = 'rgba(10, 10, 10, ' + fadeAlpha.toFixed(3) + ')';
    ctx.fillRect(0, 0, width, height);
    const resetChance = 1 - Math.exp(-RESET_CHANCE_PER_SEC * dt);

    for (let i = 0; i < columns.length; i++) {
      const col = columns[i];
      const x = i * FONT_SIZE;

      /* Column proximity (horizontal) drives the speed-up; the white lift on
         the head fades with true distance so the glow pools at the pointer
         instead of lighting whole columns top to bottom. */
      let speedMul = 1;
      let glow = 0;
      if (fxOn) {
        const dx = x + FONT_SIZE * 0.5 - pointerX;
        if (dx > -FX_RADIUS && dx < FX_RADIUS) {
          const near = 1 - Math.abs(dx) / FX_RADIUS;
          speedMul = 1 + near * FX_SPEED;
          const dy = col.y - pointerY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < FX_RADIUS) glow = (1 - dist / FX_RADIUS) * FX_GLOW;
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

  const onReduceMotionChange = () => {
    stillOnly = reduceMotion.matches;
    stop();
    resize();   // repaints as a still frame or a clear ground, per the new mode
    start();    // no-op while stillOnly
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
