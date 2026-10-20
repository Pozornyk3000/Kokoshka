#!/usr/bin/env node
/* Маленький помощник для проверки на эмуляторе: подключается к WebView отладочной сборки
   через DevTools (adb forward tcp:9222 localabstract:webview_devtools_remote_<pid>) и выполняет команду.
   node tools/android-check.cjs info              — сведения о странице (JSON)
   node tools/android-check.cjs eval "<выражение>" — значение выражения
   node tools/android-check.cjs click "<селектор>" — нажать на элемент */
let pw;
try {
  pw = require('playwright');
} catch (e) {
  pw = require('playwright-core');
}
const [cmd, arg] = process.argv.slice(2);
const endpoint = process.env.CDP || 'http://127.0.0.1:9222';

(async () => {
  const browser = await pw.chromium.connectOverCDP(endpoint, { timeout: 30000 });
  let page = null;
  for (let i = 0; i < 30 && !page; i++) {
    const pages = browser.contexts().flatMap((c) => c.pages());
    page = pages.find((p) => /appassets\.androidplatform\.net/.test(p.url())) || null;
    if (!page) await new Promise((r) => setTimeout(r, 500));
  }
  if (!page) throw new Error('Страница игры не найдена');
  await page.waitForFunction(() => window.A && window.A.ui && document.querySelector('[data-act]'), null, { timeout: 30000 });
  let out;
  if (cmd === 'info') {
    out = await page.evaluate(async () => {
      await document.fonts.ready;
      let ls;
      try {
        localStorage.setItem('anamnez.probe', '1');
        ls = localStorage.getItem('anamnez.probe') === '1';
        localStorage.removeItem('anamnez.probe');
      } catch (e) {
        ls = String(e);
      }
      const app = window.AnamnezAndroid;
      return {
        url: location.href,
        ua: navigator.userAgent,
        viewport: [innerWidth, innerHeight, devicePixelRatio],
        dark: matchMedia('(prefers-color-scheme: dark)').matches,
        bridge: app ? Object.keys(app).length || 'object' : false,
        version: app && app.version ? app.version() : null,
        localStorage: ls,
        fontsLoaded: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/"/g, '') + ' ' + f.weight),
        displayFont: document.fonts.check('20px Oranienbaum', 'Анамнез'),
        textFont: document.fonts.check('16px "Golos Text"', 'Анамнез'),
        serviceWorker: !!(navigator.serviceWorker && navigator.serviceWorker.controller),
      };
    });
  } else if (cmd === 'eval') {
    out = await page.evaluate(arg);
  } else if (cmd === 'click') {
    await page.click(arg, { timeout: 10000 });
    await page.waitForTimeout(300);
    out = true;
  } else {
    throw new Error('Неизвестная команда: ' + cmd);
  }
  console.log(typeof out === 'string' ? out : JSON.stringify(out));
  process.exit(0);
})().catch((e) => {
  console.error('android-check:', e.message);
  process.exit(1);
});
