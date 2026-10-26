/* Активности: клинические случаи (оценка), лекции, семинары, экзамены, мини-задачи. */
(function (A) {
  'use strict';
  const U = A.util;
  const D = A.data;
  const G = A.game;

  /* ================= Клинический случай ================= */
  const CS = (A.cases = {});
  CS.byId = (id) => D.caseById[id];

  /** Набор шагов для режима. */
  CS.parts = function (mode, exam) {
    if (mode === 'exam') return A.exams.defs[exam].parts;
    return ['talk', 'status', 'dx', 'tx'];
  };
  CS.weights = function (parts) {
    const base = { talk: 25, status: 25, dx: 25, tx: 25 };
    const sum = parts.reduce((a, p) => a + base[p], 0);
    const w = {};
    parts.forEach((p) => (w[p] = (base[p] / sum) * 100));
    return w;
  };

  /** Начальный прогресс случая. */
  CS.init = function (s, step) {
    const c = CS.byId(step.id);
    const r = U.mulberry32(U.hash(step.id + ':' + s.day + ':' + s.slot));
    const parts = CS.parts(step.mode, step.exam);
    const order = (n) => U.shuffle(Array.from({ length: n }, (_, i) => i), r);
    const p = {
      parts,
      stage: parts[0],
      asked: [],
      rapport: 60 - (s.stress > 70 ? 10 : 0) + (s.rep >= 40 ? 5 : 0),
      repaired: 0,
      sel: { status: [], syn: null, dx: null, dxKey: null, tx: [] },
      order: {
        q: order(c.q.length),
        status: order(c.status.opts.length),
        syn: order(c.syndrome.opts.length),
        dx: order(c.dx.opts.length),
        tx: order(c.tx.opts.length),
      },
      maxQ: 0,
      qBase: (c.maxQ || 5) - (G.hard(s) ? 1 : 0),
      qMods: G.difficulty(s) === 'easy' ? [] : CS.budgetMods(s, c, G.hard(s)),
      // лёгкая игра: беседа без ограничения вопросов (оценка — как за обычные пять)
      free: G.difficulty(s) === 'easy',
      log: [],
      tired: s.energy < 30 || s.flags.wokeTired,
      hard: G.hard(s),
      hints: CS.hints(s, c, step.mode),
      result: null,
    };
    // Порядок вопросов: оставляем авторскую логику — сначала «открывающие», но слегка перемешиваем
    p.order.q = Array.from({ length: c.q.length }, (_, i) => i);
    p.maxQ = p.free ? c.q.length + 2 : CS.budget(p);
    return p;
  };

  /* ---------- Время беседы ----------
     Обычная игра: вопросов по сценарию случая (обычно 5), усталость отнимает по одному, но не меньше трёх.
     Сложная игра: база на вопрос меньше; усталость, недосып, стресс и ночь отнимают, опыт в теме добавляет,
     а по ходу беседы — контакт: пациент разговорился — ещё вопрос, замкнулся — на вопрос меньше. Не меньше двух. */
  CS.Q_MIN = 3;
  CS.Q_MIN_HARD = 2;
  CS.Q_MAX_ADD = 3;
  CS.budgetMods = function (s, c, hard) {
    const m = [];
    const add = (k, v, t) => m.push({ k, v, t });
    if (!hard) {
      if (s.energy < 30) add('tired', -1, 'усталость');
      if (s.flags.wokeTired) add('sleep', -1, 'не выспал{ся|ась}');
      return m;
    }
    if (s.energy < 30) add('tired', -2, 'сильная усталость');
    else if (s.energy < 55) add('tired', -1, 'усталость');
    if (s.flags.wokeTired) add('sleep', -1, 'не выспал{ся|ась}');
    if (s.stress > 70) add('stress', -1, 'стресс');
    if (s.slot === 3) add('night', -1, 'ночь');
    if ((s.know[c.topic] || 0) >= 70) add('know', 1, 'опыт в теме');
    return m;
  };
  CS.budget = (p) => U.clamp(p.qBase + (p.qMods || []).reduce((a, x) => a + x.v, 0), p.hard ? CS.Q_MIN_HARD : CS.Q_MIN, p.qBase + CS.Q_MAX_ADD);
  // сложная игра: контакт меняет время беседы — один раз в каждую сторону
  CS.GOOD_RAPPORT = 70;
  CS.LOST_RAPPORT = 30;
  function contactShift(p) {
    if (!p.hard || !p.qMods) return null;
    const has = (k) => p.qMods.some((x) => x.k === k);
    let ev = null;
    if (p.rapport >= CS.GOOD_RAPPORT && !has('contact')) {
      p.qMods.push({ k: 'contact', v: 1, t: 'пациент разговорился' });
      ev = { lvl: 'ok', head: 'Контакт', text: 'Пациент разговорился — беседа идёт легче: ещё один вопрос.' };
    } else if (p.rapport < CS.LOST_RAPPORT && !has('closed')) {
      p.qMods.push({ k: 'closed', v: -1, t: 'пациент замкнулся' });
      ev = { lvl: 'bad', head: 'Контакт', text: 'Пациент замкнулся — беседа сворачивается: на один вопрос меньше.' };
    }
    if (ev) p.maxQ = Math.max(p.asked.length, CS.budget(p));
    return ev;
  }

  /* ---------- Комментарий к каждому вопросу ---------- */
  CS.CRIT_OK = {
    suicide: 'О суицидальных мыслях спрашивают прямо: вопрос не подталкивает к суициду, а помогает оценить риск.',
    substance: 'Алкоголь и другие вещества — частая причина и «маска» психических нарушений.',
    somatic: 'Соматические и лекарственные причины исключают в первую очередь.',
    safety: 'Риск для пациента и окружающих определяет всю тактику.',
    mania: 'Подъёмы настроения в прошлом меняют диагноз: при биполярном расстройстве антидепрессант без нормотимика опасен.',
    onset: 'Острое начало — главный признак делирия и органического поражения.',
    child: 'При послеродовых нарушениях безопасность ребёнка — обязательный вопрос.',
    meds: 'Принимаемые лекарства — частая причина неотложных состояний и опасных взаимодействий.',
  };
  /** Оценка заданного вопроса: { lvl: ok|part|bad, head, text }. low — контакт был потерян до вопроса. */
  CS.verdict = function (c, qi, low, rapBefore) {
    if (qi === 'repair') {
      return rapBefore < CS.LOST_RAPPORT
        ? { lvl: 'ok', head: 'Верно', text: 'Признать, что говорить трудно, и объяснить цель расспроса — так возвращают доверие. Без этого ответов не услышать.' }
        : { lvl: 'ok', head: 'Уместно', text: 'Контакт натянут: пауза и объяснение, зачем вы спрашиваете, помогают пациенту раскрыться.' };
    }
    const q = c.q[qi];
    if (!q) return null;
    if (q.v < 0) return { lvl: 'bad', head: 'Ошибка', text: U.cap(q.bad || 'такой вопрос вредит контакту') + '.' };
    let v;
    if (q.crit) v = { lvl: 'ok', head: 'Верно', text: 'Обязательный вопрос. ' + (CS.CRIT_OK[q.crit] || '') };
    else if (q.key) v = { lvl: 'ok', head: 'Верно', text: 'Ключевой вопрос: ответ прямо влияет на диагноз и тактику.' };
    else if (q.v >= 3) v = { lvl: 'ok', head: 'Верно', text: 'Очень полезный вопрос.' };
    else if (q.v >= 2) v = { lvl: 'ok', head: 'Верно', text: 'Полезный вопрос: уточняет картину.' };
    else if (q.v >= 1) v = { lvl: 'part', head: 'Можно лучше', text: 'Вопрос мало что даёт: время беседы ограничено — сначала главное.' };
    else v = { lvl: 'part', head: 'Лишний вопрос', text: 'К диагнозу и тактике он ничего не добавляет.' };
    if (low) v = { lvl: 'part', head: v.lvl === 'ok' ? 'Вопрос верный, но' : 'Контакт потерян', text: 'Пациент ушёл от ответа: контакт потерян. Сначала восстановите доверие — иначе ответов не услышать.' };
    return v;
  };

  /** Подсказки «клинического чутья» в зависимости от знаний темы. */
  CS.hints = function (s, c, mode) {
    const k = s.know[c.topic] || 0;
    const diff = G.difficulty(s);
    let level = k >= 75 ? 3 : k >= 55 ? 2 : k >= 35 ? 1 : 0;
    if (diff === 'easy') level = Math.min(3, Math.max(1, level + 1));
    if (diff === 'hard') level = 0;
    const h = { level };
    const r = U.mulberry32(U.hash(c.id + s.player.name));
    if (h.level >= 1) {
      const keys = c.q.map((q, i) => (q.key || q.crit ? i : -1)).filter((i) => i >= 0);
      if (keys.length) h.q = U.pick(keys, r);
    }
    if (h.level >= 2) {
      const ok = c.status.opts.map((o, i) => (o.ok ? i : -1)).filter((i) => i >= 0);
      if (ok.length) h.status = U.pick(ok, r);
    }
    if (h.level >= 3) {
      const wrong = c.dx.opts.map((o, i) => (!o.ok && !o.part ? i : -1)).filter((i) => i >= 0);
      if (wrong.length) h.dx = U.pick(wrong, r);
    }
    if (s.items.pharmguide) {
      const bad = c.tx.opts.map((o, i) => (o.bad ? i : -1)).filter((i) => i >= 0);
      if (bad.length) h.tx = U.pick(bad, r);
    }
    return h;
  };

  CS.repairText = '«Я вижу, что говорить об этом непросто. Я спрашиваю, чтобы понять, как вам помочь. Вы можете не отвечать, если не готовы».';

  /** Задать вопрос. В p.log[n] — комментарий к n-му вопросу (и событие контакта на сложном уровне). */
  CS.ask = function (c, p, qi) {
    p.log = p.log || [];
    const rapBefore = p.rapport;
    if (qi === 'repair') {
      p.asked.push('repair');
      p.repaired++;
      p.rapport = U.clamp(p.rapport + 18, 0, 100);
      p.log[p.asked.length - 1] = { v: CS.verdict(c, 'repair', false, rapBefore), ev: contactShift(p) };
      return;
    }
    const q = c.q[qi];
    if (!q || p.asked.indexOf(qi) >= 0) return;
    const lowBefore = p.rapport < CS.LOST_RAPPORT;
    p.asked.push(qi);
    // на сложном уровне хорошие вопросы заметнее укрепляют контакт
    const gain = p.hard ? (q.v >= 3 ? 6 : q.v >= 2 ? 4 : q.v > 0 ? 1 : 0) : q.v > 0 ? 2 : 0;
    p.rapport = U.clamp(p.rapport + (q.rap != null ? q.rap : gain), 0, 100);
    if (lowBefore && !q.always) p.evasive = (p.evasive || []).concat([qi]);
    p.log[p.asked.length - 1] = { v: CS.verdict(c, qi, lowBefore && !q.always, rapBefore), ev: contactShift(p) };
  };
  CS.questionsLeft = (p) => p.maxQ - p.asked.length;
  CS.evasive = function (c, qi) {
    const lines = c.evasive || ['«Не знаю… Не хочу сейчас об этом».', '(пожимает плечами и смотрит в сторону)', '«Какая разница? Вы всё равно не поймёте».'];
    return lines[qi % lines.length];
  };

  /** Итоговая оценка. */
  CS.score = function (s, c, p, mode) {
    const parts = p.parts;
    const W = CS.weights(parts);
    const res = { kind: 'case', caseId: c.id, mode, parts: {}, notes: [], good: [], flags: {}, score: 0 };

    if (parts.indexOf('talk') >= 0) {
      const pos = c.q.map((q) => q.v).filter((v) => v > 0).sort((a, b) => b - a);
      const best = pos.slice(0, p.free ? c.maxQ || 5 : p.maxQ).reduce((a, b) => a + b, 0) || 1;
      let got = 0;
      p.asked.forEach((qi) => {
        if (qi === 'repair') return;
        const q = c.q[qi];
        const ev = p.evasive && p.evasive.indexOf(qi) >= 0;
        if (q.v > 0) got += ev ? q.v * 0.3 : q.v;
        else got += q.v;
        if (q.v < 0 && q.bad) res.notes.push('Вопрос «' + q.t + '» — ' + q.bad + '.');
      });
      let frac = U.clamp(got / best, 0, 1);
      const missed = [];
      c.q.forEach((q, i) => {
        if (q.crit && p.asked.indexOf(i) < 0) missed.push(q);
      });
      missed.forEach((q) => {
        frac -= 0.3;
        res.notes.push(CS.critNote(q.crit, q.t));
      });
      const askedCrit = c.q.filter((q, i) => q.crit && p.asked.indexOf(i) >= 0);
      res.askedSuicide = askedCrit.some((q) => q.crit === 'suicide');
      res.missedCrit = missed.map((q) => q.crit);
      if (p.rapport < 30) {
        frac -= 0.15;
        res.notes.push('Контакт с пациентом был потерян: часть ответов вы так и не услышали. Вопросы без оценки и упрёков, нормализация чувств и объяснение цели расспроса возвращают доверие.');
      } else if (p.rapport >= 70) res.good.push('Хороший контакт: пациент раскрылся.');
      res.parts.talk = Math.round(U.clamp(frac, 0, 1) * W.talk);
    }

    if (parts.indexOf('status') >= 0) {
      const ok = c.status.opts.filter((o) => o.ok).length || 1;
      let tp = 0;
      let fp = 0;
      p.sel.status.forEach((i) => {
        if (c.status.opts[i].ok) tp++;
        else fp++;
      });
      const frac = U.clamp((tp - fp * 0.75) / ok, 0, 1);
      res.parts.status = Math.round(frac * W.status);
      res.statusTP = tp;
      res.statusFP = fp;
      res.statusOK = ok;
    }

    if (parts.indexOf('dx') >= 0) {
      const syn = c.syndrome.opts[p.sel.syn];
      let f = 0;
      if (syn && syn.ok) f += 0.4;
      if (p.hard) {
        // сложная игра: диагноз выбран из полного списка МКБ-10
        const j = A.icd.judge(c.dx.opts, p.sel.dxKey);
        f += 0.6 * j.score;
        res.dxRight = j.score === 1;
        res.dxJudge = { key: p.sel.dxKey, score: j.score, cat: !!j.cat, why: j.opt ? j.opt.why || '' : '', right: j.right ? j.right.t : '' };
      } else {
        const dx = c.dx.opts[p.sel.dx];
        if (dx && dx.ok) f += 0.6;
        else if (dx && dx.part) f += 0.6 * dx.part;
        res.dxRight = !!(dx && dx.ok);
      }
      res.synRight = !!(syn && syn.ok);
      res.parts.dx = Math.round(f * W.dx);
    }

    if (parts.indexOf('tx') >= 0) {
      const ok = c.tx.opts.filter((o) => o.ok).length || 1;
      let good = 0;
      let wrong = 0;
      let danger = 0;
      p.sel.tx.forEach((i) => {
        const o = c.tx.opts[i];
        if (o.ok) good++;
        else {
          wrong++;
          if (o.bad) danger++;
        }
      });
      const frac = U.clamp((good - wrong - danger) / ok, 0, 1);
      res.parts.tx = Math.round(frac * W.tx);
      res.danger = danger;
      res.txSel = p.sel.tx.slice();
      if (danger) res.notes.push('Опасное назначение: такое решение могло навредить пациенту.');
    }

    res.score = U.clamp(Object.keys(res.parts).reduce((a, k) => a + res.parts[k], 0), 0, 100);
    if (res.score >= 100) res.score = 100;
    return res;
  };

  CS.critNote = function (crit, t) {
    const m = {
      suicide: 'Вы не спросили о суицидальных мыслях. При депрессии и любом остром кризисе этот вопрос обязателен: прямой вопрос не провоцирует суицид, а молчание может стоить жизни.',
      substance: 'Вы не уточнили употребление алкоголя и других веществ — это одна из самых частых причин и «масок» психических нарушений.',
      somatic: 'Вы не выяснили соматическое состояние и лекарства. Органические и лекарственные причины нужно исключать в первую очередь.',
      safety: 'Вы не оценили безопасность — риск для пациента и окружающих определяет всю тактику.',
      mania: 'Вы не спросили о периодах повышенного настроения. Без этого легко пропустить биполярное расстройство и навредить антидепрессантом.',
      onset: 'Вы не уточнили, как быстро всё началось. Острое начало — главный признак делирия и органики.',
      child: 'Вы не спросили о безопасности ребёнка. При послеродовых нарушениях это ключевой вопрос.',
      meds: 'Вы не уточнили, какие лекарства принимает пациент. Половина неотложной психофармакологии начинается с этого вопроса.',
    };
    return m[crit] || 'Пропущен важный вопрос: «' + t + '».';
  };

  /** Общие награды за случай. */
  CS.reward = function (s, c, res) {
    s.stats.cases++;
    s.seen.cases[c.id] = (s.seen.cases[c.id] || 0) + 1;
    if (res.dxRight) s.stats.dxRight++;
    if (res.askedSuicide) s.stats.askSuicide++;
    if (res.score >= 100) {
      s.stats.perfect++;
      G.unlock(s, 'perfect');
    }
    G.unlock(s, 'first_case');
    if (c.thiamine && res.mode !== 'exam') {
      const ti = c.tx.opts.findIndex((o) => o.thiamine);
      if (ti >= 0 && res.txSel && res.txSel.indexOf(ti) >= 0) G.unlock(s, 'thiamine');
    }
    const mult = res.mode === 'seminar' ? 1 : res.mode === 'exam' ? 0.6 : 0.8;
    const kd = G.learn(s, c.topic, (2.5 + res.score / 25) * mult);
    if (c.topic2) G.learn(s, c.topic2, 1.2 * mult);
    const xp = Math.round(res.score / 2 + (c.difficulty || 1) * 5);
    G.apply(s, { xp });
    res.xp = xp;
    res.knowGain = (kd.know && kd.know[c.topic]) || 0;
    s.caseLog.unshift({ id: c.id, day: s.day, score: res.score, mode: res.mode, name: res.patientName || c.patient.name });
    if (s.caseLog.length > 60) s.caseLog.length = 60;
  };

  /* ================= Лекции и семинары ================= */
  G.finishLecture = function (s, res, makeup) {
    const sch = makeup ? null : G.scheduleFor(s.day);
    const L = D.lectureById[(res && res.id) || (sch && sch.lecture)];
    if (!L) return '';
    s.study.lectures[L.id] = true;
    const focus = res && res.focus != null ? res.focus : G.focus(s);
    G.learn(s, L.domain, 6 * focus);
    if (L.domain2) G.learn(s, L.domain2, 2.5 * focus);
    const right = res ? res.right : 0;
    const total = res ? res.total : 0;
    G.learn(s, L.domain, 1.6 * right);
    s.study.rating += right * 2;
    s.study.ratingMax += total * 2;
    G.apply(s, { energy: makeup ? 0 : -10, stress: 3, xp: 5 + right * 3 });
    G.checkNoSkips(s);
    if (makeup) return '';
    const mood =
      right === total ? 'Корсакова кивает: «Вижу, вы слушали». В рейтинге — плюс.' : right >= total / 2 ? 'Половину вопросов ты знаешь, остальное — повод открыть конспект.' : 'Блиц-опрос прошёл мимо. Корсакова поджимает губы и делает пометку в журнале.';
    return 'Лекция «' + L.title + '» позади. Блиц-опрос: ' + right + ' из ' + total + '. ' + mood + ' Конспект — в справочнике.';
  };

  G.finishSeminar = function (s, res, day, makeup) {
    if (day) s.study.seminars[day] = true;
    const sc = res ? res.score : 0;
    s.study.rating += Math.round(sc / 10);
    s.study.ratingMax += 10;
    G.apply(s, { energy: makeup ? 0 : -14, stress: 6, rep: sc >= 80 ? 1 : 0 });
    G.checkNoSkips(s);
    if (makeup) return '';
    let comment;
    if (sc >= 90) comment = 'Кандинский поднимает бровь: «Коллега, это было почти красиво». От него это высшая похвала.';
    else if (sc >= 70) comment = 'Кандинский: «Неплохо. Но в клинике "неплохо" — это когда пациенту стало лучше. Помните об этом».';
    else if (sc >= 50) comment = 'Кандинский вздыхает: «Направление верное, детали — нет. А в психиатрии всё решают детали».';
    else comment = 'Кандинский долго молчит. «Перечитайте лекцию. И, ради бога, сначала опишите статус, потом ставьте диагноз».';
    return 'Семинар окончен: ' + sc + ' из 100. ' + comment;
  };

  G.checkNoSkips = function (s) {
    const all = D.schedule || [];
    if (!all.length) return;
    const done = all.every((x) => s.study.lectures[x.lecture] && s.study.seminars[x.day]);
    if (done && s.stats.skips === 0) G.unlock(s, 'no_skips');
  };

  /* ================= Экзамены ================= */
  const EX = (A.exams = {
    defs: {
      exam1: {
        title: 'Экзамен по психиатрии',
        short: 'Психиатрия',
        sub: 'Промежуточная аттестация · профессор Корсакова · 3 ситуационные задачи: статус, синдром, диагноз',
        parts: ['status', 'dx'],
        n: 3,
        examiner: 'korsakova',
        topics: ['psychopath', 'affective', 'psychosis', 'neurotic', 'organic', 'child', 'addiction', 'personality'],
      },
      exam2: {
        title: 'Государственная итоговая аттестация',
        short: 'ГИА',
        sub: 'Государственная экзаменационная комиссия · 3 ситуационные задачи: диагноз и тактика лечения',
        parts: ['dx', 'tx'],
        n: 3,
        examiner: 'gek',
        topics: ['pharm', 'emergency', 'addiction', 'affective', 'psychosis', 'organic', 'neurotic', 'child', 'personality'],
        prefer: ['pharm', 'emergency'],
      },
      accr: {
        title: 'Первичная специализированная аккредитация',
        short: 'Аккредитация',
        sub: 'Аккредитационная подкомиссия · тестирование (20 заданий, «сдано» — от 70%) и две ситуационные задачи',
        parts: ['status', 'dx', 'tx'],
        n: 2,
        test: 20,
        examiner: 'commission',
        topics: null,
        passFail: true,
      },
    },
  });
  EX.title = (k) => EX.defs[k].title;
  EX.sub = (k) => EX.defs[k].sub;

  EX.makeTasks = function (s, k) {
    const def = EX.defs[k];
    const usedSeminar = (D.schedule || []).map((x) => x.seminar);
    const usedExam = [];
    Object.keys(s.study.exams).forEach((e) => (s.study.exams[e].tasks || []).forEach((id) => usedExam.push(id)));
    const pool = D.cases.filter((c) => c.vignette && (!def.topics || def.topics.indexOf(c.topic) >= 0));
    const r = Math.random;
    const scored = pool.map((c) => {
      let w = 1;
      if (usedSeminar.indexOf(c.id) < 0) w *= 4;
      if (!s.seen.cases[c.id]) w *= 2;
      if (usedExam.indexOf(c.id) >= 0) w *= 0.15;
      if (def.prefer && def.prefer.indexOf(c.topic) >= 0) w *= 2.5;
      return { c, w };
    });
    const out = [];
    const topicsUsed = {};
    for (let i = 0; i < def.n; i++) {
      const pick = U.weighted(
        scored.filter((x) => out.indexOf(x.c.id) < 0),
        (x) => x.w * (topicsUsed[x.c.topic] ? 0.25 : 1),
        r
      );
      if (!pick) break;
      out.push(pick.c.id);
      topicsUsed[pick.c.topic] = true;
    }
    const tasks = { cases: out };
    if (def.test) {
      const qs = [];
      D.lectures.forEach((L) => L.quiz.forEach((q, qi) => qs.push(L.id + ':' + qi)));
      (D.extraTest || []).forEach((q, qi) => qs.push('x:' + qi));
      (D.testBank || []).forEach((q) => qs.push('t:' + q.id));
      tasks.test = U.shuffle(qs).slice(0, def.test);
    }
    return tasks;
  };

  EX.testQuestion = function (ref) {
    const [lid, qi] = ref.split(':');
    if (lid === 'x') return D.extraTest[+qi];
    if (lid === 't') return (D.testBankById || {})[qi] || null;
    const L = D.lectureById[lid];
    return L ? L.quiz[+qi] : null;
  };

  EX.grade = function (pct) {
    if (pct >= 85) return 5;
    if (pct >= 70) return 4;
    if (pct >= 55) return 3;
    return 2;
  };
  EX.gradeName = (g) => ({ 5: 'отлично', 4: 'хорошо', 3: 'удовлетворительно', 2: 'неудовлетворительно' })[g] || '—';
  EX.gradeShort = (g) => ({ 5: 'отл.', 4: 'хор.', 3: 'уд.', 2: 'неуд.' })[g] || '—';

  /** Итог экзамена: res = { exam, scores[], test? } */
  EX.compute = function (res) {
    const def = EX.defs[res.exam];
    const caseAvg = res.scores.length ? res.scores.reduce((a, b) => a + b, 0) / res.scores.length : 0;
    let pct = caseAvg;
    if (def.test && res.test) {
      const tp = (res.test.right / res.test.total) * 100;
      pct = tp * 0.5 + caseAvg * 0.5;
      res.testPct = Math.round(tp);
      if (tp < 70 || caseAvg < 50) pct = Math.min(pct, 54);
    }
    res.pct = Math.round(pct);
    res.grade = EX.grade(pct);
    return res;
  };

  EX.finish = function (s, res) {
    if (!res) return '';
    EX.compute(res);
    const prev = s.study.exams[res.exam];
    const attempts = (prev ? prev.attempts : 0) + 1;
    let grade = res.grade;
    if (attempts > 1 && grade > 4) grade = 4; // на пересдаче выше «хорошо» не ставят
    s.study.exams[res.exam] = { grade, attempts, lastDay: s.day, pct: res.pct, tasks: res.cases };
    const def = EX.defs[res.exam];
    G.apply(s, { stress: grade >= 3 ? -12 : 10, rep: grade === 5 ? 3 : grade === 4 ? 1 : grade === 2 ? -2 : 0, xp: 20 + res.pct / 2 });
    let text = def.short + ': ' + (def.passFail ? (grade >= 3 ? '«сдано»' : '«не сдано»') : '«' + EX.gradeName(grade) + '»') + ' (' + res.pct + '%' + (res.testPct != null ? ', тест — ' + res.testPct + '%' : '') + '). ';
    if (grade === 2) {
      text +=
        res.exam === 'accr'
          ? 'Аккредитация не пройдена' + (res.testPct != null && res.testPct < 70 ? ': на тестировании меньше 70%' : '') + '. Повторить можно в любой будний день утром.'
          : 'Пересдача — в любой будний день утром. Выше «хорошо» на пересдаче не поставят.';
      return text;
    }
    if (res.exam === 'exam2') {
      EX.issueDiploma(s);
      G.queue(s, [{ type: 'story', story: 'gia_passed' }, { type: 'diploma' }], 'diploma');
      text += 'Решением ГЭК присвоена квалификация «врач-психиатр». Впереди — аккредитация.';
    } else if (res.exam === 'accr') {
      s.study.accr = { day: s.day, pct: res.pct, testPct: res.testPct == null ? null : res.testPct };
      const all = s.study.exams.exam1 && s.study.exams.exam1.grade === 5 && s.study.exams.exam2 && s.study.exams.exam2.grade === 5 && res.pct >= 85;
      if (all) G.unlock(s, 'red_diploma');
      s.phase = 'graduate';
      G.queue(s, [{ type: 'story', story: 'graduation' }, { type: 'jobs' }], 'graduation');
      text += 'Сведения об аккредитации внесены в Федеральный регистр медицинских работников. Теперь можно работать врачом-психиатром.';
    } else {
      text += grade === 5 ? 'Зачётка становится красивее.' : 'Сдано — и это главное.';
    }
    return text;
  };

  /** Диплом об окончании ординатуры с приложением: оценки по дисциплинам, практике и ГИА. */
  EX.issueDiploma = function (s) {
    const pr = (s.ward && s.ward.practice) || {};
    const n = 100000 + (U.hash(s.id + 'diploma') % 900000);
    s.study.diploma = {
      day: s.day,
      number: 'АН ' + String(n).padStart(6, '0'),
      reg: String(100 + (U.hash(s.id + 'reg') % 800)),
      protocol: String(10 + (U.hash(s.id + 'gek') % 70)),
      qual: 'Врач-психиатр',
      spec: '31.08.20 Психиатрия',
      grades: {
        exam1: s.study.exams.exam1 ? s.study.exams.exam1.grade : null,
        practice: pr.grade || null,
        gia: s.study.exams.exam2 ? s.study.exams.exam2.grade : null,
      },
    };
    return s.study.diploma;
  };

  /* ================= Мини-задачи ================= */
  const MI = (A.minis = {});
  MI.get = function (step, i) {
    if (step.items) return step.items[i];
    return D.miniById[step.ids[i]];
  };
  MI.count = (step) => (step.items ? step.items.length : step.ids.length);
  MI.reward = function (s, m, ok) {
    s.stats.minis++;
    if (ok) s.stats.minisRight++;
    if (m.id) s.seen.minis[m.id] = (s.seen.minis[m.id] || 0) + 1;
    if (m.topic) G.learn(s, m.topic, ok ? 1.5 : 1);
    G.apply(s, { xp: ok ? 10 : 3 });
    if (ok && m.dx) s.stats.dxRight++;
  };

  /** Процедурная медкомиссия: водительские справки и справки на оружие. */
  MI.commission = function (s, n) {
    const r = Math.random;
    const T = D.commissionTemplates || [];
    const out = [];
    const used = {};
    for (let i = 0; i < n && T.length; i++) {
      let t = U.pick(T, r);
      let guard = 0;
      while (used[t.id] && guard++ < 10) t = U.pick(T, r);
      used[t.id] = true;
      const sex = t.sex || (U.chance(0.6, r) ? 'm' : 'f');
      const age = U.int(t.age[0], t.age[1], r);
      const name = U.pick(sex === 'm' ? D.namesM : D.namesF, r);
      const purpose = t.purpose || U.pick(['driver', 'driver', 'weapon'], r);
      out.push({
        id: null,
        commission: true,
        topic: t.topic || 'emergency',
        setting: 'Медкомиссия · ' + (purpose === 'weapon' ? 'справка на оружие' : 'водительская справка'),
        patient: { name, age, sex, emotion: t.emotion || 'neutral', seed: U.hash(name + age + i + s.day) },
        text: U.t(t.text, { P: name, age: String(age), purpose: purpose === 'weapon' ? 'на оружие' : 'для ГИБДД' }),
        q: 'Ваше решение?',
        options: t.options,
        explain: t.explain,
      });
    }
    return out;
  };
})((window.A = window.A || {}));
