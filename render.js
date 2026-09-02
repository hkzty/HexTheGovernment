/* render.js — builds the page from config.js.
   Load order matters: config.js -> render.js -> script.js
   Everything here rewrites the static placeholder markup using the values
   the site owner put in config.js. No config value = keep the fallback. */

(() => {
  const cfg = window.ABRAXAS_CONFIG || {};
  const socials = cfg.socials || {};

  const PLATFORM_HOMES = {
    instagram: 'https://instagram.com/',
    spotify: 'https://open.spotify.com/',
    soundcloud: 'https://soundcloud.com/',
    youtube: 'https://youtube.com/',
    tiktok: 'https://www.tiktok.com/',
    appleMusic: 'https://music.apple.com/',
    youtubeMusic: 'https://music.youtube.com/'
  };

  const socialUrl = (key) => (socials[key] || '').trim() || PLATFORM_HOMES[key] || '#';

  const el = (tag, attrs = {}, children = []) => {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (key === 'text') node.textContent = value;
      else if (value !== undefined && value !== null && value !== false) node.setAttribute(key, value === true ? '' : value);
    }
    for (const child of children) node.append(child);
    return node;
  };

  /* ---- Profile links: footer icons + Out Now platform cards ------------ */
  document.querySelectorAll('[data-social]').forEach(a => { a.href = socialUrl(a.dataset.social); });
  document.querySelectorAll('[data-platform]').forEach(a => { a.href = socialUrl(a.dataset.platform); });

  /* ---- Linktree: "All Links" buttons ------------------------------------ */
  if (cfg.linktree) {
    const heroCta = document.querySelector('.hero-cta');
    if (heroCta) heroCta.append(el('a', { class: 'btn', href: cfg.linktree, target: '_blank', rel: 'noopener noreferrer', text: 'All Links' }));
    const stickyActions = document.querySelector('.sticky-actions');
    if (stickyActions) stickyActions.append(el('a', { class: 'btn', href: cfg.linktree, target: '_blank', rel: 'noopener noreferrer', text: 'All Links' }));
  }

  /* ---- Terminal card lines ---------------------------------------------- */
  if (Array.isArray(cfg.terminalLines) && cfg.terminalLines.length) {
    const card = document.querySelector('.terminal-card');
    if (card) {
      card.querySelectorAll('.terminal-line').forEach(line => line.remove());
      cfg.terminalLines.forEach(text => {
        card.append(el('div', { class: 'terminal-line' }, [
          el('span', { text: '>' }),
          el('span', { text })
        ]));
      });
    }
  }

  /* ---- Hero video --------------------------------------------------------
     The markup ships webm + mp4 sources; config can retarget them. Data
     Saver, 2G and reduced-motion visitors get the poster only.           */
  const heroVideo = document.querySelector('.hero-video');
  if (heroVideo) {
    heroVideo.muted = true; // autoplay needs it set as a property, not just the attribute
    if (cfg.heroPoster) heroVideo.poster = cfg.heroPoster;
    const conn = navigator.connection;
    const slow = !!(conn && (conn.saveData || /(^|-)2g$/.test(conn.effectiveType || '')));
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (slow || still) {
      heroVideo.querySelectorAll('source').forEach(s => s.remove());
      heroVideo.removeAttribute('autoplay');
      heroVideo.load();
    } else {
      const wanted = [];
      if (cfg.heroVideoWebm) wanted.push([cfg.heroVideoWebm, 'video/webm']);
      if (cfg.heroVideo) wanted.push([cfg.heroVideo, 'video/mp4']);
      const current = [...heroVideo.querySelectorAll('source')]
        .map(s => `${s.getAttribute('src')}|${s.getAttribute('type')}`).join();
      if (wanted.length && wanted.map(w => w.join('|')).join() !== current) {
        heroVideo.querySelectorAll('source').forEach(s => s.remove());
        wanted.forEach(([src, type]) => heroVideo.append(el('source', { src, type })));
        heroVideo.load();
      }
    }
  }

  /* ---- URL -> embedded player -------------------------------------------- */
  const toEmbed = (raw) => {
    let u;
    try { u = new URL(raw); } catch { return null; }
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'open.spotify.com') {
      const m = u.pathname.match(/(?:\/intl-[^/]+)?\/(track|album|playlist|artist|episode|show)\/([A-Za-z0-9]+)/);
      if (m) return { src: `https://open.spotify.com/embed/${m[1]}/${m[2]}?utm_source=generator&theme=0`, height: 352, title: 'Spotify player' };
    }
    if (host === 'soundcloud.com' || host === 'on.soundcloud.com' || host === 'm.soundcloud.com') {
      return { src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(raw)}&color=%23ffffff&auto_play=false&show_teaser=false`, height: 166, title: 'SoundCloud player' };
    }
    if (host === 'youtube.com' || host === 'music.youtube.com' || host === 'youtu.be') {
      const id = host === 'youtu.be'
        ? u.pathname.slice(1).split('/')[0]
        : (u.searchParams.get('v') || (u.pathname.match(/\/(?:embed|shorts|live)\/([\w-]+)/) || [])[1] || '');
      if (id) return { src: `https://www.youtube-nocookie.com/embed/${id}`, height: 315, title: 'YouTube player' };
    }
    return null;
  };

  const embedCard = (item, extras = {}) => {
    const iframe = el('iframe', {
      src: item.src,
      title: item.title,
      height: item.height,
      loading: 'lazy',
      allow: 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture',
      frameborder: '0'
    });
    const card = el('div', { class: `embed-card fade-in${extras.highlight ? ' highlight' : ''}` });
    if (extras.tag || extras.num) {
      const head = el('div', { class: 'embed-head' });
      if (extras.num) head.append(el('span', { class: 'embed-num', text: extras.num }));
      if (extras.tag) head.append(el('span', { class: 'embed-tag', text: extras.tag }));
      card.append(head);
    }
    card.append(iframe);
    return card;
  };

  /* ---- THE SEQUENCE: covers first, players on click ----------------------
     The catalog reads as a grid of art instead of a wall of identical
     players, and nothing loads from Spotify until a card is tapped. Real
     cover art and titles are hydrated in the visitor's browser from
     Spotify's public oEmbed endpoint; when that fetch fails the numbered
     deck card stands — positions and the artist name, nothing invented. */
  const hydrateCover = (card, url) => {
    const apply = (data) => {
      if (!data) return;
      const art = card.querySelector('.cover-art');
      if (data.thumbnail_url && art && !art.querySelector('.cover-img')) {
        art.prepend(el('img', { class: 'cover-img', src: data.thumbnail_url, alt: '', loading: 'lazy', decoding: 'async' }));
      }
      if (data.title) {
        const title = card.querySelector('.cover-title');
        if (title) title.textContent = data.title;
        card.setAttribute('aria-label', `Play ${data.title} on Spotify`);
      }
    };
    const key = `htg-oembed:${url}`;
    let cached = null;
    try { cached = JSON.parse(sessionStorage.getItem(key)); } catch { /* no cache */ }
    if (cached) { apply(cached); return; }
    fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`)
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (!data) return;
        const slim = { title: data.title || '', thumbnail_url: data.thumbnail_url || '' };
        try { sessionStorage.setItem(key, JSON.stringify(slim)); } catch { /* storage full or blocked */ }
        apply(slim);
      })
      .catch(() => { /* endpoint unreachable — the numbered card stands */ });
  };

  /* Committed cover art wins over the oEmbed fetch: config.sequence.covers
     maps a Spotify ID to { src, title } for a file under assets/covers/. */
  const localCover = (url) => {
    const id = (url.match(/\/(?:track|album|playlist|artist|episode|show)\/([A-Za-z0-9]+)/) || [])[1];
    const entry = id && (seqCovers[id] || null);
    return entry && (entry.src || entry.title) ? entry : null;
  };

  const coverCard = (url, extras = {}) => {
    const item = toEmbed(url);
    if (!item) return null;
    const local = localCover(url);
    const art = el('span', { class: 'cover-art', 'aria-hidden': 'true' }, [
      el('span', { class: 'cover-num', text: extras.num || '' }),
      el('span', { class: 'cover-play', text: '▶' })
    ]);
    if (local && local.src) {
      art.prepend(el('img', { class: 'cover-img', src: local.src, alt: '', loading: 'lazy', decoding: 'async', width: 640, height: 640 }));
    }
    if (local && local.title) {
      extras = { ...extras, title: local.title, label: `Play ${local.title} on Spotify` };
    }
    if (extras.tag) art.append(el('span', { class: 'cover-tag', text: extras.tag }));
    const card = el('button', {
      class: `cover-card fade-in${extras.highlight ? ' highlight' : ''}`,
      type: 'button',
      'aria-label': extras.label || 'Play on Spotify'
    }, [
      art,
      el('span', { class: 'cover-meta' }, [
        el('span', { class: 'cover-title', text: extras.title || '' }),
        el('span', { class: 'cover-sub', text: 'Tap for the player' })
      ])
    ]);
    card.addEventListener('click', () => {
      const player = embedCard(item, { highlight: extras.highlight, tag: extras.tag, num: extras.num });
      // Created after script.js armed its reveal observer, so show it directly.
      player.classList.add('visible', 'now-playing');
      card.replaceWith(player);
      player.querySelector('iframe')?.focus();
    }, { once: true });
    if (!(local && local.src && local.title)) hydrateCover(card, url);
    return card;
  };

  const seq = cfg.sequence || {};
  const seqCovers = seq.covers || {};
  const seqSection = document.querySelector('#sequence .container');
  if (seqSection && (seq.albums || []).length + (seq.highlights || []).length > 0) {
    const head = seqSection.querySelector('.section-head');
    if (head) {
      if (seq.kicker) head.querySelector('.section-kicker').textContent = seq.kicker;
      if (seq.title) head.querySelector('.section-title').textContent = seq.title;
      if (seq.note) head.querySelector('.section-copy').textContent = seq.note;
    }
    seqSection.querySelectorAll('.sequence-block').forEach(n => n.remove());
    seqSection.querySelector('.sequence-fallback')?.remove();

    seqSection.append(el('div', { class: 'sequence-block sequence-open' }, [
      el('a', { class: 'btn', href: 'sequence.html', text: 'Open the full Sequence' }),
      el('span', { class: 'sequence-open-note', text: 'Every player on one page. Here, tap a cover to load its player.' })
    ]));

    const artistName = cfg.artist || 'the artist';
    const artistCard = seq.artist ? coverCard(seq.artist, {
      title: artistName,
      label: `Play ${artistName} on Spotify`
    }) : null;
    if (artistCard) {
      artistCard.classList.add('cover-card--artist');
      seqSection.append(el('div', { class: 'sequence-block sequence-artist' }, [artistCard]));
    }

    const highlights = (seq.highlights || []).map((url, index) => coverCard(url, {
      highlight: true,
      tag: seq.highlightTag || 'HIGHLIGHT',
      title: `Pinned ${String(index + 1).padStart(2, '0')}`,
      label: `Play pinned highlight ${index + 1} on Spotify`
    })).filter(Boolean);
    if (highlights.length) {
      seqSection.append(el('div', { class: 'sequence-block cover-grid highlights' }, highlights));
    }

    const albums = (seq.albums || []).map((url, index) => coverCard(url, {
      num: String(index + 1).padStart(2, '0'),
      title: `Sequence ${String(index + 1).padStart(2, '0')}`,
      label: `Play album ${index + 1} of the Sequence on Spotify`
    })).filter(Boolean);
    if (albums.length) {
      seqSection.append(el('div', { class: 'sequence-block cover-grid' }, albums));
    }

    seqSection.append(el('div', { class: 'sequence-block pill-links' }, [
      el('a', { class: 'inline-link', href: seq.artist || 'https://open.spotify.com/', target: '_blank', rel: 'noopener noreferrer', text: `Open ${artistName} on Spotify` }),
      el('a', { class: 'inline-link', href: 'sequence.html', text: 'Open the full Sequence' })
    ]));
  }

  /* ---- Out Now: extra embeds under the platform cards --------------------- */
  const embeds = (cfg.outNowEmbeds || []).map(toEmbed).filter(Boolean);
  if (embeds.length) {
    const outNow = document.querySelector('#out-now .container');
    if (outNow) {
      outNow.append(el('div', { class: 'embed-grid' }, embeds.map(item => embedCard(item))));
    }
  }

  /* ---- Releases ---------------------------------------------------------- */
  const releaseCover = (item, index) => item.cover || `assets/placeholders/gallery-${((index) % 6) + 1}.svg`;
  const releaseGrid = document.querySelector('.release-grid');
  if (releaseGrid && Array.isArray(cfg.releases) && cfg.releases.length) {
    releaseGrid.replaceChildren(...cfg.releases.map((item, index) => {
      const isExternal = /^https?:/i.test(item.link || '');
      const link = el('a', {
        class: 'inline-link',
        href: item.link || '#out-now',
        text: isExternal ? 'Listen Now' : 'Open Players'
      });
      if (isExternal) { link.target = '_blank'; link.rel = 'noopener noreferrer'; }
      return el('article', { class: 'release-card fade-in' }, [
        el('img', { class: 'release-cover', src: releaseCover(item, index), alt: `Cover art for ${item.title}`, loading: 'lazy', decoding: 'async', width: 900, height: 900 }),
        el('div', { class: 'release-body' }, [
          el('div', { class: 'meta-row' }, [el('span', { text: item.type || 'Release' }), el('span', { text: item.tag || 'HTG' })]),
          el('div', {}, [el('h3', { text: item.title }), el('p', { text: item.blurb || '' })]),
          el('div', { class: 'pill-links' }, [link])
        ])
      ]);
    }));
  }

  /* ---- Auto-synced catalog (assets/data/content.json) ---------------------
     Written by scripts/scraper.js (run on a schedule by the content-sync
     GitHub Action). Real album titles + cover art resolved from the URLs in
     config.js — appended to the releases grid as auto-synced cards.        */
  const albumsCfg = cfg.albums || {};
  if (albumsCfg.enabled !== false && releaseGrid) {
    fetch('assets/data/content.json')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        const items = (data && Array.isArray(data.items) ? data.items : [])
          .filter(i => i.kind === 'album' && i.thumbnail && i.title)
          .slice(0, albumsCfg.pageSize || 12);
        if (!items.length) return;
        releaseGrid.append(...items.map((item, index) => {
          const link = el('a', { class: 'inline-link', href: item.url, target: '_blank', rel: 'noopener noreferrer', text: 'Listen Now' });
          return el('article', { class: 'release-card fade-in visible' }, [
            el('img', { class: 'release-cover', src: item.thumbnail, alt: `Cover art for ${item.title}`, loading: 'lazy', decoding: 'async', width: 900, height: 900 }),
            el('div', { class: 'release-body' }, [
              el('div', { class: 'meta-row' }, [el('span', { text: `Album ${String(index + 1).padStart(2, '0')}` }), el('span', { text: 'Auto-Sync' })]),
              el('div', {}, [el('h3', { text: item.title })]),
              el('div', { class: 'pill-links' }, [link])
            ])
          ]);
        }));
      })
      .catch(() => { /* no synced content yet */ });
  }

  /* ---- Coming soon -------------------------------------------------------- */
  const comingGrid = document.querySelector('.coming-grid');
  if (comingGrid && Array.isArray(cfg.comingSoon) && cfg.comingSoon.length) {
    comingGrid.replaceChildren(...cfg.comingSoon.map((item, index) => el('article', { class: 'coming-card fade-in' }, [
      el('img', { class: 'coming-image', src: item.image || `assets/placeholders/gallery-${((index) % 6) + 1}.svg`, alt: `Visual for ${item.title}`, loading: 'lazy', decoding: 'async', width: 900, height: 900 }),
      el('div', { class: 'coming-body' }, [
        el('div', { class: 'meta-row' }, [el('span', { text: item.date || 'TBA' }), el('span', { text: item.type || 'Drop' })]),
        el('div', {}, [el('h3', { text: item.title }), el('p', { text: item.blurb || '' })])
      ])
    ])));
  }

  /* ---- Gallery ------------------------------------------------------------
     Built twice if needed: synchronously from config.gallery, then replaced
     by assets/gallery/manifest.json when the auto-uploaded folder has
     photos in it (the GitHub Action keeps the manifest current).          */
  const galleryGrid = document.querySelector('.gallery-grid');

  const buildGallery = (items, revealNow) => {
    if (!galleryGrid || !items.length) return;
    galleryGrid.replaceChildren(...items.map((item, index) => el('button', {
      class: `gallery-item fade-in${revealNow ? ' visible' : ''}`,
      type: 'button',
      'data-gallery-index': index,
      'data-full': item.full || item.thumb,
      'data-caption': item.caption || ''
    }, [
      el('img', { class: 'gallery-thumb', src: item.thumb, alt: item.caption || `Gallery image ${index + 1}`, loading: 'lazy', decoding: 'async', width: 900, height: 900 }),
      el('span', { class: 'gallery-caption', text: item.caption || '' })
    ])));
  };

  if (Array.isArray(cfg.gallery) && cfg.gallery.length) buildGallery(cfg.gallery, false);

  const captionFromFilename = (name) => name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();
  fetch('assets/gallery/manifest.json')
    .then(res => (res.ok ? res.json() : null))
    .then(files => {
      if (!Array.isArray(files)) return;
      const images = files.filter(f => typeof f === 'string' && /\.(jpe?g|png|webp|gif|avif)$/i.test(f));
      if (!images.length) return;
      buildGallery(images.map(f => ({
        thumb: `assets/gallery/${f}`,
        full: `assets/gallery/${f}`,
        caption: captionFromFilename(f)
      })), true);
    })
    .catch(() => { /* no manifest yet — config fallback stays */ });

  /* ---- Merchandise: nav button straight to the Shopify storefront --------- */
  const shopUrl = (cfg.shop && cfg.shop.url || '').trim();
  document.querySelectorAll('[data-shop-link]').forEach(a => {
    if (shopUrl) a.href = shopUrl;
  });

  /* ---- Instagram post embeds (Gallery section) ----------------------------- */
  const instaCodes = (cfg.instagramPosts || []).map(raw => {
    let u;
    try { u = new URL(raw); } catch { return null; }
    const host = u.hostname.replace(/^www\./, '');
    if (host !== 'instagram.com' && !host.endsWith('.instagram.com')) return null;
    const m = u.pathname.match(/\/(?:p|reel|tv)\/([\w-]+)/);
    return m ? m[1] : null;
  }).filter(Boolean);
  if (instaCodes.length) {
    const gallerySection = document.querySelector('#gallery .container');
    if (gallerySection) {
      gallerySection.append(el('div', { class: 'embed-grid insta-grid' }, instaCodes.map(code => el('div', { class: 'embed-card fade-in' }, [
        el('iframe', {
          src: `https://www.instagram.com/p/${code}/embed`,
          title: 'Instagram post',
          height: 540,
          loading: 'lazy',
          frameborder: '0',
          scrolling: 'no',
          allowtransparency: 'true'
        })
      ]))));
    }
  }

  /* ---- Stats ---------------------------------------------------------------- */
  const statsGrid = document.querySelector('.stats-grid');
  if (statsGrid && Array.isArray(cfg.stats) && cfg.stats.length) {
    statsGrid.replaceChildren(...cfg.stats.map(item => el('article', { class: 'stat-card fade-in' }, [
      el('div', { class: 'stat-value', 'data-counter': item.value, text: '0' }),
      el('div', { class: 'stat-label', text: item.label })
    ])));
  }

  /* ---- Contact card ----------------------------------------------------------- */
  const contactList = document.querySelector('.contact-list');
  if (contactList) {
    const entries = [];
    if (cfg.contactEmail) {
      entries.push(['Email', el('a', { href: `mailto:${cfg.contactEmail}`, text: cfg.contactEmail })]);
    }
    if (cfg.management && cfg.management !== cfg.contactEmail) {
      entries.push(['Management', el('a', { href: `mailto:${cfg.management}`, text: cfg.management })]);
    }
    entries.push(['Label', el('span', { text: cfg.label || 'HTG / Hex The Government' })]);
    if (cfg.linktree) {
      entries.push(['All Links', el('a', { href: cfg.linktree, target: '_blank', rel: 'noopener noreferrer', text: cfg.linktree.replace(/^https?:\/\//, '') })]);
    }
    entries.push(['Focus', el('span', { text: 'Bookings, features, visuals, merchandise' })]);
    contactList.replaceChildren(...entries.map(([label, value]) => el('li', {}, [el('strong', { text: label }), value])));
  }
})();
