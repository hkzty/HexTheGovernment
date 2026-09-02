# Cover art for the Sequence tiles

Save each release's real cover image here as `<spotifyId>.jpg` (the ID is
the last path segment of the Spotify URL in `config.js`), then register it
under `sequence.covers` in `config.js`:

```js
covers: {
  "44Mb4ylrmZhzqqWPClRMot": { src: "assets/covers/44Mb4ylrmZhzqqWPClRMot.jpg", title: "<real title on Spotify>" }
}
```

Use the artwork and title exactly as they appear on the Spotify album
page. Do not add placeholder or invented art; a tile with no entry shows
its numbered deck card instead.
