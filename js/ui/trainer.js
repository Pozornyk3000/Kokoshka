/* Экран тренажёра: официальный репетиционный экзамен (ссылка), тесты игры по уровням сложности, вопрос за вопросом,
   разбор ошибок и достижения тренажёра. Открывается с титула и из меню игры. */
(function (A) {
  'use strict';
  const U = A.util;
  const D = A.data;
  const UI = A.ui;
  const T = A.trainer;
  const esc = U.esc;
  const btn = (label, act, arg, cls, dis) =>
    '<button type="button" class="btn ' + (cls || '') + '" data-act="' + act + '"' + (arg != null ? ' data-arg="' + esc(arg) + '"' : '') + (dis ? ' aria-disabled="true"' : '') + '>' + label + '</button>';

  const tv = () => (UI.view.trainer = UI.view.trainer || { run: null, topic: null, lvl: T.stats().lvl || 0 });
  // внешняя ссылка: в браузере — новая вкладка, в приложении Android — системный браузер
  const ext = (label, url, cls, extra) => '<a class="btn ' + (cls || '') + '" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer"' + (extra || '') + '>' + label + ' ↗</a>';
  const LVL_DESC = {
    0: 'Вопросы всех уровней вперемешку.',
    1: 'Знание определений, критериев, сроков и норм.',
    2: 'Клинические ситуации: тактика, лечение, право.',
    3: 'Развёрнутые случаи в стиле зарубежных экзаменов для ординаторов: дифференциальная диагностика, взаимодействия препаратов, редкие, но опасные состояния.',
  };
  const qWord = (n) => n + ' ' + U.plural(n, ['вопрос', 'вопроса', 'вопросов']);

  UI.screens.trainer = function () {
    const v = tv();
    let body;
    if (v.run && v.run.done) body = resultView(v.run);
    else if (v.run) body = questionView(v.run);
    else body = homeView();
    return '<main class="wrap trainer">' + body + '</main>';
  };

  function best(kind, topic, lvl) {
    const b = T.best(kind, topic, lvl);
    return b != null ? '<span class="chip ' + (b >= T.PASS ? 'pos' : '') + '">лучший результат — ' + b + '%</span>' : '';
  }
  const lvlChip = (lvl) => (lvl ? '<span class="chip tr-lvl l' + lvl + '">' + esc(T.LEVELS[lvl].short) + '</span>' : '');

  function homeView() {
    const v = tv();
    const lvl = v.lvl || 0;
    const wrong = T.wrongRefs().length;
    const total = T.bank().length;
    const nDx = T.dxPool().length;
    let out =
      '<header class="create-head"><span class="eyebrow">Анамнез</span><h1 class="display">Тренажёр</h1>' +
      '<p class="dim">Тесты и ситуационные задачи по психиатрии — ' + qWord(total) + ' и ' + nDx + ' ' + U.plural(nDx, ['задача', 'задачи', 'задач']) + ' на диагноз. На игру не влияет: это подготовка к экзаменам — и к работе.</p></header>';
    out +=
      '<section class="card official"><h2 class="h2">Официальный репетиционный экзамен</h2>' +
      '<p class="small">Настоящие тестовые задания первичной специализированной аккредитации — из единой базы Методического центра аккредитации специалистов. В репетиционном экзамене их можно проходить сколько угодно раз.</p>' +
      '<p class="small dim">Откроется в браузере, нужен интернет.</p>' +
      '<div class="row-btns">' + ext('Открыть репетиционный экзамен', T.OFFICIAL.exam, 'primary', ' data-official') + ext('Сайт центра аккредитации', T.OFFICIAL.site, '') + '</div></section>';
    out +=
      '<h2 class="step-h tr-own">Тесты игры</h2>' +
      '<p class="small dim tr-note">Вопросы ниже написаны для «Анамнеза» по клиническим рекомендациям и учебникам. Это не настоящие задания аккредитации: формат тот же — четыре варианта, один верный, «сдано» от ' + T.PASS + '%, — а вопросы свои.</p>';
    // уровень вопросов — для тестов в формате аккредитации, по темам и задач на диагноз
    const nLvl = T.pool(lvl).length;
    out +=
      '<div class="tr-levels"><span class="label">Уровень вопросов</span><div class="seg segb" role="group" aria-label="Уровень вопросов">' +
      [0, 1, 2, 3].map((k) => '<button type="button" class="seg-b" data-act="tr-lvl" data-arg="' + k + '" aria-pressed="' + (lvl === k) + '">' + esc(T.LEVELS[k].name) + '</button>').join('') +
      '</div><p class="small dim">' + esc(LVL_DESC[lvl]) + (lvl ? ' В банке — ' + qWord(nLvl) + '.' : '') + '</p></div>';
    out +=
      '<section class="card"><h2 class="h2">Тест в формате аккредитации</h2><p class="small">Вопросы из всех тем поровну, без подсказок по ходу — разбор в конце. На настоящей аккредитации — 80 вопросов за 60 минут.</p>' +
      (lvl && nLvl < 80 ? '<p class="small dim">На этом уровне в банке ' + qWord(nLvl) + ' — полный тест будет короче.</p>' : '') +
      '<div class="act-chips">' + best('accr20', null, lvl) + best('accr80', null, lvl) + '</div>' +
      '<div class="row-btns">' + btn('20 вопросов', 'tr-start', 'accr20', 'primary') + btn('80 вопросов', 'tr-start', 'accr80', '') + '</div></section>';
    out += '<section class="card"><h2 class="h2">Тест по теме</h2><p class="small">До 10 вопросов, после каждого ответа — объяснение.</p><div class="chipbar">';
    D.domainKeys.forEach((k) => {
      const n = T.topicCount(k, lvl);
      const off = n < T.MIN_TOPIC;
      out += '<button type="button" class="chipbtn" data-act="tr-topic" data-arg="' + k + '" aria-pressed="' + (v.topic === k) + '"' + (off ? ' aria-disabled="true"' : '') + '>' + esc(D.domains[k].short) + ' · ' + n + '</button>';
    });
    out += '</div>';
    if (v.topic) {
      const n = T.topicCount(v.topic, lvl);
      out +=
        '<div class="act-chips">' + best('topic', v.topic, lvl) + '</div>' +
        (n < T.MIN_TOPIC ? '<p class="small dim">На этом уровне по теме мало вопросов — выберите другой уровень.</p>' : '') +
        '<div class="row-btns">' + btn('Начать: ' + esc(D.domains[v.topic].name.toLowerCase()), 'tr-start', 'topic', 'primary', n < T.MIN_TOPIC) + '</div>';
    }
    out += '</section>';
    const nDxL = T.dxPool(lvl).length;
    out +=
      '<section class="card"><h2 class="h2">Диагноз по МКБ-10</h2><p class="small">До 8 ситуационных задач. Диагноз — самостоятельно, из полного списка МКБ-10 с поиском, как в сложной игре. Верная рубрика с другим уточнением — полбалла.' +
      (lvl ? ' Уровень задачи — сложность клинического случая; на этом уровне задач: ' + nDxL + '.' : '') + '</p>' +
      '<div class="act-chips">' + best('dx', null, lvl) + '</div><div class="row-btns">' + btn('Начать', 'tr-start', 'dx', 'primary', !nDxL) + '</div></section>';
    out +=
      '<section class="card"><h2 class="h2">Работа над ошибками</h2><p class="small">' + (wrong ? 'Вопросы всех уровней, на которые вы ответили неверно: ' + wrong + '. Правильный ответ убирает вопрос из списка.' : 'Здесь соберутся вопросы, на которые вы ответили неверно.') + '</p>' +
      '<div class="row-btns">' + btn('Повторить', 'tr-start', 'mistakes', '', !wrong) + '</div></section>';
    out += achCard();
    out += '<div class="create-btns">' + btn('Назад', 'tr-exit', null, 'ghost') + '</div>';
    return out;
  }

  function achItems(list) {
    return '<ul class="achs">' + list.map((a) => '<li class="ach' + (a.got ? ' got' : '') + '"><b>' + esc(a.name) + '</b><span>' + esc(a.desc) + '</span></li>').join('') + '</ul>';
  }
  function achCard() {
    const list = T.achList();
    const got = list.filter((a) => a.got).length;
    // свёрнуто по умолчанию: на телефоне список длинный; полученные — первыми
    const sorted = list.filter((a) => a.got).concat(list.filter((a) => !a.got));
    return (
      '<details class="card tr-achs"' + (UI.view.trAchOpen ? ' open' : '') + '><summary class="h2">Достижения тренажёра · ' + got + ' из ' + list.length + '</summary>' +
      '<p class="small dim">Свои у тренажёра, отдельно от достижений игры; хранятся на этом устройстве.</p>' + achItems(sorted) + '</details>'
    );
  }

  function questionView(run) {
    const K = T.KINDS[run.kind];
    const n = run.refs.length;
    const a = run.ans[run.i];
    const ref = run.refs[run.i];
    const qLvl = run.kind === 'dx' ? (T.dxTask(ref) || {}).difficulty || 2 : T.refLevel(ref);
    let out =
      '<header class="act-head"><span class="eyebrow">' + esc(run.kind === 'topic' ? D.domains[run.topic].name : K.name) + (run.lvl ? ' · ' + esc(T.LEVELS[run.lvl].short) + ' уровень' : '') + '</span>' +
      '<div class="tr-progress"><span class="mono small">' + (run.kind === 'dx' ? 'Задача ' : 'Вопрос ') + (run.i + 1) + ' из ' + n + ' ' + lvlChip(qLvl) + '</span><div class="mini-track"><div style="width:' + Math.round((run.i / n) * 100) + '%"></div></div></div></header>';
    if (run.kind === 'dx') {
      const c = T.dxTask(ref);
      out += '<article class="vignette"><span class="eyebrow">Ситуационная задача</span>' + U.md(c.vignette) + '</article>';
      if (a == null) {
        out += '<h2 class="step-h">Ваш диагноз по МКБ-10</h2>' + UI.icd.picker({ act: 'tr-icd', sel: UI.view.trDx || null });
        out += '<div class="next-row">' + btn('Ответить', 'tr-dx', null, 'primary wide', !UI.view.trDx) + '</div>';
      } else out += feedback(run, true);
      out += '<div class="create-btns">' + btn('Прервать', 'tr-quit', null, 'ghost') + '</div>';
      return out;
    }
    const q = T.question(ref);
    out += '<p class="q-text">' + U.inline(esc(q.q)) + '</p><div class="opts">';
    run.order[run.i].forEach((oi) => {
      const shown = run.shown && a != null;
      const cls = shown ? (oi === q.ok ? ' correct' : oi === a ? ' wrong' : ' dim') : '';
      out +=
        '<button type="button" class="opt' + cls + '" data-act="tr-pick" data-arg="' + oi + '" aria-pressed="' + (a === oi) + '"' + (a != null ? ' aria-disabled="true"' : '') + '>' +
        '<span class="opt-box radio" aria-hidden="true"></span><span class="opt-main"><span class="opt-t">' + U.inline(esc(q.opts[oi])) + '</span></span></button>';
    });
    out += '</div>';
    if (a != null && run.shown) out += feedback(run, false);
    else if (a != null) out += '<div class="next-row">' + btn(run.i < n - 1 ? 'Следующий вопрос' : 'Завершить тест', 'tr-next', null, 'primary wide') + '</div>';
    out += '<div class="create-btns">' + btn('Прервать', 'tr-quit', null, 'ghost') + '</div>';
    return out;
  }

  function feedback(run, dx) {
    const r = T.check(run, run.i);
    const n = run.refs.length;
    let out = '<div class="feedback ' + (r.score === 1 ? 'ok' : 'bad') + '" data-last><b>' + (r.score === 1 ? 'Верно.' : r.score > 0 ? 'Частично верно.' : 'Неверно.') + '</b> ';
    if (dx) {
      out += (r.score === 1 ? '' : 'Ваш ответ: ' + esc(A.icd.label(run.ans[run.i])) + '. ') + 'Верно: <b>' + esc(r.right) + '</b>.';
      if (r.why) out += '<p class="small">' + esc(r.why) + '</p>';
      if (r.pearl) out += '<p class="small dim">' + esc(r.pearl) + '</p>';
    } else {
      if (r.score !== 1) out += 'Правильный ответ: <b>' + U.inline(esc(r.right)) + '</b>. ';
      out += '<span class="small">' + U.inline(esc(r.why)) + '</span>';
    }
    out += '</div><div class="next-row">' + btn(run.i < n - 1 ? 'Дальше' : 'Итоги', 'tr-next', null, 'primary wide') + '</div>';
    return out;
  }

  function resultView(run) {
    const K = T.KINDS[run.kind];
    let out =
      '<section class="result-card"><div class="stamp' + (run.pass ? '' : ' bad') + '"><b>' + run.pct + '%</b><span>' + (K.exam ? (run.pass ? 'сдано' : 'не сдано') : run.pass ? 'хорошо' : 'надо повторить') + '</span></div>' +
      '<p class="mono small">' + esc(run.kind === 'topic' ? D.domains[run.topic].name : K.name) + (run.lvl ? ' · ' + esc(T.LEVELS[run.lvl].short) + ' уровень' : '') + ' · верно ' + String(run.right).replace('.', ',') + ' из ' + run.refs.length + '</p>' +
      (K.exam ? '<p class="small dim">Это тренировочный тест игры, а не официальная аккредитация. Настоящие задания — в репетиционном экзамене центра аккредитации.</p>' : '') +
      '</section>';
    if (run.newAch && run.newAch.length) {
      const list = T.achList().filter((a) => run.newAch.indexOf(a.id) >= 0);
      out += '<section class="card tr-ach-new"><h2 class="h2">Новые достижения</h2>' + achItems(list) + '</section>';
    }
    const wrong = run.refs.map((r, i) => ({ r, i, c: T.check(run, i) })).filter((x) => x.c.score < 1);
    if (wrong.length) {
      out += '<section class="review"><h2 class="step-h">Разбор ошибок</h2><ul class="marks">';
      wrong.forEach((x) => {
        if (run.kind === 'dx') {
          const c = T.dxTask(x.r);
          out += '<li class="' + (x.c.score > 0 ? 'm-miss' : 'm-bad') + '">' + esc(c.title || '') + ': ' + esc(A.icd.label(run.ans[x.i]) || 'нет ответа') + '<span class="m-def">Верно: ' + esc(x.c.right) + (x.c.why ? '. ' + esc(x.c.why) : '') + '</span></li>';
        } else {
          const q = T.question(x.r);
          out += '<li class="m-bad">' + U.inline(esc(q.q)) + '<span class="m-def">Ваш ответ: ' + (run.ans[x.i] != null ? U.inline(esc(q.opts[run.ans[x.i]])) : 'нет ответа') + '</span><span class="m-def"><b>Верно:</b> ' + U.inline(esc(q.opts[q.ok])) + '. ' + U.inline(esc(q.why || '')) + '</span></li>';
        }
      });
      out += '</ul></section>';
    } else out += '<p class="note">Ни одной ошибки.</p>';
    out += '<div class="next-row col">' + btn('Ещё раз', 'tr-again', null, 'primary wide') + btn('К тренажёру', 'tr-home', null, 'wide') + '</div>';
    return out;
  }

  /* ---------- Обработчики ---------- */
  UI.on('tr-open', (from) => {
    tv().run = null;
    UI.view.trainerFrom = from || (A.state ? 'game' : 'title');
    UI.view.screen = 'trainer';
    UI.render({ scroll: 'top' });
  });
  UI.on('tr-exit', () => {
    UI.view.screen = null;
    UI.view.trainer = null;
    if (A.state && UI.view.trainerFrom === 'game') UI.view.tab = 'menu';
    UI.render({ scroll: 'top' });
  });
  UI.on('tr-lvl', (k) => {
    const lvl = T.LEVELS[k] ? +k : 0;
    tv().lvl = lvl;
    T.setLevel(lvl);
    UI.render();
  });
  UI.on('tr-topic', (k) => {
    tv().topic = tv().topic === k ? null : k;
    UI.render();
  });
  UI.on('tr-start', (kind) => {
    const v = tv();
    const run = T.start(kind, kind === 'topic' ? v.topic : null, v.lvl || 0);
    if (!run) return UI.toast('Вопросов для этого теста на выбранном уровне пока мало.');
    v.run = run;
    UI.view.trDx = null;
    if (UI.icd) UI.icd.reset();
    UI.render({ scroll: 'top' });
  });
  UI.on('tr-pick', (i) => {
    const run = tv().run;
    if (!run) return;
    T.answer(run, +i);
    UI.render({ scroll: run.shown ? 'last' : null });
  });
  UI.on('tr-icd', (key) => {
    if (!A.icd.get(key)) return;
    UI.view.trDx = key;
    UI.render();
  });
  UI.on('tr-dx', () => {
    const run = tv().run;
    if (!run || !UI.view.trDx) return;
    T.answer(run, UI.view.trDx);
    UI.render({ scroll: 'last' });
  });
  UI.on('tr-next', () => {
    const run = tv().run;
    if (!run) return;
    T.next(run);
    UI.view.trDx = null;
    if (UI.icd) UI.icd.reset();
    UI.render({ scroll: 'top' });
    if (run.done && run.newAch && run.newAch.length) UI.toast((run.newAch.length > 1 ? 'Новые достижения: ' : 'Новое достижение: ') + run.newAch.map(T.achName).join(', ') + '.');
  });
  UI.on('tr-quit', () => {
    UI.ask('Прервать тест?', 'Результат этого прогона не сохранится.', 'Прервать', () => {
      tv().run = null;
      UI.render({ scroll: 'top' });
    });
  });
  UI.on('tr-again', () => {
    const v = tv();
    const run = v.run;
    if (!run) return;
    v.lvl = run.lvl || 0;
    if (run.topic) v.topic = run.topic;
    UI.handlers['tr-start'](run.kind);
  });
  UI.on('tr-home', () => {
    tv().run = null;
    UI.render({ scroll: 'top' });
  });
  // раскрыта ли карточка достижений — запоминаем до конца сеанса
  document.addEventListener('toggle', (e) => e.target && e.target.classList && e.target.classList.contains('tr-achs') && (UI.view.trAchOpen = e.target.open), true);
  // переход на официальный репетиционный экзамен — тоже достижение (ссылка открывается как обычно)
  document.addEventListener('click', (e) => {
    const a = e.target && e.target.closest ? e.target.closest('a[data-official]') : null;
    if (!a || !T.unlock('official')) return;
    UI.toast('Новое достижение: ' + T.achName('official') + '.');
    setTimeout(() => UI.view.screen === 'trainer' && UI.render(), 0);
  });
})((window.A = window.A || {}));
