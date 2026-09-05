/* =========================================================================
   HTG SITE CONFIG — links, the Sequence, gallery, contact.

   - "" (empty) drops that link from the page. Nothing falls back to a
     platform homepage.
   - Any Spotify / SoundCloud / YouTube URL in an embed list becomes an
     embedded player.
   - Photos: drop image files into assets/gallery/, run
     `npm run build:gallery`, commit both.
   ========================================================================= */

window.ABRAXAS_CONFIG = {

  /* ---- Artist ---------------------------------------------------------- */
  artist: "ABRAXAS",

  /* ---- Linked profiles ---------------------------------------------------
     Footer icons and the Music links. "" = the link is removed.          */
  socials: {
    instagram:    "https://instagram.com/abraxas.htg",
    spotify:      "https://open.spotify.com/artist/24hLqvYHqzi1eL2ZzpjO19",
    soundcloud:   "https://on.soundcloud.com/uTMdelzf0aAmn2Nx9a",
    youtube:      "",
    tiktok:       "https://www.tiktok.com/@abraxasthemage",
    appleMusic:   "",
    youtubeMusic: ""
  },

  /* Shown as the "Links" row on the contact card. */
  linktree: "https://linktr.ee/abraxashtg",

  /* ---- Crypto donations (Streamiverse) ----------------------------------
     Footer block: button + QR code pointing at the page. "" hides the
     block. The QR is a static SVG generated from the URL — regenerate
     assets/crypto-donate-qr.svg if the URL changes.                     */
  cryptoDonate: "https://donation.streamiverse.io/stretty",

  /* ---- Hero video -------------------------------------------------------
     Plays behind the wordmark on the landing page. Two encodings of the
     same 6-second 720p loop; webm is offered first, mp4 is the fallback. */
  heroVideo: "assets/htg-hero-720p.mp4",
  heroVideoWebm: "assets/htg-hero-720p.webm",
  heroPoster: "assets/placeholders/hero-poster.svg",

  /* ---- THE SEQUENCE ------------------------------------------------------
     The full playthrough, in order. Every URL becomes a cover card that
     loads its player on tap. `highlights` are pinned at the top.       */
  sequence: {
    /* Cover art for the tiles, keyed by Spotify ID (the last path segment
       of the URL). Drop the real cover image into assets/covers/ and point
       at it here; `title` is the release's real name on Spotify. With no
       entry the tile shows its numbered card and tries Spotify's oEmbed
       in the visitor's browser. Never invent art or titles here. */
    covers: {
    },
    kicker: "The Sequence",
    note: "ABRAXAS · 01 → 13",
    artist: "https://open.spotify.com/artist/24hLqvYHqzi1eL2ZzpjO19",
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

  /* ---- Extra embedded players (Music section) ----------------------------
     Optional: more Spotify / SoundCloud / YouTube URLs shown under the
     artist players.                                                       */
  outNowEmbeds: [
  ],

  /* ---- Instagram posts ----------------------------------------------------
     Public Instagram post/reel URLs, embedded in the Gallery section,
     e.g. "https://www.instagram.com/p/XXXXXXXXX/".                       */
  instagramPosts: [
  ],

  /* ---- Gallery -----------------------------------------------------------
     Drop image files into assets/gallery/, run `npm run build:gallery`
     (rebuilds assets/gallery/manifest.json), and push both. Captions come
     from the filenames. The list below is only the pre-JS fallback; keep
     it pointing at the same frames the manifest holds so the grid doesn't
     change once the manifest loads. These six are frames off HTG's own
     visuals. Never add stock or invented "photos".                      */
  gallery: [
    { thumb: "assets/gallery/htg-hero-reel-01.jpg", full: "assets/gallery/htg-hero-reel-01.jpg", caption: "htg hero reel 01" },
    { thumb: "assets/gallery/htg-hero-reel-02.jpg", full: "assets/gallery/htg-hero-reel-02.jpg", caption: "htg hero reel 02" },
    { thumb: "assets/gallery/suit-purge-floor-01.jpg", full: "assets/gallery/suit-purge-floor-01.jpg", caption: "suit purge floor 01" },
    { thumb: "assets/gallery/suit-purge-floor-02.jpg", full: "assets/gallery/suit-purge-floor-02.jpg", caption: "suit purge floor 02" },
    { thumb: "assets/gallery/suit-purge-floor-03.jpg", full: "assets/gallery/suit-purge-floor-03.jpg", caption: "suit purge floor 03" },
    { thumb: "assets/gallery/suit-purge-floor-04.jpg", full: "assets/gallery/suit-purge-floor-04.jpg", caption: "suit purge floor 04" }
  ],

  /* ---- Shopify store -------------------------------------------------------
     The "Merch" nav link goes straight to the storefront. Point it at the
     checkout domain once shop.htg.productions is verified in Shopify
     (Settings -> Domains); until then the *.myshopify.com URL works.     */
  shop: {
    url: "https://strettys-merch.myshopify.com"
  },

  /* ---- Suit Purge highscores ----------------------------------------------
     Shared top ten, served by the Cloudflare Worker in worker/ (deploy
     steps in worker/README.md). Paste the worker's /scores URL here. The
     game only sends a run when the player presses Save; with "" the table
     lives in each visitor's browser instead.                              */
  game: {
    scoresEndpoint: ""
  },

  /* ---- Contact -----------------------------------------------------------
     How a submitted form reaches the inbox, tried in this order:

     1. contactForm.endpoint — a free form-to-email service, no backend.
        Web3Forms is the one to use here: its free tier delivers to
        contactEmail AND copies every address in contactCc.
          - Web3Forms (web3forms.com): request an access key for
            contactEmail (Abraxas@htg.productions), set endpoint to
            "https://api.web3forms.com/submit" and put the key in
            accessKey. The key is meant to live in client-side code.
          - Formspree (formspree.io) also works — create a form that
            forwards to contactEmail and paste its endpoint, e.g.
            "https://formspree.io/f/abcdwxyz" — but its cc field is a
            paid feature, so on the free plan only contactEmail is
            delivered to.
     2. mailto: fallback — with no endpoint (or if the send fails), the
        form opens the visitor's email app addressed to contactEmail with
        contactCc on copy, and shows the address for anyone without a
        mail app.

     contactEmail is shown on the contact card and is the To: address.
     contactCc is delivery-only — those addresses receive every
     submission but are never rendered anywhere on the site.            */
  contactForm: {
    endpoint: "",
    accessKey: ""   // Web3Forms only — leave "" for Formspree
  },
  contactEmail: "Abraxas@htg.productions",
  contactCc: ["hkukic.2015@gmail.com"],
  management: "Bookings@htg.productions"
};
