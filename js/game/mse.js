/* Конструктор психического статуса: прохождение по разделам, выбор формулировок, оценка и текст записи.
   Данные — js/data/status*.js. Состояние прохождения сериализуемо: оно живёт в шаге занятия на кафедре,
   в первичном приёме (step.p.mse) или в тренажёре (UI.view.trainer.mse).
   Оценка раздела: (верных − 0,75 × ошибочных) / число верных, не ниже нуля; итог — среднее по разделам. */
(function (A) {
  'use strict';
  const U = A.util;
  const D = () => A.data;
  const MS = (A.mse = {});

  MS.PASS = 70; // от 70% — «с замечаниями», от 90% — «подписано»
  MS.GOOD = 80; // засчитывается заведующим на приёме и в достижениях
  MS.sections = () => D().statusSections || [];
  MS.scenarios = () => D().statusScenarios || [];
  MS.get = (id) => MS.scenarios().find((x) => x.id === id) || null;
  MS.list = (lvl) => MS.scenarios().filter((x) => !lvl || x.lvl === lvl);
  MS.forAmb = (tpl) => MS.scenarios().find((x) => x.amb === tpl) || null;
  /** {{м|ж}} — форма по полу пациента. */
  MS.fill = (text, sex) => String(text == null ? '' : text).replace(/\{\{([^{}|]*)\|([^{}|]*)\}\}/g, (m, a, b) => (sex === 'f' ? b : a));

  function resolve(entry, kind) {
    const e = typeof entry === 'string' ? { id: entry } : entry || {};
    const base = e.id ? (D().statusPhrases || {})[e.id] : null;
    return { t: e.t || (base ? base.t : ''), why: e.why || '', k: kind, id: e.id || null };
  }
  /** Описание раздела в сценарии: своё или норма по умолчанию. */
  MS.spec = function (sc, secId) {
    return (sc.sections || {})[secId] || (D().statusDefaults || {})[secId] || null;
  };
  /** Варианты раздела в постоянном порядке: верные, ошибки, ловушка. Индексы в st.secs[i].sel — по этому списку. */
  MS.items = function (st, si) {
    const sc = MS.get(st.id);
    const S = MS.sections()[si];
    if (!sc || !S) return [];
    const src = MS.spec(sc, S.id) || { ok: [], no: [] };
    const out = (src.ok || []).map((e) => resolve(e, 'ok')).concat((src.no || []).map((e) => resolve(e, 'no')));
    const sec = st.secs[si] || {};
    const trap = src.trap || (sec.trap != null ? ((D().statusTraps || {})[S.id] || [])[sec.trap] : null);
    if (trap) out.push({ t: trap.t, why: trap.why, k: 'trap', id: null });
    return out;
  };

  /** Новое прохождение. opt.seed — порядок вариантов и выбор ловушек; opt.sex — пол пациента (по умолчанию из сценария). */
  MS.init = function (id, opt) {
    opt = opt || {};
    const sc = MS.get(id);
    if (!sc) return null;
    const seed = opt.seed != null ? opt.seed >>> 0 : U.hash(id + ':' + Date.now() + ':' + Math.random());
    const r = U.mulberry32(seed);
    const st = { id, seed, sex: opt.sex || sc.patient.sex, i: 0, secs: [], done: false, res: null };
    MS.sections().forEach((S, si) => {
      const src = MS.spec(sc, S.id) || {};
      const traps = (D().statusTraps || {})[S.id] || [];
      const sec = { id: S.id, sel: [], trap: (src.trap || !traps.length) ? null : Math.floor(r() * traps.length), order: [] };
      st.secs.push(sec);
      const n = MS.items(st, si).length;
      sec.order = U.shuffle(
        Array.from({ length: n }, (x, k) => k),
        r,
      );
    });
    return st;
  };

  MS.toggle = function (st, k) {
    const sec = st && !st.done ? st.secs[st.i] : null;
    k = +k;
    if (!sec || sec.checked || !(k >= 0 && k < MS.items(st, st.i).length)) return false;
    const at = sec.sel.indexOf(k);
    if (at >= 0) sec.sel.splice(at, 1);
    else sec.sel.push(k);
    return true;
  };
  MS.go = function (st, d) {
    if (st && !st.done) st.i = U.clamp(st.i + d, 0, st.secs.length - 1);
  };
  MS.last = (st) => st.i >= st.secs.length - 1;
  /** Проверить текущий раздел: отметки фиксируются, игрок сразу видит разбор. */
  MS.check = function (st) {
    const sec = st && !st.done ? st.secs[st.i] : null;
    if (!sec || !sec.sel.length) return null;
    sec.checked = true;
    return MS.secScore(st, st.i);
  };

  /** Оценка раздела: { id, v, mark: ok|part|bad, trap, missed, wrong }. */
  MS.secScore = function (st, si) {
    const sec = st.secs[si];
    const items = MS.items(st, si);
    const K = items.filter((o) => o.k === 'ok').length || 1;
    let tp = 0;
    let fp = 0;
    let trap = false;
    sec.sel.forEach((k) => {
      const o = items[k];
      if (!o) return;
      if (o.k === 'ok') tp++;
      else {
        fp++;
        if (o.k === 'trap') trap = true;
      }
    });
    const v = U.clamp((tp - 0.75 * fp) / K, 0, 1);
    return {
      id: sec.id,
      v,
      mark: v >= 0.999 ? 'ok' : v >= 0.5 ? 'part' : 'bad',
      trap,
      missed: items.filter((o, k) => o.k === 'ok' && sec.sel.indexOf(k) < 0),
      wrong: sec.sel
        .slice()
        .sort((a, b) => a - b)
        .map((k) => items[k])
        .filter((o) => o && o.k !== 'ok'),
    };
  };
  /** Оценка: { pct, traps, exact, per: [оценка раздела] }. */
  MS.score = function (st) {
    const per = st.secs.map((sec, si) => MS.secScore(st, si));
    const sum = per.reduce((a, x) => a + x.v, 0);
    const pct = Math.round((sum / Math.max(1, st.secs.length)) * 100);
    return { pct, traps: per.filter((x) => x.trap).length, exact: per.filter((x) => x.mark === 'ok').length, per };
  };

  /** Текст записи по разделам: model — образец (все верные), иначе — выбранное игроком. [[{ t, k }]] */
  MS.text = function (st, model) {
    return st.secs.map((sec, si) => {
      const items = MS.items(st, si);
      const ks = model ? items.map((o, k) => (o.k === 'ok' ? k : -1)).filter((k) => k >= 0) : sec.sel.slice().sort((a, b) => a - b);
      return ks.filter((k) => items[k]).map((k) => ({ t: MS.fill(items[k].t, st.sex), k: items[k].k }));
    });
  };
  MS.plain = (st, model) =>
    MS.text(st, model)
      .map((ph) => ph.map((x) => x.t).join(' '))
      .filter(Boolean)
      .join(' ');

  /** Завершить прохождение; итог сохраняется в состоянии. */
  MS.finish = function (st) {
    if (!st.done) {
      const r = MS.score(st);
      st.done = true;
      st.res = { pct: r.pct, traps: r.traps, exact: r.exact };
    }
    return st.res;
  };

  /* ---------- В игре ---------- */
  /** Сценарий для практикума на кафедре: первые два — базовые, до пятого — не сложнее среднего; сначала новые. */
  MS.pick = function (s, exclude) {
    const best = (s.flags && s.flags.mseBest) || {};
    const n = (s.flags && s.flags.mseN) || 0;
    const top = n < 2 ? 1 : n < 5 ? 2 : 3;
    const all = MS.scenarios().filter((x) => x.id !== exclude);
    const pool = all.filter((x) => x.lvl <= top).length ? all.filter((x) => x.lvl <= top) : all;
    if (!pool.length) return null;
    const w = (x) => (best[x.id] == null ? 6 : best[x.id] < MS.GOOD ? 3 : 1);
    return (U.weighted(pool, w) || pool[0]).id;
  };
  MS.record = function (s, id, pct) {
    const b = (s.flags.mseBest = s.flags.mseBest || {});
    b[id] = Math.max(b[id] || 0, pct);
    s.flags.mseN = (s.flags.mseN || 0) + 1;
  };
})((window.A = window.A || {}));
