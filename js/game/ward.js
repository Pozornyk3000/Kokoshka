/* Отделение: собственные пациенты ординатора (курация на практике) и врача стационара.
   Поступление, течение болезни по дням, нежелательные явления, анализы, осложнения, обходы, выписка и оценка. */
(function (A) {
  'use strict';
  const U = A.util;
  const W = (A.ward = {});
  const P = () => A.pharma;
  const D = () => A.data;
  const G = () => A.game;

  /* ---------- Состояние ---------- */
  W.blank = () => ({ pts: [], seq: 0, done: [], lastRound: 0, used: {}, practice: { start: 0, rounds: 0, days: 0, scores: [], closed: false, grade: null, makeup: 0 } });
  W.ensure = function (s) {
    if (!s.ward || !s.ward.pts) s.ward = W.blank();
    return s.ward;
  };
  W.active = (s) => (s.ward && s.ward.pts ? s.ward.pts.filter((p) => !p.done) : []);
  W.byUid = (s, uid) => (s.ward && s.ward.pts ? s.ward.pts.find((p) => p.uid === uid) : null);

  /** Сколько пациентов ведёт игрок. */
  W.capacity = function (s) {
    if (s.phase === 'study') return 2;
    if (s.phase === 'career' && s.career && s.career.job === 'hospital') return 3 + (G().rankIndex ? Math.min(1, G().rankIndex(s) >= 2 ? 1 : 0) : 0);
    return 0;
  };

  /* ---------- Имена ---------- */
  const INITIALS = 'АБВГДЕЖЗИКЛМНОПРСТУФХЧШЯ';
  function makeName(s, sex) {
    const pool = sex === 'f' ? D().namesF || ['Анна'] : D().namesM || ['Иван'];
    const taken = W.active(s).map((p) => p.name);
    for (let i = 0; i < 12; i++) {
      const n = U.pick(pool) + ' ' + U.pick(INITIALS.split('')) + '.';
      if (taken.indexOf(n) < 0) return n;
    }
    return U.pick(pool);
  }
  /** Форма слова по полу пациента. */
  W.pv = (pt, m, f) => (pt.sex === 'f' ? f : m);
  W.fill = (pt, text) => String(text || '').replace(/\{P\}/g, pt.name.split(' ')[0]);

  /* ---------- Поступление ---------- */
  W.pickTemplate = function (s, mode) {
    const w = W.ensure(s);
    const act = W.active(s);
    const tag = mode === 'study' ? 'study' : 'hospital';
    const pool = (D().wardPatients || []).filter((t) => (t.where || []).indexOf(tag) >= 0 && !act.some((p) => p.tpl === t.id));
    if (!pool.length) return null;
    const groups = act.map((p) => p.group);
    const t = U.weighted(pool, (x) => (w.used[x.id] ? 1 : 6) * (groups.indexOf(x.group) >= 0 ? 0.25 : 1) * (mode === 'study' && (x.difficulty || 1) > 2 ? 0.2 : 1));
    return t ? t.id : null;
  };

  W.admit = function (s, tplId, mode) {
    const t = D().wardById[tplId];
    if (!t) return null;
    const w = W.ensure(s);
    w.used[t.id] = (w.used[t.id] || 0) + 1;
    const age = U.int(t.age[0], t.age[1]);
    const name = makeName(s, t.sex);
    const seq = ++w.seq;
    const b = Object.assign({ qtc: 420, anc: 4, alt: 25, egfr: 95, na: 140, glucose: 5, ldl: 2.8, tg: 1.3, prl: 12, weight: 70, height: 172, tsh: 1.8, hb: t.sex === 'f' ? 128 : 142 }, t.baseline || {});
    const look = Object.assign(A.art && A.art.randomLook ? A.art.randomLook(U.hash(name + age + seq), { sex: t.sex, age }) : {}, t.look || {});
    const sev = U.clamp(t.sev0 + U.int(-4, 4), 20, 98);
    const pt = {
      uid: 'p' + seq,
      tpl: t.id,
      group: t.group,
      dx: t.dx,
      name,
      age,
      sex: t.sex,
      look,
      seed: U.hash(name + seq),
      mode,
      admitDay: s.day,
      today: s.day,
      sev0: sev,
      sev,
      hist: [{ d: s.day, sev: Math.round(sev) }],
      rx: [],
      log: [],
      tests: [],
      notes: [],
      events: [],
      pending: null,
      sx: {},
      base: b,
      lab: {
        qtc: b.qtc,
        anc: b.anc,
        alt: b.alt,
        egfr: b.egfr,
        creat: Math.round(88 * Math.pow(90 / Math.max(15, b.egfr), 0.9)),
        na: b.na,
        glucose: b.glucose,
        ldl: b.ldl,
        tg: b.tg,
        li: 0,
        liSteady: false,
        vpa: 0,
        prl: b.prl,
        tsh: b.tsh,
        ck: 110,
        weight: b.weight,
      },
      traits: (t.traits || []).slice(),
      meds_home: (t.meds_home || []).slice(),
      intolerant: (t.intolerant || []).slice(),
      failed: (t.failed || []).slice(),
      resp: Object.assign({}, t.resp || {}),
      insight: t.insight == null ? 0.6 : t.insight,
      risk: Object.assign({ suicide: 0, aggression: 0 }, t.risk || {}),
      legal: t.legal || 'voluntary',
      adherence: 1,
      refusing: false,
      rev: { ok: 0, info: 0, warn: 0, err: 0, list: [] },
      harm: 0,
      wrong: 0,
      missed: 0,
      monMissed: {},
      seenSe: {},
      seenText: {},
      flags: {},
      away: null,
      done: false,
      toxText: t.tox || null,
    };
    // Лекарства, которые пациент уже принимал до госпитализации (их надо продолжить, заменить или отменить постепенно)
    (t.home_rx || []).forEach((r) => {
      const d = P().drug(r.id);
      if (!d) return;
      pt.rx.push({ id: r.id, kind: 'drug', route: r.route || 'po', dose: r.dose, since: s.day - (r.days || 30), changed: s.day - (r.days || 30), home: true });
    });
    if (pt.group === 'alcohol_withdrawal' || pt.group === 'delirium_tremens') {
      pt.lab.alt = Math.max(pt.lab.alt, b.alt);
      if (!pt.toxText) pt.toxText = pt.group === 'delirium_tremens' ? 'этанол не обнаружен' : 'этанол в крови 0,9 ‰';
    }
    note(s, pt, 'admit', W.fill(pt, t.admit), 'info');
    w.pts.push(pt);
    return pt;
  };

  function note(s, pt, kind, text, lvl) {
    if (!text) return;
    pt.notes.push({ day: s.day, kind, text, lvl: lvl || '' });
    if (pt.notes.length > 140) pt.notes.splice(0, pt.notes.length - 140);
  }
  W.note = note;

  function pickText(pt, key, arr) {
    if (!arr || !arr.length) return '';
    const used = pt.seenText[key] || [];
    let free = arr.map((x, i) => i).filter((i) => used.indexOf(i) < 0);
    if (!free.length) {
      pt.seenText[key] = [];
      free = arr.map((x, i) => i);
    }
    const i = U.pick(free);
    pt.seenText[key] = (pt.seenText[key] || []).concat([i]);
    return W.fill(pt, arr[i]);
  }

  /* ---------- Течение: один день ---------- */
  W.tick = function (s, steps) {
    const w = s.ward;
    if (!w || !w.pts) return;
    W.active(s).forEach((pt) => {
      // нерешённое срочное событие решает дежурный врач
      if (pt.pending && pt.pending.day < s.day) autoResolve(s, pt);
      tickPt(s, pt);
    });
    W.practiceTick(s, steps);
  };

  function tickPt(s, pt) {
    pt.today = s.day;
    const g = P().group(pt);
    const day = s.day - pt.admitDay;
    (pt.rx || []).forEach((r) => (r.usedToday = false));
    if (pt.away) {
      if (s.day >= pt.away.until) {
        note(s, pt, 'staff', W.fill(pt, '{P} возвращается из ' + pt.away.where + '. Состояние стабилизировано, назначения требуют пересмотра.'), 'warn');
        pt.away = null;
      } else {
        pt.hist.push({ d: s.day, sev: Math.round(pt.sev), away: true });
        return;
      }
    }
    pt.rx.forEach((r) => {
      const it = r.kind === 'int' ? P().int(r.id) : null;
      if (it && it.insight) pt.insight = Math.min(0.9, pt.insight + it.insight);
    });
    if (pt.sev < 50 && pt.insight < 0.7) pt.insight = Math.min(0.7, pt.insight + 0.012);
    updAdherence(s, pt);
    const E = efficacy(s, pt);
    pt.lastE = E;
    let dS;
    if (g.special) dS = withdrawalDelta(pt, day, E);
    else dS = -g.K * W.speed(pt) * E.total * pt.sev + (E.total < 0.15 ? g.drift : g.drift * 0.3);
    // бензодиазепины при ПРЛ и деменции растормаживают
    if (pt.group === 'bpd_crisis' && pt.rx.some((r) => cls(r) === 'bzd')) dS += 1.2;
    dS += (Math.random() * 2 - 1) * 1.3;
    dS += seStress(pt);
    pt.sev = U.clamp(pt.sev + dS, 0, 100);
    sideEffects(s, pt);
    updLabs(s, pt);
    resolveTests(s, pt);
    trackMonitoring(s, pt);
    if (!pt.pending) evalEvents(s, pt, E);
    dailyNotes(s, pt, day);
    pt.hist.push({ d: s.day, sev: Math.round(pt.sev), e: Math.round(E.total * 100) / 100 });
  }

  function cls(rx) {
    const d = rx.kind === 'int' ? null : P().drug(rx.id);
    return d ? d.cls : null;
  }
  function grp(rx) {
    const d = rx.kind === 'int' ? null : P().drug(rx.id);
    return d ? d.group : null;
  }

  function ramp(days, onset) {
    if (!onset || onset <= 1) return 1;
    return U.clamp(days / onset, 0.12, 1);
  }
  function respOf(pt, item) {
    if ((pt.failed || []).indexOf(item.id) >= 0) return 0.3;
    const r = pt.resp || {};
    if (r[item.id] != null) return r[item.id];
    if (r[item.cls] != null) return r[item.cls];
    return 1;
  }

  /** Учебные пациенты на практике «проживают» госпитализацию быстрее: практика длится всего две недели. */
  W.speed = (pt) => (pt.mode === 'study' ? 1.5 : 1);

  /** Суммарный эффект лечения по доменам группы (0..1). */
  function efficacy(s, pt) {
    const sp = W.speed(pt);
    const doms = P().group(pt).domains;
    const per = {};
    doms.forEach((k) => (per[k] = []));
    pt.rx.forEach((rx) => {
      const item = P().item(rx);
      if (!item) return;
      const on = (s.day - rx.since) * sp;
      doms.forEach((k) => {
        let e = (item.eff && item.eff[k]) || 0;
        if (!e) return;
        if (rx.kind === 'int') {
          e *= ramp(on, (item.onset && item.onset[k]) || 7);
          // при тяжёлом психозе психотерапия почти не работает
          if (item.kind === 'psychotherapy' && pt.sev > 70 && (k === 'psychosis' || k === 'mania')) e *= 0.3;
          per[k].push(e);
          return;
        }
        if (rx.prn) return;
        // к противотревожному и седативному действию бензодиазепинов развивается толерантность
        if (item.cls === 'bzd' && k !== 'withdrawal') e *= U.clamp(1 - (s.day - rx.since - 14) / 50, 0.15, 1);
        const f = P().doseFactor(rx, pt) * P().levelMult(pt, item);
        const gf = f <= 0 ? 0 : f < 1 ? Math.pow(f, 1.4) : Math.min(1.12, 1 + (f - 1) * 0.12);
        let onset = (item.onset && item.onset[k]) || 7;
        if (rx.route === 'depot' && !pt.rx.some((o) => o.id === rx.id && o.route === 'po')) onset *= 1.5;
        e *= gf * ramp(on, onset) * respOf(pt, item) * pt.adherence;
        per[k].push(e);
      });
    });
    const dom = {};
    doms.forEach((k) => (dom[k] = 1 - per[k].reduce((acc, e) => acc * (1 - Math.min(0.95, e)), 1)));
    const total = doms.reduce((a, k) => a + dom[k], 0) / doms.length;
    return { total, dom };
  }
  W.efficacy = efficacy;

  // Естественное течение абстиненции и делирия по суткам госпитализации (пунктов тяжести в сутки)
  const NAT_W = [0, 9, 7, 2, -7, -11, -14, -15, -15, -15];
  const NAT_DT = [0, 6, 5, 2, -2, -7, -10, -12, -12, -12, -12];
  function withdrawalDelta(pt, day, E) {
    const tab = pt.group === 'delirium_tremens' ? NAT_DT : NAT_W;
    const nat = day < tab.length ? tab[day] : -15;
    const e = E.total;
    let d = nat > 0 ? nat * (1 - e) : nat * (0.6 + 0.4 * e);
    d -= P().group(pt).K * e * pt.sev * 0.5;
    return d;
  }

  /** Неприятные побочные эффекты сами по себе утяжеляют состояние. */
  function seStress(pt) {
    const x = pt.sx || {};
    const over = (v, th, k, cap) => (v > th ? Math.min(cap, (v - th) * k) : 0);
    return over(x.akathisia || 0, 1.3, 0.5, 1.5) + over(x.eps || 0, 1.6, 0.25, 1.5) + over(x.sedation || 0, 2.4, 0.3, 0.6) + over(x.activation || 0, 1.4, 0.4, 0.8);
  }

  function updAdherence(s, pt) {
    if (pt.refusing) {
      pt.adherence = 0.25;
      return;
    }
    // в стационаре таблетки раздаёт медсестра; без критики и при побочных эффектах часть «теряется»
    const x = pt.sx || {};
    let a = 1;
    if (pt.insight < 0.35 && pt.sev > 55) a -= 0.08;
    if (x.akathisia > 1.5 || x.eps > 1.6 || x.sedation > 2.4 || x.sexual > 1.8) a -= 0.1;
    if (pt.rx.some((r) => (pt.intolerant || []).indexOf(r.id) >= 0)) a -= 0.12;
    pt.adherence = U.clamp(a, 0.5, 1);
  }

  const SE_KEYS = ['eps', 'akathisia', 'sedation', 'weight', 'metabolic', 'prolactin', 'qt', 'anticholinergic', 'orthostatic', 'serotonergic', 'seizure', 'hyponatremia', 'agranulocytosis', 'sexual', 'activation', 'hepatotox', 'rash', 'tremor', 'dependence', 'nms'];
  // Насколько резко эффект растёт с дозой: экстрапирамидные расстройства — круто, вес — полого
  const SE_EXP = { eps: 1.5, akathisia: 1.2, prolactin: 1, qt: 1, sedation: 0.85, weight: 0.7, metabolic: 0.7, orthostatic: 1, anticholinergic: 1, serotonergic: 1.2, hyponatremia: 0.8, tremor: 1.2 };
  const SE_RATE = { eps: 0.55, akathisia: 0.6, sedation: 0.8, orthostatic: 0.7, anticholinergic: 0.6, prolactin: 0.25, serotonergic: 0.9, tremor: 0.5, activation: 0.6, sexual: 0.3, rash: 0.4 };

  function sideEffects(s, pt) {
    const load = {};
    SE_KEYS.forEach((k) => (load[k] = 0));
    const t = P().tags(pt);
    pt.rx.forEach((rx) => {
      if (rx.kind === 'int') return;
      const d = P().drug(rx.id);
      if (!d) return;
      let f;
      if (rx.prn) f = rx.usedToday ? 0.7 : 0;
      else f = P().doseFactor(rx, pt) * P().levelMult(pt, d);
      if ((pt.intolerant || []).indexOf(rx.id) >= 0) f *= 1.8; // пациент уже плохо переносил этот препарат
      f = U.clamp(f, 0, 2.5);
      const on = s.day - rx.since;
      SE_KEYS.forEach((k) => {
        let v = (d.se && d.se[k]) || 0;
        if (!v) return;
        if (k === 'activation') v *= on <= 12 ? 1 : 0.2;
        if (k === 'sedation' || k === 'orthostatic') v *= on <= 7 ? 1 : 0.75; // привыкание
        if (k === 'sedation' && d.cls === 'bzd' && on > 30) v *= 0.55;
        load[k] += v * Math.pow(f, SE_EXP[k] || 0.85);
      });
    });
    if (t.elderly) {
      load.sedation *= 1.4;
      load.orthostatic *= 1.5;
      load.anticholinergic *= 1.5;
      load.hyponatremia *= 2;
      load.eps *= 1.2;
    }
    if (t.young && pt.sex === 'm') load.eps *= 1.2;
    if (t.eps_sensitive) {
      load.eps *= 1.5;
      load.nms *= 3;
    }
    if (pt.sex === 'f') load.prolactin *= 1.3;
    const has = (pred) => pt.rx.some((r) => pred(r, P().drug(r.id)));
    if (has((r, d) => d && d.cls === 'anticholinergic')) load.eps *= 0.4;
    if (has((r) => r.id === 'propranolol')) load.akathisia *= 0.35;
    if (has((r, d) => d && d.cls === 'bzd')) load.akathisia *= 0.6;
    Object.keys(SE_RATE).forEach((k) => {
      const cur = pt.sx[k] || 0;
      pt.sx[k] = Math.round((cur + (load[k] - cur) * SE_RATE[k]) * 100) / 100;
    });
    pt.load = load;
  }

  function updLabs(s, pt) {
    const L = pt.lab;
    const b = pt.base;
    const load = pt.load || {};
    const t = P().tags(pt);
    // QTc
    let qt = b.qtc;
    pt.rx.forEach((rx) => {
      if (rx.kind === 'int' || rx.prn) return;
      const d = P().drug(rx.id);
      if (!d || !d.se || !d.se.qt) return;
      qt += d.se.qt * 9 * U.clamp(P().doseFactor(rx, pt) * P().levelMult(pt, d), 0, 2.5);
    });
    if (L.na < 130) qt += 6;
    L.qtc = Math.round(L.qtc + (qt - L.qtc) * 0.6);
    // масса тела и метаболизм
    L.weight = Math.round((L.weight + 0.045 * (load.weight || 0)) * 10) / 10;
    L.glucose = U.clamp(L.glucose + 0.004 * (load.metabolic || 0) - 0.001, b.glucose - 0.3, 14);
    L.ldl = U.clamp(L.ldl + 0.003 * (load.metabolic || 0), 1, 8);
    L.tg = U.clamp(L.tg + 0.006 * (load.metabolic || 0), 0.4, 8);
    // пролактин
    L.prl += (b.prl + 22 * (load.prolactin || 0) - L.prl) * 0.35;
    // АЛТ: при отмене алкоголя снижается
    let altT = b.alt + 14 * (load.hepatotox || 0);
    if (t.alcohol) altT = Math.max(28, b.alt * 0.55) + 14 * (load.hepatotox || 0);
    L.alt += (altT - L.alt) * 0.2;
    // натрий
    const drop = 0.35 * (load.hyponatremia || 0) * (t.thiazide ? 1.5 : 1);
    L.na = U.clamp(L.na - drop + (drop < 0.05 ? (b.na - L.na) * 0.25 : 0), 116, 147);
    // литий
    const li = pt.rx.find((r) => r.id === 'lithium' && !r.prn);
    if (li) {
      const target = (li.dose / 1000) * 1.1 * (t.renal ? 1.4 : 1) * (t.elderly ? 1.2 : 1) * (t.acei || t.arb ? 1.3 : 1) * (t.nsaid ? 1.3 : 1) * (t.thiazide ? 1.5 : 1) * (pt.flags.dehydrated ? 1.3 : 1) * (pt.adherence < 0.6 ? 0.5 : 1);
      L.li += (target - L.li) * 0.35;
      L.liSteady = s.day - (li.changed || li.since) >= 5;
      L.tsh += 0.02;
    } else {
      L.li *= 0.4;
      L.liSteady = false;
    }
    const vp = pt.rx.find((r) => r.id === 'valproate' && !r.prn);
    if (vp) L.vpa += (vp.dose * 0.07 * P().levelMult(pt, P().drug('valproate')) * pt.adherence - L.vpa) * 0.4;
    else L.vpa *= 0.4;
    // нейтрофилы
    if (pt.flags.agranDay && s.day >= pt.flags.agranDay && pt.rx.some((r) => r.id === 'clozapine')) L.anc = Math.max(0.2, L.anc - 0.9);
    else L.anc += (b.anc - 0.25 * (load.agranulocytosis || 0) - L.anc) * 0.3;
    // КФК: ЗНС, инъекции, фиксация
    L.ck += ((pt.flags.nms ? 6200 : 110 + (pt.flags.restraint === s.day - 1 ? 380 : 0)) - L.ck) * 0.5;
    // отказ от курения в отделении поднимает уровень субстратов CYP1A2 (через пару дней)
    if (t.smoker && !pt.quitSmoking && s.day - pt.admitDay >= 3 && pt.flags.noSmoking) pt.quitSmoking = true;
  }

  /* ---------- Обследования ---------- */
  W.order = function (s, pt, test) {
    const T = P().TESTS[test];
    if (!T) return null;
    if (pt.tests.some((x) => x.test === test && x.day === s.day)) return null;
    const rec = { test, day: s.day, ready: T.cito ? s.day : s.day + 1, value: null, text: '' };
    if (T.cito) fillTest(s, pt, rec);
    pt.tests.push(rec);
    return rec;
  };
  function fillTest(s, pt, rec) {
    rec.value = P().labValue(s, pt, rec.test);
    rec.text = P().labText(rec.test, rec.value);
    rec.flag = /↑|↓/.test(rec.text) || (rec.test === 'hcg' && rec.value.hcg);
  }
  function resolveTests(s, pt) {
    pt.tests.forEach((rec) => {
      if (rec.value || rec.ready > s.day) return;
      fillTest(s, pt, rec);
      note(s, pt, 'lab', 'Готов результат: ' + P().TESTS[rec.test].name.toLowerCase() + ' — ' + rec.text + '.', rec.flag ? 'warn' : '');
      // находки, которые требуют решения
      if (rec.test === 'cbc' && rec.value.anc < 1.5 && pt.rx.some((r) => r.id === 'clozapine' || r.id === 'carbamazepine') && !pt.pending) startEvent(s, pt, 'neutropenia');
    });
  }
  W.lastTest = (pt, test) => {
    const r = pt.tests.filter((x) => x.test === test && x.value);
    return r.length ? r[r.length - 1] : null;
  };

  /** Обязательный мониторинг: если анализ просрочен — отмечаем (один раз на препарат и анализ). */
  function trackMonitoring(s, pt) {
    P()
      .dueTests(s, pt)
      .forEach((x) => {
        if (!x.overdue) return;
        const key = x.test + ':' + x.why;
        if (!pt.monMissed[key]) {
          pt.monMissed[key] = s.day;
          note(s, pt, 'staff', 'Не проведён обязательный контроль: ' + P().TESTS[x.test].name.toLowerCase() + ' (' + x.why + ').', 'warn');
        }
      });
  }

  /* ---------- Осложнения и события ---------- */
  const has = (pt, pred) => pt.rx.some((r) => {
    const d = r.kind === 'int' ? null : P().drug(r.id);
    return pred(r, d);
  });
  const hasInt = (pt, id) => pt.rx.some((r) => r.kind === 'int' && r.id === id);
  const isAP = (r, d) => d && d.group === 'antipsychotic';
  const isAD = (r, d) => d && d.group === 'antidepressant';
  const isMoodStab = (r, d) => d && (d.group === 'moodstab' || (d.group === 'antipsychotic' && (d.eff.mania || 0) >= 0.5));
  const isSero = (r, d) => d && (d.flags || []).indexOf('serotonergic') >= 0;
  const STRONG_SERO = ['clomipramine', 'fluoxetine', 'paroxetine', 'sertraline', 'escitalopram', 'citalopram', 'fluvoxamine', 'venlafaxine', 'duloxetine'];

  function stopWhere(s, pt, pred, why) {
    const out = [];
    pt.rx = pt.rx.filter((r) => {
      const d = r.kind === 'int' ? null : P().drug(r.id);
      if (pred(r, d)) {
        out.push(d ? d.name : r.id);
        return false;
      }
      return true;
    });
    if (out.length) log(s, pt, 'Отменено: ' + out.join(', ').toLowerCase() + (why ? ' (' + why + ')' : '') + '.');
    return out;
  }
  function addInt(s, pt, id) {
    if (hasInt(pt, id) || !P().int(id)) return;
    pt.rx.push({ id, kind: 'int', since: s.day, changed: s.day });
    log(s, pt, 'Назначено: ' + P().int(id).name.toLowerCase() + '.');
  }
  function addDrug(s, pt, id, route, dose) {
    if (!P().drug(id)) return;
    const ex = pt.rx.find((r) => r.id === id && r.route === route);
    if (ex) return;
    pt.rx.push({ id, kind: 'drug', route, dose, since: s.day, changed: s.day });
    log(s, pt, 'Назначено: ' + P().drug(id).name.toLowerCase() + ' ' + P().fmtDose(dose) + ' (' + P().ROUTES[route] + ').');
  }
  function log(s, pt, text) {
    pt.log.push({ day: s.day, text });
  }
  W.log = log;

  /**
   * События. chance → вероятность за сутки; preventable → было ли осложнение следствием назначений;
   * text → запись в дневнике; q/opts → решение на обходе (ok: true — верно, 'part' — допустимо, false — ошибка).
   */
  W.EVENTS = {
    refusal: {
      title: 'Отказ от таблеток',
      chance: (s, pt) => (pt.insight < 0.35 && pt.sev > 55 && !pt.refusing && has(pt, (r, d) => d && !r.prn && r.route === 'po' && d.group !== 'other') ? 0.18 + (pt.sx.eps > 1.5 || pt.sx.akathisia > 1.5 || pt.sx.sedation > 2.2 ? 0.15 : 0) : 0),
      start: (s, pt) => {
        pt.refusing = true;
        return pickText(pt, 'refusal', (D().wardTexts || {}).refusal) || '{P} прячет таблетки за щёку и выплёвывает их в раковину.';
      },
      q: (s, pt) => W.fill(pt, '{P} второй день не принимает таблетки: прячет за щёку, выплёвывает. ') + (pt.legal === 'voluntary' ? 'Госпитализация добровольная.' : 'Госпитализация недобровольная, решение суда есть.'),
      opts: [
        {
          t: 'Поговорить: выяснить, что пугает; обсудить побочные эффекты, при необходимости сменить препарат или форму (раствор, диспергируемые таблетки)',
          ok: true,
          fx: (s, pt) => {
            pt.refusing = false;
            pt.insight = Math.min(1, pt.insight + 0.12);
          },
          why: 'Отказ почти всегда чем-то объясним — страхом, бредом отравления, побочными эффектами. Союз с пациентом надёжнее любых уколов.',
        },
        {
          t: 'Перевести на инъекции без согласия: «так надёжнее»',
          ok: (s, pt) => (pt.legal === 'voluntary' ? false : 'part'),
          fx: (s, pt) => {
            pt.refusing = false;
            pt.insight = Math.max(0, pt.insight - 0.1);
            if (pt.legal === 'voluntary') pt.flags.illegal = true;
          },
          why: 'Лечение без согласия допустимо только при недобровольной госпитализации по основаниям ст. 29 и при принудительных мерах (ст. 11 Закона о психиатрической помощи). И даже тогда сначала пробуют договориться.',
        },
        {
          t: 'Ничего не менять — сам поймёт, что лечиться надо',
          ok: false,
          fx: () => {},
          why: 'Без лечения психоз не пройдёт, а дни в отделении потеряны.',
        },
      ],
    },

    aggression: {
      title: 'Возбуждение и агрессия',
      chance: (s, pt) => {
        if (['schizophrenia', 'mania', 'delirium_tremens', 'dementia_bpsd', 'depression_psychotic'].indexOf(pt.group) < 0) return 0;
        if (pt.sev < 72 || pt.risk.aggression < 1) return 0;
        let p = 0.04 + 0.04 * pt.risk.aggression + (pt.refusing ? 0.05 : 0);
        if (has(pt, (r) => r.prn)) p -= 0.05;
        if ((pt.sx.sedation || 0) > 1.5) p -= 0.03;
        return Math.max(0, p);
      },
      start: () => 'Вечером возбуждение: крики, угрозы санитару, перевёрнута тумбочка. Дежурная медсестра звонит врачу.',
      q: () => 'Дежурная медсестра: «Срочно подойдите, мы не справляемся». Ваши действия?',
      opts: [
        {
          t: 'Сначала словесная деэскалация; если не помогает — быстрая транквилизация: в/м антипсихотик (галоперидол, оланзапин) или бензодиазепин; при необходимости — кратковременная фиксация с записью в истории и контролем',
          ok: true,
          fx: (s, pt) => {
            pt.sev = Math.max(0, pt.sev - 4);
            pt.flags.restraint = s.day;
          },
          why: 'Порядок — от наименее ограничительного к более: разговор, лекарство, и лишь затем фиксация. По ст. 30 Закона о психиатрической помощи меры стеснения применяются только на время, пока иначе нельзя предотвратить опасные действия, под постоянным контролем и с записью в медицинской документации.',
        },
        {
          t: 'Зафиксировать до утра; записывать в историю не обязательно',
          ok: false,
          fx: (s, pt) => {
            pt.flags.restraint = s.day;
            pt.flags.illegal = true;
          },
          why: 'Фиксация «до утра» без контроля и записи — нарушение закона и прямой риск тромбоза, травм и аспирации.',
        },
        {
          t: 'Ввести в/м оланзапин и сразу же в/м диазепам — для надёжности',
          ok: false,
          fx: (s, pt) => {
            pt.flags.restraint = s.day;
            pt.harm += 1;
          },
          why: 'Одновременное в/м введение оланзапина и бензодиазепинов не рекомендуется: риск угнетения дыхания и гипотензии.',
        },
      ],
    },

    dystonia: {
      title: 'Острая дистония',
      chance: (s, pt) => {
        if (pt.flags.dystonia || s.day - lastAPChange(pt) > 5) return 0;
        const t = P().tags(pt);
        const x = (pt.sx.eps || 0) - 1.6;
        if (x <= 0) return 0;
        return U.clamp(x * (t.young || t.eps_sensitive ? 0.02 : 0.008), 0, 0.5);
      },
      // предотвратимо: высокопотентный типичный препарат у «наивного» пациента или высокая доза
      preventable: (s, pt) => {
        const t = P().tags(pt);
        return pt.rx.some((r) => {
          const d = P().drug(r.id);
          if (!d || d.group !== 'antipsychotic' || r.prn) return false;
          return ((d.se.eps || 0) >= 2 && (t.young || t.eps_sensitive)) || P().doseFactor(r, pt) > 1.6;
        });
      },
      start: (s, pt) => {
        pt.flags.dystonia = true;
        return '{P}: судорожно запрокинута голова, взгляд закатился вверх, язык плохо слушается. Испуг, просьбы о помощи.';
      },
      q: () => 'Медсестра: «Его скрутило — это что, приступ?» Что делаете?',
      opts: [
        {
          t: 'Острая дистония: бипериден в/м (или тригексифенидил внутрь), успокоить; затем снизить дозу или перейти на атипичный антипсихотик',
          ok: true,
          fx: (s, pt) => {
            pt.sx.eps = Math.max(0, (pt.sx.eps || 0) - 1.2);
          },
          why: 'Острая дистония — частое и пугающее осложнение высокопотентных антипсихотиков в первые дни, особенно у молодых мужчин. Купируется холинолитиком за минуты.',
        },
        {
          t: 'Это истерическая реакция — не обращать внимания',
          ok: false,
          fx: (s, pt) => {
            pt.insight = Math.max(0, pt.insight - 0.15);
          },
          why: 'Дистония — не истерия. Пациент запомнит, что «от лечения только хуже», и перестанет принимать таблетки.',
        },
        {
          t: 'Ввести ещё галоперидол в/м — «это возбуждение»',
          ok: false,
          fx: (s, pt) => {
            pt.sx.eps = (pt.sx.eps || 0) + 0.8;
            pt.harm += 1;
          },
          why: 'Галоперидол и вызвал дистонию — добавка её только усилит.',
        },
      ],
    },

    nms: {
      title: 'Злокачественный нейролептический синдром',
      once: true,
      chance: (s, pt) => {
        if (!has(pt, isAP)) return 0;
        const t = P().tags(pt);
        let risk = (pt.load && pt.load.nms) || 0;
        if (recentUp(s, pt, isAP)) risk *= 2;
        if (has(pt, (r, d) => isAP(r, d) && r.route === 'im')) risk *= 1.5;
        if (pt.group === 'alcohol_withdrawal' || pt.group === 'delirium_tremens') risk *= 2;
        if (pt.rx.filter((r) => isAP(r, P().drug(r.id)) && !r.prn).length >= 2) risk *= 1.5;
        if (t.nms_history) risk *= 4;
        return Math.min(0.05, 0.0002 * risk);
      },
      preventable: (s, pt) =>
        recentUp(s, pt, isAP) ||
        pt.rx.some((r) => isAP(r, P().drug(r.id)) && (r.route === 'im' || P().doseFactor(r, pt) > 1.5)) ||
        pt.rx.filter((r) => isAP(r, P().drug(r.id)) && !r.prn).length >= 2,
      start: (s, pt) => {
        pt.flags.nms = true;
        pt.traits.push('nms_history');
        return pickText(pt, 'nms', (D().wardTexts.se || {}).nms) || 'Температура 39,4, выраженная мышечная ригидность, спутанность, потливость, скачет давление.';
      },
      q: () => 'Утром температура 39,4, «свинцовая» ригидность мышц, спутанность, давление скачет. КФК — больше 6000 Ед/л. Ваши действия?',
      opts: [
        {
          t: 'Злокачественный нейролептический синдром: немедленно отменить все антипсихотики, перевод в реанимацию, инфузионная терапия, охлаждение, контроль КФК и функции почек',
          ok: true,
          fx: (s, pt) => {
            stopWhere(s, pt, isAP, 'ЗНС');
            pt.flags.nms = false;
            pt.away = { until: s.day + 3, where: 'реанимации' };
            pt.sev = Math.min(100, pt.sev + 8);
          },
          why: 'ЗНС — жизнеугрожающее осложнение. Первое и главное — отменить антипсихотики; лечение — в реанимации. Возобновлять антипсихотик можно не раньше чем через две недели, низкопотентным атипиком с медленной титрацией.',
        },
        {
          t: 'Жаропонижающее и корректор, антипсихотик продолжить',
          ok: false,
          fx: (s, pt) => {
            pt.harm += 1;
            stopWhere(s, pt, isAP, 'ЗНС — отменено реаниматологом');
            pt.away = { until: s.day + 5, where: 'реанимации' };
            pt.sev = Math.min(100, pt.sev + 15);
          },
          why: 'Продолжать антипсихотик при ЗНС — опасно для жизни: рабдомиолиз, почечная недостаточность.',
        },
        {
          t: 'Повысить дозу для седации — пациент «возбуждён»',
          ok: false,
          fx: (s, pt) => {
            pt.harm += 2;
            stopWhere(s, pt, isAP, 'ЗНС — отменено реаниматологом');
            pt.away = { until: s.day + 6, where: 'реанимации' };
            pt.sev = Math.min(100, pt.sev + 18);
          },
          why: 'Спутанность и потливость при ЗНС — не возбуждение. Новая доза антипсихотика ухудшит прогноз.',
        },
      ],
    },

    serotonin: {
      title: 'Серотониновый синдром',
      once: true,
      chance: (s, pt) => {
        const sero = pt.rx.filter((r) => isSero(r, P().drug(r.id)));
        const t = P().tags(pt);
        const strong = sero.some((r) => STRONG_SERO.indexOf(r.id) >= 0);
        if ((sero.length >= 2 && strong) || (sero.length >= 1 && (t.tramadol || t.triptan))) return recentAdd(s, pt, isSero, 7) ? 0.07 : 0.02;
        return 0;
      },
      preventable: () => true,
      start: (s, pt) => pickText(pt, 'serotonin', (D().wardTexts.se || {}).serotonin) || 'Возбуждение, потливость, тремор, понос, температура 38,3, клонус стоп.',
      q: () => 'К вечеру возбуждение, потливость, тремор, понос, температура 38,3; при осмотре — гиперрефлексия и клонус стоп. Что это и что делать?',
      opts: [
        {
          t: 'Серотониновый синдром: отменить все серотонинергические препараты, инфузия, бензодиазепин при возбуждении, наблюдение; при тяжёлом течении — реанимация',
          ok: true,
          fx: (s, pt) => {
            stopWhere(s, pt, isSero, 'серотониновый синдром');
            pt.sx.serotonergic = 0;
          },
          why: 'Клонус и гиперрефлексия на фоне двух серотонинергических средств — классика. Лечение — отмена и поддержка; обычно проходит за сутки-двое.',
        },
        {
          t: 'Добавить антипсихотик для седации, остальное оставить',
          ok: false,
          fx: (s, pt) => {
            pt.harm += 1;
            stopWhere(s, pt, isSero, 'серотониновый синдром — отменено дежурным врачом');
          },
          why: 'Причина не устранена, а антипсихотик может замаскировать картину и добавить риск ЗНС.',
        },
        {
          t: 'Жаропонижающее и продолжить лечение',
          ok: false,
          fx: (s, pt) => {
            pt.harm += 1;
            stopWhere(s, pt, isSero, 'серотониновый синдром — отменено дежурным врачом');
          },
          why: 'Гипертермия при серотониновом синдроме не снимается жаропонижающими: нужна отмена препаратов.',
        },
      ],
    },

    li_tox: {
      title: 'Литиевая интоксикация',
      once: true,
      chance: (s, pt) => (pt.lab.li > 1.6 && has(pt, (r) => r.id === 'lithium') ? 0.5 : 0),
      preventable: () => true,
      start: (s, pt) => pickText(pt, 'li_tox', (D().wardTexts.se || {}).li_tox) || 'Грубый тремор рук, понос, шаткая походка, смазанная речь.',
      q: (s, pt) => 'Шатает, речь смазанная, грубый тремор рук, рвота. Литий — ' + String(Math.round(pt.lab.li * 10) / 10).replace('.', ',') + ' ммоль/л. Ваши действия?',
      opts: [
        {
          t: 'Литиевая интоксикация: отменить литий, инфузия, убрать НПВС и иАПФ, контроль лития, креатинина и электролитов; при тяжёлой — гемодиализ',
          ok: true,
          fx: (s, pt) => {
            stopWhere(s, pt, (r) => r.id === 'lithium', 'интоксикация');
            pt.lab.li = Math.min(pt.lab.li, 1.2);
          },
          why: 'У лития узкое терапевтическое окно. НПВС, иАПФ, тиазиды, обезвоживание и снижение функции почек поднимают концентрацию до токсической.',
        },
        {
          t: 'Снизить дозу вдвое и продолжить',
          ok: 'part',
          fx: (s, pt) => {
            const r = pt.rx.find((x) => x.id === 'lithium');
            if (r) r.dose = Math.max(150, Math.round(r.dose / 2 / 150) * 150);
          },
          why: 'При клинических признаках интоксикации литий сначала отменяют и только после нормализации решают, возобновлять ли.',
        },
        {
          t: 'Это обычные побочные эффекты — продолжить',
          ok: false,
          fx: (s, pt) => {
            pt.harm += 2;
            stopWhere(s, pt, (r) => r.id === 'lithium', 'интоксикация — отменено дежурным врачом');
          },
          why: 'Грубый тремор, атаксия и дизартрия — признаки интоксикации, а не «побочка».',
        },
      ],
    },

    neutropenia: {
      title: 'Нейтропения',
      once: true,
      chance: () => 0,
      preventable: () => false,
      start: (s, pt) => 'В анализе крови нейтрофилы ' + String(Math.round(pt.lab.anc * 10) / 10).replace('.', ',') + '×10⁹/л.',
      q: (s, pt) => 'В общем анализе крови нейтрофилы ' + String(Math.round(pt.lab.anc * 10) / 10).replace('.', ',') + '×10⁹/л. Ваши действия?',
      opts: [
        {
          t: 'Немедленно отменить клозапин (или карбамазепин), ежедневный контроль крови, защита от инфекций, консультация гематолога; клозапин повторно не назначать',
          ok: true,
          fx: (s, pt) => {
            stopWhere(s, pt, (r) => r.id === 'clozapine' || r.id === 'carbamazepine', 'нейтропения');
            pt.flags.agranDay = null;
            pt.traits.push('agranulocytosis_history');
          },
          why: 'Агранулоцитоз на клозапине редок, но смертельно опасен; поэтому кровь и проверяют каждую неделю в первые месяцы.',
        },
        {
          t: 'Повторить анализ через неделю, лечение не менять',
          ok: false,
          fx: (s, pt) => {
            pt.harm += 2;
            stopWhere(s, pt, (r) => r.id === 'clozapine' || r.id === 'carbamazepine', 'нейтропения — отменено после консультации гематолога');
            pt.away = { until: s.day + 4, where: 'гематологии' };
          },
          why: 'За неделю нейтропения может перейти в агранулоцитоз с сепсисом.',
        },
        {
          t: 'Снизить дозу клозапина вдвое',
          ok: false,
          fx: (s, pt) => {
            pt.harm += 1;
            stopWhere(s, pt, (r) => r.id === 'clozapine' || r.id === 'carbamazepine', 'нейтропения — отменено после консультации гематолога');
          },
          why: 'Агранулоцитоз на клозапине не зависит от дозы — препарат отменяют полностью.',
        },
      ],
    },

    agran_fever: {
      title: 'Лихорадка на клозапине',
      once: true,
      chance: (s, pt) => (pt.flags.agranDay && s.day >= pt.flags.agranDay + 3 && pt.rx.some((r) => r.id === 'clozapine') && pt.lab.anc < 0.8 ? 0.6 : 0),
      preventable: () => true,
      start: () => 'Температура 39, боль в горле, слабость. В анализе — нейтрофилы почти на нуле.',
      q: () => 'Лихорадка 39, ангина, слабость; нейтрофилы — 0,3×10⁹/л. Агранулоцитоз пропустили. Ваши действия?',
      opts: [
        {
          t: 'Отменить клозапин, перевод в отделение интенсивной терапии/гематологии, изоляция, антибиотики широкого спектра',
          ok: true,
          fx: (s, pt) => {
            stopWhere(s, pt, (r) => r.id === 'clozapine', 'агранулоцитоз');
            pt.flags.agranDay = null;
            pt.traits.push('agranulocytosis_history');
            pt.away = { until: s.day + 6, where: 'гематологии' };
          },
          why: 'Фебрильная нейтропения — экстренное состояние. Еженедельный анализ крови позволил бы поймать снижение раньше.',
        },
        {
          t: 'Жаропонижающее и полоскание горла',
          ok: false,
          fx: (s, pt) => {
            pt.harm += 2;
            stopWhere(s, pt, (r) => r.id === 'clozapine', 'агранулоцитоз — отменено дежурным врачом');
            pt.away = { until: s.day + 8, where: 'реанимации' };
          },
          why: 'При агранулоцитозе обычная ангина за сутки становится сепсисом.',
        },
      ],
    },

    hyponatremia: {
      title: 'Гипонатриемия',
      once: true,
      chance: (s, pt) => (pt.lab.na < 128 ? 0.45 : 0),
      preventable: () => true,
      start: (s, pt) => pickText(pt, 'hyponatremia', (D().wardTexts.se || {}).hyponatremia) || 'Заторможенность, спутанность, утром — падение у кровати.',
      q: (s, pt) => 'Заторможенность, спутанность, утром — падение у кровати. Натрий — ' + Math.round(pt.lab.na) + ' ммоль/л. Ваши действия?',
      opts: [
        {
          t: 'Отменить СИОЗС/СИОЗСН (и другие причины — тиазид, карбамазепин), ограничить жидкость, контроль натрия, консультация терапевта; позже — антидепрессант с меньшим риском (миртазапин, агомелатин)',
          ok: true,
          fx: (s, pt) => {
            stopWhere(s, pt, (r, d) => d && (d.se.hyponatremia || 0) >= 1, 'гипонатриемия');
            pt.lab.na += 3;
          },
          why: 'СИОЗС у пожилых, особенно с диуретиками, часто вызывают синдром неадекватной секреции АДГ. Натрий проверяют в первые недели лечения.',
        },
        {
          t: 'Быстро ввести гипертонический раствор и поднять натрий до нормы за сутки',
          ok: false,
          fx: (s, pt) => {
            pt.harm += 2;
            stopWhere(s, pt, (r, d) => d && (d.se.hyponatremia || 0) >= 1, 'гипонатриемия — отменено терапевтом');
          },
          why: 'Слишком быстрая коррекция хронической гипонатриемии грозит осмотическим демиелинизирующим синдромом.',
        },
        {
          t: 'Это возрастное, лечение не менять',
          ok: false,
          fx: (s, pt) => {
            pt.harm += 1;
          },
          why: 'Натрий 125–128 при падениях и спутанности — повод отменить причину, а не наблюдать.',
        },
      ],
    },

    qt_syncope: {
      title: 'Удлинение QT и обморок',
      once: true,
      chance: (s, pt) => (pt.lab.qtc >= 500 ? 0.1 : 0),
      preventable: () => true,
      start: () => 'Внезапная потеря сознания в коридоре на несколько секунд; на мониторе — эпизод полиморфной желудочковой тахикардии.',
      q: (s, pt) => 'Обморок в коридоре, на мониторе — пароксизм полиморфной тахикардии. QTc — ' + pt.lab.qtc + ' мс. Ваши действия?',
      opts: [
        {
          t: 'Отменить препараты, удлиняющие QT, ЭКГ, калий и магний, кардиолог, перевод под мониторное наблюдение',
          ok: true,
          fx: (s, pt) => {
            stopWhere(s, pt, (r, d) => d && (d.se.qt || 0) >= 2, 'удлинение QT');
            pt.lab.qtc = Math.min(pt.lab.qtc, 470);
          },
          why: 'QTc больше 500 мс резко повышает риск torsades de pointes. ЭКГ до начала терапии и при наращивании доз — обязательна.',
        },
        {
          t: 'Обморок от духоты — продолжить лечение',
          ok: false,
          fx: (s, pt) => {
            pt.harm += 2;
            stopWhere(s, pt, (r, d) => d && (d.se.qt || 0) >= 2, 'удлинение QT — отменено кардиологом');
          },
          why: 'Пароксизм тахикардии при длинном QT — предвестник остановки сердца.',
        },
      ],
    },

    switch_mania: {
      title: 'Инверсия в манию',
      once: true,
      chance: (s, pt) => {
        const bip = pt.group === 'bipolar_depression' || P().tags(pt).bipolar;
        if (!bip || !has(pt, isAD) || has(pt, isMoodStab)) return 0;
        if (s.day - pt.admitDay < 4) return 0;
        return has(pt, (r, d) => d && (d.cls === 'tca' || d.cls === 'snri')) ? 0.08 : 0.05;
      },
      preventable: () => true,
      start: (s, pt) => {
        pt.group = 'mania';
        pt.dx += ' Инверсия аффекта: маниакальное состояние на фоне антидепрессанта.';
        pt.sev = Math.max(pt.sev, 72);
        return pickText(pt, 'switch_mania', (D().wardTexts.se || {}).switch_mania) || '{P} не спит третью ночь, говорит без умолку, раздаёт соседям вещи и строит планы «бизнеса».';
      },
      q: () => 'Третью ночь почти без сна, ускоренная речь, раздаёт вещи, планы «бизнеса». Что произошло и что делать?',
      opts: [
        {
          t: 'Инверсия в манию: отменить антидепрессант, начать антиманиакальную терапию (литий, вальпроат или атипичный антипсихотик)',
          ok: true,
          fx: (s, pt) => {
            stopWhere(s, pt, isAD, 'инверсия в манию');
          },
          why: 'При биполярном расстройстве антидепрессант без нормотимика может перевернуть фазу. Отсюда правило: только на фоне стабилизатора настроения.',
        },
        {
          t: 'Наконец-то настроение поднялось — продолжать',
          ok: false,
          fx: (s, pt) => {
            pt.harm += 1;
            pt.sev = Math.min(100, pt.sev + 8);
          },
          why: 'Это не выздоровление, а мания — с долгами, разводами и госпитализацией.',
        },
      ],
    },

    rash: {
      title: 'Сыпь на ламотриджине',
      once: true,
      chance: (s, pt) => {
        const r = pt.rx.find((x) => x.id === 'lamotrigine');
        if (!r || s.day - r.since > 56) return 0;
        const fast = pt.flags.lamoFast || has(pt, (x) => x.id === 'valproate');
        return fast ? 0.05 : 0.004;
      },
      preventable: (s, pt) => !!pt.flags.lamoFast || has(pt, (x) => x.id === 'valproate'),
      start: (s, pt) => pickText(pt, 'rash', (D().wardTexts.se || {}).rash) || 'Распространённая сыпь, температура, болезненность слизистой рта.',
      q: () => 'Распространённая сыпь, температура, болят губы и слизистая рта. Пациент получает ламотриджин. Ваши действия?',
      opts: [
        {
          t: 'Немедленно отменить ламотриджин (риск синдрома Стивенса–Джонсона), консультация дерматолога; повторно не назначать',
          ok: true,
          fx: (s, pt) => {
            stopWhere(s, pt, (r) => r.id === 'lamotrigine', 'сыпь');
          },
          why: 'Риск тяжёлой сыпи выше при быстрой титрации и сочетании с вальпроатом (дозы тогда вдвое ниже).',
        },
        {
          t: 'Антигистаминное и продолжить',
          ok: false,
          fx: (s, pt) => {
            pt.harm += 2;
            stopWhere(s, pt, (r) => r.id === 'lamotrigine', 'сыпь — отменено дерматологом');
            pt.away = { until: s.day + 4, where: 'дерматологии' };
          },
          why: 'Сыпь с лихорадкой и поражением слизистых — показание к немедленной отмене.',
        },
      ],
    },

    seizure: {
      title: 'Судорожный припадок',
      once: true,
      chance: (s, pt) => {
        const day = s.day - pt.admitDay;
        const alc = pt.group === 'alcohol_withdrawal' || pt.group === 'delirium_tremens';
        if (alc && day <= 3 && pt.sev > 68 && (pt.lastE ? pt.lastE.total : 0) < 0.4) return 0.12 * (pt.traits.indexOf('epilepsy') >= 0 || pt.traits.indexOf('seizure_history') >= 0 || pt.flags.seizureHistory ? 2 : 1);
        const cz = pt.rx.find((r) => r.id === 'clozapine');
        if (cz && cz.dose > 450) return 0.02;
        if (P().tags(pt).epilepsy && has(pt, (r, d) => d && (d.se.seizure || 0) >= 2)) return 0.03;
        return 0;
      },
      preventable: () => true,
      start: () => 'Генерализованный судорожный припадок около двух минут, после — оглушённость и сон.',
      q: (s, pt) => (pt.group === 'alcohol_withdrawal' || pt.group === 'delirium_tremens' ? 'Судорожный припадок на вторые сутки отмены алкоголя. Ваши действия?' : 'Генерализованный судорожный припадок. Ваши действия?'),
      opts: [
        {
          t: 'Безопасность и дыхательные пути; бензодиазепин (диазепам в/в или в/м); при отмене алкоголя — тиамин и достаточная доза бензодиазепина, при клозапине — снизить дозу, ЭЭГ, рассмотреть вальпроат',
          ok: true,
          fx: (s, pt) => {
            const alc = pt.group === 'alcohol_withdrawal' || pt.group === 'delirium_tremens';
            if (alc && !has(pt, (r, d) => d && d.cls === 'bzd')) addDrug(s, pt, 'diazepam', 'po', 30);
            if (alc && !has(pt, (r) => r.id === 'thiamine')) addDrug(s, pt, 'thiamine', 'im', 200);
            const cz = pt.rx.find((r) => r.id === 'clozapine');
            if (cz) cz.dose = Math.max(100, cz.dose - 100);
            pt.flags.seizureHistory = true;
          },
          why: 'Бензодиазепины — основа лечения и профилактики судорог при отмене алкоголя. Для клозапина риск судорог зависит от дозы.',
        },
        {
          t: 'Ввести галоперидол, чтобы не было возбуждения после приступа',
          ok: false,
          fx: (s, pt) => {
            pt.harm += 1;
          },
          why: 'Галоперидол снижает судорожный порог и при отмене алкоголя без бензодиазепинов опасен.',
        },
        {
          t: 'Наблюдать: приступ уже прошёл',
          ok: false,
          fx: (s, pt) => {
            pt.harm += 1;
          },
          why: 'Без лечения причины приступы повторятся, а при отмене алкоголя высок риск делирия.',
        },
      ],
    },

    wernicke: {
      title: 'Энцефалопатия Гайе–Вернике',
      once: true,
      chance: (s, pt) => {
        const alc = pt.group === 'alcohol_withdrawal' || pt.group === 'delirium_tremens';
        if (!alc || has(pt, (r) => r.id === 'thiamine') || s.day - pt.admitDay < 2) return 0;
        return hasInt(pt, 'infusion') ? 0.14 : 0.06;
      },
      preventable: () => true,
      start: (s, pt) => pickText(pt, 'wernicke', (D().wardTexts.se || {}).wernicke) || 'Путается в месте и времени, шаткая походка, нистагм.',
      q: () => 'Путается в месте и времени, шаткая походка, при осмотре — нистагм и слабость отводящих мышц глаз. Ваши действия?',
      opts: [
        {
          t: 'Энцефалопатия Гайе–Вернике: тиамин в высоких дозах парентерально немедленно, глюкозу — только после тиамина; консультация невролога',
          ok: true,
          fx: (s, pt) => {
            addDrug(s, pt, 'thiamine', 'im', 500);
            G().unlock(s, 'thiamine');
          },
          why: 'Тиамин назначают всем пациентам с отменой алкоголя с первого дня — до глюкозы. Иначе энцефалопатия может перейти в корсаковский синдром.',
        },
        {
          t: 'Глюкоза в/в и наблюдение',
          ok: false,
          fx: (s, pt) => {
            pt.harm += 2;
            addDrug(s, pt, 'thiamine', 'im', 500);
          },
          why: 'Глюкоза без тиамина ускоряет повреждение мозга при дефиците тиамина.',
        },
        {
          t: 'Галоперидол от спутанности',
          ok: false,
          fx: (s, pt) => {
            pt.harm += 1;
            addDrug(s, pt, 'thiamine', 'im', 500);
          },
          why: 'Спутанность здесь — от дефицита тиамина, а не от психоза.',
        },
      ],
    },

    falls: {
      title: 'Падение',
      chance: (s, pt) => {
        const t = P().tags(pt);
        if (!t.elderly) return 0;
        const x = pt.sx;
        const v = (x.sedation || 0) + (x.orthostatic || 0) + (has(pt, (r, d) => d && (d.cls === 'bzd' || d.cls === 'z')) ? 1 : 0);
        return v >= 2.2 && !pt.flags.fell ? 0.07 : 0;
      },
      preventable: () => true,
      start: (s, pt) => {
        pt.flags.fell = s.day;
        return 'Ночью — падение по дороге в туалет: ушиб бедра, перелома, по счастью, нет.';
      },
      q: () => 'Ночное падение по дороге в туалет. Ушиб бедра, давление лёжа 130/80, стоя — 100/60. Ваши действия?',
      opts: [
        {
          t: 'Пересмотреть назначения: убрать или снизить седативные и вызывающие ортостаз препараты, контроль давления лёжа и стоя, ночник и сопровождение',
          ok: true,
          fx: (s, pt) => {
            stopWhere(s, pt, (r, d) => d && (d.cls === 'bzd' || d.cls === 'z'), 'падение');
          },
          why: 'Седация и ортостатическая гипотензия — главные лекарственные причины падений у пожилых.',
        },
        {
          t: 'Добавить снотворное, чтобы ночью не вставать',
          ok: false,
          fx: (s, pt) => {
            pt.harm += 1;
          },
          why: 'Ещё один седативный препарат — ещё одно падение.',
        },
      ],
    },

    delirium_anticholinergic: {
      title: 'Антихолинергический делирий',
      once: true,
      chance: (s, pt) => (P().tags(pt).elderly && (pt.sx.anticholinergic || 0) >= 1.8 ? 0.09 : 0),
      preventable: () => true,
      start: (s, pt) => pickText(pt, 'delirium_anticholinergic', (D().wardTexts.se || {}).delirium_anticholinergic) || 'К вечеру не узнаёт медсестру, собирает с одеяла «нитки»; зрачки широкие, кожа сухая.',
      q: () => 'К вечеру не узнаёт медсестру, «собирает нитки» с одеяла; зрачки широкие, кожа сухая и горячая, пульс 112. Ваши действия?',
      opts: [
        {
          t: 'Антихолинергический делирий: отменить холинолитические препараты (ТЦА, тригексифенидил, хлорпромазин и др.), инфузия, наблюдение',
          ok: true,
          fx: (s, pt) => {
            stopWhere(s, pt, (r, d) => d && (d.se.anticholinergic || 0) >= 2, 'антихолинергический делирий');
            pt.sx.anticholinergic = 0.5;
          },
          why: 'У пожилых суммарная холинолитическая нагрузка легко вызывает делирий. Корректоры «на всякий случай» и ТЦА им противопоказаны.',
        },
        {
          t: 'Назначить галоперидол, остальное оставить',
          ok: false,
          fx: (s, pt) => {
            pt.harm += 1;
            stopWhere(s, pt, (r, d) => d && (d.se.anticholinergic || 0) >= 2, 'антихолинергический делирий — отменено дежурным врачом');
          },
          why: 'Причина делирия — лекарства. Пока их не отменят, антипсихотик лишь замаскирует картину.',
        },
      ],
    },

    oversedation: {
      title: 'Чрезмерная седация',
      once: true,
      chance: (s, pt) => {
        const t = P().tags(pt);
        return (pt.sx.sedation || 0) >= 2.7 && has(pt, (r, d) => d && d.cls === 'bzd') && (t.elderly || t.resp_failure || t.sleep_apnea || t.liver) ? 0.12 : 0;
      },
      preventable: () => true,
      start: (s, pt) => pickText(pt, 'oversedation', (D().wardTexts.se || {}).oversedation) || 'Утром не удаётся разбудить: на голос открывает глаза и снова засыпает.',
      q: () => 'Утром не удаётся разбудить: на голос открывает глаза и тут же засыпает; дыхание редкое, сатурация 89%. Ваши действия?',
      opts: [
        {
          t: 'Отменить бензодиазепины и другие седативные, пульсоксиметрия; при угнетении дыхания — флумазенил и перевод в реанимацию',
          ok: true,
          fx: (s, pt) => {
            stopWhere(s, pt, (r, d) => d && (d.cls === 'bzd' || d.cls === 'z'), 'угнетение сознания');
          },
          why: 'При болезнях печени, лёгких и в пожилом возрасте бензодиазепины накапливаются. Выбирают меньшие дозы и короткие препараты.',
        },
        {
          t: 'Пусть отоспится',
          ok: false,
          fx: (s, pt) => {
            pt.harm += 2;
            stopWhere(s, pt, (r, d) => d && (d.cls === 'bzd' || d.cls === 'z'), 'угнетение сознания — отменено дежурным врачом');
            pt.away = { until: s.day + 2, where: 'реанимации' };
          },
          why: 'Сатурация 89% и оглушение — не сон, а угнетение дыхания.',
        },
      ],
    },

    suicide: {
      title: 'Суицидальная попытка',
      chance: (s, pt) => {
        if (['depression', 'depression_psychotic', 'bipolar_depression', 'bpd_crisis', 'schizophrenia'].indexOf(pt.group) < 0) return 0;
        if (pt.risk.suicide < 2 || pt.sev < 55) return 0;
        let p = 0.02 + 0.015 * pt.risk.suicide + ((pt.sx.akathisia || 0) > 1.5 ? 0.02 : 0) + ((pt.sx.activation || 0) > 1.2 ? 0.02 : 0);
        if (hasInt(pt, 'observation_strict')) p *= 0.15;
        return p;
      },
      preventable: (s, pt) => !hasInt(pt, 'observation_strict'),
      start: () => 'Ночью медсестра застаёт в туалете с полосками простыни в руках — попытка вовремя остановлена.',
      q: () => 'Ночью попытка самоповешения — вовремя остановлена медсестрой. Пациент жив, на шее ссадина. Ваши действия?',
      opts: [
        {
          t: 'Строгое наблюдение, подробная беседа о суицидальных мыслях и плане, пересмотр терапии (в том числе акатизии и активации), привлечь психотерапевта, сообщить заведующему',
          ok: true,
          fx: (s, pt) => {
            addInt(s, pt, 'observation_strict');
            pt.risk.suicide = Math.max(pt.risk.suicide, 3);
          },
          why: 'Высокий суицидальный риск — показание к строгому наблюдению с первого дня. Акатизия и ранняя активация на антидепрессантах риск повышают.',
        },
        {
          t: 'Перевести на общий режим, чтобы «не травмировать»',
          ok: false,
          fx: (s, pt) => {
            pt.harm += 1;
          },
          why: 'После попытки риск повторной в ближайшие дни максимален.',
        },
      ],
    },

    dt_onset: {
      title: 'Развитие делирия',
      once: true,
      chance: (s, pt) => (pt.group === 'alcohol_withdrawal' && pt.sev > 78 ? 0.45 : 0),
      preventable: () => true,
      start: (s, pt) => {
        pt.group = 'delirium_tremens';
        pt.dx = 'F10.4 Синдром отмены алкоголя с делирием (развился в отделении).';
        pt.sev = Math.max(pt.sev, 85);
        pt.admitDay = Math.min(pt.admitDay, s.day - 1);
        return 'К ночи видит на стене «пауков», разговаривает с несуществующими людьми, не понимает, где находится; пульс 124, температура 38,0.';
      },
      q: () => 'Зрительные галлюцинации, дезориентировка, тремор, пульс 124, температура 38. Развился алкогольный делирий. Ваши действия?',
      opts: [
        {
          t: 'Бензодиазепин в достаточной дозе, тиамин парентерально, инфузионная терапия, мониторинг жизненных функций; при утяжелении — реанимация',
          ok: true,
          fx: (s, pt) => {
            if (!has(pt, (r, d) => d && d.cls === 'bzd')) addDrug(s, pt, 'diazepam', 'po', 40);
            if (!has(pt, (r) => r.id === 'thiamine')) addDrug(s, pt, 'thiamine', 'im', 300);
            addInt(s, pt, 'infusion');
          },
          why: 'Основа лечения алкогольного делирия — бензодиазепины (КР «…Абстинентное состояние с делирием», 2024). Тиамин — до глюкозы.',
        },
        {
          t: 'Галоперидол в/м в монотерапии',
          ok: false,
          fx: (s, pt) => {
            pt.harm += 1;
          },
          why: 'Антипсихотик без бензодиазепина при алкогольном делирии снижает судорожный порог и не лечит отмену.',
        },
        {
          t: 'Зафиксировать и ждать утра',
          ok: false,
          fx: (s, pt) => {
            pt.harm += 2;
            pt.flags.restraint = s.day;
          },
          why: 'Делирий — неотложное состояние с риском гибели; фиксация без лечения его не остановит.',
        },
      ],
    },

    bzd_withdrawal: {
      title: 'Синдром отмены бензодиазепина',
      once: true,
      chance: (s, pt) => (pt.flags.bzdCut && s.day - pt.flags.bzdCut <= 3 ? 0.4 : 0),
      preventable: () => true,
      start: () => 'Ночью резкая тревога, тремор, потливость, сердцебиение 110, бессонница; к утру — кратковременные подёргивания мышц.',
      q: () => 'После резкой отмены феназепама: тревога, тремор, тахикардия, бессонница, подёргивания мышц. Ваши действия?',
      opts: [
        {
          t: 'Вернуть бензодиазепин в прежней дозе и снижать постепенно — на 10–25% каждые 1–2 недели, параллельно лечить основное расстройство',
          ok: true,
          fx: (s, pt) => {
            if (!has(pt, (r, d) => d && d.cls === 'bzd')) addDrug(s, pt, 'phenazepam', 'po', pt.flags.bzdPrev || 2);
            pt.flags.bzdCut = null;
          },
          why: 'После месяцев ежедневного приёма бензодиазепин отменяют медленно — иначе синдром отмены вплоть до судорог.',
        },
        {
          t: 'Добавить антипсихотик от тревоги',
          ok: false,
          fx: (s, pt) => {
            pt.harm += 1;
            pt.flags.bzdCut = null;
          },
          why: 'Синдром отмены не лечат антипсихотиками: они снижают судорожный порог.',
        },
      ],
    },
  };

  /** Последнее начало или повышение дозы антипсихотика, способного вызвать ЭПС. */
  function lastAPChange(pt) {
    const r = pt.rx.filter((x) => {
      const d = P().drug(x.id);
      return d && d.group === 'antipsychotic' && (d.se.eps || 0) >= 1;
    });
    return r.length ? Math.max.apply(null, r.map((x) => (x.upCount ? x.changed : x.since))) : -99;
  }
  function recentUp(s, pt, pred) {
    return pt.rx.some((r) => pred(r, P().drug(r.id)) && (s.day - (r.changed || r.since) <= 3) && (r.upCount || 0) >= 1);
  }
  function recentAdd(s, pt, pred, n) {
    return pt.rx.some((r) => pred(r, P().drug(r.id)) && s.day - r.since <= n);
  }

  function evalEvents(s, pt) {
    // агранулоцитоз на клозапине: заранее решаем, случится ли (для обучения — чаще, чем в жизни)
    const cz = pt.rx.find((r) => r.id === 'clozapine');
    if (cz && pt.flags.agranRoll == null) {
      pt.flags.agranRoll = Math.random() < 0.06;
      if (pt.flags.agranRoll) pt.flags.agranDay = cz.since + U.int(9, 18);
    }
    const keys = Object.keys(W.EVENTS);
    const last = pt.events.length ? pt.events[pt.events.length - 1].day : -99;
    if (s.day - last < 2) return; // не больше одного происшествия за пару дней
    for (const k of U.shuffle(keys)) {
      const ev = W.EVENTS[k];
      if (ev.once && pt.events.some((e) => e.k === k)) continue;
      if (pt.events.some((e) => e.k === k && s.day - e.day < (ev.cooldown || 6))) continue;
      const p = ev.chance(s, pt);
      if (p > 0 && Math.random() < p) {
        startEvent(s, pt, k);
        break;
      }
    }
  }

  function startEvent(s, pt, k) {
    const ev = W.EVENTS[k];
    const preventable = ev.preventable ? !!ev.preventable(s, pt) : false;
    const text = ev.start(s, pt);
    pt.events.push({ k, day: s.day, preventable, resolved: false });
    if (preventable) pt.harm += 1;
    note(s, pt, 'event', W.fill(pt, text), 'alarm');
    pt.pending = { k, day: s.day };
  }
  W.startEvent = startEvent;

  /** Решение на обходе по срочному событию. Возвращает { ok, why }. */
  W.decide = function (s, pt, i) {
    if (!pt.pending) return null;
    const ev = W.EVENTS[pt.pending.k];
    const o = ev.opts[i];
    if (!o) return null;
    const ok = typeof o.ok === 'function' ? o.ok(s, pt) : o.ok;
    o.fx(s, pt);
    const e = pt.events.filter((x) => x.k === pt.pending.k).pop();
    if (e) {
      e.resolved = true;
      e.choice = i;
      e.ok = ok;
    }
    if (ok === true) pt.rev.ok++;
    else if (ok === 'part') pt.rev.warn++;
    else pt.wrong++;
    pt.rev.list.push({ day: s.day, lvl: ok === true ? 'ok' : ok === 'part' ? 'warn' : 'err', text: ev.title + ': ' + o.why });
    log(s, pt, ev.title + ' — ' + o.t.charAt(0).toLowerCase() + o.t.slice(1) + '.');
    pt.pending = null;
    return { ok, why: o.why, title: ev.title };
  };

  /** Если врач не подошёл, решает дежурный — правильно, но без заслуги. */
  function autoResolve(s, pt) {
    const ev = W.EVENTS[pt.pending.k];
    const i = ev.opts.findIndex((o) => (typeof o.ok === 'function' ? o.ok(s, pt) : o.ok) === true);
    if (i >= 0) ev.opts[i].fx(s, pt);
    const e = pt.events.filter((x) => x.k === pt.pending.k).pop();
    if (e) {
      e.resolved = true;
      e.auto = true;
    }
    const duty = pt.mode === 'study' ? 'дежурный врач' : 'дежурный врач';
    note(s, pt, 'staff', ev.title + ': помощь оказал ' + duty + '. ' + (i >= 0 ? ev.opts[i].t.split(':')[0] + '.' : ''), 'warn');
    if (W.wasExpected(s, pt.pending.day)) pt.missed++;
    pt.pending = null;
  }

  /** Ждали ли игрока на обходе в этот день. */
  W.wasExpected = function (s, day) {
    if (A.cal && A.cal.isWeekend(day)) return false;
    if (s.phase === 'study') return !!G().scheduleFor(day);
    if (s.phase === 'career') return true;
    return false;
  };

  /* ---------- Записи в дневнике ---------- */
  const SE_NOTE = [
    ['eps', 1.4],
    ['akathisia', 1.3],
    ['sedation', 2.1],
    ['orthostatic', 1.6],
    ['anticholinergic', 1.6],
    ['tremor', 1.4],
    ['activation', 1.2],
    ['sexual', 1.8],
  ];
  function dailyNotes(s, pt, day) {
    const T = D().wardTexts || {};
    const st = P().stage(pt.sev).k;
    const course = ((T.course || {})[pt.group] || {})[st];
    if (course && course.length) note(s, pt, 'course', pickText(pt, 'c:' + pt.group + ':' + st, course));
    const tpl = D().wardById[pt.tpl];
    if (tpl && tpl.quotes && tpl.quotes[st] && Math.random() < 0.55) note(s, pt, 'quote', pickText(pt, 'q:' + st, tpl.quotes[st]));
    SE_NOTE.forEach(([k, th]) => {
      if ((pt.sx[k] || 0) >= th && (!pt.seenSe[k] || s.day - pt.seenSe[k] >= 3)) {
        pt.seenSe[k] = s.day;
        const txt = pickText(pt, 'se:' + k, (T.se || {})[k]);
        if (txt) note(s, pt, 'se', txt, 'warn');
      }
    });
    const gain = pt.lab.weight - pt.base.weight;
    if (gain >= 2 && (!pt.seenSe.weight || gain - pt.seenSe.weightKg >= 1.5)) {
      pt.seenSe.weight = s.day;
      pt.seenSe.weightKg = gain;
      note(s, pt, 'se', pickText(pt, 'se:weight', (T.se || {}).weight) || 'Заметно прибавляет в весе, жалуется, что «джинсы не сходятся».', 'warn');
    }
    if (pt.lab.prl > 45 && !pt.seenSe.prolactin) {
      pt.seenSe.prolactin = s.day;
      note(s, pt, 'se', pickText(pt, 'se:prolactin', (T.se || {}).prolactin) || (pt.sex === 'f' ? 'Жалуется на выделения из груди и задержку месячных.' : 'Жалуется на снижение влечения и болезненность грудных желёз.'), 'warn');
    }
    if (pt.lab.li > 1.2 && pt.lab.li <= 1.6 && !pt.seenSe.liHigh) {
      pt.seenSe.liHigh = s.day;
      note(s, pt, 'se', 'Усилился тремор рук, жалобы на тошноту и жидкий стул.', 'warn');
    }
    if (pt.refusing) note(s, pt, 'staff', 'Медсестра: «Опять не выпил{|а} — нашли таблетки под матрасом».'.replace('{|а}', W.pv(pt, '', 'а')), 'warn');
  }

  /* ---------- Лист назначений ---------- */
  function rec(s, pt, msgs) {
    msgs.forEach((m) => {
      pt.rev[m.lvl] = (pt.rev[m.lvl] || 0) + 1;
      pt.rev.list.push({ day: s.day, lvl: m.lvl, text: m.text, cite: m.cite || '' });
    });
    if (pt.rev.list.length > 80) pt.rev.list.splice(0, pt.rev.list.length - 80);
    return msgs;
  }

  W.prescribe = function (s, pt, o) {
    if (o.kind === 'int') {
      if (hasInt(pt, o.id)) return [];
      const rx = { id: o.id, kind: 'int', since: s.day, changed: s.day };
      pt.rx.push(rx);
      if (P().line(pt, P().int(o.id)).line === 'first') pt.flags.firstLine = true;
      log(s, pt, 'Назначено: ' + P().int(o.id).name.toLowerCase() + '.');
      return rec(s, pt, P().review(s, pt, rx, 'add'));
    }
    const d = P().drug(o.id);
    if (!d) return [];
    const ex = pt.rx.find((r) => r.id === o.id && r.route === o.route);
    if (ex) return W.setDose(s, pt, pt.rx.indexOf(ex), o.dose);
    const rx = { id: o.id, kind: 'drug', route: o.route, dose: o.dose, since: s.day, changed: s.day, prn: !!(P().form(d, o.route).prn) };
    pt.rx.push(rx);
    if (P().line(pt, d).line === 'first') pt.flags.firstLine = true;
    log(s, pt, 'Назначено: ' + d.name.toLowerCase() + ' ' + P().fmtDose(o.dose) + (rx.prn ? ' по требованию' : P().unit(d, o.route) === 'мг/сут' ? '/сут' : '') + ' (' + P().ROUTES[o.route] + ').');
    if (o.id === 'lamotrigine' && o.dose > 25) pt.flags.lamoFast = true;
    return rec(s, pt, P().review(s, pt, rx, 'add'));
  };

  W.setDose = function (s, pt, idx, dose) {
    const rx = pt.rx[idx];
    if (!rx || rx.kind === 'int') return [];
    const d = P().drug(rx.id);
    const prev = rx.dose;
    if (dose === prev) return [];
    const kind = dose > prev ? 'up' : 'down';
    // резкое снижение бензодиазепина после длительного приёма
    if (d.cls === 'bzd' && s.day - rx.since > 21 && dose < prev * 0.6) {
      pt.flags.bzdCut = s.day;
      pt.flags.bzdPrev = prev;
    }
    rx.dose = dose;
    if (kind === 'up') rx.upCount = (rx.upCount || 0) + 1;
    const msgs = P().review(s, pt, rx, kind, prev);
    rx.changed = s.day;
    if (rx.id === 'lamotrigine' && kind === 'up' && dose - prev > 25) pt.flags.lamoFast = true;
    log(s, pt, d.name + ': ' + P().fmtDose(prev) + ' → ' + P().fmtDose(dose) + '.');
    return rec(s, pt, msgs);
  };

  W.stepDose = function (s, pt, idx, dir) {
    const rx = pt.rx[idx];
    if (!rx || rx.kind === 'int') return [];
    const d = P().drug(rx.id);
    const steps = P().form(d, rx.route).steps || [rx.dose];
    let i = steps.indexOf(rx.dose);
    if (i < 0) i = steps.findIndex((x) => x >= rx.dose);
    if (i < 0) i = steps.length - 1;
    const j = U.clamp(i + dir, 0, steps.length - 1);
    if (j === i) return [];
    return W.setDose(s, pt, idx, steps[j]);
  };

  W.stop = function (s, pt, idx) {
    const rx = pt.rx[idx];
    if (!rx) return [];
    const item = P().item(rx);
    const msgs = P().review(s, pt, rx, 'stop');
    const d = rx.kind === 'int' ? null : P().drug(rx.id);
    if (d && d.cls === 'bzd' && s.day - rx.since > 21 && !pt.rx.some((o) => o !== rx && cls(o) === 'bzd')) {
      pt.flags.bzdCut = s.day;
      pt.flags.bzdPrev = rx.dose;
    }
    pt.rx.splice(idx, 1);
    log(s, pt, 'Отменено: ' + (item ? item.name.toLowerCase() : rx.id) + '.');
    return rec(s, pt, msgs);
  };

  /* ---------- Выписка ---------- */
  W.canDischarge = function (s, pt) {
    const g = P().group(pt);
    if (pt.pending) return { ok: false, why: 'Сначала разберитесь со срочной ситуацией.' };
    if (pt.away) return { ok: false, why: 'Пациент сейчас в ' + pt.away.where + '.' };
    if (pt.sev > g.discharge + 25) return { ok: false, why: 'Заведующий не подпишет выписку: состояние остаётся тяжёлым.' };
    if (pt.risk.suicide >= 3 && pt.sev > g.discharge) return { ok: false, why: 'Высокий суицидальный риск — выписывать рано.' };
    return { ok: true, early: pt.sev > g.discharge };
  };

  /** Проверка поддерживающей терапии и рекомендаций при выписке. */
  function maintenance(s, pt) {
    const out = [];
    let adj = 0;
    const g = P().group(pt);
    const doms = g.domains;
    const strong = pt.rx.filter((r) => {
      const d = r.kind === 'int' ? null : P().drug(r.id);
      if (!d || r.prn || d.cls === 'bzd' || d.group === 'hypnotic') return false;
      return doms.some((k) => (d.eff[k] || 0) >= 0.45) && P().doseFactor(r, pt) >= 0.75;
    });
    const t = P().tags(pt);
    if (['schizophrenia', 'mania', 'bipolar_depression', 'depression', 'depression_psychotic', 'ocd', 'gad', 'panic', 'ptsd'].indexOf(pt.group) >= 0) {
      if (strong.length) out.push({ lvl: 'ok', text: 'Выписан' + W.pv(pt, '', 'а') + ' на эффективной поддерживающей терапии: ' + strong.map((r) => P().drug(r.id).name.toLowerCase()).join(', ') + '.' });
      else {
        out.push({ lvl: 'err', text: 'Нет поддерживающей терапии в эффективной дозе — высокий риск рецидива.' });
        adj -= 15;
      }
    }
    if (pt.group === 'schizophrenia' && (pt.insight < 0.4 || D().wardById[pt.tpl].lai)) {
      if (pt.rx.some((r) => r.route === 'depot')) {
        out.push({ lvl: 'ok', text: 'Пролонгированная форма при сомнительной приверженности — по КР «Шизофрения».' });
        adj += 5;
      } else out.push({ lvl: 'info', text: 'При плохой приверженности стоило обсудить пролонгированную инъекционную форму.' });
    }
    if (pt.group === 'alcohol_withdrawal' || pt.group === 'delirium_tremens') {
      if (pt.rx.some((r) => cls(r) === 'bzd')) {
        out.push({ lvl: 'warn', text: 'Бензодиазепин к выписке нужно было отменить постепенно — иначе риск зависимости.' });
        adj -= 8;
      } else out.push({ lvl: 'ok', text: 'Бензодиазепин отменён до выписки.' });
      if (pt.rx.some((r) => ['naltrexone', 'disulfiram', 'cyanamide'].indexOf(r.id) >= 0)) {
        out.push({ lvl: 'ok', text: 'Начата противорецидивная терапия и направление к наркологу.' });
        adj += 4;
      } else out.push({ lvl: 'info', text: 'Направьте к психиатру-наркологу; обсудите налтрексон или дисульфирам (КР «…Синдром зависимости от алкоголя», 2024).' });
    }
    if (pt.group === 'dementia_bpsd') {
      if (pt.rx.some((r) => grp(r) === 'antipsychotic')) {
        out.push({ lvl: 'warn', text: 'Антипсихотик при деменции — только на короткий срок с регулярной попыткой отмены: растёт риск инсульта и смерти.' });
        adj -= 4;
      }
      if (pt.rx.some((r) => cls(r) === 'che' || cls(r) === 'nmda')) out.push({ lvl: 'ok', text: 'Базисная противодементная терапия назначена — по КР «Когнитивные расстройства у лиц пожилого и старческого возраста».' });
      else {
        out.push({ lvl: 'warn', text: 'Не назначена базисная противодементная терапия (ингибитор холинэстеразы или мемантин).' });
        adj -= 6;
      }
    }
    if (pt.group === 'bpd_crisis') {
      const psy = pt.rx.filter((r) => r.kind !== 'int' && ['antipsychotic', 'antidepressant', 'moodstab', 'anxiolytic', 'hypnotic'].indexOf(grp(r)) >= 0);
      if (psy.length >= 2) {
        out.push({ lvl: 'warn', text: 'Несколько психотропных препаратов при расстройстве личности: специфической фармакотерапии нет, основа — психотерапия.' });
        adj -= 6;
      }
      if (pt.rx.some((r) => r.kind === 'int' && (r.id === 'psychotherapy_dbt' || r.id === 'psychotherapy_cbt'))) out.push({ lvl: 'ok', text: 'Направлен' + W.pv(pt, '', 'а') + ' на психотерапию — это основа лечения.' });
      else {
        out.push({ lvl: 'warn', text: 'Не назначена психотерапия — основной метод лечения расстройств личности.' });
        adj -= 6;
      }
    }
    if (pt.rx.some((r) => cls(r) === 'bzd') && ['gad', 'panic', 'ptsd', 'depression', 'ocd'].indexOf(pt.group) >= 0) {
      const bz = pt.rx.find((r) => cls(r) === 'bzd');
      if (s.day - bz.since > 28) {
        out.push({ lvl: 'warn', text: 'Бензодиазепин дольше месяца: нужен письменный график постепенной отмены.' });
        adj -= 4;
      }
    }
    if (t.suicide_high && pt.rx.some((r) => cls(r) === 'tca')) out.push({ lvl: 'warn', text: 'ТЦА при высоком суицидальном риске опасны в передозировке — выдавайте малыми количествами или замените.' });
    return { msgs: out, adj };
  }

  W.score = function (s, pt, how) {
    const g = P().group(pt);
    const imp = (pt.sev0 - pt.sev) / Math.max(1, pt.sev0);
    // при передаче пациента ждём улучшения соразмерно времени, которое было у врача
    const w = how === 'handover' ? U.clamp(((s.day - pt.admitDay) * W.speed(pt)) / (g.los[0] * 1.2), 0.25, 1) : 1;
    const target = Math.max(0.3, (pt.sev0 - g.discharge) / pt.sev0) * w; // улучшение до порога выписки = 87 баллов
    let outcome = U.clamp(Math.round((imp / target) * 87), 0, 100);
    if (how === 'discharge' && pt.sev > g.discharge) outcome = Math.max(0, outcome - 25);
    const r = pt.rev;
    let kr = U.clamp(Math.round(100 - r.warn * 10 - r.err * 24 + r.ok), 0, 100);
    if (!pt.flags.firstLine && P().gl(pt)) kr = Math.max(0, kr - 35); // препарат выбора так и не назначен
    const safety = U.clamp(100 - pt.harm * 22 - pt.wrong * 14 - pt.missed * 8 - (pt.flags.illegal ? 25 : 0), 0, 100);
    const mon = U.clamp(100 - Object.keys(pt.monMissed).length * 18, 0, 100);
    const los = s.day - pt.admitDay;
    let losS = 100;
    if (los > g.los[1]) losS = Math.max(0, 100 - (los - g.los[1]) * 6);
    else if (how === 'discharge' && los < g.los[0] && pt.sev > g.discharge) losS = 60;
    const m = how === 'discharge' ? maintenance(s, pt) : { msgs: [], adj: 0 };
    const wo = 0.4 * w;
    let total = U.clamp(Math.round(wo * outcome + (0.65 - wo) * kr + 0.15 * safety + 0.1 * mon + 0.1 * losS + m.adj), 0, 100);
    total = Math.min(total, 30 + outcome); // без улучшения хорошей оценки не бывает
    return { total, outcome, kr, safety, mon, los: losS, days: los, maint: m.msgs };
  };

  /** Выписка, перевод или передача пациента (окончание практики). */
  W.finish = function (s, pt, how) {
    const sc = W.score(s, pt, how);
    pt.done = true;
    pt.endDay = s.day;
    pt.how = how;
    pt.score = sc;
    const w = W.ensure(s);
    w.done.push({ uid: pt.uid, tpl: pt.tpl, name: pt.name, age: pt.age, sex: pt.sex, dx: pt.dx, group: pt.group, admit: pt.admitDay, end: s.day, how, score: sc.total, sev0: Math.round(pt.sev0), sev: Math.round(pt.sev), mode: pt.mode, look: pt.look, rev: pt.rev.list.slice(-12), maint: sc.maint, rx: pt.rx.map((r) => ({ id: r.id, kind: r.kind, route: r.route, dose: r.dose })) });
    if (w.done.length > 60) w.done.splice(0, w.done.length - 60);
    // через день-два освобождаются данные пациента
    if (pt.mode === 'study') w.practice.scores.push(sc.total);
    const g = P().group(pt);
    const Gm = G();
    if (how !== 'handover') {
      Gm.learn(s, g.topic, sc.total >= 70 ? 2.5 : 1.5);
      Gm.learn(s, 'pharm', sc.total >= 70 ? 2 : 1);
      Gm.apply(s, { xp: Math.round(20 + sc.total / 2), stress: sc.total >= 70 ? -3 : 2 });
      s.stats.discharged = (s.stats.discharged || 0) + 1;
      if (sc.total >= 85) s.stats.wardGood = (s.stats.wardGood || 0) + 1;
      if (s.phase === 'career' && s.career && s.career.job === 'hospital') {
        const job = Gm.job(s);
        Gm.apply(s, { rep: ((sc.total - 60) / 18) * (job.rep || 1) });
      }
    }
    pt.notes = pt.notes.slice(-40);
    return sc;
  };

  /* ---------- Практика ординатора ---------- */
  W.PRACTICE_FROM = 8;
  W.PRACTICE_TO = 19;
  W.practiceOn = (s) => s.phase === 'study' && s.day >= W.PRACTICE_FROM && s.day <= W.PRACTICE_TO;

  /** Подобрать пациентов на курацию (максимум 2). */
  W.fillBeds = function (s, mode) {
    const w = W.ensure(s);
    const cap = W.capacity(s);
    const out = [];
    const act = W.active(s).filter((p) => p.mode === mode);
    if (mode === 'work' && s.ward.lastAdmit === s.day) return out; // не больше одного поступления в день
    let n = cap - act.length;
    if (mode === 'work') n = Math.min(n, act.length === 0 ? 2 : 1);
    for (let i = 0; i < n; i++) {
      const id = W.pickTemplate(s, mode);
      if (!id) break;
      const pt = W.admit(s, id, mode);
      if (pt) out.push(pt);
    }
    if (out.length && mode === 'work') s.ward.lastAdmit = s.day;
    if (mode === 'study' && !w.practice.start) w.practice.start = s.day;
    return out;
  };

  W.practiceTick = function (s, steps) {
    const w = s.ward;
    if (!w || w.practice.closed) return;
    if (!w.practice.start) return;
    if (s.day > W.PRACTICE_TO) W.closePractice(s, steps);
  };

  W.practiceDays = function (s) {
    const w = s.ward;
    if (!w || !w.practice.start) return 0;
    let n = 0;
    const last = Math.min(s.day, W.PRACTICE_TO);
    for (let d = w.practice.start; d <= last; d++) if (G().scheduleFor(d)) n++;
    return n;
  };

  W.closePractice = function (s, steps) {
    const w = W.ensure(s);
    if (w.practice.closed) return;
    W.active(s)
      .filter((p) => p.mode === 'study')
      .forEach((pt) => W.finish(s, pt, 'handover'));
    w.practice.closed = true;
    w.practice.days = W.practiceDays(s) || 1;
    W.gradePractice(s);
    if (steps) steps.push({ type: 'story', story: 'practice_end' });
  };

  W.gradePractice = function (s) {
    const w = W.ensure(s);
    const pr = w.practice;
    const att = Math.min(1, (pr.rounds + pr.makeup) / Math.max(1, pr.days || W.practiceDays(s) || 1));
    const avg = pr.scores.length ? pr.scores.reduce((a, b) => a + b, 0) / pr.scores.length : 0;
    pr.att = Math.round(att * 100);
    pr.avg = Math.round(avg);
    const sc = Math.round(avg * 0.7 + att * 100 * 0.3);
    pr.score = sc;
    if (att < 0.5 || !pr.scores.length) pr.grade = 0;
    else pr.grade = sc >= 85 ? 5 : sc >= 70 ? 4 : sc >= 50 ? 3 : 0;
    return pr.grade;
  };
  W.practiceCredit = (s) => !!(s.ward && s.ward.practice && s.ward.practice.closed && s.ward.practice.grade >= 3);

  /* ---------- Обход ---------- */
  /** Начало обхода: при необходимости — новые поступления. */
  W.beginRound = function (s, mode) {
    W.ensure(s);
    const admitted = W.fillBeds(s, mode);
    s.ward.lastRound = s.day;
    if (mode === 'study') s.ward.practice.rounds++;
    return admitted;
  };

  /** Итог обхода для ленты и оплаты. */
  W.roundResult = function (s, mode) {
    const act = W.active(s).filter((p) => p.mode === mode);
    const today = (s.ward.done || []).filter((x) => x.end === s.day && x.mode === mode && x.how === 'discharge');
    return { kind: 'ward', patients: act.length, discharged: today.map((x) => ({ name: x.name, score: x.score })) };
  };
})((window.A = window.A || {}));
