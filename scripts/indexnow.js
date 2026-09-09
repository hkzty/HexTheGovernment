#!/usr/bin/env node
/*
  indexnow.js — tells Bing, DuckDuckGo, Yandex, Naver and Seznam (every
  IndexNow participant; Google does not use it) that the site's pages changed.

  Reads every <loc> in sitemap.xml and POSTs them in one call, authenticated
  by the key file at the site root (<key>.txt, whose content is the key).
  Run it after a deploy that changed pages:

    npm run ping:indexnow

  Exits non-zero unless the API answers 200 or 202. Needs Node 18+ (fetch).
*/

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const HOST = 'www.htg.productions';
const KEY = 'aa3ba17e5adc90eee1d183ab3f140bf9';

async function main() {
  const keyFile = path.join(ROOT, `${KEY}.txt`);
  if (!fs.existsSync(keyFile) || fs.readFileSync(keyFile, 'utf8').trim() !== KEY) {
    throw new Error(`indexnow: ${KEY}.txt is missing or does not contain the key`);
  }
  const xml = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
  const urlList = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  if (!urlList.length) throw new Error('indexnow: no <loc> entries in sitemap.xml');

  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList }),
  });
  console.log(`indexnow: ${res.status} for ${urlList.length} urls`);
  if (res.status !== 200 && res.status !== 202) process.exit(1);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
