/* desk.js — renders a services desk page (hexboy.html, graveboy.html)
   from config.services[<body data-desk>]. Every list is real content or
   nothing: a section whose list is empty is removed from the DOM.
   render.js is not loaded on desk pages on purpose (it rewrites
   .contact-list with the site-wide card). */
(function () {
  var key = (document.body && document.body.getAttribute('data-desk')) || '';
  var root = window.ABRAXAS_CONFIG || {};
  var desk = (root.services || {})[key] || {};
  var list = function (v) { return Array.isArray(v) ? v.filter(Boolean) : []; };
  var text = function (v) { return (v == null ? '' : String(v)).trim(); };

  var el = function (tag, attrs, children) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k]; else n.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  };
  var fill = function (host, nodes) {
    if (!host) return 0;
    nodes = nodes.filter(Boolean);
    nodes.forEach(function (n) { host.appendChild(n); });
    return nodes.length;
  };
  var pill = function (label, url, cls) {
    label = text(label); url = text(url);
    if (!label || !url) return null;
    var a = el('a', { href: url, text: label });
    if (cls) a.className = cls;
    if (/^https?:/i.test(url)) { a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener noreferrer'); }
    return a;
  };

  /* ---- Music: Spotify embeds + store link -------------------------------- */
  var embed = function (url) {
    var m = /open\.spotify\.com\/(track|album|playlist|artist)\/([A-Za-z0-9]+)/.exec(url);
    if (!m) return null;
    var frame = el('iframe', {
      title: 'Spotify',
      src: 'https://open.spotify.com/embed/' + m[1] + '/' + m[2] + '?utm_source=generator&theme=0',
      height: m[1] === 'track' ? '152' : '352',
      loading: 'lazy',
      allow: 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture'
    });
    return el('div', { class: 'embed-wrap' }, [frame]);
  };
  var counts = {};
  counts.music = fill(document.querySelector('[data-desk-embeds]'), list(desk.embeds).map(embed));
  counts.music += fill(document.querySelector('[data-desk-store]'), [pill('Buy', desk.store)]);

  /* ---- Offer grids (mastering, bundles) ----------------------------------- */
  var offer = function (item) {
    var name = text(item && item.name);
    if (!name) return null;
    var kids = [el('h3', { text: name })];
    if (text(item.detail)) kids.push(el('p', { text: text(item.detail) }));
    if (text(item.price)) kids.push(el('span', { class: 'price', text: text(item.price) }));
    return el('article', { class: 'offer' }, kids);
  };
  ['mastering', 'bundles'].forEach(function (k) {
    counts[k] = fill(document.querySelector('[data-desk-offers="' + k + '"]'), list(desk[k]).map(offer));
  });

  /* ---- Packages: products with a detail panel, Check out, Enquire --------- */
  var form = document.getElementById('contactForm');
  var money = function (n) {
    n = Number(n);
    if (!isFinite(n) || n <= 0) return '';
    return 'AUD ' + (n % 1 ? n.toFixed(2) : String(n));
  };
  var enquire = function (pkg) {
    if (!form) return;
    var svc = form.querySelector('[name="service"]');
    if (svc && text(pkg.service)) {
      Array.prototype.forEach.call(svc.options, function (o) { if (o.value === pkg.service) svc.value = o.value; });
    }
    var subj = form.querySelector('[name="subject"]');
    if (subj && !subj.value) subj.value = pkg.name;
    var sec = form.closest('section') || form;
    sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    var first = form.querySelector('[name="name"]');
    if (first) setTimeout(function () { first.focus({ preventScroll: true }); }, 500);
  };
  var dialog = document.getElementById('pkgDialog');
  var dialogBody = dialog && dialog.querySelector('[data-pkg-body]');
  var openDetail = function (pkg) {
    if (!dialog || !dialogBody) return;
    var kids = [el('h3', { text: pkg.name })];
    var priceLine = money(pkg.price);
    if (priceLine) {
      var std = money(pkg.standard);
      kids.push(el('p', { class: 'pkg-price' }, [
        el('strong', { text: priceLine }),
        std && std !== priceLine ? el('span', { text: ' launch · then ' + std }) : null
      ]));
    }
    var incl = list(pkg.includes);
    if (incl.length) kids.push(el('ul', { class: 'pkg-list' }, incl.map(function (i) { return el('li', { text: text(i) }); })));
    var meta = [];
    if (text(pkg.turnaround)) meta.push(el('li', {}, [el('strong', { text: 'Turnaround' }), el('span', { text: text(pkg.turnaround) })]));
    if (text(pkg.revisions)) meta.push(el('li', {}, [el('strong', { text: 'Revisions' }), el('span', { text: text(pkg.revisions) })]));
    if (text(pkg.note)) meta.push(el('li', {}, [el('strong', { text: 'Note' }), el('span', { text: text(pkg.note) })]));
    if (meta.length) kids.push(el('ul', { class: 'pkg-meta' }, meta));
    var acts = el('div', { class: 'pkg-actions' });
    var buy = pill('Check out', pkg.shop, 'btn');
    if (buy) acts.appendChild(buy);
    var ask = el('button', { type: 'button', class: 'btn btn--ghost', text: 'Enquire' });
    ask.addEventListener('click', function () { dialog.close(); enquire(pkg); });
    acts.appendChild(ask);
    kids.push(acts);
    dialogBody.replaceChildren.apply(dialogBody, kids);
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
  };
  if (dialog) {
    dialog.addEventListener('click', function (e) { if (e.target === dialog) dialog.close(); });
    var closeBtn = dialog.querySelector('[data-pkg-close]');
    if (closeBtn) closeBtn.addEventListener('click', function () { dialog.close(); });
  }
  var product = function (pkg) {
    var name = text(pkg && pkg.name);
    if (!name) return null;
    pkg.name = name;
    var kids = [el('h3', { text: name })];
    if (text(pkg.summary)) kids.push(el('p', { text: text(pkg.summary) }));
    var priceLine = money(pkg.price);
    if (priceLine) {
      var std = money(pkg.standard);
      kids.push(el('p', { class: 'pkg-price' }, [
        el('strong', { text: priceLine }),
        std && std !== priceLine ? el('span', { text: ' launch · then ' + std }) : null
      ]));
    }
    var acts = el('div', { class: 'pkg-actions' });
    var more = el('button', { type: 'button', class: 'btn btn--ghost', text: 'Details' });
    more.addEventListener('click', function () { openDetail(pkg); });
    acts.appendChild(more);
    var buy = pill('Check out', pkg.shop, 'btn');
    if (buy) acts.appendChild(buy);
    kids.push(acts);
    var card = el('article', { class: 'pkg' }, kids);
    return card;
  };
  counts.packages = fill(document.querySelector('[data-desk-packages]'), list(desk.packages).map(product));
  var addon = function (a) {
    var name = text(a && a.name);
    if (!name) return null;
    var kids = [el('span', { class: 'addon-name', text: name })];
    if (text(a.detail)) kids.push(el('span', { class: 'addon-detail', text: text(a.detail) }));
    var p = money(a.price);
    if (p) kids.push(el('span', { class: 'addon-price', text: p }));
    var buy = pill('Add', a.shop, 'addon-buy');
    if (buy) kids.push(buy);
    return el('li', {}, kids);
  };
  counts.packages += fill(document.querySelector('[data-desk-addons]'), list(desk.addons).map(addon));
  var addonHost = document.querySelector('[data-desk-addons]');
  if (addonHost && !addonHost.children.length) { var wrap = addonHost.closest('[data-desk-addons-wrap]'); if (wrap) wrap.remove(); }

  /* ---- Drop empty sections ---------------------------------------------- */
  document.querySelectorAll('[data-desk-section]').forEach(function (sec) {
    if (!counts[sec.getAttribute('data-desk-section')]) sec.remove();
  });

  /* ---- Contact: desk email on the card and as the form's To: ------------- */
  var email = text(desk.email) || text(root.contactEmail);
  var card = document.querySelector('[data-desk-contact]');
  if (card && email) {
    card.replaceChildren(el('li', {}, [el('strong', { text: 'Email' }), el('span', { text: email })]));
  }
  if (form && email) form.dataset.to = email;
  fill(document.querySelector('[data-desk-links]'), list(desk.links).map(function (l) { return pill(l && l.label, l && l.url); }));
})();
