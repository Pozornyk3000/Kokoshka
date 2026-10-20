#!/usr/bin/env node
/* Проверка связки игры с приложением Android без эмулятора: в обычном Chromium подставляется
   заглушка window.AnamnezAndroid с тем же набором методов, что у MainActivity.Bridge.
   NODE_PATH=/opt/node22/lib/node_modules node tools/bridge-test.cjs <site/index.html> */
const path = require('path');
let pw;
try {
  pw = require('playwright');
} catch (e) {
  pw = require('playwright-core');
}

const target = process.argv[2];
if (!target) {
  console.error('Укажите index.html собранного сайта');
  process.exit(2);
}
const url = /^(https?|file):/.test(target) ? target : 'file://' + path.resolve(target);

/* Заглушка моста. Файлы приложения живут в window.name — он переживает перезагрузку страницы,
   а localStorage мы стираем, чтобы проверить, что игра читает именно «файлы». */
const MOCK = `
(function () {
  var files = {};
  try { files = JSON.parse(window.name || '{}'); } catch (e) { files = {}; }
  var persist = function () { window.name = JSON.stringify(files); };
  window.__bridgeLog = [];
  window.AnamnezAndroid = {
    storeSet: function (k, v) { window.__bridgeLog.push('set:' + k); files[k] = String(v); persist(); return true; },
    storeGet: function (k) { window.__bridgeLog.push('get:' + k); return Object.prototype.hasOwnProperty.call(files, k) ? files[k] : null; },
    storeRemove: function (k) { window.__bridgeLog.push('rm:' + k); delete files[k]; persist(); },
    copyText: function (t) { window.__copied = t; return true; },
    shareText: function (t) { window.__shared = t; },
    version: function () { return '1.0.test'; }
  };
})();`;

(async () => {
  const browser = await pw.chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  const fail = (m) => errors.push(m);
  page.on('pageerror', (e) => fail('pageerror: ' + e.message));
  await page.addInitScript(MOCK);
  await page.goto(url);
  await page.waitForFunction(() => window.A && window.A.ui && document.querySelector('[data-act]'));
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const click = (sel) => page.click(sel, { timeout: 5000 });

  // Новая игра → сохранение уходит в «файлы» приложения
  await click('[data-act="new"]');
  if (await page.$('[data-act="confirm-yes"]')) await click('[data-act="confirm-yes"]');
  // «Назад» с экрана создания персонажа возвращает на титул
  if (!(await ev(() => window.A.ui.back()))) fail('back() на экране создания вернул false');
  if (await ev(() => window.A.ui.view.screen)) fail('back() не закрыл экран создания');
  await click('[data-act="new"]');
  if (await page.$('[data-act="confirm-yes"]')) await click('[data-act="confirm-yes"]');
  await click('[data-act="cr-start"]');
  const log1 = await ev(() => window.__bridgeLog.slice());
  if (!log1.includes('set:anamnez.save.v1')) fail('сохранение не записано через мост: ' + log1.join(','));

  // Пролог: проходим сюжетные шаги, пока не окажемся на экране дня
  for (let i = 0; i < 20 && (await ev(() => !!window.A.state.activity)); i++) {
    if (!(await ev(() => window.A.ui.back() === false))) fail('back() во время сюжета должен возвращать false');
    const b = await page.$('[data-act="step-next"], [data-act="ev-choice"]');
    if (!b) break;
    await b.click();
  }
  if (await ev(() => !!window.A.state.activity)) fail('не дошли до экрана дня');

  // «Назад»: вкладка → экран дня → свернуть приложение (false)
  await click('[data-act="tab"][data-arg="menu"]');
  if (!(await ev(() => window.A.ui.back()))) fail('back() на вкладке меню вернул false');
  if ((await ev(() => window.A.ui.view.tab)) !== 'hub') fail('back() не вернул на экран дня');
  if (await ev(() => window.A.ui.back())) fail('back() на экране дня должен вернуть false');

  // Окно выбора закрывается «назад»
  const pickId = await ev(() => {
    const A = window.A;
    const a = A.actions.list.find((x) => x.pick && !A.game.status(A.state, x).hidden && !A.game.status(A.state, x).disabled);
    return a ? a.id : null;
  });
  if (pickId) {
    await ev((id) => {
      window.A.ui.view.picker = id;
      window.A.ui.render();
    }, pickId);
    if (!(await ev(() => window.A.ui.back())) || (await page.$('.sheet'))) fail('back() не закрыл окно выбора');
  }

  // Меню: код сохранения копируется через мост, «Отправить код» есть, текст про телефон
  await click('[data-act="tab"][data-arg="menu"]');
  const menuText = await page.textContent('main');
  if (!/в приложении на этом телефоне/.test(menuText)) fail('в меню нет текста про сохранение на телефоне');
  await click('[data-act="export"]');
  const copied = await ev(() => window.__copied || '');
  if (!copied.startsWith('ANM1.')) fail('код сохранения не скопирован через мост: ' + copied.slice(0, 20));
  if (!(await page.$('[data-act="share-code"]'))) fail('нет кнопки «Отправить код»');
  await click('[data-act="share-code"]');
  if (!(await ev(() => (window.__shared || '').startsWith('ANM1.')))) fail('«Отправить код» не передал код в приложение');

  // Версия приложения на экране «Об игре»
  await click('[data-act="about"]');
  if (!/Версия приложения 1\.0\.test/.test(await page.textContent('main'))) fail('нет версии приложения в «Об игре»');
  if (!(await ev(() => window.A.ui.back()))) fail('back() не закрыл «Об игре»');

  // Перезагрузка со стёртым localStorage: игра поднимает сохранение из «файлов»
  const day = await ev(() => window.A.state.day * 4 + window.A.state.slot);
  await ev(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => window.A && window.A.ui && document.querySelector('[data-act]'));
  const boot = await ev(() => (window.A.boot.save ? window.A.boot.save.day * 4 + window.A.boot.save.slot : null));
  if (boot !== day) fail(`после перезапуска сохранение не найдено в файлах (ждали ${day}, получили ${boot})`);
  if (!(await page.$('[data-act="continue"]'))) fail('на титуле нет «Продолжить»');

  // Без моста (обычный браузер) всё по-старому: localStorage и нет текста про телефон
  const plain = await browser.newPage();
  await plain.goto(url);
  await plain.waitForFunction(() => window.A && window.A.ui && document.querySelector('[data-act]'));
  if (await plain.evaluate(() => !!window.AnamnezAndroid)) fail('мост появился без приложения');

  await browser.close();
  if (errors.length) {
    console.log('ОШИБКИ:\n - ' + errors.join('\n - '));
    process.exit(1);
  }
  console.log('Мост Android: все проверки пройдены.');
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
