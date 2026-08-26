    const topbar = document.getElementById('topbar');
    const menuToggle = document.getElementById('menuToggle');
    const nav = document.getElementById('site-nav');
    const navLinks = [...document.querySelectorAll('.nav-list a')];
    const fadeEls = document.querySelectorAll('.fade-in');
    const counters = document.querySelectorAll('[data-counter]');
    const toTop = document.getElementById('toTop');
    const sections = [...document.querySelectorAll('main section[id]')];
    const parallaxLayers = document.querySelectorAll('.parallax-layer');
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /*
      --nav-height drives the top padding that keeps content clear of the
      fixed header, but the header's real height depends on viewport width
      and on the webfont landing. Measure it instead of hardcoding a guess.
    */
    const syncNavHeight = () => {
      if (!topbar) return;
      document.documentElement.style.setProperty('--nav-height', `${topbar.offsetHeight}px`);
    };

    syncNavHeight();
    window.addEventListener('resize', syncNavHeight);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(syncNavHeight);

    menuToggle.addEventListener('click', () => {
      const isOpen = nav.classList.toggle('open');
      menuToggle.setAttribute('aria-expanded', String(isOpen));
      menuToggle.querySelector('span:last-child').textContent = isOpen ? 'Close Menu' : 'Open Menu';
    });

    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        if (window.innerWidth <= 820) {
          nav.classList.remove('open');
          menuToggle.setAttribute('aria-expanded', 'false');
          menuToggle.querySelector('span:last-child').textContent = 'Open Menu';
        }
      });
    });

    const onScrollFrame = () => {
      const scrolled = window.scrollY > 16;
      topbar.classList.toggle('scrolled', scrolled);
      toTop.classList.toggle('show', window.scrollY > 720);

      if (!prefersReducedMotion) {
        const scrollY = window.scrollY;
        parallaxLayers.forEach(layer => {
          const speed = Number(layer.dataset.speed || 0.1);
          layer.style.transform = `translate3d(0, ${scrollY * speed}px, 0)`;
        });
      }

      let currentId = sections[0]?.id || '';
      const offset = window.scrollY + 180;
      for (const section of sections) {
        if (section.hidden) continue; // e.g. the locked Suit Purge easter egg
        if (offset >= section.offsetTop) currentId = section.id;
      }
      navLinks.forEach(link => {
        const isActive = link.getAttribute('href') === `#${currentId}`;
        link.classList.toggle('active', isActive);
      });
    };

    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          onScrollFrame();
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
    onScrollFrame();

    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.14 });

    fadeEls.forEach(el => {
      if (!el.classList.contains('visible')) revealObserver.observe(el);
    });

    const animateCounter = (el) => {
      const target = Number(el.dataset.counter || 0);
      if (prefersReducedMotion) {
        el.textContent = target.toString();
        return;
      }
      const duration = 1300;
      const start = performance.now();
      const tick = (now) => {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.floor(eased * target).toString();
        if (progress < 1) {
          requestAnimationFrame(tick);
        } else {
          el.textContent = target.toString();
        }
      };
      requestAnimationFrame(tick);
    };

    const counterObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          counterObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.55 });

    counters.forEach(counter => counterObserver.observe(counter));

    toTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    });

    const cursor = document.querySelector('.cursor');
    const cursorDot = document.querySelector('.cursor-dot');
    const HOVERABLE_SELECTOR = 'a, button, input, textarea, .gallery-item';

    if (window.matchMedia('(pointer: fine)').matches) {
      let cursorVisible = false;
      window.addEventListener('mousemove', (event) => {
        const { clientX, clientY } = event;
        cursor.style.left = `${clientX}px`;
        cursor.style.top = `${clientY}px`;
        cursorDot.style.left = `${clientX}px`;
        cursorDot.style.top = `${clientY}px`;
        if (!cursorVisible) {
          cursor.classList.add('active');
          cursorDot.classList.add('active');
          cursorVisible = true;
        }
      });

      // Delegated so gallery rebuilds and injected players still count
      document.addEventListener('mouseover', (event) => {
        if (event.target.closest(HOVERABLE_SELECTOR)) cursor.classList.add('link-hover');
      });
      document.addEventListener('mouseout', (event) => {
        if (event.target.closest(HOVERABLE_SELECTOR)) cursor.classList.remove('link-hover');
      });
    }

    const getGalleryButtons = () => [...document.querySelectorAll('[data-gallery-index]')];
    const lightbox = document.getElementById('lightbox');
    const lightboxImage = document.getElementById('lightboxImage');
    const lightboxCaption = document.getElementById('lightboxCaption');
    const lightboxClose = document.getElementById('lightboxClose');
    const lightboxPrev = document.getElementById('lightboxPrev');
    const lightboxNext = document.getElementById('lightboxNext');
    let currentGalleryIndex = 0;

    const setLightbox = (index) => {
      const item = getGalleryButtons()[index];
      if (!item) return;
      currentGalleryIndex = index;
      lightboxImage.src = item.dataset.full;
      lightboxImage.alt = item.querySelector('img')?.alt || 'Expanded gallery image';
      lightboxCaption.textContent = item.dataset.caption || 'Gallery image';
    };

    let lightboxReturnFocus = null;

    const openLightbox = (index) => {
      setLightbox(index);
      lightboxReturnFocus = document.activeElement;
      lightbox.classList.add('open');
      lightbox.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      // After the next style recalc the dialog is visible and can take focus
      requestAnimationFrame(() => lightboxClose.focus());
    };

    const closeLightbox = () => {
      lightbox.classList.remove('open');
      lightbox.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      if (lightboxReturnFocus && typeof lightboxReturnFocus.focus === 'function') {
        lightboxReturnFocus.focus();
      }
    };

    const stepLightbox = (direction) => {
      const count = getGalleryButtons().length;
      if (!count) return;
      currentGalleryIndex = (currentGalleryIndex + direction + count) % count;
      setLightbox(currentGalleryIndex);
    };

    document.querySelector('.gallery-grid')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-gallery-index]');
      if (button) openLightbox(Number(button.dataset.galleryIndex));
    });

    lightboxClose.addEventListener('click', closeLightbox);
    lightboxPrev.addEventListener('click', () => stepLightbox(-1));
    lightboxNext.addEventListener('click', () => stepLightbox(1));
    lightbox.addEventListener('click', (event) => {
      if (event.target === lightbox) closeLightbox();
    });

    window.addEventListener('keydown', (event) => {
      if (!lightbox.classList.contains('open')) return;
      if (event.key === 'Escape') closeLightbox();
      if (event.key === 'ArrowLeft') stepLightbox(-1);
      if (event.key === 'ArrowRight') stepLightbox(1);
    });

    const contactForm = document.getElementById('contactForm');
    const formError = document.getElementById('formError');
    const formStatus = document.getElementById('formStatus');

    contactForm.addEventListener('submit', (event) => {
      event.preventDefault();
      formError.textContent = '';
      formStatus.textContent = '';

      const formData = new FormData(contactForm);
      const name = (formData.get('name') || '').toString().trim();
      const email = (formData.get('email') || '').toString().trim();
      const subject = (formData.get('subject') || '').toString().trim();
      const message = (formData.get('message') || '').toString().trim();
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (name.length < 2) {
        formError.textContent = 'Enter a real name with at least 2 characters.';
        return;
      }
      if (!emailPattern.test(email)) {
        formError.textContent = 'Enter a valid email address.';
        return;
      }
      if (subject.length < 3) {
        formError.textContent = 'Subject needs at least 3 characters.';
        return;
      }
      if (message.length < 12) {
        formError.textContent = 'Message is too short. Add some actual detail.';
        return;
      }

      const contactEmail = ((window.ABRAXAS_CONFIG || {}).contactEmail || '').trim();
      if (contactEmail) {
        const body = `${message}\n\n— ${name} (${email})`;
        window.location.href = `mailto:${contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        formStatus.textContent = `Opening your email app to send this to ${contactEmail}…`;
      } else {
        formStatus.textContent = 'Message validated. Add contactEmail in config.js (or hook a form service) to make submissions live.';
      }
      contactForm.reset();
    });

    /*
      Suit Purge easter egg.

      The #game section ships with the `hidden` attribute and is left out of
      the nav, so a first-time visitor never sees it. It unlocks lots of ways
      so it is easy to stumble on, on any device:

        - the Konami code — with or without the trailing B A
        - typing any of several secret words (purge, play, game, suit, htg…)
        - tapping any brand mark or the footer three times quickly (touch)
        - a shareable link: #game / #play in the URL, or ?play / ?egg

      Once unlocked we stash a flag in sessionStorage so a refresh mid-session
      keeps the maze available without having to re-enter anything.
    */
    (() => {
      const gameSection = document.getElementById('game');
      if (!gameSection) return;

      const STORAGE_KEY = 'htg-suit-purge-unlocked';
      let unlocked = false;

      const revealGame = (scroll) => {
        // First unlock: drop `hidden`, animate in, and tell the game engine to
        // size its canvas now that the section actually has a box.
        if (!unlocked) {
          unlocked = true;
          gameSection.hidden = false;
          gameSection.classList.add('egg-reveal');
          try { sessionStorage.setItem(STORAGE_KEY, '1'); } catch (e) { /* private mode */ }
          // game.js listens on window 'resize' to rebuild its render buffers.
          window.dispatchEvent(new Event('resize'));
        }
        if (scroll) {
          gameSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          const playButton = document.getElementById('gamePlay');
          if (playButton) {
            try { playButton.focus({ preventScroll: true }); } catch (e) { playButton.focus(); }
          }
        }
      };

      // Restore for the rest of the session after a reload — no scroll, so the
      // page still opens at the top.
      try {
        if (sessionStorage.getItem(STORAGE_KEY) === '1') revealGame(false);
      } catch (e) { /* private mode */ }

      // Shareable link: #game / #play in the hash, or ?play / ?game / ?egg.
      const urlWantsGame = () => {
        const hash = (location.hash || '').toLowerCase();
        const query = (location.search || '').toLowerCase();
        return hash === '#game' || hash === '#play' ||
          /[?&](play|game|egg|purge)(=|&|$)/.test(query);
      };
      if (urlWantsGame()) revealGame(false);
      window.addEventListener('hashchange', () => {
        if (urlWantsGame()) revealGame(true);
      });

      // Konami code. Completing just the arrows is enough; the classic B A
      // ending still works too.
      const konami = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];
      const arrowsDone = 8; // index reached once the eight arrows are entered
      let konamiPos = 0;

      // Any of these typed anywhere unlocks it. Longest first so the rolling
      // buffer is sized to the longest word.
      const secretWords = ['purge', 'suit', 'play', 'game', 'htg', 'hex'];
      const bufferLen = Math.max(...secretWords.map((w) => w.length));
      let typed = '';

      window.addEventListener('keydown', (event) => {
        // Ignore keys aimed at a form field so typing in Contact doesn't
        // accidentally unlock anything.
        const el = event.target;
        if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;

        konamiPos = event.code === konami[konamiPos] ? konamiPos + 1 : (event.code === konami[0] ? 1 : 0);
        if (konamiPos === arrowsDone || konamiPos === konami.length) {
          konamiPos = 0;
          revealGame(true);
          return;
        }

        if (event.key && event.key.length === 1) {
          typed = (typed + event.key.toLowerCase()).slice(-bufferLen);
          if (secretWords.some((w) => typed.endsWith(w))) revealGame(true);
        }
      });

      // Touch: three quick taps on any brand mark or the footer brand.
      const tapTargets = document.querySelectorAll('.brand-title, .brand-mark, .brand-subtitle, .footer-brand, .brand');
      tapTargets.forEach((target) => {
        let taps = 0;
        let tapTimer = null;
        target.addEventListener('click', () => {
          taps += 1;
          clearTimeout(tapTimer);
          tapTimer = setTimeout(() => { taps = 0; }, 1200);
          if (taps >= 3) {
            taps = 0;
            revealGame(true);
          }
        });
      });

      // A breadcrumb for anyone who opens the console.
      try {
        console.log('%cHTG // there is a maze hidden in this page. Try the Konami code, type "purge", or tap the logo three times.', 'color:#b794f6');
      } catch (e) { /* no console */ }
    })();

