#!/usr/bin/env node
/* Сборка в один файл.
   node tools/build.mjs                 → dist/anamnez.html (самостоятельная страница) и dist/artifact.html (фрагмент для публикации)
   node tools/build.mjs --out DIR       → то же, но в DIR */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const outDir = argv.includes('--out') ? path.resolve(argv[argv.indexOf('--out') + 1]) : path.join(root, 'dist');
fs.mkdirSync(outDir, { recursive: true });

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

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

const fragment = [title, fit, desc, fontLinks, `<style>\n${css}\n</style>`, body, `<script>\n${js}\n</script>`].join('\n');
const standalone = `<!doctype html>\n<html lang="ru">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n${title}\n${fit}\n${desc}\n${fontLinks}\n<style>\n${css}\n</style>\n</head>\n<body>\n${body}\n<script>\n${js}\n</script>\n</body>\n</html>\n`;

fs.writeFileSync(path.join(outDir, 'artifact.html'), fragment);
fs.writeFileSync(path.join(outDir, 'anamnez.html'), standalone);
const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(0) + ' КБ';
console.log(`Собрано: ${scripts.length} скриптов. anamnez.html ${kb(standalone)}, artifact.html ${kb(fragment)} → ${outDir}`);
