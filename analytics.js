/* analytics.js — Cloudflare Web Analytics beacon, gated on config.js.

   Off until config.analytics.cloudflareToken is set: nothing loads, nothing
   is sent. When it is set, one script tag is added for Cloudflare's
   cookie-free, fingerprint-free page-view counter (no IP retention, no
   consent banner needed; the zone is already on Cloudflare). Loads after
   config.js on every visitor page. Enabling it changes legal.html §7/§8 —
   see the note beside the token in config.js. */
(function () {
  var cfg = window.ABRAXAS_CONFIG || {};
  var token = ((cfg.analytics || {}).cloudflareToken || '').trim();
  if (!token) return;
  var s = document.createElement('script');
  s.defer = true;
  s.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  s.setAttribute('data-cf-beacon', JSON.stringify({ token: token }));
  document.head.appendChild(s);
})();
