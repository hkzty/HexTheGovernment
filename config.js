/* =========================================================================
   ABRAXAS / HTG SITE CONFIG — this is the only file you need to edit.
   Paste your real profile URLs and content below, save, upload. Done.

   - Leave a value as "" (empty) and the site falls back to a safe default.
   - Any Spotify / SoundCloud / YouTube URL you paste into an embed list
     is turned into an embedded player automatically.
   - Photos: drop image files into assets/gallery/ and push — the gallery
     updates itself (a GitHub Action rebuilds the list on every upload).
   ========================================================================= */

window.ABRAXAS_CONFIG = {

  /* ---- Artist ---------------------------------------------------------- */
  artist: "ABRAXAS",
  tagline: "Depressions Running Deep",
  label: "HTG / Hex The Government",
  genre: "HEXCORE",

  /* Lines shown in the signal.log terminal card on the hero. */
  terminalLines: [
    "Artist: ABRAXAS",
    "Tagline: Depressions Running Deep",
    "Label: HTG / Hex The Government",
    "Sound: HEXCORE",
    "Produces as: HexBoy",
    "Mastering: Microbial Mastering",
    "Signal: 93 93/93",
    "Status: mid ritual"
  ],

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
     Plays behind the wordmark on the landing page. Two encodings of the
     same 6-second 720p loop; webm is offered first, mp4 is the fallback.
     Local files in the repo or any public direct video URL.              */
  heroVideo: "assets/htg-hero-720p.mp4",
  heroVideoWebm: "assets/htg-hero-720p.webm",
  heroPoster: "assets/placeholders/hero-poster.svg",

  /* ---- THE SEQUENCE ------------------------------------------------------
     The full playthrough, in order. Every URL becomes an embedded player.
     `highlights` are pinned at the top and visually marked with the tag. */
  sequence: {
    /* Cover art for the tiles below, keyed by Spotify ID (the last path
       segment of the URL). Drop the real cover image into assets/covers/
       and point at it here; `title` is the release's real name on Spotify.
       Leave an entry out and the tile shows its numbered deck card and
       tries Spotify's oEmbed in the visitor's browser. Never invent
       art or titles here. */
    covers: {
    },
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
     EASIEST WAY: drop image files into assets/gallery/ and push — the site
     picks them up automatically (via assets/gallery/manifest.json, rebuilt
     by the GitHub Action on every upload). The list below is only the
     fallback shown until real photos exist.                               */
  gallery: [
    { thumb: "assets/placeholders/gallery-1.svg", full: "assets/placeholders/gallery-1.svg", caption: "Night session / purple terminal room" },
    { thumb: "assets/placeholders/gallery-2.svg", full: "assets/placeholders/gallery-2.svg", caption: "Backstage static / blackout wash" },
    { thumb: "assets/placeholders/gallery-3.svg", full: "assets/placeholders/gallery-3.svg", caption: "Cover shoot / corrupted glow" },
    { thumb: "assets/placeholders/gallery-4.svg", full: "assets/placeholders/gallery-4.svg", caption: "Venue check / monitors down" },
    { thumb: "assets/placeholders/gallery-5.svg", full: "assets/placeholders/gallery-5.svg", caption: "Merch prep / box stack" },
    { thumb: "assets/placeholders/gallery-6.svg", full: "assets/placeholders/gallery-6.svg", caption: "Visual frame / violet signal" }
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
     How a submitted form reaches the inbox, tried in this order:

     1. contactForm.endpoint — a free form-to-email service, no backend.
        Either provider works, ~2 minutes to set up:
          - Formspree (formspree.io): create a form that forwards to
            contactEmail, paste its endpoint here, e.g.
            "https://formspree.io/f/abcdwxyz".
          - Web3Forms (web3forms.com): request an access key for
            contactEmail, set endpoint to
            "https://api.web3forms.com/submit" and put the key in
            accessKey.
        With an endpoint set, the form sends from the page itself and the
        visitor never needs a mail app.
     2. mailto: fallback — with no endpoint (or if the send fails), the
        form opens the visitor's email app addressed to contactEmail, and
        shows the address to copy for anyone without a mail app.         */
  contactForm: {
    endpoint: "",
    accessKey: ""   // Web3Forms only — leave "" for Formspree
  },
  contactEmail: "Bookings@htg.productions",
  management: "Bookings@htg.productions"
};
