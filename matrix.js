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

  /* ---- Palette -------------------------------------------------------------
     Each column is randomly assigned one of these inks. The per-page weighting
     is read from <body data-rain="…">: white-dominant on the HTG landing,
     purple on ABRAXAS, green on Stretty, an even mix on shared pages.

     Amber and cyan are the roster colours of Justinn.clout (--jus, #ff9b3d)
     and ciggyholster (--cig, #2fd4e0) from index.html's doors. They rain on
     every page and in every mix, and they fall as a pair (see pickInk).     */
  const INKS = {
    white:  { head: 'rgba(240, 240, 240, 0.95)', tail: 'rgba(170, 170, 170, 0.55)' },
    purple: { head: 'rgba(190, 120, 255, 0.95)', tail: 'rgba(140, 3, 252, 0.75)' },
    green:  { head: 'rgba(150, 255, 170, 0.95)', tail: 'rgba(20, 200, 90, 0.70)' },
    amber:  { head: 'rgba(255, 200, 130, 0.95)', tail: 'rgba(255, 155, 61, 0.75)' },
    cyan:   { head: 'rgba(170, 245, 252, 0.95)', tail: 'rgba(47, 212, 224, 0.72)' },
  };
  // Weighted bags — repeated keys raise the odds of that ink for a column.
  // Every bag carries amber and cyan; only the dominant ink changes per page.
  const MIXES = {
    white:  ['white', 'white', 'white', 'white', 'white', 'purple', 'green', 'amber', 'cyan'],
    purple: ['purple', 'purple', 'purple', 'purple', 'purple', 'white', 'green', 'amber', 'cyan'],
    green:  ['green', 'green', 'green', 'green', 'green', 'white', 'purple', 'amber', 'cyan'],
    mixed:  ['white', 'purple', 'green', 'amber', 'cyan'],
  };
  // Amber and cyan never fall alone: rolling one owes the other to the next
  // column drawn, so the two arrive joined — side by side on the initial
  // left-to-right layout, and close together on later re-rolls.
  const PARTNER = { amber: 'cyan', cyan: 'amber' };
  let owedInk = null;

  function currentBag() {
    const mode = (document.body && document.body.dataset.rain) || 'purple';
    return MIXES[mode] || MIXES.mixed;
  }
  function pickInk() {
    if (owedInk) {
      const paid = owedInk;
      owedInk = null;
      return INKS[paid];
    }
    const bag = currentBag();
    const key = bag[(Math.random() * bag.length) | 0];
    if (PARTNER[key]) owedInk = PARTNER[key];
    return INKS[key];
  }

  let width = 0;
  let height = 0;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let columns = [];
  let rafId = 0;
  let paused = false;
  let lastT = 0;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let disabled = reduceMotion.matches;

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
    columns = new Array(colCount).fill(0).map(() => ({
      y: rand(-height, 0),
      speed: rand(SPEED_MIN, SPEED_MAX),
      glyph: pickGlyph(),
      swapT: Math.random() * 0.3,
      ink: pickInk(),
    }));

    ctx.fillStyle = 'rgba(10, 10, 10, 1)';
    ctx.fillRect(0, 0, width, height);
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

    for (let i = 0; i < columns.length; i++) {
      const col = columns[i];
      const x = i * FONT_SIZE;

      ctx.fillStyle = col.ink.head;
      ctx.fillText(col.glyph, x, col.y);

      ctx.fillStyle = col.ink.tail;
      ctx.fillText(col.glyph, x, col.y - FONT_SIZE);

      col.y += col.speed * FONT_SIZE * 0.6 * step;
      col.swapT -= dt;
      if (col.swapT <= 0) {
        col.glyph = pickGlyph();
        col.swapT = 0.08 + Math.random() * 0.3;
      }
      if (col.y > height + FONT_SIZE * 2 && Math.random() < resetChance) {
        col.y = rand(-height * 0.5, -FONT_SIZE);
        col.speed = rand(SPEED_MIN, SPEED_MAX);
        col.ink = pickInk();   // re-roll the ink so the mix keeps shifting
      }
    }

    rafId = requestAnimationFrame(frame);
  }

  function start() {
    if (rafId || disabled) return;
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
  if (!disabled) start();
  else canvas.style.display = 'none';

  const onReduceMotionChange = () => {
    disabled = reduceMotion.matches;
    if (disabled) {
      stop();
      canvas.style.display = 'none';
    } else {
      canvas.style.display = '';
      resize();
      start();
    }
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
