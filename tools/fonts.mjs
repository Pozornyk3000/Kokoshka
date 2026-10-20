#!/usr/bin/env node
/* Скачивает шрифты игры с Google Fonts в assets/fonts/, чтобы приложение и офлайн-версия
   работали без интернета. Запускать вручную, когда меняется набор шрифтов в index.html:
   node tools/fonts.mjs
   Все шрифты — под лицензией SIL Open Font License 1.1 (тексты лицензий — assets/fonts/OFL-*.txt). */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'assets', 'fonts');
fs.mkdirSync(outDir, { recursive: true });

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const m = html.match(/href="(https:\/\/fonts\.googleapis\.com\/css2\?[^"]+)"/);
if (!m) throw new Error('В index.html нет ссылки на Google Fonts');
const cssUrl = m[1].replace(/&amp;/g, '&');
const UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Mobile Safari/537.36';
const get = (url) => execFileSync('curl', ['-sSfL', '--max-time', '60', '-A', UA, url], { maxBuffer: 1 << 26 });

const KEEP = ['cyrillic-ext', 'cyrillic', 'latin-ext', 'latin'];
const css = get(cssUrl).toString('utf8');
const blocks = [...css.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*(@font-face\s*\{[^}]+\})/g)];
const files = new Map();
let out = '/* Шрифты игры (SIL OFL 1.1). Сгенерировано tools/fonts.mjs — не править вручную. */\n';
for (const [, subset, face] of blocks) {
  if (!KEEP.includes(subset)) continue;
  const family = face.match(/font-family:\s*'([^']+)'/)[1];
  const url = face.match(/url\((https:[^)]+\.woff2)\)/)[1];
  if (!files.has(url)) {
    const name = family.toLowerCase().replace(/\s+/g, '-') + '-' + subset + '.woff2';
    fs.writeFileSync(path.join(outDir, name), get(url));
    files.set(url, name);
  }
  out += face.replace(url, files.get(url)).replace(/\n\s*/g, ' ') + '\n';
}
fs.writeFileSync(path.join(outDir, 'fonts.css'), out);
const total = [...files.values()].reduce((n, f) => n + fs.statSync(path.join(outDir, f)).size, 0);
console.log(`Шрифтов: ${files.size} файлов, ${(total / 1024).toFixed(0)} КБ → ${path.relative(root, outDir)}/`);
