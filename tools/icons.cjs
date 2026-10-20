#!/usr/bin/env node
/* Иконки приложения: папка-медкарта с печатью «А». Рисует SVG и растрирует в Chromium.
   NODE_PATH=/opt/node22/lib/node_modules node tools/icons.cjs
   → android/app/src/main/res/mipmap-…   (адаптивная иконка Android + обычная для старых версий)
   → assets/icons/                        (иконки для браузера и «на главный экран») */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const fontUrl = 'file://' + path.join(root, 'assets/fonts/oranienbaum-cyrillic.woff2');

/* Холст 108×108 — как у адаптивной иконки Android: видна середина 72×72,
   всё важное — в круге радиусом 33 вокруг центра. */
const BG = `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#a3c9b8"/><stop offset="1" stop-color="#78a491"/>
    </linearGradient>
    <pattern id="tile" width="9" height="9" patternUnits="userSpaceOnUse">
      <path d="M9 0V9M0 9H9" stroke="#ffffff" stroke-opacity=".16" stroke-width=".6" fill="none"/>
    </pattern>
  </defs>
  <rect width="108" height="108" fill="url(#bg)"/>
  <rect width="108" height="108" fill="url(#tile)"/>`;

const FG = `
  <defs>
    <filter id="sh" x="-20%" y="-20%" width="140%" height="150%">
      <feDropShadow dx="0" dy="1.6" stdDeviation="1.6" flood-color="#1e2944" flood-opacity=".28"/>
    </filter>
  </defs>
  <g filter="url(#sh)">
    <path d="M34 37.5a2.5 2.5 0 0 1 2.5-2.5h11.2l3 3.4H72a2.5 2.5 0 0 1 2.5 2.5V74a2.5 2.5 0 0 1-2.5 2.5H36.5A2.5 2.5 0 0 1 34 74z" fill="#c9b17f"/>
    <g transform="rotate(-5 54 56)">
      <rect x="38.5" y="38" width="32" height="34" rx="1.6" fill="#f8f9f4"/>
      <path d="M38.5 44.2h32" stroke="#bd3a2c" stroke-width=".8" stroke-opacity=".7"/>
      <path d="M41 49.5h27M41 54.5h27M41 59.5h27M41 64.5h27" stroke="#c6d2cb" stroke-width=".7"/>
      <path d="M42 48.6c2-1.2 3.4 1 5.2-.2s3-1.3 4.6-.1 3 .4 4.5-.6M42 53.6c1.7-1 3.3.8 5-.3s3.4-1 4.9 0 2.6.3 4-.5 2.4-.6 3.6.1" fill="none" stroke="#24408e" stroke-width="1" stroke-linecap="round"/>
      <path d="M42 58.6c1.6-.9 3 .7 4.4-.2s2.8-.6 4.1.2" fill="none" stroke="#24408e" stroke-width="1" stroke-linecap="round"/>
    </g>
    <path d="M33 58.5h42.4l-1.6 16.4a2.4 2.4 0 0 1-2.4 2.1H37a2.4 2.4 0 0 1-2.4-2.1z" fill="#dcc79c"/>
    <path d="M33 58.5h42.4" stroke="#b89f72" stroke-width=".8"/>
  </g>
  <g transform="rotate(-14 64.5 64.5)" opacity=".94">
    <circle cx="64.5" cy="64.5" r="11.4" fill="#f4f0fb" fill-opacity=".55" stroke="#5b3fa8" stroke-width="2.1"/>
    <circle cx="64.5" cy="64.5" r="8.4" fill="none" stroke="#5b3fa8" stroke-width=".7"/>
    <text x="64.5" y="69.6" text-anchor="middle" font-family="Oranienbaum" font-size="14.5" fill="#5b3fa8">А</text>
  </g>`;

/* Монохромная версия для «тематических» иконок Android 13+: только печать. */
const MONO = `
  <g transform="rotate(-14 54 54)">
    <circle cx="54" cy="54" r="21" fill="none" stroke="#fff" stroke-width="3.6"/>
    <circle cx="54" cy="54" r="15.6" fill="none" stroke="#fff" stroke-width="1.3"/>
    <text x="54" y="63.4" text-anchor="middle" font-family="Oranienbaum" font-size="27" fill="#fff">А</text>
  </g>`;

const svg = (body, vb, round) => {
  const [x, y, w] = vb;
  const clip = round ? `<clipPath id="r"><rect x="${x}" y="${y}" width="${w}" height="${w}" rx="${(w * round).toFixed(2)}"/></clipPath>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.join(' ')}">${clip}<g${round ? ' clip-path="url(#r)"' : ''}>${body}</g></svg>`;
};

const jobs = [];
const res = path.join(root, 'android/app/src/main/res');
const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [d, k] of Object.entries(dens)) {
  const dir = path.join(res, 'mipmap-' + d);
  jobs.push({ file: path.join(dir, 'ic_launcher_foreground.png'), size: 108 * k, svg: svg(FG, [0, 0, 108, 108]) });
  jobs.push({ file: path.join(dir, 'ic_launcher_background.png'), size: 108 * k, svg: svg(BG, [0, 0, 108, 108]) });
  jobs.push({ file: path.join(dir, 'ic_launcher_monochrome.png'), size: 108 * k, svg: svg(MONO, [0, 0, 108, 108]) });
  // Обычная иконка для Android 7: видимая часть 72×72 со скруглением
  jobs.push({ file: path.join(dir, 'ic_launcher.png'), size: 48 * k, svg: svg(BG + FG, [18, 18, 72, 72], 0.2) });
  jobs.push({ file: path.join(dir, 'ic_launcher_round.png'), size: 48 * k, svg: svg(BG + FG, [18, 18, 72, 72], 0.5) });
}
const web = path.join(root, 'assets/icons');
jobs.push({ file: path.join(web, 'icon-192.png'), size: 192, svg: svg(BG + FG, [18, 18, 72, 72], 0.2) });
jobs.push({ file: path.join(web, 'icon-512.png'), size: 512, svg: svg(BG + FG, [18, 18, 72, 72], 0.2) });
jobs.push({ file: path.join(web, 'maskable-512.png'), size: 512, svg: svg(BG + FG, [9, 9, 90, 90]) });
jobs.push({ file: path.join(web, 'apple-touch-icon.png'), size: 180, svg: svg(BG + FG, [16, 16, 76, 76]) });
jobs.push({ file: path.join(web, 'favicon-32.png'), size: 32, svg: svg(BG + FG, [20, 20, 68, 68], 0.22) });
jobs.push({ file: path.join(root, 'assets/icons/preview.png'), size: 512, svg: svg(BG + FG, [18, 18, 72, 72], 0.5) });

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const j of jobs) {
    fs.mkdirSync(path.dirname(j.file), { recursive: true });
    await page.setViewportSize({ width: j.size, height: j.size });
    await page.setContent(
      `<!doctype html><style>@font-face{font-family:Oranienbaum;src:url(${fontUrl})}html,body{margin:0;background:transparent}svg{display:block;width:${j.size}px;height:${j.size}px}</style>${j.svg}`
    );
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(30);
    await page.screenshot({ path: j.file, omitBackground: true, clip: { x: 0, y: 0, width: j.size, height: j.size } });
  }
  await browser.close();
  console.log('Иконок:', jobs.length);
})();
