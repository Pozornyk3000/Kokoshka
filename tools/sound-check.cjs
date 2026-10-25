#!/usr/bin/env node
/* Проверка фонового звука в headless Chromium: каждое настроение рендерится офлайн (уровни без перегруза
   и не тишина), затем звук включается касанием, выключается кнопкой и замолкает в фоне.
   NODE_PATH=/opt/node22/lib/node_modules node tools/sound-check.cjs docs/index.html */
const path = require('path');
let pw;
try {
  pw = require('playwright');
} catch (e) {
  pw = require('playwright-core');
}

(async () => {
  const file = process.argv[2] || 'docs/index.html';
  const browser = await pw.chromium.launch({ args: ['--autoplay-policy=user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  const fail = (m) => errors.push(m);
  page.on('pageerror', (e) => fail('pageerror: ' + e.message));
  await page.goto('file://' + path.resolve(file));
  await page.waitForFunction(() => window.A && window.A.sound && document.querySelector('[data-act]'));

  // 1. Настроения офлайн: не тишина, без перегруза
  const moods = [
    { key: 'title' },
    { key: 'home', purr: true },
    { key: 'home', night: true, rain: true },
    { key: 'uni' },
    { key: 'clinic', night: true },
    { key: 'street', wind: true },
    { key: 'exam' },
  ];
  for (const m of moods) {
    const r = await page.evaluate((m) => window.A.sound.renderTest(12, m), m);
    const name = JSON.stringify(m);
    if (!r) {
      fail('нет OfflineAudioContext');
      break;
    }
    console.log('настроение', name, 'пик', r.peak, 'RMS', r.rms);
    if (r.peak >= 0.99) fail('перегруз в ' + name + ': пик ' + r.peak);
    if (r.rms < 0.004) fail('почти тишина в ' + name + ': RMS ' + r.rms);
    if (r.rms > 0.25) fail('слишком громко в ' + name + ': RMS ' + r.rms);
  }

  // 2. До касания звук не запущен (политика автозапуска), после касания — играет
  let st = await page.evaluate(() => window.A.sound.status());
  if (st.state === 'running') fail('звук заиграл без касания');
  await page.click('[data-act="about"]');
  await page.waitForTimeout(1500);
  st = await page.evaluate(() => window.A.sound.status());
  console.log('после касания:', JSON.stringify(st));
  if (st.state !== 'running') fail('после касания звук не запустился: ' + st.state);
  if (st.mood !== 'title') fail('на титуле настроение не «title»: ' + st.mood);
  await page.click('[data-act="about-back"]');

  // 3. Кнопка на титуле выключает и включает
  await page.click('[data-act="sound-toggle"]');
  await page.waitForTimeout(1200);
  st = await page.evaluate(() => window.A.sound.status());
  if (st.enabled || st.state === 'running') fail('кнопка не выключила звук: ' + JSON.stringify(st));
  await page.click('[data-act="sound-toggle"]');
  await page.waitForTimeout(800);
  st = await page.evaluate(() => window.A.sound.status());
  if (!st.enabled || st.state !== 'running') fail('кнопка не включила звук: ' + JSON.stringify(st));

  // 4. Фон: пауза и возврат (как onPause/onResume в приложении)
  await page.evaluate(() => window.A.sound.pause());
  await page.waitForTimeout(1200);
  st = await page.evaluate(() => window.A.sound.status());
  if (st.state === 'running') fail('в фоне звук не замолк');
  await page.evaluate(() => window.A.sound.resume());
  await page.waitForTimeout(600);
  st = await page.evaluate(() => window.A.sound.status());
  if (st.state !== 'running') fail('после возврата звук не продолжился');

  // 5. В игре настроение следует за местом: новая игра → пролог дома
  await page.click('[data-act="new"]');
  if (await page.$('[data-act="confirm-yes"]')) await page.click('[data-act="confirm-yes"]');
  await page.click('[data-act="mode-pick"][data-arg="full"]');
  await page.click('[data-act="cr-start"]');
  await page.waitForTimeout(900);
  st = await page.evaluate(() => window.A.sound.status());
  console.log('в прологе:', st.mood);
  if (st.mood !== 'home') fail('в прологе дома настроение не «home»: ' + st.mood);
  for (let i = 0; i < 4 && (await page.evaluate(() => !!window.A.state.activity)); i++) await page.click('[data-act="step-next"]');
  await page.click('[data-act="tab"][data-arg="menu"]');
  const vol = await page.$('#sound-vol');
  if (!vol) fail('в меню нет регулятора громкости');
  else {
    await vol.fill('30');
    const v = await page.evaluate(() => window.A.sound.volume());
    if (Math.abs(v - 0.3) > 0.01) fail('громкость не сохранилась: ' + v);
  }
  st = await page.evaluate(() => window.A.sound.status());
  if (st.error) fail('ошибка звука: ' + st.error);

  await browser.close();
  if (errors.length) {
    console.log('ОШИБКИ:');
    errors.forEach((e) => console.log(' - ' + e));
    process.exit(1);
  }
  console.log('Звук: все проверки пройдены.');
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
