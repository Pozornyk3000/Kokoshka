#!/usr/bin/env node
/* Проверка тренажёра и уровней сложности в headless Chromium: тест «как на аккредитации», тест по теме, работа над ошибками,
   задачи «диагноз по МКБ-10» с поиском по полному списку, кнопка «назад», вход из меню игры и смена сложности.
   NODE_PATH=/opt/node22/lib/node_modules node tools/trainer-check.cjs docs/index.html */
const path = require('path');
let pw;
try {
  pw = require('playwright');
} catch (e) {
  pw = require('playwright-core');
}

const file = path.resolve(process.argv[2] || 'index.html');
const fails = [];
const ok = (cond, msg) => {
  if (!cond) fails.push(msg);
  console.log((cond ? '  ✓ ' : '  ✗ ') + msg);
};

(async () => {
  const browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => m.type() === 'error' && !/ERR_FILE_NOT_FOUND|Failed to load resource/.test(m.text()) && errors.push('console: ' + m.text()));
  await page.goto('file://' + file);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('[data-act="tr-open"]');

  const sel = (act, arg) => '[data-act="' + act + '"]' + (arg != null ? '[data-arg="' + arg + '"]' : '');
  const click = async (act, arg) => {
    const el = page.locator(sel(act, arg)).first();
    await el.scrollIntoViewIfNeeded();
    await el.click();
  };
  const run = () => page.evaluate(() => {
    const r = A.ui.view.trainer && A.ui.view.trainer.run;
    return r ? { kind: r.kind, i: r.i, n: r.refs.length, done: r.done, pct: r.pct, right: r.right, shown: r.shown } : null;
  });
  const okIndex = () => page.evaluate(() => {
    const r = A.ui.view.trainer.run;
    return A.trainer.question(r.refs[r.i]).ok;
  });
  const has = (css) => page.locator(css).count().then((n) => n > 0);

  console.log('Титул → тренажёр');
  await click('tr-open', 'title');
  ok(await has('.trainer'), 'экран тренажёра открылся с титула');
  const total = await page.evaluate(() => A.trainer.bank().length);
  ok(total >= 180, 'в банке ' + total + ' вопросов');
  const off = await page.evaluate(() => [...document.querySelectorAll('.card.official a.btn')].map((a) => ({ href: a.href, target: a.target })));
  ok(off.length === 2 && off[0].href.startsWith('https://selftest.mededtech.ru') && off.every((x) => x.target === '_blank'), 'ссылка на официальный репетиционный экзамен открывается в новой вкладке');
  ok(await page.evaluate(() => /не настоящие задания аккредитации/.test(document.querySelector('.trainer').textContent)), 'приписка: тесты игры — не настоящие задания аккредитации');
  ok(await has('[data-act="tr-start"][data-arg="accr80"]'), 'полный тест — 80 вопросов, как на настоящем тестировании');
  const topics = await page.evaluate(() => A.data.domainKeys.map((k) => [k, A.trainer.topicCount(k)]));
  ok(topics.every(([, n]) => n >= 10), 'в каждой теме не меньше 10 вопросов: ' + topics.map(([k, n]) => k + ' ' + n).join(', '));

  console.log('Тест в формате аккредитации, 20 вопросов: 10 верно, 10 неверно');
  await click('tr-start', 'accr20');
  let r = await run();
  ok(r && r.kind === 'accr20' && r.n === 20, 'прогон начат, 20 вопросов');
  const seenTopics = await page.evaluate(() => new Set(A.ui.view.trainer.run.refs.map((ref) => A.trainer.bank().find((x) => x.ref === ref).topic)).size);
  ok(seenTopics === 10, 'вопросы из всех 10 тем (' + seenTopics + ')');
  for (let i = 0; i < 20; i++) {
    const k = await okIndex();
    const pick = i % 2 === 0 ? k : (k + 1) % 4;
    await click('tr-pick', pick);
    if (i === 0) ok(!(await has('.feedback')), 'в режиме экзамена объяснение не показывается сразу');
    await click('tr-next');
  }
  r = await run();
  ok(r.done && r.pct === 50, 'итог 50% (' + r.pct + '%)');
  ok(await has('.result-card .stamp.bad'), 'штамп «не сдано»');
  ok(await page.evaluate(() => /не официальная аккредитация/.test(document.querySelector('.result-card').textContent)), 'в итогах — приписка, что это не официальная аккредитация');
  ok((await page.locator('.review .marks li').count()) === 10, 'в разборе 10 ошибок');
  let wrong = await page.evaluate(() => A.trainer.wrongRefs().length);
  ok(wrong === 10, 'в работе над ошибками 10 вопросов');
  ok(await page.evaluate(() => A.trainer.stats().best.accr20 === 50), 'лучший результат сохранён');

  console.log('«Ещё раз» и «Прервать»');
  await click('tr-again');
  r = await run();
  ok(r && !r.done && r.i === 0, 'новый прогон начат');
  await click('tr-quit');
  await click('confirm-yes');
  ok((await run()) === null && (await has('[data-act="tr-start"][data-arg="accr20"]')), 'прогон прерван, снова главный экран тренажёра');

  console.log('Тест по теме: детская психиатрия, все ответы верные');
  await click('tr-topic', 'child');
  await click('tr-start', 'topic');
  r = await run();
  ok(r && r.kind === 'topic' && r.n === 10, 'тест по теме, 10 вопросов');
  const allChild = await page.evaluate(() => A.ui.view.trainer.run.refs.every((ref) => A.trainer.bank().find((x) => x.ref === ref).topic === 'child'));
  ok(allChild, 'все вопросы по выбранной теме');
  for (let i = 0; i < 10; i++) {
    await click('tr-pick', await okIndex());
    if (i === 0) ok(await has('.feedback.ok'), 'после ответа сразу видно объяснение');
    await click('tr-next');
  }
  r = await run();
  ok(r.done && r.pct === 100 && (await has('.result-card .stamp:not(.bad)')), 'итог 100%');
  await click('tr-home');

  console.log('Работа над ошибками');
  // тест по теме мог уже «исправить» часть ошибок, если вопросы совпали
  const left = await page.evaluate(() => A.trainer.wrongRefs().length);
  await click('tr-start', 'mistakes');
  r = await run();
  ok(r && left > 0 && r.n === Math.min(15, left), 'повтор вопросов с ошибками: ' + (r && r.n));
  for (let i = 0; i < r.n; i++) {
    await click('tr-pick', await okIndex());
    await click('tr-next');
  }
  wrong = await page.evaluate(() => A.trainer.wrongRefs().length);
  ok(wrong === 0, 'после верных ответов список ошибок пуст');
  await click('tr-home');
  ok(await has('[data-act="tr-start"][data-arg="mistakes"][aria-disabled="true"]'), 'кнопка повтора ошибок неактивна');

  console.log('Диагноз по МКБ-10: поиск по полному списку');
  await click('tr-start', 'dx');
  r = await run();
  ok(r && r.kind === 'dx' && r.n === 8, '8 задач');
  ok(await has('#icd-q'), 'поле поиска по МКБ-10');
  ok(await has('[data-act="tr-dx"][aria-disabled="true"]'), '«Ответить» неактивна, пока диагноз не выбран');
  let half = false;
  for (let i = 0; i < 8; i++) {
    const t = await page.evaluate(() => {
      const c = A.trainer.dxTask(A.ui.view.trainer.run.refs[A.ui.view.trainer.run.i]);
      const right = c.dx.opts.find((o) => o.ok);
      const e = A.icd.entryFor(right.t);
      // соседняя запись той же рубрики — для проверки «половины балла»
      const sib = A.data.icd.find((x) => x.k !== e.k && x.c.slice(0, 3) === e.c.slice(0, 3) && x.c[0] === 'F' && !c.dx.opts.some((o) => (A.icd.entryFor(o.t) || {}).k === x.k));
      return { k: e.k, c: e.c, sib: sib ? { k: sib.k, c: sib.c } : null };
    });
    const target = !half && t.sib ? t.sib : t;
    await page.fill('#icd-q', target.c);
    await page.waitForSelector(sel('tr-icd', target.k));
    await click('tr-icd', target.k);
    ok(await has('.icd-sel'), 'задача ' + (i + 1) + ': выбран ' + target.c);
    await click('tr-dx');
    if (target !== t) {
      half = true;
      ok(await page.locator('.feedback').first().textContent().then((x) => /Частично/.test(x)), 'та же рубрика с другим уточнением — «частично верно»');
    } else ok(await has('.feedback.ok'), 'верный диагноз засчитан');
    await click('tr-next');
  }
  r = await run();
  ok(r.done && r.pct === (half ? 94 : 100), 'итог ' + r.pct + '%');
  await click('tr-home');

  console.log('Разделы МКБ и «назад»');
  await click('tr-start', 'dx');
  await click('icd-block', 'F3');
  const n3 = await page.locator('.icd-item').count();
  ok(n3 > 10 && (await page.locator('.icd-item').first().textContent()).includes('F3'), 'раздел F30–F39: ' + n3 + ' рубрик');
  await page.fill('#icd-q', 'паническ');
  await page.waitForFunction(() => document.querySelectorAll('.icd-item').length === 0 || [...document.querySelectorAll('.icd-item')].every((x) => /паническ/i.test(x.textContent)));
  ok((await page.locator('.icd-item').count()) === 0, 'в разделе F3 ничего «панического» нет');
  await click('icd-block', 'F3');
  await page.waitForSelector('.icd-item');
  ok(/F41\.0/.test(await page.locator('#icd-list').textContent()), 'без раздела «паническ» находит F41.0');
  await page.evaluate(() => A.ui.back());
  ok((await run()) === null, '«назад» во время задачи — к экрану тренажёра');
  await page.evaluate(() => A.ui.back());
  ok(!(await has('.trainer')) && (await has('[data-act="tr-open"][data-arg="title"]')), '«назад» с экрана тренажёра — на титул');

  console.log('Новая игра на сложном уровне, тренажёр из меню');
  await click('new');
  await click('mode-pick', 'full');
  await click('cr-diff', 'hard');
  ok(await has('[data-act="cr-diff"][data-arg="hard"][aria-pressed="true"]'), 'выбран сложный уровень');
  await click('cr-start');
  ok(await page.evaluate(() => A.state.difficulty === 'hard' && A.game.hard(A.state)), 'игра начата на сложном уровне');
  // пролог: две сюжетные сцены
  for (let i = 0; i < 6 && (await page.evaluate(() => !!A.state.activity)); i++) await click('step-next');
  ok(await page.evaluate(() => !A.state.activity), 'пролог пройден');
  await click('tab', 'menu');
  await click('tr-open', 'game');
  ok(await has('.trainer'), 'тренажёр открылся из меню');
  await click('tr-exit');
  ok(await page.evaluate(() => A.ui.view.tab === 'menu' && !A.ui.view.screen), 'выход из тренажёра — обратно в меню');
  await click('set-diff', 'easy');
  ok(await page.evaluate(() => A.state.difficulty === 'easy'), 'сложность меняется в меню');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => /save/i.test(k)) || 'x') || 'null'));
  ok(!saved || saved.difficulty === 'easy' || (saved.state && saved.state.difficulty === 'easy'), 'сложность сохранена');

  ok(!errors.length, 'ошибок в консоли нет' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
  console.log(fails.length ? 'Провалено: ' + fails.length : 'Тренажёр в порядке.');
  process.exit(fails.length ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
