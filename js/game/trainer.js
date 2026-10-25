/* Тренажёр: тесты вне игры. Банк — вопросы блиц-опросов лекций, теста аккредитации и отдельного банка (js/data/tests-*.js);
   ситуационные задачи «поставьте диагноз» — по виньеткам клинических случаев с выбором из полного списка МКБ-10.
   На игру не влияет: лучшие результаты и вопросы с ошибками хранятся в настройках устройства. */
(function (A) {
  'use strict';
  const U = A.util;
  const D = () => A.data;
  const T = (A.trainer = {});

  T.PASS = 70;
  T.KINDS = {
    accr20: { name: 'Тест как на аккредитации', short: 'Аккредитация, 20', n: 20, exam: true },
    accr60: { name: 'Полный тест как на аккредитации', short: 'Аккредитация, 60', n: 60, exam: true },
    topic: { name: 'Тест по теме', n: 10 },
    mistakes: { name: 'Работа над ошибками', n: 15 },
    dx: { name: 'Диагноз по МКБ-10', n: 8 },
  };

  /** Весь банк тестовых вопросов: { ref, topic }. */
  T.bank = function () {
    const out = [];
    (D().lectures || []).forEach((L) => (L.quiz || []).forEach((q, i) => out.push({ ref: L.id + ':' + i, topic: L.domain })));
    (D().extraTest || []).forEach((q, i) => out.push({ ref: 'x:' + i, topic: q.topic || 'emergency' }));
    (D().testBank || []).forEach((q) => out.push({ ref: 't:' + q.id, topic: q.topic }));
    return out;
  };
  T.question = function (ref) {
    const [a, b] = String(ref).split(':');
    if (a === 'x') return (D().extraTest || [])[+b] || null;
    if (a === 't') return (D().testBankById || {})[b] || null;
    const L = (D().lectureById || {})[a];
    return L ? (L.quiz || [])[+b] || null : null;
  };
  T.topicCount = (topic) => T.bank().filter((x) => x.topic === topic).length;

  /** Задачи на диагноз: клинические случаи с виньеткой. */
  T.dxPool = () => (D().cases || []).filter((c) => c.vignette && c.dx && c.dx.opts && c.dx.opts.some((o) => o.ok)).map((c) => 'c:' + c.id);
  T.dxTask = function (ref) {
    const id = String(ref).slice(2);
    return (D().caseById || {})[id] || null;
  };

  /* ---------- Настройки устройства ---------- */
  const store = () => (A.store && A.store.prefs ? A.store.prefs().trainer : null) || { best: {}, wrong: [], runs: 0 };
  const put = (st) => A.store && A.store.setPref && A.store.setPref('trainer', st);
  T.stats = store;
  T.wrongRefs = () => store().wrong.filter((r) => T.question(r));

  /** Новый прогон. kind — ключ T.KINDS; topic — для теста по теме. */
  T.start = function (kind, topic) {
    const K = T.KINDS[kind];
    if (!K) return null;
    let refs;
    if (kind === 'dx') refs = U.shuffle(T.dxPool()).slice(0, K.n);
    else if (kind === 'mistakes') refs = U.shuffle(T.wrongRefs()).slice(0, K.n);
    else if (kind === 'topic') refs = U.shuffle(T.bank().filter((x) => x.topic === topic)).slice(0, K.n).map((x) => x.ref);
    else {
      // как на аккредитации: вопросы из всех тем, без повторов
      const byTopic = {};
      U.shuffle(T.bank()).forEach((x) => (byTopic[x.topic] = byTopic[x.topic] || []).push(x.ref));
      refs = [];
      const keys = Object.keys(byTopic);
      while (refs.length < K.n && keys.some((k) => byTopic[k].length)) keys.forEach((k) => byTopic[k].length && refs.length < K.n && refs.push(byTopic[k].pop()));
      refs = U.shuffle(refs);
    }
    if (!refs.length) return null;
    // порядок вариантов в каждом вопросе перемешан
    const order = refs.map((r) => {
      if (kind === 'dx') return null;
      const q = T.question(r);
      return U.shuffle(q.opts.map((o, i) => i));
    });
    return { kind, topic: topic || null, refs, order, i: 0, ans: [], shown: false, done: false };
  };

  /** Ответ на текущий вопрос: для тестов — индекс варианта, для задач — ключ МКБ-10. */
  T.answer = function (run, a) {
    if (!run || run.done || run.ans[run.i] != null) return null;
    run.ans[run.i] = a;
    run.shown = !T.KINDS[run.kind].exam;
    return T.check(run, run.i);
  };
  /** Верно ли: { score 0..1, right, why }. */
  T.check = function (run, i) {
    const ref = run.refs[i];
    const a = run.ans[i];
    if (run.kind === 'dx') {
      const c = T.dxTask(ref);
      const j = A.icd.judge(c.dx.opts, a);
      return { score: j.score, right: j.right ? j.right.t : '', why: j.opt && j.opt.why ? j.opt.why : j.cat ? 'Рубрика верная, но уточнение другое.' : '', pearl: c.pearl || '' };
    }
    const q = T.question(ref);
    return { score: a === q.ok ? 1 : 0, right: q.opts[q.ok], why: q.why || '' };
  };
  T.next = function (run) {
    if (!run || run.done) return;
    if (run.i < run.refs.length - 1) {
      run.i++;
      run.shown = false;
    } else T.finish(run);
  };
  T.finish = function (run) {
    run.done = true;
    let sum = 0;
    run.refs.forEach((r, i) => (sum += run.ans[i] != null ? T.check(run, i).score : 0));
    run.right = Math.round(sum * 10) / 10;
    run.pct = Math.round((sum / run.refs.length) * 100);
    run.pass = run.pct >= T.PASS;
    // лучшие результаты и вопросы с ошибками — в настройках устройства
    const st = store();
    st.best = st.best || {};
    const key = run.kind === 'topic' ? 'topic_' + run.topic : run.kind;
    st.best[key] = Math.max(st.best[key] || 0, run.pct);
    st.runs = (st.runs || 0) + 1;
    if (run.kind !== 'dx') {
      const wrong = new Set(st.wrong || []);
      run.refs.forEach((r, i) => {
        if (T.check(run, i).score === 1) wrong.delete(r);
        else wrong.add(r);
      });
      st.wrong = Array.from(wrong).slice(-200);
    }
    put(st);
    return run;
  };
})((window.A = window.A || {}));
