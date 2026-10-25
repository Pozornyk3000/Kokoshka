/* Экран тренажёра: выбор теста, вопрос за вопросом, разбор ошибок. Открывается с титула и из меню игры. */
(function (A) {
  'use strict';
  const U = A.util;
  const D = A.data;
  const UI = A.ui;
  const T = A.trainer;
  const esc = U.esc;
  const btn = (label, act, arg, cls, dis) =>
    '<button type="button" class="btn ' + (cls || '') + '" data-act="' + act + '"' + (arg != null ? ' data-arg="' + esc(arg) + '"' : '') + (dis ? ' aria-disabled="true"' : '') + '>' + label + '</button>';

  const tv = () => (UI.view.trainer = UI.view.trainer || { run: null, topic: null });

  UI.screens.trainer = function () {
    const v = tv();
    let body;
    if (v.run && v.run.done) body = resultView(v.run);
    else if (v.run) body = questionView(v.run);
    else body = homeView();
    return '<main class="wrap trainer">' + body + '</main>';
  };

  function best(key) {
    const b = (T.stats().best || {})[key];
    return b != null ? '<span class="chip ' + (b >= T.PASS ? 'pos' : '') + '">лучший результат — ' + b + '%</span>' : '';
  }

  function homeView() {
    const v = tv();
    const wrong = T.wrongRefs().length;
    const total = T.bank().length;
    const nDx = T.dxPool().length;
    let out = '<header class="create-head"><span class="eyebrow">Анамнез</span><h1 class="display">Тренажёр</h1>' +
      '<p class="dim">Тесты и ситуационные задачи по психиатрии — ' + total + ' ' + U.plural(total, ['вопрос', 'вопроса', 'вопросов']) + ' и ' + nDx + ' ' + U.plural(nDx, ['задача', 'задачи', 'задач']) + ' на диагноз. На игру не влияет: это подготовка к экзаменам — и к работе.</p></header>';
    out +=
      '<section class="card"><h2 class="h2">Тест как на аккредитации</h2><p class="small">Вопросы из всех тем, без подсказок по ходу — разбор в конце. «Сдано» — от ' + T.PASS + '% верных ответов.</p>' +
      '<div class="act-chips">' + best('accr20') + best('accr60') + '</div>' +
      '<div class="row-btns">' + btn('20 вопросов', 'tr-start', 'accr20', 'primary') + btn('60 вопросов', 'tr-start', 'accr60', '') + '</div></section>';
    out += '<section class="card"><h2 class="h2">Тест по теме</h2><p class="small">10 вопросов, после каждого ответа — объяснение.</p><div class="chipbar">';
    D.domainKeys.forEach((k) => {
      const n = T.topicCount(k);
      if (!n) return;
      out += '<button type="button" class="chipbtn" data-act="tr-topic" data-arg="' + k + '" aria-pressed="' + (v.topic === k) + '">' + esc(D.domains[k].short) + ' · ' + n + '</button>';
    });
    out += '</div>';
    if (v.topic) out += '<div class="act-chips">' + best('topic_' + v.topic) + '</div><div class="row-btns">' + btn('Начать: ' + esc(D.domains[v.topic].name.toLowerCase()), 'tr-start', 'topic', 'primary') + '</div>';
    out += '</section>';
    out +=
      '<section class="card"><h2 class="h2">Диагноз по МКБ-10</h2><p class="small">8 ситуационных задач. Диагноз — самостоятельно, из полного списка МКБ-10 с поиском, как в сложной игре. Верная рубрика с другим уточнением — полбалла.</p>' +
      '<div class="act-chips">' + best('dx') + '</div><div class="row-btns">' + btn('Начать', 'tr-start', 'dx', 'primary') + '</div></section>';
    out +=
      '<section class="card"><h2 class="h2">Работа над ошибками</h2><p class="small">' + (wrong ? 'Вопросы, на которые вы ответили неверно: ' + wrong + '. Правильный ответ убирает вопрос из списка.' : 'Здесь соберутся вопросы, на которые вы ответили неверно.') + '</p>' +
      '<div class="row-btns">' + btn('Повторить', 'tr-start', 'mistakes', '', !wrong) + '</div></section>';
    out += '<div class="create-btns">' + btn('Назад', 'tr-exit', null, 'ghost') + '</div>';
    return out;
  }

  function questionView(run) {
    const K = T.KINDS[run.kind];
    const n = run.refs.length;
    const a = run.ans[run.i];
    let out =
      '<header class="act-head"><span class="eyebrow">' + esc(run.kind === 'topic' ? D.domains[run.topic].name : K.name) + '</span>' +
      '<div class="tr-progress"><span class="mono small">' + (run.kind === 'dx' ? 'Задача ' : 'Вопрос ') + (run.i + 1) + ' из ' + n + '</span><div class="mini-track"><div style="width:' + Math.round((run.i / n) * 100) + '%"></div></div></div></header>';
    if (run.kind === 'dx') {
      const c = T.dxTask(run.refs[run.i]);
      out += '<article class="vignette"><span class="eyebrow">Ситуационная задача</span>' + U.md(c.vignette) + '</article>';
      if (a == null) {
        out += '<h2 class="step-h">Ваш диагноз по МКБ-10</h2>' + UI.icd.picker({ act: 'tr-icd', sel: UI.view.trDx || null });
        out += '<div class="next-row">' + btn('Ответить', 'tr-dx', null, 'primary wide', !UI.view.trDx) + '</div>';
      } else out += feedback(run, true);
      return out;
    }
    const q = T.question(run.refs[run.i]);
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
      '<p class="mono small">' + esc(run.kind === 'topic' ? D.domains[run.topic].name : K.name) + ' · верно ' + String(run.right).replace('.', ',') + ' из ' + run.refs.length + '</p></section>';
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
  UI.on('tr-topic', (k) => {
    tv().topic = tv().topic === k ? null : k;
    UI.render();
  });
  UI.on('tr-start', (kind) => {
    const v = tv();
    const run = T.start(kind, kind === 'topic' ? v.topic : null);
    if (!run) return UI.toast('Вопросов для этого теста пока нет.');
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
  });
  UI.on('tr-quit', () => {
    UI.ask('Прервать тест?', 'Ответы этого прогона не сохранятся.', 'Прервать', () => {
      tv().run = null;
      UI.render({ scroll: 'top' });
    });
  });
  UI.on('tr-again', () => {
    const v = tv();
    const run = v.run;
    if (!run) return;
    UI.handlers['tr-start'](run.kind === 'topic' ? 'topic' : run.kind);
  });
  UI.on('tr-home', () => {
    tv().run = null;
    UI.render({ scroll: 'top' });
  });
})((window.A = window.A || {}));
