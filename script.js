    const topbar = document.getElementById('topbar');
    const menuToggle = document.getElementById('menuToggle');
    const nav = document.getElementById('site-nav');
    const navLinks = [...document.querySelectorAll('.nav-list a')];
    const fadeEls = document.querySelectorAll('.fade-in');
    const sections = [...document.querySelectorAll('main section[id]')];
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

    if (menuToggle && nav) menuToggle.addEventListener('click', () => {
      const isOpen = nav.classList.toggle('open');
      menuToggle.setAttribute('aria-expanded', String(isOpen));
      menuToggle.querySelector('span:last-child').textContent = isOpen ? 'Close' : 'Menu';
    });

    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        if (window.innerWidth <= 820 && nav && menuToggle) {
          nav.classList.remove('open');
          menuToggle.setAttribute('aria-expanded', 'false');
          menuToggle.querySelector('span:last-child').textContent = 'Menu';
        }
      });
    });

    const onScrollFrame = () => {
      const scrolled = window.scrollY > 16;
      if (topbar) topbar.classList.toggle('scrolled', scrolled);

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

    const getGalleryButtons = () => [...document.querySelectorAll('[data-gallery-index]')];
    const lightbox = document.getElementById('lightbox');
    const lightboxImage = document.getElementById('lightboxImage');
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

    if (lightbox) {
    lightboxClose.addEventListener('click', closeLightbox);
    lightboxPrev.addEventListener('click', () => stepLightbox(-1));
    lightboxNext.addEventListener('click', () => stepLightbox(1));
    lightbox.addEventListener('click', (event) => {
      if (event.target === lightbox) closeLightbox();
    });
    }

    window.addEventListener('keydown', (event) => {
      if (!lightbox || !lightbox.classList.contains('open')) return;
      if (event.key === 'Escape') closeLightbox();
      if (event.key === 'ArrowLeft') stepLightbox(-1);
      if (event.key === 'ArrowRight') stepLightbox(1);
    });

    const contactForm = document.getElementById('contactForm');
    const formError = document.getElementById('formError');
    const formStatus = document.getElementById('formStatus');
    const contactSubmit = contactForm ? contactForm.querySelector('button[type="submit"]') : null;

    /*
      Delivery order: POST to the form service in config.contactForm when
      one is set, so sending works without a mail app — mailto: alone does
      nothing, silently, for visitors without one, and bookings are the
      site's one conversion. mailto: stays as the no-endpoint default and
      the network-failure fallback. On the mailto path the form is NOT
      reset: for someone with no mail app the text still sitting in the
      form is the only copy of their message.
    */
    const openMailto = ({ name, email, subject, message, contactEmail, contactCc, lead }) => {
      const body = `${message}\n\n${name}\n${email}`;
      const cc = contactCc.length ? `cc=${encodeURIComponent(contactCc.join(','))}&` : '';
      window.location.href = `mailto:${contactEmail}?${cc}subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      formStatus.textContent = `${lead} If nothing opened, email ${contactEmail}.`;
    };

    if (contactForm) contactForm.addEventListener('submit', async (event) => {
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
        formError.textContent = 'Name too short.';
        return;
      }
      if (!emailPattern.test(email)) {
        formError.textContent = 'Invalid email.';
        return;
      }
      if (subject.length < 3) {
        formError.textContent = 'Subject too short.';
        return;
      }
      if (message.length < 12) {
        formError.textContent = 'Message too short.';
        return;
      }

      // Honeypot: the field is invisible, so a filled value is a bot.
      // Claim success and send nothing.
      if ((formData.get('botcheck') || '').toString().trim()) {
        contactForm.reset();
        formStatus.textContent = 'Sent.';
        return;
      }

      const cfg = window.ABRAXAS_CONFIG || {};
      const contactEmail = (cfg.contactEmail || '').trim();
      // Delivery-only copies: every submission also lands in these inboxes.
      // They ride along as cc on both paths and are never shown on the page.
      const contactCc = (Array.isArray(cfg.contactCc) ? cfg.contactCc : [])
        .map(a => String(a).trim()).filter(Boolean);
      const service = cfg.contactForm || {};
      const endpoint = (service.endpoint || '').trim();
      const accessKey = (service.accessKey || '').trim();

      if (!endpoint && !contactEmail) {
        formStatus.textContent = 'Send failed.';
        return;
      }

      if (endpoint) {
        // Web3Forms wants access_key + botcheck and copies `ccemail`;
        // Formspree reads its meta fields from _-prefixed keys (`_cc` is a
        // paid-tier feature there). Shape the payload for whichever service
        // the config points at.
        const ccList = contactCc.join(',');
        const payload = accessKey
          ? { access_key: accessKey, name, email, subject, message, botcheck: false, ...(ccList && { ccemail: ccList }) }
          : { name, email, subject, message, _subject: subject, _replyto: email, _gotcha: '', ...(ccList && { _cc: ccList }) };
        contactSubmit.disabled = true;
        formStatus.textContent = 'Sending…';
        try {
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify(payload)
          });
          if (!res.ok) throw new Error(`form service responded ${res.status}`);
          contactForm.reset();
          formStatus.textContent = 'Sent.';
        } catch (err) {
          if (contactEmail) {
            openMailto({ name, email, subject, message, contactEmail, contactCc, lead: 'Send failed. Opening your mail app.' });
          } else {
            formStatus.textContent = 'Send failed. Try again.';
          }
        } finally {
          contactSubmit.disabled = false;
        }
        return;
      }

      openMailto({ name, email, subject, message, contactEmail, contactCc, lead: 'Opening your mail app.' });
    });
  

    /*
      Suit Purge easter egg.

      Suit Purge lives on game.html and is left out of the nav, so a
      first-time visitor never sees it. Any of the triggers below sends the
      visitor there (or reveals the hidden #game section on a page that still
      carries one). It is easy to stumble on, on any device:

        - the Konami code — with or without the trailing B A
        - typing any of several secret words (purge, play, game, suit, htg…)
        - tapping any brand mark or the footer three times quickly (touch)
        - a shareable link: #game / #play in the URL, or ?play / ?egg

      Once unlocked we stash a flag in sessionStorage so a refresh mid-session
      keeps the maze available without having to re-enter anything.
    */
    (() => {
      const gameSection = document.getElementById('game');

      const STORAGE_KEY = 'htg-suit-purge-unlocked';
      let unlocked = false;

      const revealGame = (scroll) => {
        if (!gameSection) {
          window.location.href = 'game.html';
          return;
        }
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
        if (gameSection && sessionStorage.getItem(STORAGE_KEY) === '1') revealGame(false);
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

    })();

