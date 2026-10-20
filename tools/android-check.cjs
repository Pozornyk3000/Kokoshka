#!/usr/bin/env node
/* Маленький помощник для проверки на эмуляторе: подключается через adb к WebView отладочной
   сборки (режим Playwright для Android) и выполняет команду.
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
const PKG = process.env.PKG || 'io.github.pozornyk3000.anamnez';

(async () => {
  const devices = await pw._android.devices({ omitDriverInstall: true });
  if (!devices.length) throw new Error('adb не видит ни одного устройства');
  const device = devices[0];
  const webview = await device.webView({ pkg: PKG }, { timeout: 45000 });
  const page = await webview.page();
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
  await device.close().catch(() => {});
  process.exit(0);
})().catch((e) => {
  console.error('android-check:', e.message);
  process.exit(1);
});
