#!/usr/bin/env node
/* Проверка тренажёра и уровней сложности в headless Chromium: тест «как на аккредитации», тест по теме, работа над ошибками,
   задачи «диагноз по МКБ-10» с поиском по полному списку, конструктор психического статуса (тренажёр, практикум на кафедре,
   первичный приём в ПНД), кнопка «назад», вход из меню игры и смена сложности.
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

  console.log('Уровни сложности и достижения');
  ok((await page.locator('[data-act="tr-lvl"]').count()) === 4, 'переключатель уровня: все, базовый, средний, сложный');
  await click('tr-lvl', 3);
  ok(await page.evaluate(() => A.trainer.stats().lvl === 3), 'выбранный уровень сохраняется');
  const hardChips = await page.evaluate(() => [...document.querySelectorAll('[data-act="tr-topic"]')].map((b) => +b.textContent.split('·').pop()));
  ok(hardChips.length === 10 && hardChips.every((n) => n >= 8), 'на сложном уровне в каждой теме не меньше 8 вопросов: ' + hardChips.join(', '));
  await click('tr-start', 'accr20');
  ok(await page.evaluate(() => { const r = A.ui.view.trainer.run; return r.lvl === 3 && r.refs.every((x) => A.trainer.refLevel(x) === 3); }), 'тест сложного уровня — только сложные вопросы');
  ok(await page.evaluate(() => /сложный уровень/.test(document.querySelector('.act-head').textContent)), 'в заголовке виден уровень');
  for (let i = 0; i < 20; i++) {
    await click('tr-pick', await okIndex());
    await click('tr-next');
  }
  r = await run();
  ok(r.done && r.pct === 100, 'сложный тест без ошибок: ' + r.pct + '%');
  const newAch = await page.evaluate(() => A.ui.view.trainer.run.newAch);
  ok(['pass20', 'hard_pass', 'hard_ace'].every((id) => newAch.indexOf(id) >= 0), 'новые достижения: ' + newAch.join(', '));
  ok(await has('.tr-ach-new .ach.got'), 'новые достижения показаны в итогах');
  ok(await page.evaluate(() => A.trainer.stats().best.accr20_l3 === 100), 'лучший результат сохранён отдельно для уровня');
  await click('tr-home');
  const got = await page.evaluate(() => A.trainer.achList().filter((a) => a.got).map((a) => a.id));
  ok(['first', 'topic_ace', 'streak10'].every((id) => got.indexOf(id) >= 0), 'достижения за прошлые тесты: ' + got.join(', '));
  ok(await page.evaluate((n) => new RegExp(n + ' из ').test(document.querySelector('.tr-achs .h2').textContent), got.length), 'карточка достижений: ' + got.length + ' из ' + (await page.evaluate(() => A.trainer.ACH.length)));
  // переход на официальный экзамен — тоже достижение (сам переход в тесте отменяем)
  await page.evaluate(() => window.addEventListener('click', (e) => e.preventDefault()));
  await page.locator('a[data-official]').click();
  await page.waitForTimeout(100);
  ok(await page.evaluate(() => !!A.trainer.stats().ach.official), 'достижение за переход на официальный экзамен');
  await click('tr-lvl', 1);
  const em1 = await page.evaluate(() => A.trainer.topicCount('emergency', 1));
  ok(em1 >= (await page.evaluate(() => A.trainer.MIN_TOPIC)), 'на базовом уровне тест по каждой теме доступен (неотложка — ' + em1 + ')');
  await click('tr-lvl', 0);

  console.log('Тест на время');
  await click('tr-timed');
  ok(await page.evaluate(() => A.trainer.stats().timed === true), 'режим «на время» включается и сохраняется');
  await click('tr-start', 'accr20');
  ok(await page.evaluate(() => { const r = A.ui.view.trainer.run; return r.limit === 20 * A.trainer.SEC_PER_Q * 1000; }), 'на 20 вопросов — 15 минут');
  ok(/^1[45]:\d\d$/.test(await page.locator('#tr-timer').textContent()), 'на экране идёт обратный отсчёт: ' + (await page.locator('#tr-timer').textContent()));
  await click('tr-pick', await okIndex());
  await click('tr-next');
  // «перематываем» время: срок истёк — прогон завершается сам
  await page.evaluate(() => (A.ui.view.trainer.run.deadline = Date.now() - 10));
  await page.waitForFunction(() => A.ui.view.trainer.run && A.ui.view.trainer.run.done, null, { timeout: 5000 });
  r = await run();
  ok(r.done && r.pct === 5, 'время вышло: неотвеченные вопросы засчитаны как неверные (' + r.pct + '%)');
  ok(await page.evaluate(() => /Время вышло/.test(document.querySelector('.result-card').textContent)), 'в итогах сказано, что время вышло');
  await click('tr-home');
  await click('tr-timed');
  ok(await page.evaluate(() => A.trainer.stats().timed === false), 'режим «на время» выключается');

  console.log('Конструктор психического статуса');
  const mse = () => page.evaluate(() => {
    const c = A.ui.mse.cur();
    return c ? { id: c.st.id, i: c.st.i, done: c.st.done, res: c.st.res, sel: c.st.secs.map((x) => x.sel.length), ach: c.st.newAch || null } : null;
  });
  // отметить в текущем разделе: верные формулировки и, если нужно, ловушку
  const mark = (withTrap) => page.evaluate((withTrap) => {
    const c = A.ui.mse.cur();
    return A.mse.items(c.st, c.st.i).map((o, k) => (o.k === 'ok' || (withTrap && o.k === 'trap') ? k : -1)).filter((k) => k >= 0);
  }, withTrap);
  // проверить раздел и перейти дальше (на последнем — к итогам)
  const advance = async (last) => {
    await click('mse-check');
    await click(last ? 'mse-done' : 'mse-next');
  };
  const nSc = await page.evaluate(() => A.mse.scenarios().length);
  ok(nSc >= 15 && (await page.locator('[data-act="tr-mse"]').count()) === nSc + 1, 'карточка конструктора: ' + nSc + ' пациентов и «случайный пациент»');
  await click('tr-mse', 'st_norm');
  let m = await mse();
  ok(m && m.id === 'st_norm' && m.i === 0 && m.sel.length === (await page.evaluate(() => A.mse.sections().length)), 'конструктор открылся: 11 разделов, первый — внешний вид');
  ok(await has('details.mse-mat[open] .mse-m'), 'на первом разделе материал приёма раскрыт');
  ok(await has('[data-act="mse-check"][aria-disabled="true"]'), '«Проверить» недоступно, пока ничего не отмечено');
  const nSec = m.sel.length;
  for (let i = 0; i < nSec; i++) {
    for (const k of await mark(i === 2)) await click('mse-tog', k);
    if (i === 1) {
      ok(!(await has('details.mse-mat[open]')), 'на следующих разделах материал свёрнут');
      ok(/Сознание ясное/.test(await page.locator('.mse-rec .record').textContent()), 'запись в карте собирается по ходу');
      await click('mse-prev');
      m = await mse();
      ok(m.i === 0 && m.sel[0] > 0 && (await has('.opt.correct[aria-disabled="true"]')), '«Назад» возвращает к проверенному разделу, отметки на месте');
      await click('mse-next');
    }
    if (i === 2) {
      await click('mse-check');
      ok((await has('.mse-verdict')) && (await has('.opt.wrong .opt-sub')) && /Ярлык/.test(await page.locator('.opt.wrong').first().textContent()), 'после «Проверить» — разбор раздела: ярлык отмечен и объяснён');
      const before = (await mse()).sel[2];
      await page.evaluate(() => { const b = document.querySelector('[data-act="mse-tog"]'); b && b.click(); });
      ok((await mse()).sel[2] === before, 'проверенный раздел изменить нельзя');
      await click('mse-next');
      continue;
    }
    if (i === 0) {
      await click('mse-check');
      ok((await has('.mse-verdict.ok')) && /Точно/.test(await page.locator('.mse-verdict').textContent()), 'верный раздел — «Точно»');
      await click('mse-next');
      continue;
    }
    await advance(i === nSec - 1);
  }
  m = await mse();
  ok(m.done && m.res.traps === 1 && m.res.pct < 100 && m.res.pct >= 85, 'статус с одним ярлыком: ' + m.res.pct + '%, ярлыков ' + m.res.traps);
  ok((await has('.mse-mine mark.mse-trap')) && /Ярлык:/.test(await page.locator('.review').textContent()), 'в разборе ярлык выделен и объяснён');
  ok(/Сознание ясное/.test(await page.locator('.record').last().textContent()) && (await has('.mse-memo')), 'образец статуса и памятка «Как писать статус»');
  ok(m.ach && m.ach.indexOf('mse_first') >= 0, 'достижение «Первая запись»');
  ok(await page.evaluate(() => A.trainer.stats().mse.st_norm === A.ui.view.trainer.mse.res.pct), 'лучший результат по пациенту сохранён');
  await click('mse-again');
  m = await mse();
  ok(m.id === 'st_norm' && !m.done && m.sel.every((n) => n === 0), '«Ещё раз» — тот же пациент с чистого листа');
  for (let i = 0; i < nSec; i++) {
    for (const k of await mark(false)) await click('mse-tog', k);
    await advance(i === nSec - 1);
  }
  m = await mse();
  ok(m.res.pct === 100 && m.ach.indexOf('mse_ace') >= 0, 'безошибочный статус — 100% и «Статус как в учебнике»');
  await click('mse-other');
  m = await mse();
  ok(m && m.id !== 'st_norm' && !m.done, '«Другой пациент»: ' + (m && m.id));
  await page.evaluate(() => A.ui.back());
  ok((await mse()) === null && (await has('.tr-mse')), '«назад» из конструктора — к экрану тренажёра');
  await click('tr-lvl', 3);
  ok((await page.locator('.tr-mse [data-act="tr-mse"][data-arg^="st_"]').count()) === (await page.evaluate(() => A.mse.list(3).length)), 'на сложном уровне — только сложные пациенты');
  await click('tr-mse', '');
  m = await mse();
  ok(m && (await page.evaluate((id) => A.mse.get(id).lvl, m.id)) === 3, 'случайный пациент выбранного уровня: ' + (m && m.id));
  await page.evaluate(() => A.ui.back());
  await click('tr-lvl', 0);

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

  console.log('Беседа на сложном уровне: время беседы и комментарий к каждому вопросу');
  await page.evaluate(() => {
    const s = A.state;
    s.energy = 80;
    s.stress = 20;
    s.slot = 1;
    s.flags.wokeTired = false;
    s.activity = { action: 'check', arg: null, steps: [{ type: 'case', id: 'c_depression', mode: 'seminar' }], i: 0, results: [], snap: null };
    A.ui.render({ scroll: 'top' });
  });
  const talk = () => page.evaluate(() => { const p = A.state.activity.steps[0].p; return { maxQ: p.maxQ, asked: p.asked.length, mods: p.qMods.map((x) => x.k), log: p.log.map((l) => (l.v ? l.v.lvl : '-') + (l.ev ? '+' + l.ev.lvl : '')) }; });
  let tk = await talk();
  ok(tk.maxQ === 4 && !tk.mods.length && (await has('.qbudget')), 'сложный уровень: база — 4 вопроса вместо 5, расклад виден');
  const tired = await page.evaluate(() => {
    const s = A.state;
    const e = s.energy;
    s.energy = 45;
    const a = A.cases.init(s, { id: 'c_depression', mode: 'seminar' }).maxQ;
    s.energy = 25;
    const b = A.cases.init(s, { id: 'c_depression', mode: 'seminar' }).maxQ;
    s.energy = e;
    return [a, b];
  });
  ok(tired[0] === 3 && tired[1] === 2, 'усталость отнимает вопросы: энергия 45 — ' + tired[0] + ', энергия 25 — ' + tired[1]);
  await click('cs-ask', 4);
  ok((await has('.qnote.ok')) && /Обязательный вопрос/.test(await page.locator('.qnote').last().textContent()), 'вопрос о суицидальных мыслях — «Верно», с пояснением');
  await click('cs-ask', 1);
  tk = await talk();
  ok(tk.maxQ === 5 && tk.mods.indexOf('contact') >= 0 && /разговорился/.test(await page.locator('.talk').textContent()), 'хороший контакт — ещё один вопрос (' + tk.maxQ + ')');
  await click('cs-ask', 7);
  ok((await has('.qnote.bad')) && /Ошибка/.test(await page.locator('.qnote.bad').last().textContent()), 'стыжение — «Ошибка» с объяснением');
  await click('cs-ask', 6);
  ok(/Можно лучше/.test(await page.locator('.qnote').last().textContent()), 'малополезный вопрос — «Можно лучше»');
  await click('cs-ask', 0);
  tk = await talk();
  ok(tk.asked === tk.maxQ && (await page.locator('[data-act="cs-ask"]').count()) === 0, 'время беседы вышло — вопросов больше нет');
  await click('cs-next');
  ok((await has('.talk-sum')) && /периодах повышенного настроения/.test(await page.locator('.talk-sum').textContent()), 'итог беседы: что из обязательного не спросили');
  await page.evaluate(() => { A.state.activity = null; A.ui.render({ scroll: 'top' }); });
  await click('tab', 'menu');
  await click('tr-open', 'game');
  ok(await has('.trainer'), 'тренажёр открылся из меню');
  await click('tr-exit');
  ok(await page.evaluate(() => A.ui.view.tab === 'menu' && !A.ui.view.screen), 'выход из тренажёра — обратно в меню');
  await click('set-diff', 'easy');
  ok(await page.evaluate(() => A.state.difficulty === 'easy'), 'сложность меняется в меню');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => /save/i.test(k)) || 'x') || 'null'));
  ok(!saved || saved.difficulty === 'easy' || (saved.state && saved.state.difficulty === 'easy'), 'сложность сохранена');

  console.log('Практикум «психический статус» на кафедре');
  const stepType = () => page.evaluate(() => { const a = A.state.activity; const st = a && a.steps[a.i]; return st ? st.type : 'hub'; });
  await click('tab', 'hub');
  await page.evaluate(() => { const s = A.state; while (A.cal.isWeekend(s.day)) s.day++; s.slot = 2; A.ui.render(); });
  await click('place', 'uni');
  ok(await has('[data-act="do"][data-arg="mse_practice"]:not([aria-disabled="true"])'), 'вечером в будни на кафедре доступен практикум');
  const xp0 = await page.evaluate(() => A.state.xp);
  await click('do', 'mse_practice');
  if (await has('[data-act="confirm-yes"]')) await click('confirm-yes');
  m = await mse();
  ok((await stepType()) === 'mse' && m && (await page.evaluate((id) => A.mse.get(id).lvl, m.id)) === 1, 'первый практикум — пациент базового уровня: ' + (m && m.id));
  ok(await has('.mse-intro'), 'Кандинский объясняет задание');
  for (let i = 0; i < nSec; i++) {
    for (const k of await mark(false)) await click('mse-tog', k);
    if (i === 4) {
      // сохранение посреди практикума: после перезагрузки — тот же раздел с отметками
      await page.evaluate(() => A.game.save());
      await page.reload();
      await page.waitForSelector('[data-act="continue"]');
      await click('continue');
      await page.waitForSelector('.mse-mat');
      m = await mse();
      ok(m && m.i === 4 && m.sel[4] > 0, 'после перезагрузки практикум продолжается с того же места');
    }
    await advance(i === nSec - 1);
  }
  ok(await has('.mse-boss'), 'Кандинский комментирует запись');
  await click('mse-close');
  const pr = await page.evaluate(() => ({ t: A.state.activity ? 'act' : 'hub', best: A.state.flags.mseBest, day: A.state.flags.mseDay === A.state.day, xp: A.state.xp, ach: !!A.state.ach.status_writer }));
  ok(pr.t === 'hub' && pr.day && Object.values(pr.best || {})[0] === 100 && pr.xp > xp0, 'практикум засчитан: 100%, опыт ' + xp0 + ' → ' + pr.xp);
  ok(pr.ach, 'игровое достижение «Без единого ярлыка»');
  ok(await page.evaluate(() => { const s = A.state; const slot = s.slot; s.slot = 2; const st = A.game.status(s, A.actions.byId.mse_practice); s.slot = slot; return st.disabled && /уже был/.test(st.reason); }), 'второй практикум в тот же день недоступен');

  console.log('Психический статус на первичном приёме в ПНД');
  await click('tab', 'menu');
  await click('new');
  if (await has('[data-act="confirm-yes"]')) await click('confirm-yes');
  await click('mode-pick', 'doctor');
  await click('cr-start');
  for (let i = 0; i < 12 && (await stepType()) !== 'hub'; i++) {
    if ((await stepType()) === 'jobs') await click('job-pick', 'pnd');
    else await click('step-next');
  }
  await page.evaluate(() => { A.state.slot = 0; A.ui.render(); });
  await click('place', 'work');
  await click('do', 'work');
  for (let i = 0; i < 6 && (await stepType()) === 'story'; i++) await click('step-next');
  const fresh = await page.evaluate(() => { const st = A.state.activity.steps[A.state.activity.i]; return st.type === 'amb' ? st.p.fresh[0] : null; });
  ok(!!fresh, 'на приёме есть новый пациент');
  await click('am-open', fresh);
  ok((await has('[data-act="am-mse"]')) && (await has('[data-act="am-mse-skip"]')), 'вместо готового статуса — «Записать статус» или «Показать готовую запись»');
  await click('am-mse');
  m = await mse();
  ok(m && m.id === (await page.evaluate((u) => A.mse.forAmb(A.clinic.byUid(A.state, u).tpl).id, fresh)), 'конструктор открылся для этого пациента: ' + (m && m.id));
  ok(await page.evaluate((u) => document.querySelector('.mse-pt .pt-name').textContent.indexOf(A.clinic.byUid(A.state, u).name) === 0, fresh), 'в конструкторе — имя пациента с приёма');
  await page.evaluate(() => A.ui.back());
  ok((await mse()) === null && (await has('[data-act="am-mse"]')), '«назад» из конструктора — к приёму');
  await click('am-mse');
  for (let i = 0; i < nSec; i++) {
    for (const k of await mark(i === 0)) await click('mse-tog', k);
    await advance(i === nSec - 1);
  }
  const am = await page.evaluate((u) => { const pt = A.clinic.byUid(A.state, u); return { mse: pt.mse, rev: pt.rev.list[pt.rev.list.length - 1] }; }, fresh);
  ok(am.mse && am.mse.pct >= 90 && am.mse.traps === 1 && /Психический статус/.test(am.rev.text), 'запись проверил заведующий: ' + am.mse.pct + '%, «' + am.rev.text + '»');
  await click('mse-close');
  ok(!(await has('[data-act="am-mse"]')) && /Ваша запись — \d+%/.test(await page.locator('.folder').textContent()), 'после записи на приёме — статус в карте и оценка');

  console.log('Беседа на приёме: комментарий заведующего, на сложном уровне — лимит тем');
  await page.evaluate(() => { A.state.difficulty = 'hard'; A.state.energy = 80; A.state.stress = 20; A.ui.render(); });
  const lim = await page.evaluate((u) => { const pt = A.clinic.byUid(A.state, u); pt.insight = 0.6; A.ui.render(); return A.clinic.talkBudget(A.state, pt); }, fresh);
  ok(lim.n === 3 && (await has('.qbudget')), 'на первичном приёме — 3 темы, расклад виден');
  await click('am-talk', 'safety');
  ok((await has('.talk-out li.boss')) && /Верно|Уместно/.test(await page.locator('.talk-out li.boss').last().textContent()), 'тема «суицидальный риск» — комментарий заведующего');
  await click('am-talk', 'sleep');
  await click('am-talk', 'lifestyle');
  const boss = await page.evaluate(() => [...document.querySelectorAll('.talk-out li.boss')].map((x) => x.textContent));
  ok(boss.length === 3, 'каждая тема получила комментарий: ' + boss.map((x) => x.split(':')[0]).join(', '));
  ok((await page.locator('[data-act="am-talk"]:not([aria-disabled="true"])').count()) === 0 && /Время на беседу вышло/.test(await page.locator('.folder').textContent()), 'после трёх тем остальные недоступны');


  ok(!errors.length, 'ошибок в консоли нет' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
  console.log(fails.length ? 'Провалено: ' + fails.length : 'Тренажёр в порядке.');
  process.exit(fails.length ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
