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
     Footer icons and the Music links. "" = the link is removed. A platform
     that gains a URL here also needs its <a data-social> anchor back in
     index.html (footer icons + Music links) and music.html: the static
     markup mirrors these values for crawlers that never run render.js, and
     render.js only rewrites anchors that exist.                           */
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

  /* ---- Analytics (Cloudflare Web Analytics) --------------------------------
     Cookie-free, fingerprint-free page-view counts, no consent banner
     needed, free on the Cloudflare account that already serves the DNS.
     Cloudflare dashboard -> Analytics & Logs -> Web Analytics -> Add a site
     -> www.htg.productions -> copy the token out of the JS snippet. "" =
     nothing is loaded (analytics.js). Do NOT use Cloudflare's "automatic"
     edge injection: it silently stops if the proxy is ever switched off.
     When a token is set, update legal.html in the same commit: §7 "What we
     do NOT collect" (say Cloudflare Web Analytics, a cookie-free aggregate
     counter, is used) and §6's third-party list.                          */
  analytics: {
    cloudflareToken: ""
  },

  /* ---- Services desks (hexboy.html, graveboy.html) -----------------------
     One key per desk, read by desk.js off <body data-desk="…">. A section
     whose list is empty is removed from the page — nothing here is a
     placeholder. Prices are AUD numbers; `standard` is the post-launch
     price shown beside the launch price. `shop` is a Shopify cart
     permalink (https://<store>/cart/<variantId>:1) so Check out lands
     straight in checkout; the products are published in the H.T.G Merch
     store. `price` and `shop` are optional: a package without them
     renders Details + Enquire only (Graveboy quotes per job — never put
     a placeholder price there). `service` picks the option in the desk's
     contact form when a visitor presses Enquire.

       email:     To: address for that desk's form. "" = contactEmail.
       store:     storefront URL for music sales. "" = no link.
       embeds:    Spotify URLs to embed under Music.
       packages:  [{ name, summary, price, standard, includes[], turnaround,
                     revisions, note, service, shop }]
       addons:    [{ name, detail, price, shop }]
       mastering: [{ name, detail, price }]   legacy offer cards, unused
       bundles:   [{ name, detail, price }]   legacy offer cards, unused
       links:     [{ label, url }] extra pills under the contact card.       */
  services: {
    hexboy: {
      email: "",
      store: "",
      embeds: [],
      packages: [
        {
          name: "Mix + Master",
          summary: "One track. Mix, master, instrumental and clean.",
          price: 93, standard: 330,
          includes: ["Mix + master", "Instrumental", "Clean version", "24-bit WAV + streaming MP3"],
          turnaround: "7 days from stems", revisions: "2 included",
          service: "HexBoy · Engineering",
          shop: "https://strettys-merch.myshopify.com/cart/47687126941780:1"
        },
        {
          name: "Mix",
          summary: "One track mixed. Instrumental and acapella.",
          price: 100, standard: 250,
          includes: ["24-bit WAV mix", "Instrumental", "Acapella"],
          turnaround: "5 days from stems", revisions: "2 included",
          note: "Stems via Drive or WeTransfer after checkout.",
          service: "HexBoy · Engineering",
          shop: "https://strettys-merch.myshopify.com/cart/47687126417492:1"
        },
        {
          name: "Master",
          summary: "One track mastered for release.",
          price: 69, standard: 120,
          includes: ["24-bit WAV master", "Streaming MP3", "ISRC embed on request"],
          turnaround: "2 days", revisions: "1 included",
          service: "HexBoy · Mastering",
          shop: "https://strettys-merch.myshopify.com/cart/47687126712404:1"
        },
        {
          name: "Stem Master",
          summary: "Stem-balanced master.",
          price: 80, standard: 150,
          includes: ["Stem-balanced 24-bit WAV master"],
          turnaround: "3 days", revisions: "1 included",
          service: "HexBoy · Mastering",
          shop: "https://strettys-merch.myshopify.com/cart/47687126974548:1"
        },
        {
          name: "EP Bundle",
          summary: "Four tracks, mix + master, instrumentals.",
          price: 480, standard: 1100,
          includes: ["4× mix + master", "4× instrumental"],
          turnaround: "21 days from stems", revisions: "2 per track",
          service: "HexBoy · Engineering",
          shop: "https://strettys-merch.myshopify.com/cart/47687127007316:1"
        },
        {
          name: "Album",
          summary: "Ten tracks, mix + master.",
          price: 1100, standard: 2500,
          includes: ["10× mix + master"],
          turnaround: "45 days from stems", revisions: "2 per track",
          note: "50% deposit at checkout, balance on delivery.",
          service: "HexBoy · Engineering",
          shop: "https://strettys-merch.myshopify.com/cart/47687127236692:1"
        }
      ],
      addons: [
        { name: "Vocal tuning / edit", detail: "Per track. Tuned, timed, comped.", price: 40, shop: "https://strettys-merch.myshopify.com/cart/47687127302228:1" },
        { name: "Extra revision", detail: "Beyond those included.", price: 25, shop: "https://strettys-merch.myshopify.com/cart/47687127367764:1" },
        { name: "Rush 48h", detail: "Subject to an open slot.", price: 50, shop: "https://strettys-merch.myshopify.com/cart/47687127466068:1" }
      ],
      mastering: [],
      bundles: [],
      links: []
    },
    graveboy: {
      email: "",
      store: "",
      embeds: [],
      /* Stretty's own desk. Every package here is work already done on this
         site or for the roster; no prices, quoted per job. */
      packages: [
        {
          name: "Site",
          summary: "A site like this one. Static, no framework, no tracking.",
          includes: ["Design and build", "Domain, DNS, hosting", "Share cards, structured data, sitemap, llms.txt", "Phone and desktop"],
          service: "Graveboy · Sites"
        },
        {
          name: "Mark",
          summary: "A drawn mark in the HTG treatment.",
          includes: ["Deck and door variants", "SVG source, webp and PNG exports", "Favicon and share card"],
          service: "Graveboy · Marks"
        },
        {
          name: "Store",
          summary: "Shopify wired to a site.",
          includes: ["Products and variants", "Checkout links from the page", "Store domain"],
          service: "Graveboy · Store"
        },
        {
          name: "Game",
          summary: "A browser game on a page. No downloads.",
          includes: ["Original, drawn in code", "Shared highscores (Cloudflare Worker + KV)"],
          service: "Graveboy · Games"
        },
        {
          name: "IT & Security",
          summary: "Devices, accounts, networks.",
          includes: ["Hardening and privacy setups", "Backups and recovery", "Ongoing support"],
          service: "Graveboy · IT & Security"
        }
      ],
      addons: [],
      mastering: [],
      bundles: [],
      links: []
    }
  },

  /* ---- Contact -----------------------------------------------------------
     How a submitted form reaches the inbox, tried in this order:

     1. contactForm.endpoint — a free form-to-email service, no backend.
        Web3Forms is the one in use. Delivery goes to the inbox the
        access key was issued for — NOT contactEmail, and NOT contactCc
        (cc is a paid feature on both services and is not sent; the
        site fell back to mailto: on every submit while it was).
          - Web3Forms (web3forms.com): request an access key for the
            inbox that should receive the form, set endpoint to
            "https://api.web3forms.com/submit" and put the key in
            accessKey. The key is meant to live in client-side code.
          - Formspree (formspree.io) also works — create a form that
            forwards to contactEmail and paste its endpoint, e.g.
            "https://formspree.io/f/abcdwxyz" — but its cc field is a
            paid feature, so on the free plan only contactEmail is
            delivered to.
     2. There is no mailto: fallback. A failed send (or no endpoint) shows
        contactEmail as plain text; the site never opens a mail app.

     contactEmail is shown on the contact card and is the To: address.
     contactCc is unused by the form service (cc is a paid feature there)
     and is never rendered anywhere on the site.                        */
  contactForm: {
    endpoint: "https://api.web3forms.com/submit",
    accessKey: "a6207845-06de-4728-a582-6daea0adda47"   // Web3Forms only — leave "" for Formspree
  },
  contactEmail: "Abraxas@htg.productions",
  contactCc: ["hkukic.2015@gmail.com"],
  management: "Bookings@htg.productions"
};
