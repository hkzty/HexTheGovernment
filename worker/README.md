# Suit Purge scores worker

Cloudflare Worker + KV holding the shared top ten. Free tier is enough.

## Deploy

```bash
cd worker
npx wrangler login
npx wrangler kv namespace create SCORES     # paste the id into wrangler.toml
npx wrangler deploy                          # prints the workers.dev URL
```

Then in `config.js`:

```js
game: { scoresEndpoint: "https://htg-suit-purge-scores.<account>.workers.dev/scores" }
```

Optional custom domain: uncomment `routes` in `wrangler.toml` and add
`scores.htg.productions` in the Cloudflare dashboard.

## Reset the board

```bash
npx wrangler kv key delete --binding SCORES board
```

## Local run

```bash
npx wrangler dev
# then in config.js point scoresEndpoint at http://127.0.0.1:8787/scores
# and add http://localhost:8000 to ALLOWED_ORIGINS in wrangler.toml
```
