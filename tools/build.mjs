#!/usr/bin/env node
/* Сборка.
   node tools/build.mjs                 → dist/anamnez.html (один файл, шрифты внутри — работает без интернета)
                                          и dist/artifact.html (фрагмент для публикации в Claude)
   node tools/build.mjs --out DIR       → то же, но в DIR
   node tools/build.mjs --site DIR      → сайт-приложение (PWA): index.html, шрифты, иконки, манифест,
                                          service worker. Им же наполняется APK (android/app/src/main/assets/www). */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const flag = (n) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : null);
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const kb = (n) => (n / 1024).toFixed(0) + ' КБ';

const html = read('index.html');
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
const missing = scripts.filter((s) => !fs.existsSync(path.join(root, s)));
if (missing.length) {
  console.error('Нет файлов:', missing.join(', '));
  process.exit(1);
}
const js = scripts.map((s) => `/* ${s} */\n` + read(s)).join('\n;\n').replace(/<\/script/gi, '<\\/script');
const css = read('css/style.css');

const fontLinks = [...html.matchAll(/<link rel="(?:preconnect|stylesheet)" href="https:\/\/fonts\.[^"]+"[^>]*>/g)].map((m) => m[0]).join('\n');
const title = (html.match(/<title>[\s\S]*?<\/title>/) || ['<title>Анамнез</title>'])[0];
const desc = (html.match(/<meta name="description"[^>]*>/) || [''])[0];
const fit = '<meta name="claude:viewport-fit-sides" content="cover">';
const body = '<div id="app"><p style="padding:24px;font-family:sans-serif">Загрузка «Анамнеза»…</p></div>';

/* Запасной экран: если браузер слишком старый и игра не стартовала (ES5, чтобы сработал везде). */
const bootGuard = `<script>
(function () {
  var err = '';
  window.addEventListener('error', function (e) { if (!err && e && e.message) err = String(e.message); });
  setTimeout(function () {
    if (window.A && window.A.ui && window.A.ui.render) return;
    var el = document.getElementById('app');
    if (!el) return;
    el.innerHTML = '<div style="padding:24px;font-family:sans-serif;line-height:1.5;max-width:560px">' +
      '<p><b>Игра не запустилась.</b></p>' +
      '<p>Похоже, браузер устарел. Обновите Chrome (на Android — ещё и «Android System WebView» в Google Play) и откройте игру снова.</p>' +
      (err ? '<p style="opacity:.6;font-size:13px">' + err.replace(/[<>&]/g, '') + '</p>' : '') + '</div>';
  }, 9000);
})();
</script>`;

/* ---------- Шрифты из assets/fonts (скачаны tools/fonts.mjs) ---------- */
const fontDir = path.join(root, 'assets/fonts');
const fontCss = fs.readFileSync(path.join(fontDir, 'fonts.css'), 'utf8');
const fontFiles = [...new Set([...fontCss.matchAll(/url\(([^)]+\.woff2)\)/g)].map((m) => m[1]))];
const fontCssInline = fontCss.replace(/url\(([^)]+\.woff2)\)/g, (m, f) => 'url(data:font/woff2;base64,' + fs.readFileSync(path.join(fontDir, f)).toString('base64') + ')');
const fontCssSite = fontCss.replace(/url\(([^)]+\.woff2)\)/g, 'url(fonts/$1)');

if (flag('--site')) buildSite(path.resolve(flag('--site')));
else buildSingle(flag('--out') ? path.resolve(flag('--out')) : path.join(root, 'dist'));

function buildSingle(outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const fragment = [title, fit, desc, fontLinks, `<style>\n${css}\n</style>`, body, `<script>\n${js}\n</script>`].join('\n');
  const standalone =
    `<!doctype html>\n<html lang="ru">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n${title}\n${desc}\n` +
    `<style>\n${fontCssInline}\n</style>\n<style>\n${css}\n</style>\n</head>\n<body>\n${body}\n${bootGuard}\n<script>\n${js}\n</script>\n</body>\n</html>\n`;
  fs.writeFileSync(path.join(outDir, 'artifact.html'), fragment);
  fs.writeFileSync(path.join(outDir, 'anamnez.html'), standalone);
  console.log(`Собрано: ${scripts.length} скриптов. anamnez.html ${kb(Buffer.byteLength(standalone))}, artifact.html ${kb(Buffer.byteLength(fragment))} → ${outDir}`);
}

function buildSite(outDir) {
  // Каталог пересобирается целиком, чтобы не оставалось устаревших файлов
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(outDir, 'fonts'), { recursive: true });
  fs.mkdirSync(path.join(outDir, 'icons'), { recursive: true });

  for (const f of fontFiles) fs.copyFileSync(path.join(fontDir, f), path.join(outDir, 'fonts', f));
  for (const f of fs.readdirSync(fontDir).filter((f) => /^OFL.*\.txt$/.test(f))) fs.copyFileSync(path.join(fontDir, f), path.join(outDir, 'fonts', f));
  const icons = ['icon-192.png', 'icon-512.png', 'maskable-512.png', 'apple-touch-icon.png', 'favicon-32.png'];
  for (const f of icons) fs.copyFileSync(path.join(root, 'assets/icons', f), path.join(outDir, 'icons', f));

  const descText = (desc.match(/content="([^"]*)"/) || [, ''])[1];
  const manifest = {
    name: 'Анамнез — симулятор ординатора-психиатра',
    short_name: 'Анамнез',
    description: descText,
    lang: 'ru',
    id: './',
    start_url: './',
    scope: './',
    display: 'standalone',
    background_color: '#dce5de',
    theme_color: '#f8f9f4',
    icons: [
      { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
  fs.writeFileSync(path.join(outDir, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2) + '\n');

  // В приложении Android service worker не нужен: файлы и так лежат внутри APK
  const swReg = `<script>
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost') && !window.AnamnezAndroid) {
  window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
}
</script>`;
  const index =
    `<!doctype html>\n<html lang="ru">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n${title}\n${desc}\n` +
    `<meta name="theme-color" content="#f8f9f4" media="(prefers-color-scheme: light)">\n<meta name="theme-color" content="#16201d" media="(prefers-color-scheme: dark)">\n` +
    `<meta name="mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="apple-mobile-web-app-title" content="Анамнез">\n` +
    `<link rel="manifest" href="manifest.webmanifest">\n<link rel="icon" type="image/png" sizes="32x32" href="icons/favicon-32.png">\n<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">\n` +
    `<style>\n${fontCssSite}\n</style>\n<style>\n${css}\n</style>\n</head>\n<body>\n${body}\n${bootGuard}\n<script>\n${js}\n</script>\n${swReg}\n</body>\n</html>\n`;
  fs.writeFileSync(path.join(outDir, 'index.html'), index);

  // Service worker: всё для офлайна кладётся в кэш при установке; страница — «сначала сеть», чтобы обновления приходили сразу
  const files = ['./', 'index.html', 'manifest.webmanifest', ...icons.map((f) => 'icons/' + f), ...fontFiles.map((f) => 'fonts/' + f)];
  const hash = crypto.createHash('sha256');
  for (const f of files.slice(1)) hash.update(fs.readFileSync(path.join(outDir, f)));
  const version = hash.digest('hex').slice(0, 12);
  const sw = `/* Анамнез: офлайн-кэш. Сгенерировано tools/build.mjs. */
const CACHE = 'anamnez-${version}';
const FILES = ${JSON.stringify(files)};

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('anamnez-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function fromNetwork(req, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    fetch(req).then((r) => { clearTimeout(t); resolve(r); }, (e) => { clearTimeout(t); reject(e); });
  });
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(
      fromNetwork(req, 4000)
        .then((r) => {
          if (r.ok && (url.pathname.endsWith('/') || url.pathname.endsWith('/index.html'))) {
            const copy = r.clone();
            caches.open(CACHE).then((c) => c.put('index.html', copy));
          }
          return r;
        })
        .catch(() => caches.match('index.html'))
    );
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
});
`;
  fs.writeFileSync(path.join(outDir, 'sw.js'), sw);
  fs.writeFileSync(path.join(outDir, '.nojekyll'), '');
  const total = fs.readdirSync(outDir, { recursive: true }).reduce((n, f) => {
    const p = path.join(outDir, f);
    return n + (fs.statSync(p).isFile() ? fs.statSync(p).size : 0);
  }, 0);
  console.log(`Сайт собран: ${scripts.length} скриптов, index.html ${kb(Buffer.byteLength(index))}, всего ${kb(total)}, кэш ${version} → ${outDir}`);
}
