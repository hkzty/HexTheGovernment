/* render.js — builds the page from config.js.
   Load order matters: config.js -> render.js -> script.js
   Everything here rewrites the static markup using the values in
   config.js. No config value = keep the fallback. */

(() => {
  const cfg = window.ABRAXAS_CONFIG || {};
  const socials = cfg.socials || {};

  const socialUrl = (key) => (socials[key] || '').trim();

  const el = (tag, attrs = {}, children = []) => {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (key === 'text') node.textContent = value;
      else if (value !== undefined && value !== null && value !== false) node.setAttribute(key, value === true ? '' : value);
    }
    for (const child of children) node.append(child);
    return node;
  };

  /* ---- Profile links: footer icons + Music links -------------------------
     A platform with no URL in config is dropped from the page, never
     pointed at the platform's homepage. */
  document.querySelectorAll('[data-social]').forEach(a => {
    const url = socialUrl(a.dataset.social);
    if (url) a.href = url; else a.remove();
  });

  /* ---- Crypto donations block (footer) ---------------------------------- */
  const support = document.getElementById('support');
  if (support) {
    if (cfg.cryptoDonate) {
      support.querySelectorAll('a').forEach(a => { a.href = cfg.cryptoDonate; });
    } else {
      support.remove();
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
     card stands with no title — positions only, nothing invented. */
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
        el('span', { class: 'cover-title', text: extras.title || '' })
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
      const kicker = head.querySelector('.section-kicker');
      const note = head.querySelector('.section-copy');
      if (seq.kicker && kicker) kicker.textContent = seq.kicker;
      if (seq.note && note) note.textContent = seq.note;
    }
    seqSection.querySelectorAll('.sequence-block').forEach(n => n.remove());
    seqSection.querySelector('.sequence-fallback')?.remove();

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
      tag: seq.highlightTag || 'PINNED',
      label: `Play pinned track ${index + 1} on Spotify`
    })).filter(Boolean);
    if (highlights.length) {
      seqSection.append(el('div', { class: 'sequence-block cover-grid highlights' }, highlights));
    }

    const albums = (seq.albums || []).map((url, index) => coverCard(url, {
      num: String(index + 1).padStart(2, '0'),
      label: `Play album ${index + 1} of the Sequence on Spotify`
    })).filter(Boolean);
    if (albums.length) {
      seqSection.append(el('div', { class: 'sequence-block cover-grid' }, albums));
    }

    seqSection.append(el('div', { class: 'sequence-block pill-links' }, [
      el('a', { class: 'btn', href: 'sequence.html', text: 'Full Sequence' }),
      el('a', { class: 'inline-link', href: seq.artist || 'https://open.spotify.com/', target: '_blank', rel: 'noopener noreferrer', text: 'Spotify' })
    ]));
  }

  /* ---- Music: extra embeds under the artist players ----------------------- */
  const embeds = (cfg.outNowEmbeds || []).map(toEmbed).filter(Boolean);
  if (embeds.length) {
    const outNow = document.querySelector('#out-now .container');
    if (outNow) {
      outNow.append(el('div', { class: 'embed-grid' }, embeds.map(item => embedCard(item))));
    }
  }

  /* ---- Gallery ------------------------------------------------------------
     Built twice if needed: synchronously from config.gallery, then replaced
     by assets/gallery/manifest.json when the folder has photos in it
     (npm run build:gallery keeps the manifest current).                   */
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
      el('img', { class: 'gallery-thumb', src: item.thumb, alt: item.caption || `Gallery image ${index + 1}`, loading: 'lazy', decoding: 'async', width: 900, height: 900 })
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

  /* ---- Merch: nav button straight to the Shopify storefront --------------- */
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

  /* ---- Contact card ----------------------------------------------------------- */
  const contactList = document.querySelector('.contact-list');
  if (contactList) {
    const entries = [];
    if (cfg.contactEmail) {
      entries.push(['Email', el('a', { href: `mailto:${cfg.contactEmail}`, text: cfg.contactEmail })]);
    }
    if (cfg.management && cfg.management !== cfg.contactEmail) {
      entries.push(['Bookings', el('a', { href: `mailto:${cfg.management}`, text: cfg.management })]);
    }
    if (cfg.linktree) {
      entries.push(['Links', el('a', { href: cfg.linktree, target: '_blank', rel: 'noopener noreferrer', text: cfg.linktree.replace(/^https?:\/\//, '') })]);
    }
    if (entries.length) {
      contactList.replaceChildren(...entries.map(([label, value]) => el('li', {}, [el('strong', { text: label }), value])));
    }
  }
})();
