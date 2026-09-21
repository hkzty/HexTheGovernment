# Launch checklist — the parts that live outside the repo

Everything on this list needs an account, a dashboard or DNS, so no commit
can do it. Nothing here adds anything visible to the site. In order of
what moves traffic soonest. `docs/` is blocked in `robots.txt`.

Facts this list rests on (resolved from the build sandbox, September 2026):
nameservers `pola` / `merlin.ns.cloudflare.com`, so DNS is edited in the
Cloudflare dashboard; `www` and the apex both resolve to Cloudflare proxy
addresses, not GitHub's; the apex already carries a
`google-site-verification` TXT and an SPF record for Microsoft 365
(`htg-productions.mail.protection.outlook.com`); `shop.htg.productions`
resolves to the proxy but is not connected in Shopify; `stretty.music` is
unregistered (NXDOMAIN) and its links were removed.

## 1. Contact form delivery — DONE except the junk filter

Web3Forms is wired (`config.contactForm` in `config.js`, September 2026).
Remaining owner step: 4 below. The key delivers to the address it was
created for at web3forms.com; `contactCc` addresses are copied via
`ccemail`.

1. https://web3forms.com → *Create your Access Key* → enter
   `Abraxas@htg.productions` → open the confirmation email → copy the key.
2. `config.js`: `contactForm: { endpoint: "https://api.web3forms.com/submit", accessKey: "<the key>" }`.
   `script.js` already sends `access_key`, `botcheck` and `ccemail` in the
   shape Web3Forms expects. The key is meant to be public.
3. Commit, then send a test from https://www.htg.productions/contact.html:
   status line reads `Sent.`, message lands in `Abraxas@htg.productions`
   and every `contactCc` address.
4. Stop it landing in Junk: Outlook on the web → Settings → Mail → Junk
   email → *Safe senders and domains* → add `web3forms.com` (or, in the
   Exchange admin centre, a mail-flow rule *sender domain is web3forms.com
   → set SCL −1*).
5. Delete the "contact form's delivery endpoint is unset" item from
   `CLAUDE.md`.

Free tier: 250 submissions a month.

`config.contactCc` currently publishes a personal Gmail address in a file
every visitor and crawler can fetch (`/config.js`). If that is not wanted,
set `contactCc: []` and forward server-side instead: Outlook on the web for
`Abraxas@htg.productions` → Settings → Mail → Forwarding → enable, *Keep a
copy* ticked.

## 2. GitHub Pages behind the Cloudflare proxy (15 min)

The custom domain currently resolves to Cloudflare, not to GitHub. That can
work, but only in one configuration, and the repo has no evidence it has
been checked.

1. https://github.com/hkzty/HexTheGovernment/settings/pages — *Custom
   domain* must show **DNS check successful** and **Enforce HTTPS** must be
   ticked (and tick-able).
2. If either fails, in Cloudflare → `htg.productions` → DNS → Records:
   - `www` → CNAME → `hkzty.github.io`, proxy **DNS only** (grey cloud);
   - `@` → A records `185.199.108.153`, `185.199.109.153`,
     `185.199.110.153`, `185.199.111.153` and AAAA `2606:50c0:8000::153`,
     `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`,
     all DNS only.
   Wait for the Pages settings page to show the certificate issued, then
   tick *Enforce HTTPS*. GitHub then redirects `htg.productions` →
   `www.htg.productions` itself.
3. Only if the orange-cloud proxy is wanted back afterwards: Cloudflare →
   SSL/TLS → *Full (strict)* and Edge Certificates → *Always Use HTTPS*.
   Never *Flexible* (it loops against GitHub's HTTPS redirect).
4. https://github.com/settings/pages → *Add a domain* → `htg.productions`
   → add the TXT it shows in Cloudflare as `_github-pages-challenge-hkzty`,
   DNS only → *Verify*. This stops anyone else binding the domain to their
   Pages site if the repo is ever renamed or deleted.
5. Confirm `https://www.htg.productions/favicon.ico`,
   `/assets/icons/apple-touch-icon.png`, `/.well-known/security.txt` and
   `/aa3ba17e5adc90eee1d183ab3f140bf9.txt` all return 200 after the deploy.

## 3. Google Search Console (10 min)

`robots.txt` already advertises the sitemap, so Google finds it on its own;
this is coverage reporting and on-demand indexing, not a blocker.

1. https://search.google.com/search-console → property picker. If a
   Domain property `htg.productions` is already listed, skip to 3. The TXT
   already on the apex may belong to whoever added it; it does not
   transfer between Google accounts.
2. Otherwise *Add property* → **Domain** → `htg.productions` → copy the
   `google-site-verification=…` string → Cloudflare DNS → add a TXT on `@`
   with that content (keep the existing one; several can coexist) →
   *Verify*.
3. Sitemaps → `https://www.htg.productions/sitemap.xml` → Submit. If it
   reports *Couldn't fetch* for a day or two, that is Google's queue, not
   the site.
4. URL Inspection → *Request indexing* for `/`, `/abraxas.html`,
   `/stretty.html`, `/ciggie.html`, `/sequence.html`, `/game.html`
   (about ten a day).
5. After a week, Indexing → Pages: `mobile.html` should read *Alternate
   page with proper canonical tag*. That is correct; do not "fix" it.

Do not add a separate `www` URL-prefix property; the Domain property covers
www, apex, http and https.

## 4. Bing Webmaster Tools + IndexNow (10 min)

Bing feeds DuckDuckGo, Yahoo and Ecosia.

1. https://www.bing.com/webmasters → sign in with the Microsoft account
   that owns the Microsoft 365 tenant → *Import* → *Import from Google
   Search Console* → authorise → pick `htg.productions`. Verification and
   the sitemap come across; no DNS change.
2. Sitemaps → confirm `sitemap.xml` shows 15 URLs.
3. IndexNow → the key file at the site root is detected once deployed.
   After any deploy that changed pages, from the repo:

   ```bash
   npm run ping:indexnow
   ```

   Expect `200` or `202`. Yandex, Naver and Seznam share the submission.

## 5. Point every existing profile at the site (30 min)

The site has no inbound links yet. These are the only backlinks and the
only day-one referral traffic it can have. Use the deck URL for each artist
and `https://www.htg.productions/` for the label.

- **Instagram** (`abraxas.htg` → `/abraxas.html`, `ciggyholster` →
  `/ciggie.html`, `justinn.clout` → `/justin.html`): Edit profile → Links →
  Add external link. Keep Linktree too.
- **TikTok** (`@abraxasthemage`): website links need a Business account
  below 1,000 followers — Settings → Account → Switch to Business account →
  Edit profile → Website → `/abraxas.html`.
- **Linktree** (`abraxashtg`, `ciggyholster`): the deck URL as the first
  link, titled with the artist name only.
- **YouTube** (both channels): YouTube Studio → Customisation → Basic info
  → Links → the site.
- **SoundCloud** (both profiles): Edit profile → Your links.
- **Spotify for Artists**: there is no website field. Confirm all three
  artist profiles are claimed at https://artists.spotify.com, set the
  Instagram link there, and put `www.htg.productions` in the bio text.
- **Shopify** (`strettys-merch`): Online Store → Navigation → Footer menu →
  add *HTG* → `https://www.htg.productions/`.
- **YTJobs** profile: website field.

These links are nofollow or JavaScript-rendered; the value is referral
traffic and entity confirmation, not PageRank.

## 6. MusicBrainz (30 min, free) — the open data that knowledge panels read

Several unrelated Spotify artists are also called ABRAXAS and Stretty.
MusicBrainz is the disambiguation source Google's music entity graph and
Wikidata pull from.

1. https://musicbrainz.org → *Add Label* → Name `HTG`, Type *Original
   Production*, Area *Australia* (or *New South Wales*). Leave the begin
   date blank unless it is known. After saving, *Edit relationships* → URL
   → *official homepage* → `https://www.htg.productions/`.
2. *Add Artist* ×3: ABRAXAS (Person, Australia, disambiguation *Australian
   HEXCORE artist, HTG*), Stretty (*Australian dark emo / alt rap, HTG*),
   ciggyholster. For each, URL relationships: *official homepage* → the
   deck; *streaming* → the Spotify artist URL **from `config.js` /
   `llms.txt`**, never one found by search; *social networking* →
   Instagram / TikTok; *youtube*; *soundcloud*; *purchase for mail-order*
   → the Shopify store (Stretty).
3. Paste the resulting `https://musicbrainz.org/label/<uuid>` and
   `/artist/<uuid>` URLs into `Organization.sameAs` (`index.html`), each
   `MusicGroup.sameAs` (`index.html` and the deck) and `llms.txt`, in one
   commit; `npm run build:mobile`.
4. A month later, Wikidata items citing the MusicBrainz IDs plus the
   official site. Do not write Wikipedia articles about your own label.

Skip: Bandsintown / Songkick (no shows — an empty profile is the empty
state `CLAUDE.md` forbids), Google Business Profile (no premises), paid
music directories, "submit to 100 search engines" services, link farms.
Apple Music for Artists only if the distributor delivers to Apple Music;
once claimed, its real artist URL fills `config.socials.appleMusic`, and
the Apple Music anchor goes back into `index.html` / `music.html`.

## 7. Shop domain (15 min)

`shop.htg.productions` resolves to the Cloudflare proxy but is not connected
in Shopify, so the Merch link still goes to `strettys-merch.myshopify.com`.

1. Cloudflare DNS → edit `shop` → CNAME → `shops.myshopify.com`, proxy
   **DNS only**. Shopify's connection check fails through the proxy.
2. Shopify admin → Settings → Domains → *Connect existing domain* →
   `shop.htg.productions` → *Verify connection* → *Set as primary*
   (Shopify redirects the myshopify host to it and issues a certificate
   within the hour).
3. One commit: `config.shop.url`, the Stretty `sameAs` and the
   Organization `sameAs` in `index.html`, `llms.txt` lines 12 and 45;
   `npm run build:mobile`. Do not keep both hosts in `sameAs`.

## 8. Analytics — only if wanted

`legal.html` promises no analytics. The repo ships an off-by-default slot
for Cloudflare Web Analytics (cookie-free, no fingerprinting, no IP
retention, no consent banner, free on the account that already serves the
DNS). To turn it on:

1. Cloudflare → Analytics & Logs → Web Analytics → *Add a site* →
   `www.htg.productions` → copy the token out of the JS snippet. Do not
   use *automatic* injection (it stops silently if the proxy is ever turned
   off, and it bypasses `config.js`).
2. `config.js` → `analytics.cloudflareToken`.
3. Same commit, `legal.html`: §6 add Cloudflare to the third-party list;
   §7 replace "We do not run our own analytics" with a line saying
   Cloudflare Web Analytics, a cookie-free aggregate page-view counter that
   stores no IP address or identifier, is used. §8 stays true (no cookie).

## 9. One owner decision: the phone redirect

Phones landing on `/` fetch `index.html`, then get bounced to
`mobile.html` and fetch it too. The redirect script now runs before the
preload scanner starts fetching, which removes most of the waste, but the
second document remains. `mobile.html` differs from `index.html` only by
having `style.css` inlined. Retiring the width redirect (keep the footer
*Mobile site* toggle and `?mobile=1` for testing) would save the second
page load for every bio-link visitor, at the cost of the documented
desktop/mobile split, the `rel="alternate"` line, and the matching anchor
in `scripts/build-mobile.js`. Not done here; it is the owner's call.

## 10. Service desk subdomain (`hexboy.htg.productions`)

`hexboy.html` ships on the main domain; GitHub Pages serves one custom
domain per repo, so a real subdomain is DNS plus a redirect, not a page:

1. Cloudflare → DNS → `CNAME hexboy → www.htg.productions`, proxied.
2. Cloudflare → Rules → Redirect Rules: host equals
   `hexboy.htg.productions` → `https://www.htg.productions/hexboy.html`,
   301, preserve nothing. Same pattern for `graveboy` when that page lands.

Serving the page *at* the subdomain (no redirect) means a second repo with
its own `CNAME`; not worth it for one page.

## Not worth doing

- Paid directories, "SEO submission" services, link exchanges.
- A Wikipedia article about the label.
- Songkick / Bandsintown with no dates.
- Any visible copy for search engines. Everything above is back-end.
