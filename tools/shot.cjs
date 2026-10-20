#!/usr/bin/env node
/* Скриншот HTML-файла в headless Chromium.
   NODE_PATH=/opt/node22/lib/node_modules node tools/shot.cjs <file.html|url> <out.png> [ширина=420] [высота=900] [--dark] [--full] */
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const argv = process.argv.slice(2);
  const flags = argv.filter((a) => a.startsWith('--'));
  const [src, out, w = '420', h = '900'] = argv.filter((a) => !a.startsWith('--'));
  if (!src || !out) {
    console.log('usage: shot.cjs <file.html|url> <out.png> [width] [height] [--dark] [--full]');
    process.exit(2);
  }
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: +w, height: +h },
    deviceScaleFactor: 2,
    colorScheme: flags.includes('--dark') ? 'dark' : 'light',
  });
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') console.log('console ' + m.type() + ':', m.text());
  });
  page.on('pageerror', (e) => console.log('page error:', e.message));
  const url = /^(https?|file):/.test(src) ? src : 'file://' + path.resolve(src);
  await page.goto(url);
  await page.waitForTimeout(500);
  await page.screenshot({ path: out, fullPage: flags.includes('--full') });
  await browser.close();
  console.log('saved', out);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
