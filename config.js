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
  genre: "Underground Occult Rap",

  /* Lines shown in the signal.log terminal card on the hero. */
  terminalLines: [
    "Artist: ABRAXAS",
    "Tagline: Depressions Running Deep",
    "Label: HTG / Hex The Government",
    "Sound: underground occult rap",
    "Produces as: HexBoy",
    "Mastering: Microbial Mastering",
    "Signal: 93 93/93",
    "Status: next release compiling"
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
     Local file in the repo or any public direct .mp4 URL.                 */
  heroVideo: "assets/htg-hero.mp4",
  heroPoster: "https://picsum.photos/seed/abraxashero/1920/1080?grayscale",

  /* ---- THE SEQUENCE ------------------------------------------------------
     The full playthrough, in order. Every URL becomes an embedded player.
     `highlights` are pinned at the top and visually marked with the tag. */
  sequence: {
    kicker: "The Sequence // 93",
    title: "Play it through. In order.",
    note: "01 → 13. No words.",
    artist: "https://open.spotify.com/artist/24hLqvYHqzi1eL2ZzpjO19",
    highlightTag: "STRETTY",
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

  /* ---- Releases (real titles — swap covers/links when ready) ------------
     cover: local file ("assets/cover.jpg") or public image URL.
     link:  streaming URL for the release ("" = points to Out Now section). */
  releases: [
    {
      title: "Black Halo Error",
      type: "Single",
      tag: "Occult Rap",
      blurb: "A lead single built on clipped drums, cold synth haze, and a vocal line that sounds like it barely held together on export.",
      cover: "",
      link: ""
    },
    {
      title: "Violet Static",
      type: "EP",
      tag: "Alt Rap",
      blurb: "Short-run EP material with more melodic damage, sharper textures, and a tighter visual frame under the HTG banner.",
      cover: "",
      link: ""
    },
    {
      title: "Crash Prayer",
      type: "Visual Drop",
      tag: "HTG",
      blurb: "Visual-first release block for reel edits, short teasers, and sharper promo assets tied back to the main one-page site.",
      cover: "",
      link: ""
    }
  ],

  /* ---- Coming soon ------------------------------------------------------ */
  comingSoon: [
    {
      title: "Saintless Code",
      date: "TBA",
      type: "Single",
      blurb: "Upcoming single with a colder vocal bed, denser low-end, and a stronger visual package built for teaser campaigns.",
      image: ""
    },
    {
      title: "Purple Mourning",
      date: "July 2026",
      type: "EP",
      blurb: "Multi-track release expanding the catalog with more structured sequencing, heavier atmosphere, and better repeat pull.",
      image: ""
    },
    {
      title: "Null Cathedral Video",
      date: "Visual",
      type: "HTG Rollout",
      blurb: "Dark visual piece aligned with the next track cycle, shaped for shorts, reels, and a full video release.",
      image: ""
    }
  ],

  /* ---- Gallery -----------------------------------------------------------
     EASIEST WAY: drop image files into assets/gallery/ and push — the site
     picks them up automatically (via assets/gallery/manifest.json, rebuilt
     by the GitHub Action on every upload). The list below is only the
     fallback shown until real photos exist.                               */
  gallery: [
    { thumb: "https://picsum.photos/seed/abraxasgallery1/900/900?grayscale", full: "https://picsum.photos/seed/abraxasgallery1/1600/1200?grayscale", caption: "Night session / purple terminal room" },
    { thumb: "https://picsum.photos/seed/abraxasgallery2/900/900?grayscale", full: "https://picsum.photos/seed/abraxasgallery2/1600/1200?grayscale", caption: "Backstage static / blackout wash" },
    { thumb: "https://picsum.photos/seed/abraxasgallery3/900/900?grayscale", full: "https://picsum.photos/seed/abraxasgallery3/1600/1200?grayscale", caption: "Cover shoot / corrupted glow" },
    { thumb: "https://picsum.photos/seed/abraxasgallery4/900/900?grayscale", full: "https://picsum.photos/seed/abraxasgallery4/1600/1200?grayscale", caption: "Venue check / monitors down" },
    { thumb: "https://picsum.photos/seed/abraxasgallery5/900/900?grayscale", full: "https://picsum.photos/seed/abraxasgallery5/1600/1200?grayscale", caption: "Merch prep / box stack" },
    { thumb: "https://picsum.photos/seed/abraxasgallery6/900/900?grayscale", full: "https://picsum.photos/seed/abraxasgallery6/1600/1200?grayscale", caption: "Visual frame / violet signal" }
  ],

  /* ---- Stats (placeholder numbers — edit freely) ------------------------ */
  stats: [
    { value: 13, label: "Albums in the Sequence" },
    { value: 3,  label: "Stretty Highlights" },
    { value: 34, label: "Night Sessions Logged" },
    { value: 4,  label: "Cities Routed Next" }
  ],

  /* ---- Contact -----------------------------------------------------------
     The contact form opens the visitor's email app with the message
     pre-filled, addressed to contactEmail.                                */
  contactEmail: "Bookings@htg.productions",
  management: "Bookings@htg.productions"
};
