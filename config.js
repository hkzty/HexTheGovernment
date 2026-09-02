/* =========================================================================
   ABRAXAS / HTG SITE CONFIG — this is the only file you need to edit.
   Paste your real profile URLs and content below, save, upload. Done.

   - Leave a value as "" (empty) and the site falls back to a safe default.
   - Any Spotify / SoundCloud / YouTube URL you paste into an embed list
     is turned into an embedded player automatically.
   - Photos: drop image files into assets/gallery/, run
     `npm run build:gallery`, and push both — the gallery picks them up.
     (The GitHub Action that was meant to do this never runs in this repo.)
   ========================================================================= */

window.ABRAXAS_CONFIG = {

  /* ---- Artist ---------------------------------------------------------- */
  artist: "ABRAXAS",
  tagline: "Depressions Running Deep",
  label: "HTG / Hex The Government",
  genre: "HEXCORE",

  /* ---- Linked profiles (paste your public URLs here) -------------------
     Used for the footer icons AND the "Out Now" platform cards.
     Empty "" = the button falls back to the platform's homepage.         */
  socials: {
    instagram:    "https://instagram.com/abraxas.htg",
    spotify:      "https://open.spotify.com/artist/24hLqvYHqzi1eL2ZzpjO19",
    soundcloud:   "https://on.soundcloud.com/uTMdelzf0aAmn2Nx9a",
    youtube:      "",
    tiktok:       "https://www.tiktok.com/@abraxasthemage",
    appleMusic:   "",
    youtubeMusic: ""
  },

  /* One link that holds everything — shown as an "All Links" button in the
     hero and in the contact card. */
  linktree: "https://linktr.ee/abraxashtg",

  /* ---- Hero video -------------------------------------------------------
     Local file in the repo or any public direct .mp4 URL.                 */
  heroVideo: "assets/htg-hero.mp4",
  heroPoster: "assets/placeholders/hero-poster.svg",

  /* ---- THE SEQUENCE ------------------------------------------------------
     The full playthrough, in order. Every URL becomes an embedded player.
     `highlights` are pinned at the top and visually marked with the tag. */
  sequence: {
    kicker: "The Sequence // 93",
    title: "Play it through. In order.",
    note: "01 → 13. No words.",
    artist: "https://open.spotify.com/artist/24hLqvYHqzi1eL2ZzpjO19",
    highlightTag: "PINNED",
    highlights: [
      "https://open.spotify.com/track/7Az3pwgwCk09ZfQzlH8slr",
      "https://open.spotify.com/track/2oGrGX4T83boP9ZMIl2gZd",
      "https://open.spotify.com/track/5wiaIGjX8ht4vIxYHYHBqG"
    ],
    albums: [
      "https://open.spotify.com/album/44Mb4ylrmZhzqqWPClRMot",
      "https://open.spotify.com/album/6oib72faDOWbdjGCKDv8jG",
      "https://open.spotify.com/album/7rCWdf0wGJIEf4sLw5Ewi1",
      "https://open.spotify.com/album/039roKxrwPBwNawJufx5Yn",
      "https://open.spotify.com/album/4hV4QdF3cA0FARJHE4kbe3",
      "https://open.spotify.com/album/3ZwRxhRCwxo0QYZzWZWBs0",
      "https://open.spotify.com/album/6CJlKhuqdk7nIRdLzazPVf",
      "https://open.spotify.com/album/4kODOq52gGwuk56aFdwe0Q",
      "https://open.spotify.com/album/7G5EdtjQd1XB26OvMPZ9SY",
      "https://open.spotify.com/album/7r921T9Cl623OEmsdOQuYM",
      "https://open.spotify.com/album/22ERfUbenWhta3Pq6PZ6Hd",
      "https://open.spotify.com/album/1gvEKFbi6CIZu8yZf5E0q9",
      "https://open.spotify.com/album/5vbKU5ZwNhl0G8Pv1OOXYB"
    ]
  },

  /* ---- Extra embedded players (Out Now section) --------------------------
     Optional: more Spotify / SoundCloud / YouTube URLs shown under the
     platform cards.                                                       */
  outNowEmbeds: [
  ],

  /* ---- Instagram posts ----------------------------------------------------
     Paste public Instagram post/reel URLs and they appear embedded in the
     Gallery section, e.g. "https://www.instagram.com/p/XXXXXXXXX/".       */
  instagramPosts: [
  ],

  /* ---- Releases ----------------------------------------------------------
     The three entries that used to live here were invented placeholders and
     have been removed. Add a release only when it actually exists.
     cover: local file ("assets/cover.jpg") or public image URL.
     link:  streaming URL for the release ("" = points to Out Now section). */
  releases: [
    // Empty = the New Releases section shows an honest "catalog is the
    // Sequence" state. Add an entry only for a real, released title.
  ],

  /* ---- Coming soon (REMOVED FALSE TOUR DATA) ----------------------------
     Tour dates and locations removed. Use for real announcements only.    */
  comingSoon: [
  ],

  /* ---- Gallery -----------------------------------------------------------
     EASIEST WAY: drop image files into assets/gallery/, run
     `npm run build:gallery` (rebuilds assets/gallery/manifest.json), and
     push both. Captions come from the filenames. The list below is only
     the pre-JS fallback; keep it pointing at the same frames the manifest
     holds so the grid doesn't change once the manifest loads.
     These six are real frames off HTG's own visuals — the hero reel and
     live Suit Purge floors. Phone shots from sessions replace them
     whenever they exist; never add stock or invented "photos".          */
  gallery: [
    { thumb: "assets/gallery/htg-hero-reel-01.jpg", full: "assets/gallery/htg-hero-reel-01.jpg", caption: "htg hero reel 01" },
    { thumb: "assets/gallery/htg-hero-reel-02.jpg", full: "assets/gallery/htg-hero-reel-02.jpg", caption: "htg hero reel 02" },
    { thumb: "assets/gallery/suit-purge-floor-01.jpg", full: "assets/gallery/suit-purge-floor-01.jpg", caption: "suit purge floor 01" },
    { thumb: "assets/gallery/suit-purge-floor-02.jpg", full: "assets/gallery/suit-purge-floor-02.jpg", caption: "suit purge floor 02" },
    { thumb: "assets/gallery/suit-purge-floor-03.jpg", full: "assets/gallery/suit-purge-floor-03.jpg", caption: "suit purge floor 03" },
    { thumb: "assets/gallery/suit-purge-floor-04.jpg", full: "assets/gallery/suit-purge-floor-04.jpg", caption: "suit purge floor 04" }
  ],

  /* ---- Stats — counted from the Sequence above, not invented. ---------- */
  stats: [
    { value: 13, label: "Albums in the Sequence" },
    { value: 3,  label: "Pinned Highlights" },
    // Counted off the roster decks on index.html — keep the two in step.
    { value: 4,  label: "Names aboard the vessel" }
  ],

  /* ---- Albums Configuration (NEW - Auto-scraper) ------------------------ */
  albums: {
    enabled: true,
    pageSize: 12,
    platforms: ['instagram', 'youtube', 'tiktok'],
    defaultFilter: 'all',
    defaultSort: 'latest',
    updateInterval: 21600000  // 6 hours in milliseconds
  },

  /* ---- Shopify store -------------------------------------------------------
     The "Merchandise" nav link is a plain button straight to the Shopify
     storefront - no in-page product grid. Point it at the checkout domain
     once shop.htg.productions is verified in Shopify (Settings -> Domains);
     until then the *.myshopify.com storefront URL works fine. */
  shop: {
    url: "https://strettys-merch.myshopify.com"
  },

  /* ---- Contact -----------------------------------------------------------
     The contact form opens the visitor's email app with the message
     pre-filled, addressed to contactEmail.                                */
  contactEmail: "Bookings@htg.productions",
  management: "Bookings@htg.productions"
};
