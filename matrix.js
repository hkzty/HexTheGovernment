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
  const FADE = 'rgba(10, 10, 10, 0.08)';
  const HEAD = 'rgba(190, 120, 255, 0.95)';
  const TAIL = 'rgba(140, 3, 252, 0.75)';

  let width = 0;
  let height = 0;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let columns = [];
  let rafId = 0;
  let paused = false;

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
      swap: (Math.random() * 20) | 0,
    }));

    ctx.fillStyle = 'rgba(10, 10, 10, 1)';
    ctx.fillRect(0, 0, width, height);
  }

  function frame() {
    if (paused) { rafId = 0; return; }
    ctx.fillStyle = FADE;
    ctx.fillRect(0, 0, width, height);

    for (let i = 0; i < columns.length; i++) {
      const col = columns[i];
      const x = i * FONT_SIZE;

      ctx.fillStyle = HEAD;
      ctx.fillText(col.glyph, x, col.y);

      ctx.fillStyle = TAIL;
      ctx.fillText(col.glyph, x, col.y - FONT_SIZE);

      col.y += col.speed * FONT_SIZE * 0.6;
      col.swap--;
      if (col.swap <= 0) {
        col.glyph = pickGlyph();
        col.swap = 4 + ((Math.random() * 18) | 0);
      }
      if (col.y > height + FONT_SIZE * 2 && Math.random() > 0.975) {
        col.y = rand(-height * 0.5, -FONT_SIZE);
        col.speed = rand(SPEED_MIN, SPEED_MAX);
      }
    }

    rafId = requestAnimationFrame(frame);
  }

  function start() {
    if (rafId) return;
    paused = false;
    rafId = requestAnimationFrame(frame);
  }
  function stop() {
    paused = true;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  }

  resize();
  start();

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
