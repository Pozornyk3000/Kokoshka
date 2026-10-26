/* Тренажёр: тесты вне игры. Банк — вопросы блиц-опросов лекций, теста аккредитации и отдельного банка
   (js/data/tests-*.js); ситуационные задачи «поставьте диагноз» — по виньеткам клинических случаев с выбором
   из полного списка МКБ-10. Все вопросы написаны для игры — это не официальные задания аккредитации; ссылка на
   настоящий репетиционный экзамен — T.OFFICIAL.
   Уровни вопросов: 1 — базовый, 2 — средний, 3 — сложный. Свои достижения у тренажёра (T.ACH).
   На игру не влияет: результаты, ошибки и достижения хранятся в настройках устройства. */
(function (A) {
  'use strict';
  const U = A.util;
  const D = () => A.data;
  const T = (A.trainer = {});

  T.PASS = 70;
  T.MIN_TOPIC = 4; // меньше вопросов на выбранном уровне — тест по теме недоступен
  /** Официальный репетиционный экзамен Методического центра аккредитации специалистов (открывается в браузере). */
  T.OFFICIAL = { exam: 'https://selftest.mededtech.ru/', site: 'https://fmza.ru/' };
  T.KINDS = {
    accr20: { name: 'Тест в формате аккредитации', short: 'Формат аккредитации, 20', n: 20, exam: true },
    accr80: { name: 'Полный тест в формате аккредитации', short: 'Формат аккредитации, 80', n: 80, exam: true },
    topic: { name: 'Тест по теме', n: 10 },
    mistakes: { name: 'Работа над ошибками', n: 15 },
    dx: { name: 'Диагноз по МКБ-10', n: 8 },
  };
  T.LEVELS = {
    0: { name: 'Все уровни', short: 'все' },
    1: { name: 'Базовый', short: 'базовый' },
    2: { name: 'Средний', short: 'средний' },
    3: { name: 'Сложный', short: 'сложный' },
  };

  /* ---------- Банк ---------- */
  // Вопросы лекций без уровня: клиническая ситуация — средний, вопрос на знание — базовый; вопросы теста аккредитации — средний
  const VIGNETTE = /\d+ (лет|года|год)\b|Пациент|Женщин|Мужчин|Студент|Девушк|Мальчик|Подрост|Девочк|Мать |Жена |представитель|Начальник|Санитар|Родител|ребён/;
  T.levelOf = function (ref, q) {
    if (!q) return 1;
    if (q.lvl) return q.lvl;
    if (String(ref).indexOf('x:') === 0) return 2;
    return VIGNETTE.test(q.q) ? 2 : 1;
  };
  let bankCache = null;
  /** Весь банк тестовых вопросов: { ref, topic, lvl }. */
  T.bank = function () {
    const n = (D().lectures || []).length + ':' + (D().extraTest || []).length + ':' + (D().testBank || []).length;
    if (bankCache && bankCache.n === n) return bankCache.list;
    const out = [];
    (D().lectures || []).forEach((L) => (L.quiz || []).forEach((q, i) => out.push({ ref: L.id + ':' + i, topic: L.domain, lvl: T.levelOf(L.id + ':' + i, q) })));
    (D().extraTest || []).forEach((q, i) => out.push({ ref: 'x:' + i, topic: q.topic || 'emergency', lvl: T.levelOf('x:' + i, q) }));
    (D().testBank || []).forEach((q) => out.push({ ref: 't:' + q.id, topic: q.topic, lvl: T.levelOf('t:' + q.id, q) }));
    bankCache = { n, list: out };
    return out;
  };
  T.pool = (lvl) => T.bank().filter((x) => !lvl || x.lvl === lvl);
  T.question = function (ref) {
    const [a, b] = String(ref).split(':');
    if (a === 'x') return (D().extraTest || [])[+b] || null;
    if (a === 't') return (D().testBankById || {})[b] || null;
    const L = (D().lectureById || {})[a];
    return L ? (L.quiz || [])[+b] || null : null;
  };
  T.refLevel = (ref) => T.levelOf(ref, T.question(ref));
  T.topicCount = (topic, lvl) => T.pool(lvl).filter((x) => x.topic === topic).length;

  /** Задачи на диагноз: клинические случаи с виньеткой; уровень — сложность случая. */
  T.dxPool = (lvl) =>
    (D().cases || [])
      .filter((c) => c.vignette && c.dx && c.dx.opts && c.dx.opts.some((o) => o.ok) && (!lvl || (c.difficulty || 2) === lvl))
      .map((c) => 'c:' + c.id);
  T.dxTask = function (ref) {
    const id = String(ref).slice(2);
    return (D().caseById || {})[id] || null;
  };

  /* ---------- Настройки устройства ---------- */
  const BLANK = () => ({ best: {}, wrong: [], runs: 0, answered: 0, streak: 0, bestStreak: 0, right: [], ach: {}, failed: {}, lvl: 0 });
  const store = () => Object.assign(BLANK(), (A.store && A.store.prefs ? A.store.prefs().trainer : null) || {});
  const put = (st) => A.store && A.store.setPref && A.store.setPref('trainer', st);
  T.stats = store;
  T.wrongRefs = () => store().wrong.filter((r) => T.question(r));
  T.bestKey = (kind, topic, lvl) => (kind === 'topic' ? 'topic_' + topic : kind) + (lvl ? '_l' + lvl : '');
  T.best = (kind, topic, lvl) => store().best[T.bestKey(kind, topic, lvl)];
  T.setLevel = function (lvl) {
    const st = store();
    st.lvl = T.LEVELS[lvl] ? +lvl : 0;
    put(st);
  };

  /** Новый прогон. kind — ключ T.KINDS; topic — для теста по теме; lvl — уровень (0 — все). */
  T.start = function (kind, topic, lvl) {
    const K = T.KINDS[kind];
    if (!K) return null;
    lvl = T.LEVELS[lvl] ? +lvl : 0;
    if (kind === 'mistakes') lvl = 0;
    let refs;
    if (kind === 'dx') refs = U.shuffle(T.dxPool(lvl)).slice(0, K.n);
    else if (kind === 'mistakes') refs = U.shuffle(T.wrongRefs()).slice(0, K.n);
    else if (kind === 'topic') {
      const pool = T.pool(lvl).filter((x) => x.topic === topic);
      if (pool.length < T.MIN_TOPIC) return null;
      refs = U.shuffle(pool).slice(0, K.n).map((x) => x.ref);
    } else {
      // как на аккредитации: вопросы из всех тем поровну, без повторов
      const byTopic = {};
      U.shuffle(T.pool(lvl)).forEach((x) => (byTopic[x.topic] = byTopic[x.topic] || []).push(x.ref));
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
    return { kind, topic: topic || null, lvl, refs, order, i: 0, ans: [], shown: false, done: false };
  };

  /** Ответ на текущий вопрос: для тестов — индекс варианта, для задач — ключ МКБ-10. */
  T.answer = function (run, a) {
    if (!run || run.done || run.ans[run.i] != null) return null;
    run.ans[run.i] = a;
    run.shown = !T.KINDS[run.kind].exam;
    const r = T.check(run, run.i);
    // статистика для достижений: всего ответов, серия верных подряд, вопросы, на которые хоть раз ответили верно
    const st = store();
    st.answered++;
    st.streak = r.score === 1 ? st.streak + 1 : 0;
    st.bestStreak = Math.max(st.bestStreak, st.streak);
    if (r.score === 1 && run.kind !== 'dx' && st.right.indexOf(run.refs[run.i]) < 0) st.right.push(run.refs[run.i]);
    put(st);
    return r;
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
    // лучшие результаты (по виду теста и уровню), вопросы с ошибками — в настройках устройства
    const st = store();
    const key = T.bestKey(run.kind, run.topic, run.lvl);
    st.best[key] = Math.max(st.best[key] || 0, run.pct);
    st.runs++;
    const wrongBefore = st.wrong.length;
    if (run.kind !== 'dx') {
      const wrong = new Set(st.wrong);
      run.refs.forEach((r, i) => {
        if (T.check(run, i).score === 1) wrong.delete(r);
        else wrong.add(r);
      });
      st.wrong = Array.from(wrong).slice(-200);
    }
    run.newAch = achieve(st, run, wrongBefore);
    put(st);
    return run;
  };

  /* ---------- Достижения тренажёра ---------- */
  T.ACH = [
    { id: 'first', name: 'Первый шаг', desc: 'Завершить первый тест в тренажёре.' },
    { id: 'pass20', name: 'Допуск', desc: 'Сдать тест в формате аккредитации на 20 вопросов — от 70%.' },
    { id: 'pass80', name: 'Как на настоящей', desc: 'Сдать полный тест на 80 вопросов.' },
    { id: 'ace80', name: 'Отличник', desc: '90% и больше в полном тесте на 80 вопросов.' },
    { id: 'hard_pass', name: 'Без поблажек', desc: 'Сдать тест в формате аккредитации на сложном уровне.' },
    { id: 'hard_ace', name: 'Профессор', desc: 'Ни одной ошибки в тесте сложного уровня от 10 вопросов.' },
    { id: 'topic_ace', name: 'В теме', desc: '100% в тесте по теме.' },
    { id: 'all_topics', name: 'Все темы', desc: 'От 70% в тестах по каждой из десяти тем.' },
    { id: 'all_topics_hard', name: 'Широкий кругозор', desc: 'От 70% в тестах по каждой теме на сложном уровне.' },
    { id: 'streak10', name: 'Серия', desc: '10 верных ответов подряд.' },
    { id: 'streak30', name: 'Неудержимый', desc: '30 верных ответов подряд.' },
    { id: 'comeback', name: 'Вторая попытка', desc: 'Сдать тест в формате аккредитации после проваленного.' },
    { id: 'clean', name: 'Работа над собой', desc: 'Очистить список ошибок, в котором было не меньше 10 вопросов.' },
    { id: 'dx_ace', name: 'Диагност', desc: 'Все задачи на диагноз по МКБ-10 в прогоне — без единой ошибки.' },
    { id: 'q300', name: 'Триста вопросов', desc: 'Ответить в тренажёре на 300 вопросов.' },
    { id: 'bank', name: 'Весь банк', desc: 'Хотя бы раз верно ответить на каждый вопрос банка.' },
    { id: 'official', name: 'К настоящему экзамену', desc: 'Открыть официальный репетиционный экзамен.' },
  ];
  T.achList = function () {
    const got = store().ach;
    return T.ACH.map((a) => Object.assign({ got: got[a.id] || null }, a));
  };
  T.achName = (id) => (T.ACH.find((a) => a.id === id) || {}).name || id;
  /** Открыть достижение вне прогона (например, переход на официальный экзамен). Возвращает true, если оно новое. */
  T.unlock = function (id) {
    const st = store();
    if (st.ach[id] || !T.ACH.some((a) => a.id === id)) return false;
    st.ach[id] = Date.now();
    put(st);
    return true;
  };
  const topBest = (st, topic, lvl) =>
    Object.keys(st.best)
      .filter((k) => (lvl ? k === 'topic_' + topic + '_l' + lvl : k === 'topic_' + topic || k.indexOf('topic_' + topic + '_l') === 0))
      .reduce((m, k) => Math.max(m, st.best[k] || 0), 0);
  function achieve(st, run, wrongBefore) {
    const got = [];
    const give = (id, cond) => {
      if (cond && !st.ach[id]) {
        st.ach[id] = Date.now();
        got.push(id);
      }
    };
    const accr = run.kind === 'accr20' || run.kind === 'accr80';
    give('first', true);
    give('pass20', run.kind === 'accr20' && run.pass);
    give('pass80', run.kind === 'accr80' && run.pass);
    give('ace80', run.kind === 'accr80' && run.pct >= 90);
    give('hard_pass', accr && run.lvl === 3 && run.pass);
    give('hard_ace', run.lvl === 3 && run.kind !== 'dx' && run.refs.length >= 10 && run.pct === 100);
    give('topic_ace', run.kind === 'topic' && run.pct === 100);
    const keys = D().domainKeys || [];
    give('all_topics', keys.length && keys.every((k) => topBest(st, k, 0) >= T.PASS));
    give('all_topics_hard', keys.length && keys.every((k) => topBest(st, k, 3) >= T.PASS));
    give('streak10', st.bestStreak >= 10);
    give('streak30', st.bestStreak >= 30);
    if (accr) {
      give('comeback', run.pass && !!st.failed[run.kind]);
      if (!run.pass) st.failed[run.kind] = true;
    }
    give('clean', run.kind === 'mistakes' && wrongBefore >= 10 && st.wrong.length === 0);
    give('dx_ace', run.kind === 'dx' && run.refs.length >= 5 && run.pct === 100);
    give('q300', st.answered >= 300);
    const right = new Set(st.right);
    give('bank', T.bank().every((x) => right.has(x.ref)));
    return got;
  }
})((window.A = window.A || {}));
