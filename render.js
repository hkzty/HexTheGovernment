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

  /* ---- Hero video --------------------------------------------------------
     Respects Data Saver / very slow connections: poster only, no 25MB pull. */
  const heroVideo = document.querySelector('.hero-video');
  if (heroVideo) {
    if (cfg.heroPoster) heroVideo.poster = cfg.heroPoster;
    const conn = navigator.connection;
    const slow = !!(conn && (conn.saveData || /(^|-)2g$/.test(conn.effectiveType || '')));
    if (slow) {
      heroVideo.querySelectorAll('source').forEach(s => s.remove());
      heroVideo.removeAttribute('autoplay');
      heroVideo.load();
    } else if (cfg.heroVideo) {
      let source = heroVideo.querySelector('source');
      if (!source) { source = el('source'); heroVideo.append(source); }
      if (source.getAttribute('src') !== cfg.heroVideo) {
        source.src = cfg.heroVideo;
        source.type = 'video/mp4';
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

  /* ---- THE SEQUENCE: full playthrough, highlights pinned and marked ------ */
  const seq = cfg.sequence || {};
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

    const artistEmbed = seq.artist ? toEmbed(seq.artist) : null;
    if (artistEmbed) {
      seqSection.append(el('div', { class: 'sequence-block sequence-artist' }, [embedCard(artistEmbed)]));
    }

    const highlights = (seq.highlights || []).map(toEmbed).filter(Boolean);
    if (highlights.length) {
      seqSection.append(el('div', { class: 'sequence-block embed-grid highlights' },
        highlights.map(item => embedCard(item, { highlight: true, tag: seq.highlightTag || 'HIGHLIGHT' }))));
    }

    const albums = (seq.albums || []).map(toEmbed).filter(Boolean);
    if (albums.length) {
      seqSection.append(el('div', { class: 'sequence-block embed-grid' },
        albums.map((item, index) => embedCard(item, { num: String(index + 1).padStart(2, '0') }))));
    }
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
