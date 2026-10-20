/* Экраны активностей: сюжет, событие, лекция, клинический случай, экзамен, мини-задачи, расчётный листок, магазин, выбор работы, финал. */
(function (A) {
  'use strict';
  const U = A.util;
  const C = A.cal;
  const D = A.data;
  const G = A.game;
  const UI = A.ui;
  const CS = A.cases;
  const ACT = (UI.act = {});
  const val = UI.val;

  const btn = (label, act, arg, cls, dis) =>
    '<button type="button" class="btn ' + (cls || '') + '" data-act="' + act + '"' + (arg != null ? ' data-arg="' + U.esc(arg) + '"' : '') + (dis ? ' aria-disabled="true"' : '') + '>' + label + '</button>';

  ACT.render = function (s) {
    const act = s.activity;
    const step = act.steps[act.i];
    if (!step) {
      G.finishActivity();
      G.save();
      return UI.hub(s);
    }
    const fn = ACT[step.type];
    const body = fn ? fn(s, step, act) : '<p>Неизвестный шаг.</p>' + btn('Дальше', 'step-next', null, 'primary wide');
    return UI.hud(s) + '<main class="wrap act-screen act-' + step.type + '">' + body + '</main>';
  };

  ACT.done = function (result) {
    G.stepDone(result);
    UI.render({ scroll: 'top' });
  };
  UI.on('step-next', () => ACT.done(null));

  ACT.sceneId = function (s, id) {
    if (!id) return G.homeScene(s);
    if (id === 'home') return G.homeScene(s);
    return id;
  };

  /* ================= Сюжет ================= */
  ACT.story = function (s, step) {
    const st = A.stories.get(step.story) || { title: '', text: '…', scene: 'street' };
    if (!step.p) {
      step.p = {
        title: U.t(val(st.title, s) || ''),
        text: A.stories.text(s, st) || '',
        scene: ACT.sceneId(s, val(st.scene, s)),
      };
      G.save();
    }
    const p = step.p;
    return (
      UI.sceneFig(p.scene, s) +
      (st.npc ? '<div class="story-npc">' + UI.npcPortrait(st.npc, step.story === 'graduation' ? 'smile' : 'neutral') + '</div>' : '') +
      '<section class="story">' +
      (p.title ? '<h1 class="display">' + U.esc(p.title) + '</h1>' : '') +
      U.md(p.text) +
      '</section>' +
      '<div class="next-row">' +
      btn(U.esc(U.t(st.btn || 'Дальше')), 'step-next', null, 'primary wide') +
      '</div>'
    );
  };

  /* ================= Событие ================= */
  ACT.event = function (s, step) {
    const e = A.events.byId[step.id];
    if (!e) return btn('Дальше', 'step-next', null, 'primary wide');
    if (!step.p) {
      step.p = { text: val(e.text, s), scene: ACT.sceneId(s, val(e.scene, s)) };
      G.save();
    }
    const p = step.p;
    let out = UI.sceneFig(p.scene, s) + (e.npc ? '<div class="story-npc">' + UI.npcPortrait(e.npc, e.emotion || 'neutral') + '</div>' : '');
    out += '<section class="story"><span class="eyebrow">Событие</span><h1 class="display">' + U.esc(U.t(e.title)) + '</h1>' + U.md(p.text) + '</section>';
    if (p.out == null) {
      out +=
        '<div class="choices">' +
        e.choices
          .map((c, i) => {
            const r = c.req ? c.req(s) : null;
            return (
              '<button type="button" class="opt choice" data-act="ev-choice" data-arg="' + i + '"' + (r ? ' aria-disabled="true"' : '') + '><span class="opt-box" aria-hidden="true"></span><span class="opt-main"><span class="opt-t">' +
              U.line(c.t) +
              '</span>' +
              (c.sub || r ? '<span class="opt-sub">' + U.esc(U.t(r || c.sub)) + '</span>' : '') +
              '</span></button>'
            );
          })
          .join('') +
        '</div>';
    } else {
      out +=
        '<div class="outcome"><p class="chosen"><span class="hand">' + U.esc(U.t(e.choices[p.choice].t)) + '</span></p>' + U.md(p.out) + UI.deltaChips(p.delta) + '</div>' +
        '<div class="next-row">' + btn('Дальше', 'step-next', null, 'primary wide') + '</div>';
    }
    return out;
  };
  UI.on('ev-choice', (i) => {
    const s = A.state;
    const step = s.activity.steps[s.activity.i];
    const e = A.events.byId[step.id];
    const c = e.choices[+i];
    if (!c || step.p.out != null) return;
    const snap = G.snap(s);
    step.p.choice = +i;
    step.p.out = c.run(s) || '';
    step.p.delta = G.diff(snap, s);
    G.after(s);
    G.save();
    UI.render();
  });

  /* ================= Лекция ================= */
  ACT.lecture = function (s, step) {
    const L = D.lectureById[step.id];
    if (!L) return '<p>Лекция не найдена.</p>' + btn('Дальше', 'step-next', null, 'primary wide');
    if (!step.p) {
      step.p = { stage: 'slides', i: 0, q: 0, ans: [], focus: G.focus(s) };
      G.save();
    }
    const p = step.p;
    const head =
      '<header class="act-head"><span class="eyebrow">' + (step.makeup ? 'Отработка · ' : '') + 'Лекция №' + L.n + ' · ' + D.domains[L.domain].name + '</span><h1 class="display">' + U.esc(L.title) + '</h1>' +
      '<div class="lecturer">' + UI.npcPortrait('korsakova', p.stage === 'done' && p.ans.filter(Boolean).length === L.quiz.length ? 'smile' : 'neutral', 'small') + '</div></header>';
    let body = '';
    if (p.stage === 'slides') {
      const sl = L.slides[p.i];
      const dots = L.slides.map((x, i) => '<span class="dot' + (i === p.i ? ' on' : i < p.i ? ' past' : '') + '"></span>').join('');
      body =
        (p.i === 0 ? UI.sceneFig(step.makeup ? 'library' : 'lecture', s) : '') +
        (p.focus < 0.8 && p.i === 0 ? '<p class="note warn">Ты клюёшь носом — запомнится меньше. Высыпайся перед лекциями.</p>' : '') +
        '<article class="slide"><span class="slide-n mono">' + (p.i + 1) + ' / ' + L.slides.length + '</span><h2>' + U.esc(sl.h) + '</h2>' + U.md(sl.b) + '</article>' +
        '<div class="dots" aria-hidden="true">' + dots + '</div>' +
        '<div class="row-btns spread">' +
        btn('Назад', 'lec-prev', null, 'ghost', p.i === 0) +
        (p.i < L.slides.length - 1 ? btn('Дальше', 'lec-next', null, 'primary') : btn('К блиц-опросу', 'lec-quiz', null, 'primary')) +
        '</div>';
    } else if (p.stage === 'quiz') {
      const q = L.quiz[p.q];
      const answered = p.ans[p.q] != null;
      const pick = answered ? p.pick : null;
      body =
        '<section class="quiz"><span class="eyebrow">Блиц-опрос · ' + (p.q + 1) + ' из ' + L.quiz.length + '</span><h2 class="q-text">' + U.esc(q.q) + '</h2><div class="opts">' +
        q.opts
          .map((o, i) => {
            let cls = '';
            if (answered) cls = i === q.ok ? ' correct' : i === pick ? ' wrong' : ' dim';
            return '<button type="button" class="opt' + cls + '" data-act="lec-pick" data-arg="' + i + '"' + (answered ? ' aria-disabled="true"' : '') + '><span class="opt-box radio" aria-hidden="true"></span><span class="opt-main"><span class="opt-t">' + U.esc(o) + '</span></span></button>';
          })
          .join('') +
        '</div>' +
        (answered ? '<div class="feedback ' + (p.ans[p.q] ? 'ok' : 'bad') + '"><b>' + (p.ans[p.q] ? 'Верно.' : 'Неверно.') + '</b> ' + U.esc(q.why) + '</div>' + '<div class="next-row">' + btn(p.q < L.quiz.length - 1 ? 'Следующий вопрос' : 'Итоги', 'lec-qnext', null, 'primary wide') + '</div>' : '') +
        '</section>';
    } else {
      const right = p.ans.filter(Boolean).length;
      body =
        '<section class="result-card"><div class="stamp">' + right + ' / ' + L.quiz.length + '</div><p>' +
        (right === L.quiz.length ? 'Корсакова отмечает тебя в журнале: «Отлично».' : right >= L.quiz.length / 2 ? 'Неплохо. Конспект поможет закрепить остальное.' : 'Стоит перечитать конспект в справочнике.') +
        '</p><p class="dim small">Конспект лекции сохранён в справочнике.</p></section>' +
        '<div class="next-row">' + btn('Завершить', 'lec-done', null, 'primary wide') + '</div>';
    }
    return head + body;
  };
  const lec = () => {
    const s = A.state;
    return s.activity.steps[s.activity.i];
  };
  UI.on('lec-prev', () => {
    const st = lec();
    st.p.i = Math.max(0, st.p.i - 1);
    G.save();
    UI.render({ scroll: 'top' });
  });
  UI.on('lec-next', () => {
    const st = lec();
    st.p.i++;
    G.save();
    UI.render({ scroll: 'top' });
  });
  UI.on('lec-quiz', () => {
    const st = lec();
    st.p.stage = 'quiz';
    st.p.q = 0;
    G.save();
    UI.render({ scroll: 'top' });
  });
  UI.on('lec-pick', (i) => {
    const st = lec();
    const L = D.lectureById[st.id];
    if (st.p.ans[st.p.q] != null) return;
    st.p.pick = +i;
    st.p.ans[st.p.q] = +i === L.quiz[st.p.q].ok;
    G.save();
    UI.render();
  });
  UI.on('lec-qnext', () => {
    const st = lec();
    const L = D.lectureById[st.id];
    if (st.p.q < L.quiz.length - 1) st.p.q++;
    else st.p.stage = 'done';
    st.p.pick = null;
    G.save();
    UI.render({ scroll: 'top' });
  });
  UI.on('lec-done', () => {
    const st = lec();
    const L = D.lectureById[st.id];
    ACT.done({ id: st.id, right: st.p.ans.filter(Boolean).length, total: L.quiz.length, focus: st.p.focus });
  });

  /* ================= Клинический случай ================= */
  ACT.cur = function () {
    const s = A.state;
    const act = s.activity;
    if (!act) return null;
    const step = act.steps[act.i];
    if (step.type === 'case') return { s, step, c: D.caseById[step.id], p: step.p, mode: step.mode };
    if (step.type === 'exam') {
      const ep = step.p;
      return { s, step, c: D.caseById[ep.cases[ep.ti]], p: ep.task, mode: 'exam', exam: step.exam, ep };
    }
    return null;
  };

  ACT.case = function (s, step) {
    const c = D.caseById[step.id];
    if (!c) return '<p>Случай не найден.</p>' + btn('Дальше', 'step-next', null, 'primary wide');
    if (!step.p) {
      step.p = CS.init(s, step);
      G.save();
    }
    return ACT.caseView(s, c, step.p, step.mode, step);
  };

  ACT.look = function (c) {
    return Object.assign({ sex: c.patient.sex, age: c.patient.age }, c.patient.look || {});
  };
  ACT.emotion = function (c, p) {
    if (p && p.rapport < 30) return c.patient.emotion === 'sad' ? 'sad' : 'stern';
    return c.patient.emotion || 'neutral';
  };

  ACT.stageNames = { talk: 'Беседа', status: 'Статус', dx: 'Диагноз', tx: 'Тактика', result: 'Разбор' };

  ACT.caseView = function (s, c, p, mode, step, extra) {
    extra = extra || {};
    const stages = p.parts.concat(['result']);
    const tracker =
      '<ol class="tracker">' +
      stages.map((st) => '<li class="' + (st === p.stage ? 'on' : stages.indexOf(st) < stages.indexOf(p.stage) ? 'past' : '') + '">' + ACT.stageNames[st] + '</li>').join('') +
      '</ol>';
    const modeLabel = mode === 'seminar' ? 'Семинар · ' : mode === 'exam' ? '' : '';
    const pt =
      '<div class="patient">' +
      '<div class="pt-photo">' + A.art.portrait(ACT.look(c), ACT.emotion(c, p), { seed: U.hash(c.id) }) + '</div>' +
      '<div class="pt-info"><span class="eyebrow">' + modeLabel + U.esc(c.where) + '</span><b class="pt-name">' + U.esc(c.patient.name) + ', ' + c.patient.age + ' ' + U.plural(c.patient.age, ['год', 'года', 'лет']) + '</b>' +
      (mode !== 'exam' ? '<span class="pt-title">«' + U.esc(c.title) + '»</span>' : '') +
      (s.seen.cases[c.id] && mode === 'work' ? '<span class="dim small">Похожий случай уже встречался</span>' : '') +
      '</div></div>';

    let head = '';
    if (mode !== 'exam') head = UI.sceneFig(c.scene, s, null) + '<div class="chart"><div class="chart-top mono">Медицинская карта · ' + (mode === 'seminar' ? 'учебный разбор' : 'приём') + '</div>' + pt + tracker + '</div>';
    else head = extra.head + '<div class="chart">' + pt + tracker + '</div>';

    let body = '';
    if (p.stage === 'talk') body = ACT.talk(s, c, p, mode);
    else if (p.stage === 'status') body = ACT.statusStage(s, c, p, mode);
    else if (p.stage === 'dx') body = ACT.dxStage(s, c, p, mode);
    else if (p.stage === 'tx') body = ACT.txStage(s, c, p, mode);
    else body = ACT.resultStage(s, c, p, mode, extra);
    if (mode === 'exam' && p.stage !== 'result') body = '<article class="vignette"><span class="eyebrow">Ситуационная задача</span>' + U.md(c.vignette) + '</article>' + body;
    return head + body;
  };

  ACT.transcript = function (c, p, markLast) {
    let out = '<div class="talk"><div class="bubble pt"><span class="who">' + U.esc(c.patient.name) + '</span>' + U.inline(U.esc(c.complaint)) + '</div>';
    p.asked.forEach((qi, n) => {
      const last = markLast && n === p.asked.length - 1;
      if (qi === 'repair') {
        out += '<div class="bubble dr"' + (last ? ' data-last' : '') + '><span class="who">Вы</span>' + U.esc(CS.repairText) + '</div>';
        out += '<div class="bubble pt soft">(' + U.esc(c.patient.sex === 'f' ? 'Она' : 'Он') + ' чуть расслабляется и кивает.)</div>';
        return;
      }
      const q = c.q[qi];
      const ev = p.evasive && p.evasive.indexOf(qi) >= 0;
      out += '<div class="bubble dr"' + (last ? ' data-last' : '') + '><span class="who">Вы</span>' + U.esc(U.t(q.t)) + '</div>';
      out += '<div class="bubble pt' + (ev ? ' evasive' : '') + '"><span class="who">' + U.esc(c.patient.name) + '</span>' + U.esc(ev ? CS.evasive(c, qi) : q.a) + '</div>';
    });
    return out + '</div>';
  };

  ACT.rapportLabel = function (r) {
    if (r >= 70) return ['хороший', 'ok'];
    if (r >= 45) return ['осторожный', ''];
    if (r >= 30) return ['натянутый', 'warn'];
    return ['потерян', 'bad'];
  };

  ACT.talk = function (s, c, p, mode) {
    const left = CS.questionsLeft(p);
    const [rl, rc] = ACT.rapportLabel(p.rapport);
    let out = '<section class="story case-intro">' + U.md(c.intro) + '</section>';
    if (mode === 'seminar' && c.tutor) out += '<p class="tutor"><span class="hand">' + U.esc(c.tutor) + '</span></p>';
    out += ACT.transcript(c, p, true);
    out +=
      '<div class="talk-meta"><span>Вопросов осталось: <b>' + left + '</b> из ' + p.maxQ + '</span><span class="rapport ' + rc + '">Контакт: <b>' + rl + '</b></span></div>' +
      (p.tired ? '<p class="note warn">Ты {устал|устала}: времени на расспрос меньше обычного.</p>' : '');
    if (left > 0) {
      const opts = p.order.q
        .filter((i) => p.asked.indexOf(i) < 0)
        .map((i) => {
          const q = c.q[i];
          const hint = p.hints.q === i;
          return '<button type="button" class="opt ask' + (hint ? ' hinted' : '') + '" data-act="cs-ask" data-arg="' + i + '"><span class="opt-main"><span class="opt-t">' + U.esc(U.t(q.t)) + '</span>' + (hint ? '<span class="hint-tag">клиническое чутьё: важный вопрос</span>' : '') + '</span></button>';
        });
      if (p.rapport < 45 && p.repaired < 2) {
        opts.unshift('<button type="button" class="opt ask repair" data-act="cs-ask" data-arg="repair"><span class="opt-main"><span class="opt-t">' + U.esc(CS.repairText) + '</span><span class="hint-tag">восстановить контакт · тратит вопрос</span></span></button>');
      }
      out += '<div class="opts asks">' + U.t(opts.join('')) + '</div>';
    } else out += '<p class="note">Время беседы вышло. Пора описать статус.</p>';
    out += '<div class="next-row">' + btn('Перейти к осмотру', 'cs-next', null, left === 0 ? 'primary wide' : 'wide') + '</div>';
    return U.t(out);
  };

  ACT.statusStage = function (s, c, p, mode) {
    const exam = mode === 'exam';
    let out = '';
    if (!exam) out += '<details class="talk-fold"><summary>Беседа</summary>' + ACT.transcript(c, p, false) + '</details>';
    out += '<article class="record"><span class="eyebrow">Психический статус</span><p>' + U.esc(c.status.text) + '</p></article>';
    out += '<h2 class="step-h">Какие симптомы вы отмечаете? <span class="dim">Выберите все верные</span></h2><div class="opts">';
    out += p.order.status
      .map((i) => {
        const o = c.status.opts[i];
        const g = o.k ? D.glossary[o.k] : null;
        const name = g ? g.name : o.t;
        const def = g ? g.def : o.def;
        const on = p.sel.status.indexOf(i) >= 0;
        const hint = p.hints.status === i;
        const infoOpen = p.info && p.info[i];
        return (
          '<div class="opt-wrap"><button type="button" class="opt' + (hint ? ' hinted' : '') + '" data-act="cs-toggle" data-arg="status:' + i + '" aria-pressed="' + on + '"><span class="opt-box" aria-hidden="true"></span><span class="opt-main"><span class="opt-t">' + U.esc(name) + '</span>' +
          (hint ? '<span class="hint-tag">клиническое чутьё: это точно есть</span>' : '') +
          (infoOpen && def ? '<span class="opt-sub">' + U.esc(def) + '</span>' : '') +
          '</span></button>' +
          (!exam && def ? '<button type="button" class="info-btn" data-act="cs-info" data-arg="' + i + '" aria-label="Что это?" aria-expanded="' + !!infoOpen + '">' + UI.icon('info') + '</button>' : '') +
          '</div>'
        );
      })
      .join('');
    out += '</div><div class="next-row">' + btn('Записать в карту', 'cs-submit', 'status', 'primary wide', !p.sel.status.length) + '</div>';
    return out;
  };

  ACT.dxStage = function (s, c, p, mode) {
    let out = '';
    if (mode !== 'exam') out += '<details class="talk-fold"><summary>Беседа и статус</summary>' + ACT.transcript(c, p, false) + '<article class="record"><p>' + U.esc(c.status.text) + '</p></article></details>';
    const group = (title, key, opts, order, sel, hintIdx) =>
      '<h2 class="step-h">' + title + '</h2><div class="opts">' +
      order
        .map((i) => {
          const o = opts[i];
          const struck = hintIdx === i;
          return '<button type="button" class="opt' + (struck ? ' struck' : '') + '" data-act="cs-radio" data-arg="' + key + ':' + i + '" aria-pressed="' + (sel === i) + '"><span class="opt-box radio" aria-hidden="true"></span><span class="opt-main"><span class="opt-t">' + U.esc(o.t) + '</span>' + (struck ? '<span class="hint-tag">клиническое чутьё: вряд ли</span>' : '') + '</span></button>';
        })
        .join('') +
      '</div>';
    out += group('Ведущий синдром', 'syn', c.syndrome.opts, p.order.syn, p.sel.syn, null);
    out += group('Диагноз по МКБ-10', 'dx', c.dx.opts, p.order.dx, p.sel.dx, p.hints.dx);
    out += '<div class="next-row">' + btn('Поставить диагноз', 'cs-submit', 'dx', 'primary wide', p.sel.syn == null || p.sel.dx == null) + '</div>';
    return out;
  };

  ACT.txStage = function (s, c, p, mode) {
    let out = '';
    const dx = c.dx.opts[p.sel.dx];
    if (dx) out += '<p class="dx-line"><span class="eyebrow">Ваш диагноз</span><span class="hand">' + U.esc(dx.t) + '</span></p>';
    out += '<h2 class="step-h">Что вы сделаете? <span class="dim">Выберите все нужные шаги</span></h2><div class="opts">';
    out += p.order.tx
      .map((i) => {
        const o = c.tx.opts[i];
        const on = p.sel.tx.indexOf(i) >= 0;
        const warn = p.hints.tx === i;
        return '<button type="button" class="opt" data-act="cs-toggle" data-arg="tx:' + i + '" aria-pressed="' + on + '"><span class="opt-box" aria-hidden="true"></span><span class="opt-main"><span class="opt-t">' + U.esc(o.t) + '</span>' + (warn ? '<span class="hint-tag warn">справочник: осторожно, опасно</span>' : '') + '</span></button>';
      })
      .join('');
    out += '</div><div class="next-row">' + btn('Назначить', 'cs-submit', 'tx', 'primary wide', !p.sel.tx.length) + '</div>';
    return out;
  };

  ACT.resultStage = function (s, c, p, mode, extra) {
    const r = p.result;
    const W = CS.weights(p.parts);
    const grade = r.score >= 85 ? 'Блестяще' : r.score >= 70 ? 'Хорошо' : r.score >= 50 ? 'Удовлетворительно' : 'Есть над чем работать';
    let out = '<section class="result-card"><div class="stamp' + (r.score < 50 ? ' bad' : '') + '"><b>' + r.score + '</b><span>' + grade + '</span></div>';
    out +=
      '<div class="parts">' +
      p.parts
        .map((k) => {
          const v = r.parts[k] || 0;
          const max = Math.round(W[k]);
          return '<div class="part"><span>' + ACT.stageNames[k] + '</span><div class="mini-track"><div style="width:' + (max ? (v / max) * 100 : 0) + '%"></div></div><b>' + v + '/' + max + '</b></div>';
        })
        .join('') +
      '</div>';
    if (r.good.length) out += '<ul class="good">' + r.good.map((x) => '<li>' + U.esc(x) + '</li>').join('') + '</ul>';
    if (r.notes.length) out += '<ul class="notes">' + r.notes.map((x) => '<li>' + U.esc(U.t(x)) + '</li>').join('') + '</ul>';
    if (mode !== 'exam' && r.xp) out += '<div class="delta">' + UI.chip('+' + r.xp + ' опыта', 'pos') + (r.knowGain >= 0.1 ? UI.chip('+' + r.knowGain.toFixed(1).replace('.', ',') + ' · ' + D.domains[c.topic].short, 'pos') : '') + '</div>';
    out += '</section>';

    // Разбор по шагам
    out += '<section class="review">';
    if (p.parts.indexOf('status') >= 0) {
      out += '<h2 class="step-h">Статус</h2><ul class="marks">';
      c.status.opts.forEach((o, i) => {
        const g = o.k ? D.glossary[o.k] : null;
        const name = g ? g.name : o.t;
        const on = p.sel.status.indexOf(i) >= 0;
        if (o.ok && on) out += '<li class="m-ok">' + U.esc(name) + '</li>';
        else if (o.ok && !on) out += '<li class="m-miss">' + U.esc(name) + ' <span class="dim">— пропущено</span>' + (g && g.def ? '<span class="m-def">' + U.esc(g.def) + '</span>' : '') + '</li>';
        else if (!o.ok && on) out += '<li class="m-bad">' + U.esc(name) + ' <span class="dim">— этого нет</span>' + (g && g.def ? '<span class="m-def">' + U.esc(g.def) + '</span>' : '') + '</li>';
      });
      out += '</ul>';
    }
    if (p.parts.indexOf('dx') >= 0) {
      const syn = c.syndrome.opts[p.sel.syn];
      const synOk = c.syndrome.opts.find((o) => o.ok);
      const dx = c.dx.opts[p.sel.dx];
      const dxOk = c.dx.opts.find((o) => o.ok);
      out += '<h2 class="step-h">Синдром и диагноз</h2><ul class="marks">';
      out += syn && syn.ok ? '<li class="m-ok">' + U.esc(syn.t) + '</li>' : '<li class="m-bad">' + U.esc(syn ? syn.t : '—') + (syn && syn.why ? '<span class="m-def">' + U.esc(syn.why) + '</span>' : '') + '</li><li class="m-miss">Верно: ' + U.esc(synOk.t) + '</li>';
      out += dx && dx.ok ? '<li class="m-ok">' + U.esc(dx.t) + '</li>' : '<li class="m-bad">' + U.esc(dx ? dx.t : '—') + (dx && dx.why ? '<span class="m-def">' + U.esc(dx.why) + '</span>' : '') + '</li><li class="m-miss">Верно: ' + U.esc(dxOk.t) + '</li>';
      out += '</ul>';
    }
    if (p.parts.indexOf('tx') >= 0) {
      out += '<h2 class="step-h">Тактика</h2><ul class="marks">';
      c.tx.opts.forEach((o, i) => {
        const on = p.sel.tx.indexOf(i) >= 0;
        if (o.ok && on) out += '<li class="m-ok">' + U.esc(o.t) + '</li>';
        else if (o.ok && !on) out += '<li class="m-miss">' + U.esc(o.t) + ' <span class="dim">— не назначено</span>' + (o.why ? '<span class="m-def">' + U.esc(o.why) + '</span>' : '') + '</li>';
        else if (on) out += '<li class="m-bad' + (o.bad ? ' danger' : '') + '">' + U.esc(o.t) + (o.bad ? ' <span class="chip neg">опасно</span>' : '') + (o.why ? '<span class="m-def">' + U.esc(o.why) + '</span>' : '') + '</li>';
      });
      out += '</ul>';
    }
    out += '<h2 class="step-h">Разбор</h2><div class="prose">' + U.md(c.debrief) + '</div>';
    if (c.pearl) out += '<div class="pearl"><span class="eyebrow">Клиническая жемчужина</span>' + U.md(c.pearl) + '</div>';
    out += '</section>';
    out += '<div class="next-row">' + btn(extra.finishLabel || 'Завершить', 'cs-finish', null, 'primary wide') + '</div>';
    return out;
  };

  UI.on('cs-ask', (arg) => {
    const x = ACT.cur();
    if (!x || CS.questionsLeft(x.p) <= 0) return;
    CS.ask(x.c, x.p, arg === 'repair' ? 'repair' : +arg);
    G.save();
    UI.render({ scroll: 'last' });
  });
  UI.on('cs-next', () => {
    const x = ACT.cur();
    if (!x) return;
    x.p.stage = x.p.parts[x.p.parts.indexOf(x.p.stage) + 1] || 'result';
    G.save();
    UI.render({ scroll: 'top' });
  });
  UI.on('cs-info', (i) => {
    const x = ACT.cur();
    x.p.info = x.p.info || {};
    x.p.info[i] = !x.p.info[i];
    UI.render();
  });
  UI.on('cs-toggle', (arg) => {
    const x = ACT.cur();
    const [k, i] = arg.split(':');
    const arr = x.p.sel[k];
    const n = +i;
    const at = arr.indexOf(n);
    if (at >= 0) arr.splice(at, 1);
    else arr.push(n);
    G.save();
    UI.render();
  });
  UI.on('cs-radio', (arg) => {
    const x = ACT.cur();
    const [k, i] = arg.split(':');
    x.p.sel[k] = +i;
    G.save();
    UI.render();
  });
  UI.on('cs-submit', (stage) => {
    const x = ACT.cur();
    const p = x.p;
    if (stage === 'status' && !p.sel.status.length) return;
    if (stage === 'dx' && (p.sel.syn == null || p.sel.dx == null)) return;
    if (stage === 'tx' && !p.sel.tx.length) return;
    const next = p.parts[p.parts.indexOf(stage) + 1];
    if (next) p.stage = next;
    else {
      const res = CS.score(x.s, x.c, p, x.mode);
      res.patientName = x.c.patient.name;
      CS.reward(x.s, x.c, res);
      p.result = res;
      p.stage = 'result';
      G.after(x.s);
    }
    G.save();
    UI.render({ scroll: 'top' });
  });
  UI.on('cs-finish', () => {
    const x = ACT.cur();
    if (!x) return;
    if (x.mode !== 'exam') {
      ACT.done(x.p.result);
      return;
    }
    const ep = x.ep;
    ep.scores.push(x.p.result.score);
    ep.ti++;
    if (ep.ti < ep.cases.length) ep.task = CS.init(x.s, { id: ep.cases[ep.ti], mode: 'exam', exam: x.exam });
    else {
      ep.task = null;
      ep.stage = 'result';
    }
    G.save();
    UI.render({ scroll: 'top' });
  });

  /* ================= Экзамен ================= */
  ACT.examiners = {
    korsakova: { npc: 'korsakova', room: 'Аудитория 3' },
    kandinsky: { npc: 'kandinsky', room: 'Учебная комната 12' },
    commission: { npc: 'shubin', room: 'Аккредитационный центр' },
  };
  ACT.exam = function (s, step) {
    const def = A.exams.defs[step.exam];
    if (!step.p) {
      step.p = { stage: 'intro', cases: step.tasks.cases || [], test: step.tasks.test || [], ti: 0, task: null, scores: [], tq: 0, tans: [], ticket: U.int(3, 42) };
      G.save();
    }
    const p = step.p;
    const ex = ACT.examiners[def.examiner];
    if (p.stage === 'intro') {
      const t =
        def.examiner === 'commission'
          ? 'Аккредитационный центр, камеры под потолком, вежливая комиссия. Сначала тест — ' + p.test.length + ' вопросов, затем ситуационная задача. Порог теста — 70%, задачи — 50 баллов.'
          : 'Билеты разложены веером на зелёном сукне. ' + (def.examiner === 'korsakova' ? 'Корсакова поправляет очки: «Тяните. И не торопитесь: сначала статус, потом синдром, потом диагноз».' : 'Кандинский постукивает ручкой: «Диагноз вам дадут в условии почти даром. Меня интересует, что вы будете делать».');
      return (
        UI.sceneFig('exam', s) +
        '<div class="story-npc">' + UI.npcPortrait(ex.npc, 'stern') + '</div>' +
        '<section class="story"><span class="eyebrow">' + U.esc(ex.room) + '</span><h1 class="display">' + U.esc(def.title) + '</h1>' + U.md(t) + '<p class="dim small">' + U.esc(def.sub) + '</p></section>' +
        '<div class="next-row">' + btn(p.test.length ? 'Начать тест' : 'Взять билет', 'ex-start', null, 'primary wide') + '</div>'
      );
    }
    const head = '<header class="act-head"><span class="eyebrow">' + U.esc(def.short) + (p.stage === 'tasks' ? ' · билет №' + p.ticket + ' · задача ' + (p.ti + 1) + ' из ' + p.cases.length : '') + '</span></header>';
    if (p.stage === 'test') {
      const q = A.exams.testQuestion(p.test[p.tq]);
      return (
        '<header class="act-head"><span class="eyebrow">Тест · вопрос ' + (p.tq + 1) + ' из ' + p.test.length + '</span></header>' +
        '<section class="quiz"><h2 class="q-text">' + U.esc(q.q) + '</h2><div class="opts">' +
        q.opts.map((o, i) => '<button type="button" class="opt" data-act="ex-test" data-arg="' + i + '"><span class="opt-box radio" aria-hidden="true"></span><span class="opt-main"><span class="opt-t">' + U.esc(o) + '</span></span></button>').join('') +
        '</div><p class="dim small">На экзамене ответы не комментируют. Разбор — в конце.</p></section>'
      );
    }
    if (p.stage === 'tasks') {
      if (!p.task) {
        p.task = CS.init(s, { id: p.cases[p.ti], mode: 'exam', exam: step.exam });
        G.save();
      }
      const c = D.caseById[p.cases[p.ti]];
      return ACT.caseView(s, c, p.task, 'exam', step, { head, finishLabel: p.ti < p.cases.length - 1 ? 'Следующая задача' : 'К итогам экзамена' });
    }
    // Итог
    const res = A.exams.compute({ exam: step.exam, scores: p.scores, cases: p.cases, test: p.test.length ? { right: p.tans.filter((a, i) => a === A.exams.testQuestion(p.test[i]).ok).length, total: p.test.length } : null });
    let grade = res.grade;
    const prev = s.study.exams[step.exam];
    if (prev && grade > 4) grade = 4;
    const gname = A.exams.gradeName(grade);
    const comment =
      grade === 5 ? (def.examiner === 'kandinsky' ? '«Ну что ж. Пациентам с вами повезёт», — Кандинский впервые улыбается.' : '«Отлично. Видно клиническое мышление», — говорит экзаменатор.')
      : grade === 4 ? '«Хорошо. Есть пробелы, но рассуждаете правильно».'
      : grade === 3 ? '«Удовлетворительно. Перед самостоятельной работой — обязательно повторите».'
      : '«К сожалению, нет. Приходите на пересдачу — и повторите разборы».';
    let testReview = '';
    if (p.test.length) {
      const wrong = p.test.map((ref, i) => ({ q: A.exams.testQuestion(ref), a: p.tans[i] })).filter((x) => x.a !== x.q.ok);
      testReview =
        '<h2 class="step-h">Тест: ' + (p.test.length - wrong.length) + ' из ' + p.test.length + '</h2>' +
        (wrong.length ? '<ul class="marks">' + wrong.map((x) => '<li class="m-bad">' + U.esc(x.q.q) + '<span class="m-def">Верно: ' + U.esc(x.q.opts[x.q.ok]) + '. ' + U.esc(x.q.why) + '</span></li>').join('') + '</ul>' : '<p>Без ошибок.</p>');
    }
    return (
      '<section class="result-card exam-result"><span class="eyebrow">' + U.esc(def.title) + '</span><div class="stamp' + (grade < 3 ? ' bad' : '') + '"><b>' + U.esc(gname) + '</b><span>' + res.pct + '%</span></div>' +
      '<div class="zachetka-line"><span>' + U.esc(def.short) + '</span><span class="hand grade">' + A.exams.gradeShort(grade) + '</span><span class="hand sign">' + (grade >= 3 ? U.esc(def.examiner === 'korsakova' ? 'Корсакова' : def.examiner === 'kandinsky' ? 'Кандинский' : 'Комиссия') : '') + '</span></div>' +
      '<p>' + U.esc(comment) + '</p>' +
      (prev && res.grade > 4 ? '<p class="dim small">Пересдача: выше «хорошо» не ставят.</p>' : '') +
      '<div class="parts">' + p.scores.map((sc, i) => '<div class="part"><span>Задача ' + (i + 1) + '</span><div class="mini-track"><div style="width:' + sc + '%"></div></div><b>' + sc + '</b></div>').join('') + '</div>' +
      '</section>' +
      (testReview ? '<section class="review">' + testReview + '</section>' : '') +
      '<div class="next-row">' + btn('Забрать зачётку', 'ex-done', null, 'primary wide') + '</div>'
    );
  };
  UI.on('ex-start', () => {
    const s = A.state;
    const step = s.activity.steps[s.activity.i];
    step.p.stage = step.p.test.length ? 'test' : 'tasks';
    G.save();
    UI.render({ scroll: 'top' });
  });
  UI.on('ex-test', (i) => {
    const s = A.state;
    const step = s.activity.steps[s.activity.i];
    const p = step.p;
    p.tans[p.tq] = +i;
    p.tq++;
    if (p.tq >= p.test.length) p.stage = 'tasks';
    G.save();
    UI.render({ scroll: 'top' });
  });
  UI.on('ex-done', () => {
    const s = A.state;
    const step = s.activity.steps[s.activity.i];
    const p = step.p;
    const test = p.test.length ? { right: p.tans.filter((a, i) => a === A.exams.testQuestion(p.test[i]).ok).length, total: p.test.length } : null;
    ACT.done({ exam: step.exam, scores: p.scores, cases: p.cases, test });
  });

  /* ================= Мини-задачи ================= */
  ACT.mini = function (s, step) {
    const n = A.minis.count(step);
    if (!step.p) {
      step.p = { i: 0, pick: null, right: 0 };
      G.save();
    }
    const p = step.p;
    if (!n) return '<p>Сегодня без сюрпризов.</p>' + btn('Дальше', 'mini-end', null, 'primary wide');
    const m = A.minis.get(step, p.i);
    const look = Object.assign({ sex: m.patient.sex, age: m.patient.age }, m.patient.look || {});
    const seed = m.patient.seed || U.hash(m.id || m.text);
    const answered = p.pick != null;
    let out =
      '<header class="act-head"><span class="eyebrow">' + U.esc(m.setting) + ' · ' + (p.i + 1) + ' из ' + n + '</span></header>' +
      '<div class="patient"><div class="pt-photo">' + A.art.portrait(look, m.patient.emotion || 'neutral', { seed }) + '</div><div class="pt-info"><b class="pt-name">' + U.esc(m.patient.name) + ', ' + m.patient.age + ' ' + U.plural(m.patient.age, ['год', 'года', 'лет']) + '</b></div></div>' +
      '<section class="story">' + U.md(m.text) + '</section><h2 class="step-h">' + U.esc(m.q) + '</h2><div class="opts">';
    out += m.options
      .map((o, i) => {
        let cls = '';
        if (answered) cls = o.ok ? ' correct' : i === p.pick ? ' wrong' : ' dim';
        return (
          '<button type="button" class="opt' + cls + '" data-act="mini-pick" data-arg="' + i + '"' + (answered ? ' aria-disabled="true"' : '') + '><span class="opt-box radio" aria-hidden="true"></span><span class="opt-main"><span class="opt-t">' + U.esc(U.t(o.t)) + '</span>' +
          (answered && (o.ok || i === p.pick) ? '<span class="opt-sub">' + U.esc(U.t(o.why)) + '</span>' : '') +
          '</span></button>'
        );
      })
      .join('');
    out += '</div>';
    if (answered) {
      const ok = m.options[p.pick].ok;
      out += '<div class="feedback ' + (ok ? 'ok' : 'bad') + '"><b>' + (ok ? 'Верное решение.' : 'Не лучшее решение.') + '</b> ' + U.esc(U.t(m.explain)) + '</div>';
      out += '<div class="next-row">' + btn(p.i < n - 1 ? 'Следующий пациент' : 'Завершить', 'mini-next', null, 'primary wide') + '</div>';
    }
    return out;
  };
  UI.on('mini-pick', (i) => {
    const s = A.state;
    const step = s.activity.steps[s.activity.i];
    const p = step.p;
    if (p.pick != null) return;
    const m = A.minis.get(step, p.i);
    p.pick = +i;
    const ok = !!m.options[p.pick].ok;
    if (ok) p.right++;
    A.minis.reward(s, m, ok);
    G.after(s);
    G.save();
    UI.render();
  });
  UI.on('mini-next', () => {
    const s = A.state;
    const step = s.activity.steps[s.activity.i];
    const p = step.p;
    const n = A.minis.count(step);
    if (p.i < n - 1) {
      p.i++;
      p.pick = null;
      G.save();
      UI.render({ scroll: 'top' });
    } else ACT.done({ kind: 'mini', right: p.right, total: n });
  });
  UI.on('mini-end', () => ACT.done({ kind: 'mini', right: 0, total: 0 }));

  /* ================= Расчётный листок ================= */
  ACT.payslip = function (s, step) {
    const d = step.data;
    const rows = (list, sign) =>
      list.length
        ? list.map((r) => '<tr><td>' + U.esc(r[0]) + '</td><td class="num ' + (sign > 0 ? 'pos' : 'neg') + '">' + (sign > 0 ? '+' : '−') + U.groups(r[1]) + '</td></tr>').join('')
        : '<tr><td class="dim" colspan="2">—</td></tr>';
    const sum = (list) => list.reduce((a, r) => a + r[1], 0);
    return (
      '<section class="payslip"><div class="payslip-head"><span class="eyebrow">Расчётный листок</span><h1 class="display">Неделя ' + d.week + '</h1><span class="mono dim">по ' + C.fmtDate(d.until) + '</span></div>' +
      '<div class="table-wrap"><table><tbody>' +
      '<tr class="sec"><th colspan="2">Начислено</th></tr>' + rows(d.accrual, 1) +
      '<tr class="sec"><th colspan="2">Подработки и прочие доходы за неделю</th></tr>' + rows(d.gigs, 1) +
      '<tr class="sec"><th colspan="2">Обязательные расходы</th></tr>' + rows(d.charges, -1) +
      '<tr class="sec"><th colspan="2">Покупки и траты за неделю</th></tr>' + rows(d.spent, -1) +
      '<tr class="total"><td>Итог недели</td><td class="num ' + (d.net >= 0 ? 'pos' : 'neg') + '">' + U.signedMoney(d.net) + '</td></tr>' +
      '<tr class="total"><td>На счету</td><td class="num">' + U.money(d.after) + '</td></tr>' +
      '</tbody></table></div>' +
      (sum(d.charges) > sum(d.accrual) + sum(d.gigs) ? '<p class="note warn">Расходы больше доходов. Подработки или жильё подешевле помогут свести концы с концами.</p>' : '') +
      (d.bailout ? '<p class="note warn">Долг по кредитке превысил лимит. Родители перевели 45 000 ₽ и долго молчали в трубку. Второй раз так не выйдет.</p>' : '') +
      (d.broke ? '<p class="note bad">Долг снова превысил лимит. Банк блокирует карту.</p>' : '') +
      '</section><div class="next-row">' + btn('Дальше', 'step-next', null, 'primary wide') + '</div>'
    );
  };

  /* ================= Магазин ================= */
  ACT.shop = function (s) {
    const items = D.shop.filter((it) => !it.phase || it.phase === s.phase);
    return (
      UI.sceneFig('shop', s, 'Торговый центр') +
      '<header class="act-head"><span class="eyebrow">Магазины</span><h1 class="display">Что купить?</h1><p class="dim">На счету: ' + U.money(s.money) + '. В кредит покупки не оформляются.</p></header>' +
      '<div class="shop-list">' +
      items
        .map((it) => {
          const owned = !!s.items[it.id];
          const can = s.money >= it.price;
          return (
            '<div class="shop-item' + (owned ? ' owned' : '') + '"><div class="shop-main"><b>' + U.esc(it.name) + '</b><span class="dim">' + U.esc(it.desc) + '</span></div>' +
            (owned ? '<span class="chip pos">куплено</span>' : '<button type="button" class="btn small' + (can ? '' : ' ghost') + '" data-act="buy" data-arg="' + it.id + '"' + (can ? '' : ' aria-disabled="true"') + '>' + U.money(it.price) + '</button>') +
            '</div>'
          );
        })
        .join('') +
      '</div><div class="next-row">' + btn('Уйти из магазина', 'step-next', null, 'primary wide') + '</div>'
    );
  };
  UI.on('buy', (id) => {
    const s = A.state;
    const it = D.shopById[id];
    if (!it || s.items[id] || s.money < it.price) return;
    G.apply(s, { money: -it.price }, 'Покупка: ' + it.name.toLowerCase());
    s.items[id] = true;
    if (id === 'course_cbt') G.apply(s, { know: { personality: 12, neurotic: 6 } });
    if (id === 'course_child') G.apply(s, { know: { child: 15 } });
    G.after(s);
    G.save();
    UI.toast('Куплено: ' + U.esc(it.name));
  });

  /* ================= Выбор работы ================= */
  ACT.jobs = function (s) {
    return (
      UI.sceneFig('street', s, 'Предложения о работе') +
      '<header class="act-head"><span class="eyebrow">Трудоустройство</span><h1 class="display">Где работать?</h1><p class="dim">Сменить место позже можно только если позовут. Выбирай по душе и по кошельку.</p></header>' +
      '<div class="jobs">' +
      Object.keys(D.jobs)
        .map((k) => {
          const j = D.jobs[k];
          const r = j.req(s);
          return (
            '<div class="job' + (r ? ' locked' : '') + '"><span class="eyebrow">' + U.esc(j.name) + '</span><b>' + U.esc(j.role) + '</b><p>' + U.esc(j.desc) + '</p>' +
            '<div class="act-chips">' + UI.chip('оклад ' + U.money(j.salary) + '/нед.', '') + (j.perCase ? UI.chip('+' + U.money(j.perCase) + ' за пациента', 'pos') : '') + (j.nightDuty ? UI.chip('дежурства', '') : '') + UI.chip('стресс ' + (j.stress >= 9 ? 'высокий' : j.stress >= 7 ? 'средний' : 'умеренный'), j.stress >= 9 ? 'neg' : '') + '</div>' +
            (r ? '<p class="chip off">' + U.esc(r) + '</p>' : btn('Выбрать', 'job-pick', k, 'primary')) +
            '</div>'
          );
        })
        .join('') +
      '</div>'
    );
  };
  UI.on('job-pick', (k) => {
    const s = A.state;
    const j = D.jobs[k];
    if (!j || j.req(s)) return;
    G.startCareer(s, k);
    G.say(s, 'Ты {принял|приняла} предложение: ' + j.role.toLowerCase() + ', ' + j.name + '. Первый рабочий день — в ближайший будний день, утром.' + (s.housing === 'dorm' ? ' Из общежития придётся съехать в течение двух недель.' : ''));
    ACT.done({ job: k });
  });

  /* ================= Финал ================= */
  ACT.ending = function (s, step) {
    const e = (D.endings || {})[step.id] || { title: 'Конец главы', scene: 'title', kind: 'good', text: 'История продолжается.' };
    if (!step.p) {
      step.p = { text: typeof e.text === 'function' ? e.text(s) : e.text };
      if (e.kind === 'bad') s.ended = step.id;
      G.save();
    }
    const stat = (l, v) => '<div class="stat"><span>' + l + '</span><b>' + v + '</b></div>';
    return (
      UI.sceneFig(e.scene || 'title', s) +
      '<section class="story ending"><span class="eyebrow">' + (e.kind === 'bad' ? 'Финал' : 'Мечта сбылась') + '</span><h1 class="display">' + U.esc(U.t(e.title)) + '</h1>' + U.md(step.p.text) + '</section>' +
      '<section class="card"><div class="stats">' +
      stat('Дней в игре', s.day) + stat('Пациентов', s.stats.cases) + stat('Верных диагнозов', s.stats.dxRight) + stat('Ночных смен', s.stats.nights) + stat('Репутация', Math.round(s.rep)) + stat('На счету', U.money(s.money)) + stat('Достижений', Object.keys(s.ach).length + ' из ' + Object.keys(D.achievements).length) +
      '</div></section>' +
      '<div class="next-row col">' +
      (e.kind === 'bad' ? btn('Вернуться к началу недели', 'end-cp', null, 'primary wide') + btn('Начать заново', 'new', null, 'wide') : btn('Жить дальше', 'step-next', null, 'primary wide') + btn('Новая игра', 'new', null, 'wide')) +
      '</div>'
    );
  };
  UI.on('end-cp', () => {
    const cp = A.store.readLocal('checkpoint');
    if (!cp) {
      UI.toast('Чекпоинта нет — придётся начать заново.');
      return;
    }
    A.state = A.migrate(cp);
    G.save();
    UI.view.tab = 'hub';
    UI.render({ scroll: 'top' });
  });
})((window.A = window.A || {}));
