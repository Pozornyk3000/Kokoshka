/* Амбулаторный приём: участок врача ПНД, пациенты частной клиники, консультации на кафедре.
   Амбулаторная карта (визиты, назначения, анализы), течение болезни между визитами, звонки и срочные ситуации,
   приём (жалобы, осмотр, шкала, беседа, назначения), разбор визита и итоговая оценка ведения.

   Модель пациента та же, что в отделении (js/game/ward.js): эффект доз, нежелательные явления, анализы, проверка
   назначений по КР. Отличия: лечение идёт дома — приверженность, пропуски и самостоятельная отмена; врач видит
   пациента только на визитах; время «сжато»: игровой день между визитами — два дня лечения (M.SPEED).

   Шаблон пациента (D.ambPatients): id, kind ('new' | 'inherited'), group, phase?, dx, sex, age [от, до], sev0, where,
   adh (приверженность таблеткам 0–1), insight, risk, rel (кто приходит вместе с пациентом), family, baseline (анализы до
   лечения), now (текущие значения), traits, meds_home, failed, intolerant, resp, rx (текущее лечение принятых: id, route,
   dose, days — дней лечения, time, lastInj — дней с инъекции), home_rx (у новых: назначения других врачей), referral,
   complaints, history, somatic, status, dxq.opts (предварительный диагноз), past (записи прежних врачей: ago, who, text),
   pastLabs (ago, test, v), triggers ([{ k, at: [от, до] }] — игровые дни после первого визита), issues (проверки при
   завершении: id, text, ok, bad, check(s, pt, M.q)), chronic, pitfall, ideal. */
(function (A) {
  'use strict';
  const U = A.util;
  const C = A.cal;
  const M = (A.clinic = {});
  const P = () => A.pharma;
  const D = () => A.data;
  const G = () => A.game;
  const W = () => A.ward;

  M.SPEED = 2; // игровой день между визитами — два дня лечения
  M.K_AMB = 0.6; // амбулаторно лечение действует мягче, чем в отделении
  // Интервалы до следующего визита в игровых днях и как это звучит в «днях лечения» (×M.SPEED)
  M.INTERVALS = [1, 3, 7, 14, 28];
  M.INTERVAL_NAME = { 1: 'через 1–2 дня', 3: 'через неделю', 7: 'через 2 недели', 14: 'через месяц', 28: 'через 2 месяца' };
  M.intervalName = (n) => M.INTERVAL_NAME[n] || 'через ' + n * M.SPEED + ' дн.';
  M.MAX_VISITS = 4; // больше «ключевых» визитов за день не бывает — остальных переносят

  /* ---------- Состояние ---------- */
  M.blank = () => ({ pts: [], seq: 0, done: [], used: {}, lastIntake: 0, visits: 0, seeded: null, good: 0 });
  M.ensure = function (s) {
    if (!s.amb || !s.amb.pts) s.amb = M.blank();
    return s.amb;
  };
  M.active = (s) => (s.amb && s.amb.pts ? s.amb.pts.filter((p) => !p.done) : []);
  M.byUid = (s, uid) => (s.amb && s.amb.pts ? s.amb.pts.find((p) => p.uid === uid) : null);
  M.place = (s) => (s.phase === 'career' && s.career ? s.career.job : null);
  /** Сколько пациентов ведёт врач: участок ПНД больше, на кафедре — несколько консультативных. */
  M.capacity = function (s) {
    const j = M.place(s);
    const r = G().rankIndex(s);
    if (j === 'pnd') return 7 + (r >= 2 ? 2 : 0);
    if (j === 'private') return 5 + (r >= 2 ? 1 : 0);
    if (j === 'uni') return 3;
    return 0;
  };
  M.bossNpc = (s) => ({ pnd: 'shubin', uni: 'korsakova' })[M.place(s)] || null;
  M.bossName = (s) => ({ pnd: 'Шубин, заведующий диспансерным отделением', private: 'Медицинский директор клиники', uni: 'Профессор Корсакова' })[M.place(s)] || 'Заведующий';
  /** «3 месяца назад» — давность записи в днях лечения (записи прежних врачей — ещё до начала игры). */
  M.agoText = function (s, day) {
    const n = Math.max(0, Math.round((s.day - day) * M.SPEED));
    if (n < 1) return 'сегодня';
    if (n < 14) return n + ' ' + U.plural(n, ['день', 'дня', 'дней']) + ' назад';
    if (n < 60) return Math.round(n / 7) + ' ' + U.plural(Math.round(n / 7), ['неделю', 'недели', 'недель']) + ' назад';
    if (n < 540) return Math.round(n / 30) + ' ' + U.plural(Math.round(n / 30), ['месяц', 'месяца', 'месяцев']) + ' назад';
    const y = Math.round(n / 365);
    return y + ' ' + U.plural(y, ['год', 'года', 'лет']) + ' назад';
  };
  /** Дата записи: в игре — календарная, до игры — давность. */
  M.dayText = (s, day) => (day >= 1 ? C.fmtShort(day) : M.agoText(s, day));
  const tpl = (pt) => D().ambById[pt.tpl] || {};
  M.tpl = tpl;
  const bio = (n) => n * M.SPEED;
  const recent = (day, n, s) => day != null && (s || A.state).day - day <= n;

  /* ---------- Имена ---------- */
  const INITIALS = 'АБВГДЕЖЗИКЛМНОПРСТУФХЧШЯ';
  function makeName(s, sex) {
    const pool = sex === 'f' ? D().namesF || ['Анна'] : D().namesM || ['Иван'];
    const taken = M.active(s).map((p) => p.name).concat(W() ? W().active(s).map((p) => p.name) : []);
    for (let i = 0; i < 14; i++) {
      const n = U.pick(pool) + ' ' + U.pick(INITIALS.split('')) + '.';
      if (taken.indexOf(n) < 0) return n;
    }
    return U.pick(pool);
  }
  /** {P}, {{м|ж}} — по пациенту; {REL} — кто пришёл с пациентом; {KG} — прибавка веса; {N} — дней трезвости. */
  M.fill = function (pt, text) {
    const gain = Math.max(1, Math.round(pt.lab.weight - pt.base.weight));
    const sober = Math.max(3, Math.round(bio(A.state ? A.state.day - (pt.soberSince || pt.admitDay) : 10)));
    return W()
      .fill(pt, text)
      .replace(/\{REL\}/g, pt.rel || 'Родные')
      .replace(/\{KG\}/g, String(gain))
      .replace(/\{N\}/g, String(sober));
  };

  /* ---------- Поступление на участок ---------- */
  M.pickTemplate = function (s, kind) {
    const w = M.ensure(s);
    const act = M.active(s);
    const place = M.place(s);
    const pool = (D().ambPatients || []).filter((t) => (!kind || t.kind === kind) && (t.where || []).indexOf(place) >= 0 && !act.some((p) => p.tpl === t.id));
    if (!pool.length) return null;
    const t = U.weighted(pool, (x) => (w.used[x.id] ? 1 : 6) * (act.some((p) => p.group === x.group) ? 0.4 : 1));
    return t ? t.id : null;
  };

  M.admit = function (s, tplId) {
    const t = D().ambById[tplId];
    if (!t) return null;
    const w = M.ensure(s);
    w.used[t.id] = (w.used[t.id] || 0) + 1;
    const age = U.int(t.age[0], t.age[1]);
    const name = makeName(s, t.sex);
    const seq = ++w.seq;
    const b = Object.assign({ qtc: 420, anc: 4, alt: 25, egfr: 95, na: 140, glucose: 5, ldl: 2.8, tg: 1.3, prl: 12, weight: 70, height: 170, tsh: 1.8, hb: t.sex === 'f' ? 128 : 142 }, t.baseline || {});
    const now = t.now || {};
    const look = Object.assign(A.art && A.art.randomLook ? A.art.randomLook(U.hash(name + age + seq + 'amb'), { sex: t.sex, age }) : {}, t.look || {});
    const sev = U.clamp(t.sev0 + U.int(-3, 3), 4, 95);
    const pick = (k) => (now[k] != null ? now[k] : b[k]);
    const pt = {
      uid: 'a' + seq,
      tpl: t.id,
      kind: t.kind,
      group: t.group,
      dx: t.dx,
      name,
      age,
      sex: t.sex,
      look,
      seed: U.hash(name + seq + 'amb'),
      mode: 'amb',
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
        qtc: pick('qtc'),
        anc: pick('anc'),
        alt: pick('alt'),
        egfr: pick('egfr'),
        creat: Math.round(88 * Math.pow(90 / Math.max(15, pick('egfr')), 0.9)),
        na: pick('na'),
        glucose: pick('glucose'),
        ldl: pick('ldl'),
        tg: pick('tg'),
        li: 0,
        liSteady: false,
        vpa: 0,
        prl: pick('prl'),
        tsh: pick('tsh'),
        ck: 110,
        weight: pick('weight'),
      },
      traits: (t.traits || []).slice(),
      meds_home: (t.meds_home || []).map((m) => Object.assign({}, m)),
      phase: t.phase || null,
      intolerant: (t.intolerant || []).slice(),
      failed: (t.failed || []).slice(),
      resp: Object.assign({}, t.resp || {}),
      insight: t.insight == null ? 0.6 : t.insight,
      risk: Object.assign({ suicide: 0, aggression: 0 }, t.risk || {}),
      legal: 'voluntary',
      adherence: t.adh == null ? 0.85 : t.adh,
      adh0: t.adh == null ? 0.85 : t.adh,
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
      // амбулаторное
      next: s.day,
      visits: [],
      vis: null,
      talks: {},
      scaleHist: [],
      diary: [],
      dxOk: t.kind === 'new' ? null : true,
      rel: t.rel || null,
      family: !!t.family,
      chronic: !!t.chronic,
      trig: [],
      prevSev: sev,
      prevRx: [],
      care: { sevMax: sev, remDays: 0, adhSum: 0, adhN: 0, warns: 0, errs: 0, oks: 0, noShow: 0, late: 0 },
    };
    // текущее лечение принятого пациента
    (t.rx || []).forEach((r) => {
      const d = P().drug(r.id);
      if (!d) return;
      const route = r.route || 'po';
      const since = s.day - Math.round((r.days || 180) / M.SPEED);
      const rx = { id: r.id, kind: 'drug', route, dose: r.dose, since, changed: since, pre: true, time: r.time || P().defaultTime(d, route) };
      if (route === 'depot') rx.lastInj = s.day - Math.round((r.lastInj || 0) / M.SPEED);
      pt.rx.push(rx);
    });
    // лекарства, назначенные другими врачами (у новых пациентов)
    (t.home_rx || []).forEach((r) => {
      const d = P().drug(r.id);
      if (!d) return;
      const route = r.route || 'po';
      const since = s.day - Math.round((r.days || 30) / M.SPEED);
      pt.rx.push({ id: r.id, kind: 'drug', route, dose: r.dose, baseDose: r.dose, since, changed: since, home: true, pre: true, time: r.time || P().defaultTime(d, route) });
    });
    // анализы и записи прежних врачей
    (t.pastLabs || []).forEach((x) => {
      const day = s.day - Math.round(x.ago / M.SPEED);
      const text = P().labText(x.test, x.v);
      pt.tests.push({ test: x.test, day, ready: day, value: x.v, text, flag: /↑|↓/.test(text), pre: true });
    });
    pt.visits = (t.past || []).map((x) => ({ day: s.day - Math.round(x.ago / M.SPEED), kind: 'past', who: x.who, text: x.text }));
    (t.triggers || []).forEach((x) => pt.trig.push({ k: x.k, day: s.day + U.int(x.at[0], x.at[1]), done: false }));
    pt.trig.forEach((x) => {
      if (x.day <= s.day && TRIG[x.k] && x.k !== 'pregnancy') {
        x.done = true;
        TRIG[x.k](s, pt);
      }
    });
    if (t.kind === 'inherited') warmUp(s, pt);
    pt.prevRx = rxSnap(pt);
    w.pts.push(pt);
    return pt;
  };

  /** Принятый пациент уже давно лечится: побочные эффекты и концентрации — на установившемся уровне. */
  function warmUp(s, pt) {
    const keep = { weight: pt.lab.weight, glucose: pt.lab.glucose, ldl: pt.lab.ldl, tg: pt.lab.tg };
    for (let i = 0; i < 10; i++) {
      W().sim.sideEffects(s, pt);
      W().sim.updLabs(s, pt);
    }
    Object.assign(pt.lab, keep);
    const E = W().sim.efficacy(s, pt);
    pt.lastE = E;
  }
  const rxSnap = (pt) => pt.rx.filter((r) => r.kind !== 'int').map((r) => ({ id: r.id, route: r.route, dose: r.dose, since: r.since }));

  /** Первый день на новой работе: врач принимает участок у предшественника. */
  M.seed = function (s) {
    const w = M.ensure(s);
    const place = M.place(s);
    if (!place || w.seeded === place) return [];
    w.seeded = place;
    const n = place === 'pnd' ? 3 : 2;
    const out = [];
    for (let i = 0; i < n; i++) {
      const id = M.pickTemplate(s, 'inherited');
      if (!id) break;
      const pt = M.admit(s, id);
      pt.next = s.day + (i === 0 ? 0 : U.int(1, 2 + i * 2));
      out.push(pt);
    }
    return out;
  };

  /* ---------- Течение между визитами ---------- */
  M.tick = function (s) {
    const w = s.amb;
    if (!w || !w.pts) return;
    // врач ушёл с амбулаторного приёма — пациентов принимает коллега
    if (M.capacity(s) === 0 && M.active(s).length) M.handoverAll(s, 'Вы больше не ведёте амбулаторный приём: пациентов приняли коллеги.');
    M.active(s).forEach((pt) => {
      // звонок без ответа два дня — решает дежурный врач
      if (pt.pending && s.day - pt.pending.day >= 2) autoResolve(s, pt);
      try {
        tickPt(s, pt);
      } catch (e) {
        if (typeof console !== 'undefined') console.error('clinic tick', pt.tpl, e);
      }
    });
  };

  const TEXT_KEY = { depression: 'depression', bipolar_depression: 'depression', depression_psychotic: 'depression', gad: 'anxiety', panic: 'anxiety', ocd: 'ocd', ptsd: 'ptsd', schizophrenia: 'schizophrenia', bipolar_maint: 'bipolar', mania: 'bipolar', alcohol_dependence: 'alcohol', insomnia: 'insomnia', dementia_mild: 'dementia', dementia_bpsd: 'dementia' };

  function tickPt(s, pt) {
    pt.today = s.day;
    // сценарные повороты шаблона (бросил курить, терапевт назначил НПВС, беременность…)
    pt.trig.forEach((x) => {
      if (!x.done && s.day >= x.day && TRIG[x.k]) {
        x.done = true;
        TRIG[x.k](s, pt);
      }
    });
    if (pt.away) {
      if (s.day >= pt.away.until) backFromHospital(s, pt);
      else {
        pt.hist.push({ d: s.day, sev: Math.round(pt.sev), away: true });
        return;
      }
    }
    dayHospitalTick(s, pt);
    stoppedCheck(s, pt);
    adherence(s, pt);
    const g = P().group(pt);
    const E = W().sim.efficacy(s, pt);
    pt.lastE = E;
    // без лечения болезнь возвращается: у хронических пациентов — обострение, у остальных — естественное течение
    const drift = pt.chronic ? Math.max(g.drift, 0.4) : g.drift;
    let dS = -g.K * M.K_AMB * M.SPEED * E.total * pt.sev + (E.total < 0.15 ? drift : drift * 0.3) * M.SPEED;
    dS += (Math.random() * 2 - 1) * (pt.group === 'dementia_mild' ? 0.35 : 1.0);
    dS += W().sim.seStress(pt) * 0.6;
    // холинолитики ухудшают память у пожилых с деменцией
    if (pt.group === 'dementia_mild') dS += 0.12 * ((pt.load && pt.load.anticholinergic) || 0) + 0.1 * ((pt.load && pt.load.sedation) || 0);
    // беседа о сне, поддержка семьи — небольшой, но реальный эффект
    if (recent(pt.talks.sleep, 14, s) && pt.group === 'insomnia') dS -= 0.4;
    if (recent(pt.talks.family, 20, s) && (pt.group === 'dementia_mild' || pt.group === 'alcohol_dependence')) dS -= 0.25;
    // жизнь между визитами
    if (Math.random() < 0.02) {
      const ev = U.pick((D().ambTexts || {}).life || [{ t: '', d: 0 }]);
      if (ev.t) {
        dS += ev.d;
        diary(pt, s.day, 'life', ev.t);
      }
    }
    dS += withdrawal(s, pt);
    pt.sev = U.clamp(pt.sev + dS, 0, 100);
    W().sim.sideEffects(s, pt);
    W().sim.updLabs(s, pt);
    resolveTests(s, pt);
    if (!pt.pending) evalEvents(s, pt);
    // для итоговой оценки
    pt.care.sevMax = Math.max(pt.care.sevMax, pt.sev);
    if (pt.sev < M.stableTh(pt) - 3) pt.care.remDays++;
    else pt.care.remDays = 0;
    if (pt.rx.some((r) => r.kind !== 'int' && P().oral(r.route))) {
      pt.care.adhSum += pt.adherence;
      pt.care.adhN++;
    }
    if (pt.sev >= 55 && pt.sev0 < 35 && !pt.flags.relapsed) {
      pt.flags.relapsed = s.day;
      diary(pt, s.day, 'relapse', 'Состояние ухудшилось до обострения.');
    }
    if (pt.group === 'alcohol_dependence' && pt.sev >= 70) pt.soberSince = s.day;
    pt.hist.push({ d: s.day, sev: Math.round(pt.sev), e: Math.round(E.total * 100) / 100 });
    if (pt.hist.length > 200) pt.hist.splice(0, pt.hist.length - 200);
  }

  function diary(pt, day, k, text) {
    pt.diary.push({ day, k, text });
    if (pt.diary.length > 30) pt.diary.splice(0, pt.diary.length - 30);
  }
  M.diary = diary;

  /** Препарат исчез из назначений (отменили на визите или по телефону): синдром отмены и рикошет. */
  function stoppedCheck(s, pt) {
    const now = rxSnap(pt);
    (pt.prevRx || []).forEach((o) => {
      if (now.some((x) => x.id === o.id)) return;
      const d = P().drug(o.id);
      if (!d) return;
      const long = bio(s.day - o.since) > 28;
      const low = (P().form(d, o.route).steps || [o.dose])[0];
      if (long && (d.id === 'paroxetine' || d.id === 'venlafaxine') && o.dose > low) {
        pt.flags.discont = s.day;
        pt.flags.discontinuation = true;
      } else if (long && (d.cls === 'ssri' || d.cls === 'snri') && o.dose > low * 2) pt.flags.discont = s.day;
    });
    pt.prevRx = now;
  }

  function withdrawal(s, pt) {
    let d = 0;
    const f = pt.flags;
    if (f.bzdCut && s.day - f.bzdCut <= 5) {
      d += pt.group === 'insomnia' ? 3.5 : 2.5;
      if (!f.bzdNoted) {
        f.bzdNoted = true;
        diary(pt, s.day, 'withdrawal', pt.group === 'insomnia' ? 'После отмены снотворного — несколько ночей почти без сна, тревога.' : 'После резкого снижения транквилизатора — тревога, дрожь, бессонница, потливость.');
      }
    } else if (f.bzdCut) f.bzdNoted = false;
    if (f.discont && s.day - f.discont <= 4) {
      d += 1.5;
      if (f.discontNoted !== f.discont) {
        f.discontNoted = f.discont;
        diary(pt, s.day, 'withdrawal', 'После отмены антидепрессанта — головокружение, «удары током» в голове, раздражительность, тошнота.');
      }
    }
    return d;
  }

  /** Приверженность лечению дома. */
  function adherence(s, pt) {
    if (pt.flags.dayHosp && s.day < pt.flags.dayHosp) {
      pt.adherence = 1;
      return;
    }
    if (pt.stopped) {
      pt.adherence = 0.05;
      return;
    }
    const x = pt.sx || {};
    let a = pt.adh0;
    if (pt.insight < 0.45) a -= (0.25 * (0.45 - pt.insight)) / 0.45;
    const gain = pt.lab.weight - pt.base.weight;
    const bother = (x.sedation > 2.2 ? 1 : 0) + (x.sexual > 1.6 ? 1 : 0) + (x.akathisia > 1.2 ? 1 : 0) + (x.eps > 1.5 ? 1 : 0) + (x.tremor > 1.8 ? 1 : 0) + (x.activation > 1.3 ? 1 : 0) + (gain > 7 ? 1 : 0) + (x.anticholinergic > 2 ? 1 : 0);
    a -= 0.07 * bother;
    const n = P().intakes(pt);
    if (n > 2) a -= 0.05 * (n - 2);
    if (pt.rx.some((r) => r.kind === 'int' && r.id === 'psychoeducation_family')) a += 0.06;
    if (recent(pt.talks.adherence, 21, s)) a += 0.08;
    if (recent(pt.talks.family, 30, s)) a += 0.08;
    if (pt.sev > 70 && ['schizophrenia', 'bipolar_maint', 'mania'].indexOf(pt.group) >= 0) a -= 0.15;
    pt.adherence = U.clamp(a, 0.15, 1);
    pt.bother = bother;
    selfStop(s, pt, bother);
  }

  /** Пациент сам бросает таблетки: «я здоров» или из-за побочных эффектов. */
  function selfStop(s, pt, bother) {
    const oral = pt.rx.filter((r) => r.kind !== 'int' && P().oral(r.route) && !r.prn);
    if (!oral.length) return;
    let p = 0;
    if (pt.sev < 22 && bio(pt.care.remDays) > 20 && !recent(pt.talks.goal, 40, s)) p += 0.012 * (1 - pt.insight);
    p += 0.006 * bother * (recent(pt.talks.explain, 10, s) ? 0.4 : 1);
    if (pt.flags.wantsStop && !recent(pt.talks.goal, 30, s) && !recent(pt.talks.adherence, 30, s)) p += 0.2;
    if (pt.group === 'alcohol_dependence') p *= 1.4;
    if (Math.random() >= p) return;
    pt.stopped = s.day;
    pt.stopWhy = bother ? 'se' : 'well';
    oral.forEach((r) => {
      const d = P().drug(r.id);
      const long = bio(s.day - r.since) > 28;
      if (d.cls === 'bzd' || d.cls === 'z') return; // транквилизатор и снотворное обычно продолжают пить
      const low = (P().form(d, r.route).steps || [r.dose])[0];
      if (long && (d.id === 'paroxetine' || d.id === 'venlafaxine') && r.dose > low) {
        pt.flags.discont = s.day;
        pt.flags.discontinuation = true;
      } else if (long && (d.cls === 'ssri' || d.cls === 'snri')) pt.flags.discont = s.day;
    });
    diary(pt, s.day, 'stop', pt.stopWhy === 'se' ? 'Перестал{{|а}} принимать таблетки из-за побочных эффектов.' : 'Перестал{{|а}} принимать таблетки: «чувствую себя хорошо».');
  }

  function dayHospitalTick(s, pt) {
    const i = pt.rx.findIndex((r) => r.kind === 'int' && r.id === 'day_hospital');
    if (i < 0) {
      pt.flags.dayHosp = null;
      return;
    }
    if (!pt.flags.dayHosp) pt.flags.dayHosp = s.day + 12;
    if (s.day >= pt.flags.dayHosp) {
      pt.rx.splice(i, 1);
      pt.flags.dayHosp = null;
      W().log(s, pt, 'Курс дневного стационара завершён.');
      diary(pt, s.day, 'dayhosp', 'Завершил{{|а}} курс в дневном стационаре: «Там было спокойно, таблетки давали при мне».');
    }
  }

  /* ---------- Анализы ---------- */
  function resolveTests(s, pt) {
    pt.tests.forEach((rec) => {
      if (rec.value || rec.ready > s.day) return;
      rec.value = P().labValue(s, pt, rec.test);
      rec.text = P().labText(rec.test, rec.value);
      rec.flag = /↑|↓/.test(rec.text) || (rec.test === 'hcg' && rec.value.hcg);
      rec.fresh = true;
      // находки, о которых лаборатория звонит сразу
      if (!pt.pending) {
        if (rec.test === 'cbc' && rec.value.anc < 1.5 && pt.rx.some((r) => r.id === 'clozapine' || r.id === 'carbamazepine')) startEvent(s, pt, 'neutropenia');
        else if (rec.test === 'lithium' && rec.value.li > 1.4) startEvent(s, pt, 'li_tox');
        else if (rec.test === 'bio' && rec.value.na < 129) startEvent(s, pt, 'hypona');
      }
    });
  }

  /* ---------- Сценарные повороты ---------- */
  const TRIG = {
    quit_smoking(s, pt) {
      pt.quitSmoking = true;
      pt.flags.quitSmokeDay = s.day;
      pt.traits = pt.traits.filter((t) => t !== 'smoker');
      diary(pt, s.day, 'life', 'Бросил{{|а}} курить — «к Новому году, как обещал{{|а}}».');
      if (pt.rx.some((r) => r.id === 'clozapine' || r.id === 'olanzapine') && !pt.pending) startEvent(s, pt, 'smoke_quit');
    },
    nsaid(s, pt) {
      if (!pt.meds_home.some((m) => m.tag === 'nsaid')) pt.meds_home.push({ tag: 'nsaid', name: 'ибупрофен 400 мг 3 раза в день — назначил терапевт от боли в спине' });
      pt.flags.nsaidOn = s.day;
      diary(pt, s.day, 'life', 'Терапевт назначил ибупрофен от боли в спине — «пью три раза в день, помогает».');
    },
    pregnancy(s, pt) {
      if (pt.flags.contraception) {
        diary(pt, s.day, 'life', 'Решили с мужем подождать с беременностью, пока не поменяем лечение.');
        return;
      }
      pt.traits.push('pregnancy');
      startEvent(s, pt, 'pregnancy');
    },
    wants_stop(s, pt) {
      pt.flags.wantsStop = true;
    },
  };

  /* ---------- Звонки и срочные ситуации между визитами ---------- */
  const has = (pt, pred) => pt.rx.some((r) => pred(r, r.kind === 'int' ? null : P().drug(r.id)));
  const isAD = (r, d) => d && d.group === 'antidepressant';
  const isStab = (r, d) => d && (d.group === 'moodstab' || (d.group === 'antipsychotic' && (d.eff.mania || 0) >= 0.5));
  const stopWhere = (s, pt, pred, why) => {
    const out = [];
    pt.rx = pt.rx.filter((r) => {
      const d = r.kind === 'int' ? null : P().drug(r.id);
      if (pred(r, d)) {
        out.push(d ? d.name : r.id);
        return false;
      }
      return true;
    });
    if (out.length) W().log(s, pt, 'Отменено: ' + out.join(', ').toLowerCase() + (why ? ' (' + why + ')' : '') + '.');
    return out;
  };
  /** Был ли визит после этого дня: врач мог заметить и вмешаться. */
  const seenSince = (pt, day) => day != null && pt.visits.some((v) => v.kind !== 'past' && v.kind !== 'noshow' && v.kind !== 'auto' && v.day > day);
  const urgentVisit = (s, pt) => {
    pt.next = s.day;
    pt.urgent = true;
  };

  M.EVENTS = {
    early_se: {
      title: 'Звонок: тяжело переносит начало лечения',
      from: 'Пациент',
      cooldown: 20,
      chance: (s, pt) => {
        const fresh = pt.rx.some((r) => {
          const d = r.kind === 'int' ? null : P().drug(r.id);
          return d && (d.group === 'antidepressant' || d.cls === 'ssri') && !r.pre && bio(s.day - r.since) <= 8;
        });
        if (!fresh) return 0;
        const x = pt.sx;
        if ((x.serotonergic || 0) < 0.8 && (x.activation || 0) < 0.8) return 0;
        return recent(pt.talks.explain, 8, s) ? 0.04 : 0.16;
      },
      q: (s, pt) => '{P}: «Доктор, от таблеток тошнит, внутри всё дрожит, ночью почти не спал{{|а}}. Может, мне их бросить?»',
      opts: [
        { t: 'Объяснить: это частая реакция первых дней, обычно проходит за 1–2 недели. Пока можно принимать половину дозы, после еды; если станет хуже или появятся мысли о смерти — звонить сразу', ok: true, fx: (s, pt) => (pt.talks.explain = s.day), why: 'Тошнота и беспокойство в первые дни приёма СИОЗС — частые и преходящие. Объяснение удерживает пациента в лечении; временное снижение дозы допустимо.' },
        { t: 'Раз не подходит — отменить и попробовать другой при следующем визите', ok: false, fx: (s, pt) => stopWhere(s, pt, (r, d) => isAD(r, d) && !r.pre, 'отменено по телефону'), why: 'Преходящие нежелательные явления первых дней — не повод менять препарат: следующий вызовет то же самое, а время уйдёт.' },
        { t: 'Добавить феназепам, «чтобы перетерпеть»', ok: (s, pt) => (pt.group === 'panic' ? 'part' : false), fx: (s, pt) => W().prescribe(s, pt, { id: 'phenazepam', kind: 'drug', route: 'po', dose: 1 }), why: 'Бензодиазепин коротким курсом иногда допустим при паническом расстройстве, но обычно хватает объяснения и временного снижения дозы; назначать его по телефону без плана отмены — риск зависимости.' },
      ],
    },

    switch_mania: {
      title: 'Звонок родственников: инверсия фазы',
      from: 'rel',
      once: true,
      chance: (s, pt) => {
        if (['bipolar_depression', 'bipolar_maint'].indexOf(pt.group) < 0) return 0;
        if (!has(pt, isAD) || has(pt, isStab)) return 0;
        const ad = pt.rx.find((r) => isAD(r, P().drug(r.id)));
        return bio(s.day - ad.since) >= 6 ? 0.1 : 0;
      },
      preventable: () => true,
      start: (s, pt) => {
        pt.sev = Math.max(pt.sev, 62);
        pt.flags.switched = s.day;
      },
      q: () => '{REL}: «Третью ночь не спит, говорит без остановки, набрал{{|а}} кредитов на новый бизнес, грубит. Неделю назад был{{|а}} так{{им|ой}} подавленн{{ым|ой}}, а теперь — как подменили».',
      opts: [
        { t: 'Это инверсия в манию на антидепрессанте: отменить антидепрессант, срочный приём сегодня, назначить антиманиакальный препарат; если опасно — госпитализация', ok: true, fx: (s, pt) => { stopWhere(s, pt, isAD, 'инверсия фазы'); urgentVisit(s, pt); }, why: 'Антидепрессант без нормотимика при биполярном расстройстве спровоцировал инверсию. Его отменяют и лечат манию; при угрозе себе или финансам — госпитализация.' },
        { t: 'Радоваться: депрессия прошла, лечение подействовало', ok: false, fx: (s, pt) => { pt.sev = Math.min(100, pt.sev + 12); pt.harm += 1; }, why: 'Бессонница без усталости, гиперактивность и долги — это мания, а не выздоровление.' },
        { t: 'Повысить дозу антидепрессанта — «раз он так хорошо работает»', ok: false, fx: (s, pt) => { pt.sev = Math.min(100, pt.sev + 18); pt.harm += 1; }, why: 'Антидепрессант и вызвал инверсию: повышение дозы утяжелит манию.' },
      ],
    },

    suicidal: {
      title: 'Сообщение: «не вижу смысла жить»',
      from: 'Пациент',
      cooldown: 12,
      chance: (s, pt) => {
        if ((pt.risk.suicide || 0) < 1 || pt.sev < 58) return 0;
        if (['depression', 'bipolar_depression', 'ptsd', 'bipolar_maint'].indexOf(pt.group) < 0) return 0;
        return (0.03 + 0.02 * pt.risk.suicide) * (recent(pt.talks.safety, 20, s) ? 0.35 : 1);
      },
      q: () => '{P} пишет в чат клиники поздно вечером: «Простите, что беспокою. Я больше не вижу смысла. Всем было бы легче без меня».',
      opts: [
        { t: 'Ответить сразу: поддержать, спросить прямо о намерениях и плане, пригласить на приём завтра утром; при намерении и плане — скорая помощь и госпитализация; дать телефон доверия', ok: true, fx: (s, pt) => urgentVisit(s, pt), why: 'Прямой вопрос о суицидальных мыслях не провоцирует их, а снижает риск. Сообщение о нежелании жить — повод для срочной оценки, а при намерении и плане — для неотложной помощи.' },
        { t: 'Написать, что всё наладится, и обсудить на плановом визите', ok: false, fx: (s, pt) => { pt.harm += 1; pt.sev = Math.min(100, pt.sev + 5); }, why: 'Сообщение о желании умереть нельзя откладывать до планового визита: риск надо оценить сегодня.' },
        { t: 'Выписать снотворное, чтобы выспал{{ся|ась}}', ok: false, fx: (s, pt) => { pt.harm += 1; }, why: 'Снотворное не лечит суицидальный риск, а при передозировке становится средством. Сначала — оценка риска и план безопасности.' },
      ],
    },

    relapse_psy: {
      title: 'Звонок родственников: обострение',
      from: 'rel',
      cooldown: 14,
      chance: (s, pt) => (pt.group === 'schizophrenia' && pt.sev >= 52 && (pt.adherence < 0.6 || pt.stopped || !pt.lastE || pt.lastE.total < 0.3) ? 0.12 : 0),
      q: () => '{REL}: «Опять началось: не спит, слышит соседей через стену, закрыл{{|а}} окна фольгой. Таблетки, похоже, не пьёт. На приём идти отказывается».',
      opts: [
        { t: 'Активный патронаж: выехать на дом с медсестрой сегодня-завтра, возобновить лечение (лучше пролонгированной формой); если опасен для себя или других — госпитализация по ст. 29 через бригаду', ok: true, fx: (s, pt) => { urgentVisit(s, pt); pt.stopped = null; pt.flags.homeVisit = s.day; }, why: 'Пациенты с обострением редко приходят сами: участковый психиатр выезжает на дом. Недобровольная госпитализация возможна только по основаниям ст. 29 Закона о психиатрической помощи.' },
        { t: 'Вызвать полицию и госпитализировать — «так надёжнее»', ok: (s, pt) => (pt.sev >= 75 ? 'part' : false), fx: (s, pt) => { if (pt.sev < 75) pt.flags.illegal = true; M.hospitalize(s, pt, true); }, why: 'Недобровольная госпитализация — только при опасности, беспомощности или угрозе тяжёлого ухудшения без помощи (ст. 29). Сначала — осмотр психиатром.' },
        { t: 'Пусть придёт сам, когда захочет', ok: false, fx: (s, pt) => { pt.missed += 1; pt.sev = Math.min(100, pt.sev + 6); }, why: 'Без критики к болезни пациент сам не придёт; обострение будет нарастать.' },
      ],
    },

    no_show: {
      title: 'Не пришёл на приём',
      from: 'Медсестра',
      cooldown: 3,
      chance: () => 0,
      q: (s, pt) => (pt.rx.some((r) => r.route === 'depot') ? '{P} не приш{{ёл|ла}} на приём и плановую инъекцию. Телефон не отвечает.' : '{P} не приш{{ёл|ла}} на приём, на звонок не ответил{{|а}}.'),
      opts: [
        { t: 'Позвонить родственникам, выяснить причину; если нужна инъекция или есть признаки обострения — медсестра на дом (активный патронаж); записать на ближайший день', ok: true, fx: (s, pt) => { pt.next = s.day + 1; const dep = pt.rx.find((r) => r.route === 'depot'); if (dep && pt.family) { dep.lastInj = s.day; W().log(s, pt, 'Инъекция выполнена на дому (патронаж).'); } }, why: 'Неявка — частый ранний признак обострения или отказа от лечения. Активный патронаж и связь с семьёй — работа участкового психиатра.' },
        { t: 'Ждать: придёт в следующий раз', ok: false, fx: (s, pt) => { pt.next = s.day + 14; pt.missed += 1; }, why: 'Пропущенная инъекция пролонга или визит без объяснений — повод действовать, а не ждать месяц.' },
        { t: 'Снять с наблюдения за неявку', ok: false, fx: (s, pt) => { pt.next = s.day + 14; pt.missed += 1; pt.harm += 1; }, why: 'Снятие с диспансерного наблюдения за неявку у пациента с тяжёлым психическим расстройством — прямой путь к обострению без помощи.' },
      ],
    },

    li_tox: {
      title: 'Признаки литиевой интоксикации',
      from: 'rel',
      cooldown: 8,
      chance: (s, pt) => (pt.rx.some((r) => r.id === 'lithium') && pt.lab.li > 1.25 ? 0.12 + (pt.lab.li - 1.25) : 0),
      preventable: (s, pt) => !!P().tags(pt).nsaid && seenSince(pt, pt.flags.nsaidOn),
      start: (s, pt) => {
        pt.sx.tremor = Math.max(pt.sx.tremor || 0, 2.5);
      },
      q: () => '{REL}: «Третий день понос и рвота, руки трясутся так, что не может держать ложку, шатается, речь стала невнятной».',
      opts: [
        { t: 'Похоже на литиевую интоксикацию: литий не принимать, срочно концентрация лития, креатинин и электролиты; при выраженных симптомах — скорая, в стационар', ok: true, fx: (s, pt) => { const i = pt.rx.findIndex((r) => r.id === 'lithium'); if (i >= 0) { pt.rx[i].held = true; pt.rx[i].heldDay = s.day; W().log(s, pt, 'Литий временно отменён: подозрение на интоксикацию.'); } pt.lab.li = Math.min(pt.lab.li, 0.9); if (pt.lab.li > 1.8) M.hospitalize(s, pt, true); urgentVisit(s, pt); }, why: 'Понос, рвота, крупный тремор, атаксия и дизартрия на литии — интоксикация, пока не доказано обратное. Литий отменяют и срочно проверяют концентрацию и функцию почек.' },
        { t: 'Снизить дозу по телефону и прийти через неделю', ok: 'part', fx: (s, pt) => { const i = pt.rx.findIndex((r) => r.id === 'lithium'); if (i >= 0) W().stepDose(s, pt, i, -1); pt.harm += 1; }, why: 'При признаках интоксикации ждать неделю нельзя: нужна срочная концентрация и оценка почек.' },
        { t: 'Противодиарейное — это кишечная инфекция', ok: false, fx: (s, pt) => { pt.harm += 2; pt.lab.li += 0.3; M.hospitalize(s, pt, true); }, why: 'Понос и рвота на литии — повод подумать об интоксикации. Обезвоживание повышает концентрацию лития ещё сильнее.' },
      ],
    },

    smoke_quit: {
      title: 'Звонок: бросил курить',
      from: 'rel',
      once: true,
      chance: () => 0,
      q: (s, pt) => '{REL}: «Доктор, хорошая новость — {P} третий день не курит! Говорит, насовсем. Нам что-нибудь нужно сделать с таблетками?» (принимает ' + pt.rx.filter((r) => r.id === 'clozapine' || r.id === 'olanzapine').map((r) => P().drug(r.id).name.toLowerCase() + ' ' + P().fmtDose(r.dose)).join(', ') + ')',
      opts: [
        { t: 'Поддержать отказ от курения и сразу снизить дозу клозапина примерно на треть; приём через несколько дней; если появятся сонливость, слюнотечение, шаткость — звонить сразу', ok: true, fx: (s, pt) => { const i = pt.rx.findIndex((r) => r.id === 'clozapine'); if (i >= 0) { const rx = pt.rx[i]; const steps = P().form(P().drug('clozapine'), 'po').steps; const target = steps.filter((x) => x <= rx.dose * 0.72).pop() || steps[0]; W().setDose(s, pt, i, target); } pt.next = Math.min(pt.next, s.day + 3); }, why: 'Курение индуцирует CYP1A2: после отказа концентрация клозапина за 1–2 недели вырастает в 1,5–2 раза. Дозу снижают заранее примерно на треть и наблюдают чаще.' },
        { t: 'Похвалить — лечение менять не нужно', ok: false, fx: () => {}, why: 'Отказ от курения поднимает уровень клозапина почти вдвое: без снижения дозы будут сонливость, слюнотечение, падения и риск судорог.' },
        { t: 'Посоветовать пока не бросать: на клозапине это опасно', ok: false, fx: (s, pt) => { pt.quitSmoking = false; pt.traits.push('smoker'); }, why: 'Отказ от курения полезен и на клозапине — просто нужно вовремя снизить дозу. Отговаривать бросать курить — неверно.' },
      ],
    },

    cloz_tox: {
      title: 'Звонок: сонливость и слюнотечение на клозапине',
      from: 'rel',
      once: true,
      chance: (s, pt) => (pt.quitSmoking && pt.rx.some((r) => r.id === 'clozapine' && r.dose > 250) && s.day - (pt.flags.quitSmokeDay || s.day) >= 3 ? 0.25 : 0),
      preventable: () => true,
      start: (s, pt) => {
        pt.sx.sedation = Math.max(pt.sx.sedation || 0, 3);
      },
      q: () => '{REL}: «Неделю назад бросил{{|а}} курить, молодец. Но теперь спит на ходу, слюни текут, вчера чуть не упал{{|а}} в ванной. Что с {{ним|ней}}?»',
      opts: [
        { t: 'Отказ от курения поднял концентрацию клозапина: снизить дозу примерно на треть, прийти на приём в ближайшие дни, ЭКГ и анализ крови', ok: true, fx: (s, pt) => { const i = pt.rx.findIndex((r) => r.id === 'clozapine'); if (i >= 0) { const rx = pt.rx[i]; const steps = P().form(P().drug('clozapine'), 'po').steps; const target = steps.filter((x) => x <= rx.dose * 0.7).pop() || steps[0]; W().setDose(s, pt, i, target); } urgentVisit(s, pt); }, why: 'Курение индуцирует CYP1A2 и снижает уровень клозапина; после отказа от курения он растёт в 1,5–2 раза. Дозу снижают примерно на треть и наблюдают.' },
        { t: 'Отменить клозапин, раз он так действует', ok: false, fx: (s, pt) => { stopWhere(s, pt, (r) => r.id === 'clozapine', 'отменено по телефону'); pt.harm += 1; }, why: 'Резкая отмена клозапина — быстрый рецидив психоза и холинергический «откат». Нужна коррекция дозы, а не отмена.' },
        { t: 'Ничего страшного, привыкнет', ok: false, fx: (s, pt) => { pt.harm += 1; if (Math.random() < 0.3) M.hospitalize(s, pt, true); }, why: 'Высокая концентрация клозапина — риск судорог, падений и аспирации. Это не «привыкание».' },
      ],
    },

    pregnancy: {
      title: 'Звонок: положительный тест на беременность',
      from: 'Пациент',
      once: true,
      chance: () => 0,
      preventable: (s, pt) => pt.rx.some((r) => r.id === 'valproate'),
      q: (s, pt) => '{P}: «Доктор, задержка две недели, тест положительный! Я так рада… но что делать с таблетками?»' + (pt.rx.some((r) => r.id === 'valproate') ? ' (принимает вальпроевую кислоту)' : ''),
      opts: [
        { t: 'Не бросать лечение резко; срочный приём: обсудить замену препарата с учётом рисков, направить к акушеру-гинекологу, фолиевая кислота, УЗИ-скрининг', ok: true, fx: (s, pt) => urgentVisit(s, pt), why: 'Резкая отмена нормотимика при БАР — риск тяжёлого рецидива; оставлять вальпроат при беременности нельзя. Решение — срочно, вместе с акушером-гинекологом.' },
        { t: 'Немедленно бросить все таблетки', ok: false, fx: (s, pt) => { stopWhere(s, pt, (r, d) => !!d, 'отменено самой пациенткой по совету'); pt.harm += 1; }, why: 'Резкая отмена всего лечения при биполярном расстройстве — высокий риск рецидива, особенно после родов.' },
        { t: 'Продолжать как есть — вред лекарств преувеличен', ok: (s, pt) => (pt.rx.some((r) => r.id === 'valproate') ? false : 'part'), fx: (s, pt) => { if (pt.rx.some((r) => r.id === 'valproate')) pt.harm += 2; }, why: 'Вальпроевая кислота при беременности повышает риск пороков развития и нарушений развития ребёнка — её продолжение недопустимо без крайней необходимости.' },
      ],
    },

    bzd_withdrawal: {
      title: 'Звонок: синдром отмены',
      from: 'Пациент',
      cooldown: 10,
      chance: (s, pt) => (pt.flags.bzdCut && s.day - pt.flags.bzdCut <= 4 && !pt.flags.bzdWithdrawalCalled ? 0.35 : 0),
      start: (s, pt) => {
        pt.flags.bzdWithdrawalCalled = s.day;
        pt.flags.bzdWithdrawal = true;
      },
      q: (s, pt) => (pt.group === 'insomnia' ? '{P}: «Бросил{{|а}} снотворное, как вы сказали, — третью ночь не сплю совсем, сердце колотится. Я так не могу».' : '{P}: «После того как убрал{{|а}} феназепам, трясёт, пот, страх, сплю по два часа. Вчера на секунду «выключил{{ся|ась}}»…»'),
      opts: [
        { t: 'Вернуть прежнюю дозу и снижать медленно: на 10–25% раз в 1–2 недели; при судорогах — скорая', ok: true, fx: (s, pt) => { pt.flags.bzdCut = null; const prev = pt.flags.bzdPrev; const hasB = pt.rx.some((r) => { const d = P().drug(r.id); return d && (d.cls === 'bzd' || d.cls === 'z'); }); if (!hasB && pt.group !== 'insomnia') W().prescribe(s, pt, { id: 'phenazepam', kind: 'drug', route: 'po', dose: prev && prev <= 6 ? prev : 2 }); if (!hasB && pt.group === 'insomnia') W().prescribe(s, pt, { id: 'zopiclone', kind: 'drug', route: 'po', dose: 7.5 }); }, why: 'Резкая отмена бензодиазепина после долгого приёма вызывает синдром отмены вплоть до судорог. Возвращают дозу и снижают постепенно.' },
        { t: 'Перетерпеть — через неделю пройдёт', ok: false, fx: (s, pt) => { pt.harm += 1; if (pt.group !== 'insomnia' && Math.random() < 0.3) { pt.flags.seizure = s.day; M.hospitalize(s, pt, true); } }, why: 'Синдром отмены бензодиазепинов может закончиться судорожным припадком. «Перетерпеть» — опасный совет.' },
        { t: 'Заменить на прегабалин', ok: 'part', fx: (s, pt) => W().prescribe(s, pt, { id: 'pregabalin', kind: 'drug', route: 'po', dose: 150 }), why: 'Прегабалин иногда помогает при отмене, но сам вызывает зависимость; надёжнее вернуть дозу бензодиазепина и снижать её медленно.' },
      ],
    },

    relapse_drink: {
      title: 'Звонок: срыв',
      from: 'rel',
      cooldown: 12,
      chance: (s, pt) => (pt.group === 'alcohol_dependence' && pt.sev >= 58 ? 0.07 * (pt.rx.some((r) => ['naltrexone', 'disulfiram', 'cyanamide'].indexOf(r.id) >= 0) && !pt.stopped ? 0.4 : 1) : 0),
      start: (s, pt) => {
        pt.sev = Math.max(pt.sev, 72);
        pt.soberSince = s.day;
      },
      q: () => '{REL}: «Сорвал{{ся|ась}}. Третий день пьёт, на работу не пош{{ёл|ла}}. Говорит, что завтра бросит. Что нам делать?»',
      opts: [
        { t: 'Без упрёков: приём или выезд в ближайшие дни; при тяжёлом запое — госпитализация для купирования абстиненции; потом вернуться к противорецидивному плану', ok: true, fx: (s, pt) => { if (pt.sev >= 75) M.hospitalize(s, pt, true); else urgentVisit(s, pt); }, why: 'Срыв — частая часть пути к ремиссии, а не провал. Абстиненцию после запоя купируют под наблюдением, затем возвращаются к лечению.' },
        { t: 'Срочно назначить дисульфирам, чтобы испугался', ok: false, fx: (s, pt) => { pt.harm += 2; }, why: 'Дисульфирам в состоянии опьянения опасен для жизни; его назначают только трезвому пациенту с письменного согласия.' },
        { t: 'Посоветовать феназепам, чтобы выйти из запоя дома', ok: false, fx: (s, pt) => { pt.harm += 1; }, why: 'Бензодиазепин вместе с алкоголем дома — угнетение дыхания и риск смерти. Тяжёлую абстиненцию лечат под наблюдением.' },
      ],
    },

    hypona: {
      title: 'Гипонатриемия',
      from: 'rel',
      once: true,
      chance: (s, pt) => (pt.lab.na < 129 ? 0.25 : 0),
      preventable: (s, pt) => (P().tags(pt).thiazide || P().tags(pt).elderly) && !pt.tests.some((t) => t.test === 'bio' && !t.pre && bio(s.day - t.day) <= 30),
      q: () => '{REL}: «Последние дни вял{{ый|ая}}, тошнит, путается в словах, вчера не узнал{{|а}} соседку. Это от новых таблеток?»',
      opts: [
        { t: 'Возможна гипонатриемия: срочно натрий крови; при натрии ниже 125 или спутанности — госпитализация; антидепрессант приостановить, тиазид — заменить вместе с терапевтом', ok: true, fx: (s, pt) => { stopWhere(s, pt, (r, d) => d && (d.cls === 'ssri' || d.cls === 'snri'), 'гипонатриемия'); pt.meds_home = pt.meds_home.filter((m) => m.tag !== 'thiazide'); pt.lab.na = Math.max(pt.lab.na, 131); if (pt.lab.na < 125) M.hospitalize(s, pt, true); urgentVisit(s, pt); }, why: 'СИОЗС у пожилых, особенно с тиазидами, вызывают синдром неадекватной секреции АДГ и гипонатриемию: слабость, тошнота, спутанность, судороги.' },
        { t: 'Это возраст и депрессия, подождём', ok: false, fx: (s, pt) => { pt.harm += 2; M.hospitalize(s, pt, true); }, why: 'Новая спутанность у пожилой на антидепрессанте — повод проверить натрий, а не списать на возраст.' },
      ],
    },

    neutropenia: {
      title: 'Лаборатория: нейтропения',
      from: 'Лаборатория',
      once: true,
      chance: () => 0,
      q: (s, pt) => 'Звонок из лаборатории: {P}, общий анализ крови — нейтрофилы ' + String(Math.round(((W().lastTest(pt, 'cbc') || {}).value || {}).anc * 10) / 10).replace('.', ',') + ' ×10⁹/л.',
      opts: [
        { t: 'Отменить клозапин (или карбамазепин), повторить анализ крови, температура и инфекции — под контроль, при нейтрофилах ниже 0,5 — госпитализация; консультация гематолога', ok: true, fx: (s, pt) => { stopWhere(s, pt, (r) => r.id === 'clozapine' || r.id === 'carbamazepine', 'нейтропения'); urgentVisit(s, pt); }, why: 'Нейтрофилы ниже 1,5 ×10⁹/л на клозапине — повод отменить препарат и наблюдать: агранулоцитоз опасен сепсисом.' },
        { t: 'Повторить анализ через месяц', ok: false, fx: (s, pt) => { pt.harm += 2; }, why: 'Падение нейтрофилов на клозапине нельзя наблюдать месяц — это может быть начало агранулоцитоза.' },
      ],
    },

    rash: {
      title: 'Звонок: сыпь на ламотриджине',
      from: 'Пациент',
      once: true,
      chance: (s, pt) => {
        const lt = pt.rx.find((r) => r.id === 'lamotrigine');
        if (!lt || bio(s.day - lt.since) > 70) return 0;
        return pt.flags.lamoFast ? 0.04 : pt.rx.some((r) => r.id === 'valproate') ? 0.004 : 0.0015;
      },
      preventable: (s, pt) => !!pt.flags.lamoFast,
      q: () => '{P}: «На груди и руках появилась сыпь, температура 37,8, во рту болячки. Это аллергия на что-то?»',
      opts: [
        { t: 'Немедленно прекратить ламотриджин и сегодня же осмотреть (при поражении слизистых — скорая): риск синдрома Стивенса–Джонсона', ok: true, fx: (s, pt) => { stopWhere(s, pt, (r) => r.id === 'lamotrigine', 'сыпь'); pt.intolerant.push('lamotrigine'); urgentVisit(s, pt); }, why: 'Сыпь с температурой и поражением слизистых на ламотриджине — повод отменить его немедленно. Риск выше при быстрой титрации и в сочетании с вальпроатом.' },
        { t: 'Антигистаминное и продолжать — это ерунда', ok: false, fx: (s, pt) => { pt.harm += 2; M.hospitalize(s, pt, true); }, why: 'Продолжать ламотриджин при сыпи с температурой и болячками во рту — риск тяжёлой токсической реакции.' },
      ],
    },

    fall: {
      title: 'Падение дома',
      from: 'rel',
      cooldown: 20,
      chance: (s, pt) => {
        if (pt.age < 65) return 0;
        const risky = pt.rx.some((r) => {
          const d = r.kind === 'int' ? null : P().drug(r.id);
          return d && (d.cls === 'bzd' || d.cls === 'z' || d.cls === 'tca' || d.cls === 'fga_low');
        });
        return (risky ? 0.012 : 0) + ((pt.sx.orthostatic || 0) > 1.5 ? 0.01 : 0) + ((pt.sx.sedation || 0) > 2 ? 0.006 : 0);
      },
      preventable: (s, pt) =>
        pt.rx.some((r) => {
          const d = r.kind === 'int' ? null : P().drug(r.id);
          return d && ['bzd', 'z', 'tca', 'fga_low'].indexOf(d.cls) >= 0 && !r.home && !r.pre;
        }) || pt.visits.filter((v) => ['past', 'noshow', 'auto'].indexOf(v.kind) < 0).length >= 3,
      q: () => '{REL}: «Ночью встал{{|а}} в туалет и упал{{|а}}, ударил{{ся|ась}} бедром. Рентген — без перелома, слава богу. Это может быть от таблеток?»',
      opts: [
        { t: 'Да, седативные и холинолитические препараты повышают риск падений у пожилых: на ближайшем приёме пересмотреть лечение, по возможности постепенно отменить их; ночник, поручни', ok: true, fx: (s, pt) => urgentVisit(s, pt), why: 'Бензодиазепины, Z-гипнотики, трициклики и низкопотентные антипсихотики у пожилых — главные «лекарственные» причины падений и переломов.' },
        { t: 'Просто случайность, ничего не менять', ok: false, fx: (s, pt) => { pt.harm += 1; }, why: 'Падение у пожилой на седативных препаратах — повод пересмотреть лечение, а не случайность.' },
      ],
    },
  };

  function evalEvents(s, pt) {
    const last = pt.events.length ? pt.events[pt.events.length - 1].day : -99;
    if (s.day - last < 2) return;
    for (const k of U.shuffle(Object.keys(M.EVENTS))) {
      const ev = M.EVENTS[k];
      if (ev.once && pt.events.some((e) => e.k === k)) continue;
      if (pt.events.some((e) => e.k === k && s.day - e.day < (ev.cooldown || 8))) continue;
      const p = ev.chance(s, pt);
      if (p > 0 && Math.random() < p) {
        startEvent(s, pt, k);
        break;
      }
    }
  }
  function startEvent(s, pt, k) {
    const ev = M.EVENTS[k];
    const preventable = ev.preventable ? !!ev.preventable(s, pt) : false;
    if (ev.start) ev.start(s, pt);
    pt.events.push({ k, day: s.day, preventable, resolved: false });
    if (preventable) pt.harm += 1;
    pt.pending = { k, day: s.day };
    diary(pt, s.day, 'call', ev.title);
  }
  M.startEvent = startEvent;
  /** Решение по звонку. Возвращает { ok, why, title }. */
  M.decide = function (s, pt, i) {
    if (!pt.pending) return null;
    const k = pt.pending.k;
    const ev = M.EVENTS[k];
    const o = ev.opts[i];
    if (!o) return null;
    const ok = typeof o.ok === 'function' ? o.ok(s, pt) : o.ok;
    o.fx(s, pt);
    const e = pt.events.filter((x) => x.k === k).pop();
    if (e) {
      e.resolved = true;
      e.choice = i;
      e.ok = ok;
    }
    if (ok === true) pt.rev.ok++;
    else if (ok === 'part') pt.rev.warn++;
    else pt.wrong++;
    pt.rev.list.push({ day: s.day, lvl: ok === true ? 'ok' : ok === 'part' ? 'warn' : 'err', text: ev.title + ': ' + o.why });
    W().log(s, pt, ev.title + ' — ' + o.t.charAt(0).toLowerCase() + o.t.slice(1) + '.');
    pt.pending = null;
    return { ok, why: o.why, title: ev.title };
  };
  /** Звонок, на который не ответили за два рабочих дня, отработал дежурный или скорая. */
  function autoResolve(s, pt, noBlame) {
    const pend = pt.pending;
    const ev = M.EVENTS[pend.k];
    const i = ev.opts.findIndex((o) => (typeof o.ok === 'function' ? o.ok(s, pt) : o.ok) === true);
    if (i >= 0) ev.opts[i].fx(s, pt);
    const e = pt.events.filter((x) => x.k === pend.k).pop();
    if (e) {
      e.resolved = true;
      e.auto = true;
    }
    if (!noBlame && s.career && s.career.today > pend.day) pt.missed++;
    W().log(s, pt, ev.title + ': решал дежурный врач.');
    diary(pt, s.day, 'call', ev.title + ' — решал дежурный врач.');
    pt.pending = null;
  }
  M.autoResolveOld = function (s) {
    M.active(s).forEach((pt) => {
      if (pt.pending && s.day - pt.pending.day > 3) autoResolve(s, pt);
    });
  };

  /* ---------- Госпитализация ---------- */
  /** Направить в стационар. force — по скорой или решению дежурного, без проверки показаний. Возвращает { ok, msgs }. */
  M.hospitalize = function (s, pt, force) {
    const g = P().group(pt);
    const indicated = pt.sev >= 68 || ((pt.risk.suicide || 0) >= 2 && pt.sev >= 55) || !!pt.flags.seizure || pt.lab.li > 1.8 || pt.lab.na < 125;
    if (!force && !indicated) return { ok: false, msgs: [{ lvl: 'warn', text: 'Показаний для госпитализации нет: состояние позволяет лечить амбулаторно. ' + U.cap(W().pv(pt, 'пациент', 'пациентка')) + ' отказывается ложиться в больницу.' }] };
    const stay = U.int(7, 12);
    // направили с приёма — визит записывается в карту
    const v = pt.vis && pt.vis.day === s.day ? pt.vis : null;
    if (v) {
      pt.visits.push({ day: s.day, kind: v.kind, who: 'Вы', scale: v.scale ? { name: v.scale.name, v: v.scale.value, max: v.scale.max, rev: v.scale.rev } : null, complaints: v.report.filter((x) => x.who !== 'chart').map((x) => x.text).slice(0, 4), obj: v.obj, changes: pt.log.slice(v.log0).map((x) => x.text), talks: v.talks.slice(), tests: pt.tests.slice(v.tests0).map((t) => t.test), hosp: true });
      pt.vis = null;
      M.ensure(s).visits++;
    }
    pt.away = { where: 'стационаре', until: s.day + stay, from: s.day, forced: !!force };
    pt.next = s.day + stay + 1;
    pt.pending = null;
    W().log(s, pt, 'Направлен' + W().pv(pt, '', 'а') + ' на госпитализацию в ПБ №6.');
    diary(pt, s.day, 'hosp', 'Госпитализирован' + W().pv(pt, '', 'а') + ' в ПБ №6.');
    pt.care.hosp = (pt.care.hosp || 0) + 1;
    return { ok: true, msgs: [{ lvl: indicated ? 'ok' : 'info', text: indicated ? 'Госпитализация обоснована: состояние тяжёлое или есть риск, который амбулаторно не снизить.' : 'Пациента госпитализировали по скорой.' }] };
  };
  /** Выписка из стационара: состояние лучше, лечение поправлено. */
  function backFromHospital(s, pt) {
    const g = P().group(pt);
    pt.sev = Math.min(pt.sev, g.discharge + U.int(-6, 4));
    pt.away = null;
    pt.stopped = null;
    pt.flags.bzdCut = null;
    pt.flags.seizure = null;
    const eff = (r) => {
      const d = r.kind === 'int' ? null : P().drug(r.id);
      return d && g.domains.some((k) => (d.eff[k] || 0) >= 0.45);
    };
    const STD = { schizophrenia: ['risperidone', 'po', 4], bipolar_maint: ['quetiapine', 'po', 400], bipolar_depression: ['quetiapine', 'po', 300], depression: ['sertraline', 'po', 100], gad: ['escitalopram', 'po', 10], panic: ['escitalopram', 'po', 10], ocd: ['sertraline', 'po', 150], ptsd: ['sertraline', 'po', 100], alcohol_dependence: ['naltrexone', 'po', 50], insomnia: ['trazodone', 'po', 75], dementia_mild: ['donepezil', 'po', 5] };
    let txt = 'Выписка из ПБ №6: состояние улучшилось.';
    if (!pt.rx.some((r) => eff(r) && !r.held) && STD[pt.group]) {
      const [id, route, dose] = STD[pt.group];
      pt.rx.push({ id, kind: 'drug', route, dose, since: s.day - 6, changed: s.day - 6, time: P().defaultTime(P().drug(id), route), hosp: true });
      txt += ' В стационаре назначен ' + P().drug(id).name.toLowerCase() + ' ' + P().fmtDose(dose) + '.';
    }
    pt.rx.forEach((r) => (r.held = false));
    pt.visits.push({ day: s.day, kind: 'hospital', who: 'ПБ №6, выписной эпикриз', text: txt + ' Рекомендовано: наблюдение у участкового психиатра, визит в течение недели.' });
    pt.next = s.day + 1;
    pt.prevRx = rxSnap(pt);
    diary(pt, s.day, 'hosp', 'Выписан' + W().pv(pt, '', 'а') + ' из стационара.');
  }

  /* ---------- Предварительный диагноз ---------- */
  /** Выбор диагноза на первичном приёме. Неверный диагноз поправит заведующий — но это ошибка в оценке ведения. */
  M.chooseDx = function (s, pt, i) {
    const t = tpl(pt);
    const o = t.dxq && t.dxq.opts && t.dxq.opts[i];
    if (!o || pt.dxOk != null) return null;
    pt.dxOk = o.ok === true ? true : o.ok === 'part' ? 'part' : false;
    pt.dxPick = i;
    pt.dxText = o.t;
    pt.dxWhy = o.why || '';
    if (o.ok === true) pt.rev.ok++;
    pt.rev.list.push({ day: s.day, lvl: o.ok === true ? 'ok' : o.ok === 'part' ? 'warn' : 'err', text: 'Диагноз «' + o.t + '»: ' + o.why });
    W().log(s, pt, 'Предварительный диагноз: ' + o.t + (o.ok === true ? '.' : ' — исправлен заведующим на ' + pt.dx + '.'));
    return { ok: o.ok, why: o.why, right: pt.dx };
  };

  /** Диагноз из полного списка МКБ-10 (сложная игра). Возвращает { ok, why, right }. */
  M.chooseDxKey = function (s, pt, key) {
    const t = tpl(pt);
    if (!t.dxq || !t.dxq.opts || pt.dxOk != null || !A.icd.get(key)) return null;
    const okOf = (o) => (o.ok === true ? 1 : o.ok === 'part' ? 0.5 : 0);
    const j = A.icd.judge(t.dxq.opts, key, okOf);
    const label = A.icd.label(key);
    pt.dxOk = j.score === 1 ? true : j.score > 0 ? 'part' : false;
    pt.dxKey = key;
    pt.dxText = label;
    pt.dxWhy = j.opt && j.opt.why ? j.opt.why : j.score === 1 ? (j.right && j.right.why) || '' : j.cat ? 'Рубрика верная, но уточнение другое.' : 'Этот диагноз не объясняет картину. ' + ((j.right && j.right.why) || '');
    if (pt.dxOk === true) pt.rev.ok++;
    pt.rev.list.push({ day: s.day, lvl: pt.dxOk === true ? 'ok' : pt.dxOk === 'part' ? 'warn' : 'err', text: 'Диагноз «' + label + '»: ' + pt.dxWhy });
    W().log(s, pt, 'Предварительный диагноз: ' + label + (pt.dxOk === true ? '.' : ' — исправлен заведующим на ' + pt.dx + '.'));
    return { ok: pt.dxOk, why: pt.dxWhy, right: pt.dx };
  };

  /* ---------- Беседа на приёме ---------- */
  M.TALKS = {
    explain: { name: 'Объяснить, как действует лечение и чего ждать', short: 'Объяснить лечение' },
    goal: { name: 'Обсудить цели и сроки лечения', short: 'Сроки лечения' },
    adherence: { name: 'Разобрать пропуски и сомнения в таблетках', short: 'Пропуски таблеток' },
    safety: { name: 'Спросить о суицидальных мыслях, составить план безопасности', short: 'Суицидальный риск' },
    family: { name: 'Пригласить {REL_LC}, договориться о помощи', short: 'Подключить близких', when: (pt) => pt.family },
    lifestyle: { name: 'Питание, движение, вес: план на месяц', short: 'Образ жизни' },
    alcohol: { name: 'Поговорить об алкоголе', short: 'Алкоголь' },
    sleep: { name: 'Гигиена сна и дневник сна', short: 'Сон' },
    pregnancy: { name: 'Обсудить планирование беременности и контрацепцию', short: 'Беременность', when: (pt) => pt.sex === 'f' && pt.age >= 16 && pt.age <= 48 },
  };
  // «Пригласить мужа / маму / сестру» — родственник в винительном падеже
  const REL_ACC = { мама: 'маму', папа: 'папу', дочь: 'дочь', сын: 'сына', жена: 'жену', муж: 'мужа', сестра: 'сестру', брат: 'брата', бабушка: 'бабушку', дедушка: 'дедушку', отец: 'отца', мать: 'мать' };
  M.talkName = (pt, k) => {
    const rel = (pt.rel || 'близких').toLowerCase();
    return M.TALKS[k].name.replace('{REL_LC}', REL_ACC[rel] || rel);
  };
  M.talksFor = (pt) => Object.keys(M.TALKS).filter((k) => !M.TALKS[k].when || M.TALKS[k].when(pt));
  /** Провести беседу. Возвращает [{ lvl, text }] — что сказал пациент и как это оценил заведующий. */
  M.talk = function (s, pt, k) {
    const v = pt.vis;
    if (!v || v.talks.indexOf(k) >= 0) return [];
    v.talks.push(k);
    pt.talks[k] = s.day;
    const out = [];
    const fill = (t) => M.fill(pt, t);
    const st = P().stage(pt.sev).k;
    switch (k) {
      case 'explain':
        out.push({ lvl: 'info', text: fill('{P} кивает: «Значит, тошнота пройдёт, а эффект будет недели через две-три. Хорошо, что предупредили».') });
        break;
      case 'goal':
        pt.insight = Math.min(0.95, pt.insight + 0.05);
        if (pt.flags.wantsStop) {
          if (Math.random() < pt.insight + 0.25) {
            pt.flags.wantsStop = false;
            out.push({ lvl: 'ok', text: fill('«Три эпизода — это серьёзно… Ладно, продолжу. Но давайте подумаем, как быть с весом и влечением».') });
          } else out.push({ lvl: 'warn', text: fill('«Я всё понимаю, но я устал{{|а}} от таблеток». Решение пока не изменилось.') });
        } else out.push({ lvl: 'info', text: fill(st === 'remission' || st === 'mild' ? '«Значит, бросать сразу, как стало лучше, нельзя. Поняла: ещё минимум полгода». ' : '«Значит, эффект будет не сразу, а лечиться — долго. Буду терпеть».').replace('Поняла', W().pv(pt, 'Понял', 'Поняла')) });
        break;
      case 'adherence':
        pt.insight = Math.min(0.95, pt.insight + 0.05);
        if (pt.stopped) {
          if (Math.random() < 0.4 + pt.insight * 0.5) {
            pt.stopped = null;
            out.push({ lvl: 'ok', text: fill('{P} признаётся, что бросил{{|а}} таблетки, и соглашается вернуться к лечению: «Только если с побочными что-то сделаем»') });
          } else out.push({ lvl: 'warn', text: fill('{P}: «Нет, пить не буду». Пока не удалось договориться — нужен другой подход (пролонгированная форма, семья, дневной стационар).') });
        } else if (pt.adherence < 0.8) out.push({ lvl: 'info', text: fill('{P}: «Честно, вечернюю часто забываю». Договорились о напоминании в телефоне и таблетнице на неделю.') });
        else out.push({ lvl: 'info', text: fill('{P}: «Пью всё, как написано». Похоже, правда.') });
        if (pt.flags.wantsStop && Math.random() < 0.5) pt.flags.wantsStop = false;
        break;
      case 'safety': {
        const r = pt.risk.suicide || 0;
        if (r >= 2 || (r >= 1 && pt.sev >= 60)) {
          out.push({ lvl: 'warn', text: fill('{P}: «Бывают мысли, что лучше бы меня не было. Плана нет… но иногда думаю о таблетках». Составили план безопасности: телефоны близких и доверия, лекарства — у родных, визит чаще.') });
          v.riskFound = true;
        } else if (r >= 1) out.push({ lvl: 'info', text: fill('{P}: «Иногда мелькает „лучше бы не просыпаться“, но я никогда бы не… У меня семья». Обсудили, куда звонить, если станет хуже.') });
        else out.push({ lvl: 'info', text: fill('{P}: «Нет, таких мыслей нет». Риск низкий.') });
        if (r >= 1) pt.flags.safetyPlan = s.day;
        break;
      }
      case 'family':
        out.push({ lvl: 'ok', text: fill('{REL} обещает помогать: напоминать о таблетках, замечать ранние признаки ухудшения и звонить, если что-то не так.') });
        break;
      case 'lifestyle':
        pt.flags.lifestyle = s.day;
        out.push({ lvl: 'info', text: fill('Договорились: меньше сладкого и мучного, прогулки по 40 минут, взвешивание раз в неделю. {P}: «Попробую. Главное — чтобы не набирать дальше».') });
        break;
      case 'alcohol': {
        const t = P().tags(pt);
        if (t.alcohol || pt.group === 'alcohol_dependence') {
          pt.sev = Math.max(0, pt.sev - 2);
          out.push({ lvl: 'ok', text: fill('Поговорили об алкоголе без осуждения: как он влияет на сон, настроение и лечение. {P}: «Вечером бокал — уже привычка… Попробую без него».') });
        } else out.push({ lvl: 'info', text: fill('{P}: «Пью редко, по праздникам». С лекарствами алкоголь не сочетать — договорились.') });
        break;
      }
      case 'sleep':
        out.push({ lvl: 'info', text: fill('Обсудили режим: вставать в одно время, без телефона в постели, кровать — только для сна, дневник сна. {P}: «Звучит просто, а я ничего этого не делал{{|а}}».') });
        break;
      case 'pregnancy':
        pt.flags.contraception = s.day;
        out.push({ lvl: 'ok', text: fill('{P}: «Не знала, что таблетки так опасны для ребёнка. Пока будем предохраняться, а с беременностью подождём, пока не поменяем лечение».') });
        break;
    }
    return out;
  };

  /* ---------- Приём ---------- */
  /** Список на сегодня: звонки, записанные, новый пациент. */
  M.beginDay = function (s) {
    const w = M.ensure(s);
    M.archiveDone(s);
    const seeded = M.seed(s);
    M.autoResolveOld(s);
    const act = M.active(s);
    const fresh = [];
    if (!seeded.length && act.length < M.capacity(s) && s.day - (w.lastIntake || 0) >= 2 && (act.length < 3 || U.chance(0.45))) {
      const id = M.pickTemplate(s, 'new');
      if (id) {
        const pt = M.admit(s, id);
        pt.next = s.day;
        fresh.push(pt.uid);
        w.lastIntake = s.day;
      }
    } else if (seeded.length) {
      const id = M.pickTemplate(s, 'new');
      if (id) {
        const pt = M.admit(s, id);
        pt.next = s.day;
        fresh.push(pt.uid);
        w.lastIntake = s.day;
      }
    }
    let due = M.active(s).filter((p) => !p.away && p.next <= s.day);
    // неявки
    due.forEach((pt) => {
      if (!pt.visits.some((v) => v.kind !== 'past') || pt.urgent || pt.pending) return;
      const come = 0.97 - (pt.insight < 0.45 ? 0.12 : 0) - (pt.stopped ? 0.15 : 0) - (pt.sev > 70 && pt.group === 'schizophrenia' ? 0.2 : 0);
      if (Math.random() > come) {
        pt.visits.push({ day: s.day, kind: 'noshow', text: 'На приём не явил' + W().pv(pt, 'ся', 'ась') + '.' });
        pt.care.noShow++;
        startEvent(s, pt, 'no_show');
        pt.next = s.day + 1;
      }
    });
    due = M.active(s).filter((p) => !p.away && p.next <= s.day && fresh.indexOf(p.uid) < 0);
    // не больше нескольких ключевых визитов (на кафедре — двух): остальных переносят на следующий день
    due.sort((a, b) => (b.urgent ? 1 : 0) - (a.urgent ? 1 : 0) || a.next - b.next);
    const maxV = M.place(s) === 'uni' ? 2 : M.MAX_VISITS;
    due.slice(maxV).forEach((pt) => {
      pt.next = s.day + 1;
      pt.care.late++;
    });
    due = due.slice(0, maxV);
    // никто не записан — приходит новый пациент, если на участке есть место
    if (!due.length && !fresh.length && M.active(s).length < M.capacity(s)) {
      const id = M.pickTemplate(s, 'new');
      if (id) {
        const pt = M.admit(s, id);
        pt.next = s.day;
        fresh.push(pt.uid);
        w.lastIntake = s.day;
      }
    }
    const order = due.slice();
    fresh.forEach((u) => {
      const pt = M.byUid(s, u);
      if (pt && order.indexOf(pt) < 0) order.push(pt);
    });
    return { list: order.map((p) => p.uid), fresh };
  };
  M.archiveDone = function (s) {
    const w = M.ensure(s);
    w.pts = w.pts.filter((p) => !p.done);
  };

  const SE_ORDER = [
    ['akathisia', 1.0],
    ['eps', 1.2],
    ['sedation', 1.9],
    ['sexual', 1.4],
    ['activation', 0.9],
    ['serotonergic', 0.9],
    ['tremor', 1.4],
    ['orthostatic', 1.4],
    ['anticholinergic', 1.7],
    ['dependence', 1.6],
  ];
  /** Начать визит: жалобы, осмотр, шкала, свежие анализы; медсестра делает плановую инъекцию. */
  M.beginVisit = function (s, pt) {
    if (pt.vis && pt.vis.day === s.day) return pt.vis;
    const T = D().ambTexts || {};
    const first = !pt.visits.some((v) => v.kind !== 'past' && v.kind !== 'noshow');
    const kind = first ? 'first' : pt.urgent ? 'urgent' : pt.visits.length && pt.visits[pt.visits.length - 1].kind === 'hospital' ? 'return' : 'follow';
    const v = { day: s.day, kind, prevSev: pt.prevSev, report: [], talks: [], rx0: rxSnap(pt), log0: pt.log.length, rev0: { ok: pt.rev.ok, warn: pt.rev.warn, err: pt.rev.err }, tests0: pt.tests.length, injected: null };
    const key = TEXT_KEY[pt.group] || 'default';
    const fill = (t) => M.fill(pt, t);
    const pickT = (k, arr) => (arr && arr.length ? fill(arr[(U.hash(pt.uid + k + s.day) >>> 0) % arr.length]) : '');
    const lastV = pt.visits.filter((x) => x.kind !== 'past' && x.kind !== 'noshow').pop();
    const since = lastV ? lastV.day : pt.admitDay - 1;
    if (!first) {
      const d = pt.sev - pt.prevSev;
      const ch = d <= -5 ? 'better' : d >= 5 ? 'worse' : 'same';
      const set = (T.change || {})[key] || (T.change || {}).default || {};
      const line = pickT('ch' + ch, set[ch]);
      if (line) v.report.push({ who: pt.group === 'dementia_mild' ? 'rel' : 'pt', text: line, k: 'change' });
    }
    if (pt.flags.wantsStop) v.report.push({ who: 'pt', text: fill('«Доктор, мне давно хорошо. Можно я просто перестану пить таблетки с понедельника? Вес набрала, и… ну, вы понимаете».').replace('набрала', W().pv(pt, 'набрал', 'набрала')), k: 'wantsStop', lvl: 'warn' });
    // нежелательные явления
    let n = 0;
    pt.seSaid = pt.seSaid || {};
    const sayAgain = (k, val) => {
      const was = pt.seSaid[k];
      if (!was) return true;
      if (val >= was.v + 0.35) return true; // усилилось
      return pt.visits.filter((x) => x.day > was.day && x.kind !== 'past' && x.kind !== 'noshow').length >= 2; // давно не обсуждали
    };
    SE_ORDER.forEach(([k, th]) => {
      const val = pt.sx[k] || 0;
      if (n >= 3 || val < th) {
        if (val < th * 0.7) delete pt.seSaid[k];
        return;
      }
      if ((k === 'activation' || k === 'serotonergic') && !pt.rx.some((r) => !r.pre && bio(s.day - r.since) <= 20)) return;
      if (!sayAgain(k, val)) return;
      const line = pickT('se' + k, (T.se || {})[k]);
      if (line) {
        v.report.push({ who: 'pt', text: line, k: 'se', se: k, lvl: 'warn' });
        pt.seSaid[k] = { v: val, day: s.day };
        n++;
      }
    });
    const gain = pt.lab.weight - pt.base.weight;
    if (gain >= 4 && n < 3) v.report.push({ who: 'pt', text: pickT('sew', (T.se || {}).weight), k: 'se', se: 'weight', lvl: 'warn' });
    if (pt.lab.prl > 45 && n < 3) v.report.push({ who: 'pt', text: pickT('sep', (T.se || {})['prolactin_' + pt.sex]), k: 'se', se: 'prolactin', lvl: 'warn' });
    if (pt.group === 'dementia_mild' && ((pt.load && pt.load.anticholinergic) || 0) > 1) v.report.push({ who: 'rel', text: pickT('sec', (T.se || {}).cognition), k: 'se', se: 'cognition', lvl: 'warn' });
    if (pt.lab.na < 132) v.report.push({ who: 'rel', text: pickT('sena', (T.se || {}).hyponatremia), k: 'se', se: 'hyponatremia', lvl: 'warn' });
    // приверженность
    if (pt.stopped) {
      const confess = Math.random() < 0.35 + pt.insight * 0.5;
      if (confess) v.report.push({ who: 'pt', text: pickT('stop', (T.adh || {})[pt.stopWhy === 'se' ? 'stoppedSe' : 'stoppedWell']), k: 'stopped', lvl: 'warn' });
      else if (pt.family) v.report.push({ who: 'rel', text: pickT('rel', (T.adh || {}).relatives), k: 'stopped', lvl: 'warn' });
      else v.report.push({ who: 'pt', text: pickT('den', (T.adh || {}).denies), k: 'denies' });
      v.stoppedKnown = confess || pt.family;
    } else if (pt.adherence < 0.75 && Math.random() < 0.6) v.report.push({ who: 'pt', text: pickT('skip', (T.adh || {}).skip), k: 'skip', lvl: 'info' });
    // что было между визитами
    pt.diary
      .filter((x) => x.day > since && x.day <= s.day && ['life', 'withdrawal', 'dayhosp', 'hosp', 'stop'].indexOf(x.k) >= 0)
      .slice(-3)
      .forEach((x) => {
        if (x.k === 'stop') return; // о самоотмене — по признанию выше
        v.report.push({ who: x.k === 'hosp' || x.k === 'dayhosp' ? 'chart' : 'pt', text: fill(x.text), k: 'diary' });
      });
    // осмотр
    v.obj = objective(s, pt);
    const sc = P().scale(pt);
    if (sc) {
      sc.value = U.clamp(sc.value + U.int(-1, 1), sc.min || 0, sc.max);
      v.scale = sc;
      pt.scaleHist.push({ day: s.day, v: sc.value });
      if (pt.scaleHist.length > 40) pt.scaleHist.splice(0, pt.scaleHist.length - 40);
    }
    // свежие анализы
    v.labs = pt.tests.filter((x) => x.value && x.ready > since && x.ready <= s.day && !x.pre && x.test !== 'weight').map((x) => ({ test: x.test, text: x.text, flag: x.flag }));
    // масса тела — на каждом визите
    const wv = P().labValue(s, pt, 'weight');
    const wt = P().labText('weight', wv);
    pt.tests.push({ test: 'weight', day: s.day, ready: s.day, value: wv, text: wt, flag: /↑|↓/.test(wt), auto: true });
    v.tests0 = pt.tests.length;
    pt.tests.forEach((x) => (x.fresh = false));
    // плановая инъекция пролонга
    pt.rx.forEach((r) => {
      if (r.route !== 'depot' || r.held) return;
      const f = P().form(P().drug(r.id), 'depot');
      const every = f.interval || 28;
      if (r.lastInj == null || bio(s.day - r.lastInj) >= every - 8) {
        r.lastInj = s.day;
        v.injected = r.id;
        W().log(s, pt, 'Инъекция: ' + P().drug(r.id).name.toLowerCase() + ' ' + P().fmtDose(r.dose) + ' в/м (процедурный кабинет).');
      }
    });
    pt.urgent = false;
    pt.vis = v;
    if (first) pt.admitDay = s.day;
    return v;
  };

  function objective(s, pt) {
    const x = pt.sx || {};
    const L = pt.lab;
    const bmi = Math.round((L.weight / Math.pow((pt.base.height || 170) / 100, 2)) * 10) / 10;
    let sys = 125 + (pt.age > 60 ? 10 : 0) - Math.round((x.orthostatic || 0) * 4);
    let dia = 80 - Math.round((x.orthostatic || 0) * 2);
    const hr = Math.round(72 + (x.anticholinergic || 0) * 6 + (pt.rx.some((r) => r.id === 'clozapine') ? 14 : 0) + (pt.group === 'alcohol_dependence' && pt.sev > 60 ? 12 : 0) - (pt.rx.some((r) => P().drug(r.id) && P().drug(r.id).cls === 'che') ? 8 : 0));
    const finds = [];
    if ((x.tremor || 0) >= 1 || L.li > 1.1) finds.push(L.li > 1.3 ? 'крупноразмашистый тремор рук, неустойчивость в позе Ромберга' : 'мелкий тремор пальцев вытянутых рук');
    if ((x.eps || 0) >= 1.2) finds.push('гипомимия, ригидность по типу «зубчатого колеса», походка скованная');
    if ((x.akathisia || 0) >= 1) finds.push('не может усидеть, переминается с ноги на ногу');
    if ((x.sedation || 0) >= 2) finds.push('сонлив' + W().pv(pt, '', 'а') + ', зевает, отвечает с задержкой');
    if (pt.quitSmoking && pt.rx.some((r) => r.id === 'clozapine' && r.dose > 250)) finds.push('выраженное слюнотечение, заторможенность');
    if ((x.orthostatic || 0) >= 1.4) finds.push('при вставании АД снижается до ' + (sys - 25) + '/' + (dia - 12) + ', головокружение');
    if ((x.anticholinergic || 0) >= 1.7) finds.push('сухость слизистых, жалобы на запоры');
    const st = P().stage(pt.sev).k;
    const ST = (D().ambTexts || {}).status || {};
    const list = (ST[pt.group] && ST[pt.group][st]) || (((D().wardTexts || {}).status || {})[pt.group] || {})[st] || [];
    const status = list.length ? M.fill(pt, list[(s.day + (pt.seed % 5)) % list.length]) : '';
    return { weight: L.weight, gain: Math.round((L.weight - pt.base.weight) * 10) / 10, bmi, bp: sys + '/' + dia, hr, finds, status };
  }
  M.objective = objective;

  /* ---------- Завершение визита ---------- */
  const SE_FIX = {
    akathisia: (r, d) => d && (d.id === 'propranolol' || d.cls === 'bzd'),
    eps: (r, d) => d && d.cls === 'anticholinergic',
  };
  /** Разбор визита: интервал, жалобы, ответ на лечение, контроль. Записывает визит в карту. Возвращает { msgs, score }. */
  M.endVisit = function (s, pt, interval) {
    const v = pt.vis;
    if (!v) return { msgs: [], score: 0 };
    const msgs = [];
    const say = (lvl, text) => msgs.push({ lvl, text });
    const g = P().group(pt);
    const newLog = pt.log.slice(v.log0).map((x) => x.text);
    const now = rxSnap(pt);
    const changed = (id) => {
      const a = v.rx0.find((x) => x.id === id);
      const b = now.find((x) => x.id === id);
      return !a || !b || a.dose !== b.dose;
    };
    const anyChange = v.rx0.length !== now.length || now.some((x) => changed(x.id)) || v.rx0.some((x) => !now.some((y) => y.id === x.id)) || newLog.some((t) => /^Назначено|^Отменено|→/.test(t));
    const timeChanged = !!v.timeChanged;
    // 0. Первичный приём: диагноз
    if (v.kind === 'first' && pt.dxOk == null) say('warn', 'Предварительный диагноз так и не поставлен.');
    // 1. Интервал до следующего визита
    const started = now.filter((x) => !v.rx0.some((y) => y.id === x.id));
    const adStarted = started.some((x) => {
      const d = P().drug(x.id);
      return d && d.group === 'antidepressant';
    });
    const adChanged = now.some((x) => {
      const d = P().drug(x.id);
      return d && d.group === 'antidepressant' && changed(x.id);
    });
    const riskHigh = (pt.risk.suicide || 0) >= 2 || v.riskFound;
    const when = M.intervalName(interval);
    if (riskHigh && interval > 3) say('err', 'Суицидальный риск: следующий визит — через 1–2 дня, план безопасности и связь с близкими. Отпускать «' + when + '» нельзя.');
    else if (riskHigh && interval > 1) say('warn', 'При суицидальном риске лучше увидеть пациента через 1–2 дня, а не через неделю.');
    else if (adStarted && interval > 3 && (pt.age < 25 || (pt.risk.suicide || 0) >= 1)) say('warn', 'Антидепрессант начат у ' + (pt.age < 25 ? 'молодого пациента' : 'пациента с мыслями о смерти') + ': первый контроль — через неделю (суицидальные мысли, активация, переносимость).');
    else if ((adStarted || adChanged) && interval > 7) say('warn', 'После начала или смены антидепрессанта нужен контроль через 1–2 недели: переносимость, ранние нежелательные явления, суицидальные мысли.');
    else if (pt.sev >= 65 && interval > 3) say('warn', 'Состояние тяжёлое — следующий визит через неделю или раньше; обсудите дневной стационар или госпитализацию.');
    else if (started.some((x) => { const d = P().drug(x.id); return d && (d.group === 'antipsychotic' || d.id === 'lithium' || d.id === 'lamotrigine' || d.id === 'clozapine'); }) && interval > 7) say('info', 'Новый препарат с выраженными побочными эффектами — переносимость лучше проверить через 1–2 недели.');
    else if (!anyChange && pt.sev < 25 && interval <= 3 && !riskHigh) say('info', 'Стабильному пациенту так часто приходить не нужно — это отнимает время у тех, кому хуже.');
    // пролонг: инъекция должна прийтись на визит
    pt.rx.forEach((r) => {
      if (r.route !== 'depot' || r.lastInj == null) return;
      const every = P().form(P().drug(r.id), 'depot').interval || 28;
      const dueIn = (every - bio(s.day - r.lastInj)) / M.SPEED; // игровых дней до следующей инъекции
      if (interval > dueIn + 4) say('warn', 'Следующая инъекция ' + P().drug(r.id).name.toLowerCase() + ' — через ' + Math.max(1, Math.round(dueIn * M.SPEED)) + ' дн., а визит назначен позже: будет перерыв в лечении.');
    });
    // 2. Жалобы на нежелательные явления
    v.report.forEach((x) => {
      if (x.k !== 'se') return;
      const k = x.se;
      const culprits = pt.rx.filter((r) => {
        const d = r.kind === 'int' ? null : P().drug(r.id);
        if (!d) return false;
        if (k === 'weight') return (d.se.weight || 0) >= 2;
        if (k === 'prolactin') return (d.se.prolactin || 0) >= 2;
        if (k === 'cognition') return (d.se.anticholinergic || 0) >= 2 || d.cls === 'bzd';
        if (k === 'hyponatremia') return (d.se.hyponatremia || 0) >= 1;
        return (d.se[k] || 0) >= 1;
      });
      // настоящая мера: доза, отмена или замена виновника, корректор, время приёма, нужный анализ
      const acted =
        culprits.some((r) => changed(r.id)) ||
        v.rx0.some((o) => !now.some((y) => y.id === o.id)) ||
        (SE_FIX[k] && pt.rx.some((r) => SE_FIX[k](r, P().drug(r.id)) && !v.rx0.some((o) => o.id === r.id))) ||
        ((k === 'sedation' || k === 'activation' || k === 'orthostatic') && timeChanged) ||
        (k === 'prolactin' && (pt.tests.some((t) => t.test === 'prolactin' && t.day === s.day) || anyChange)) ||
        (k === 'hyponatremia' && pt.tests.some((t) => t.test === 'bio' && t.day === s.day)) ||
        (k === 'tremor' && pt.tests.some((t) => t.test === 'lithium' && t.day === s.day));
      // объяснение и план тоже ответ — но не на одну и ту же жалобу раз за разом
      const talked = (k === 'weight' && v.talks.indexOf('lifestyle') >= 0) || (k !== 'weight' && k !== 'hyponatremia' && k !== 'akathisia' && v.talks.indexOf('explain') >= 0);
      pt.seTalk = pt.seTalk || {};
      if (acted) pt.seTalk[k] = 0;
      else if (talked) pt.seTalk[k] = (pt.seTalk[k] || 0) + 1;
      const fixed = acted || (talked && pt.seTalk[k] <= 2);
      const names = { akathisia: 'акатизию', eps: 'экстрапирамидные расстройства', sedation: 'сонливость', sexual: 'сексуальную дисфункцию', activation: 'беспокойство и бессонницу', serotonergic: 'тошноту', tremor: 'тремор', orthostatic: 'головокружение при вставании', anticholinergic: 'сухость во рту и запоры', dependence: 'привыкание к таблеткам', weight: 'прибавку веса', prolactin: 'симптомы гиперпролактинемии', cognition: 'ухудшение памяти', hyponatremia: 'слабость и спутанность (натрий!)' };
      if (fixed) {
        say('ok', 'Жалобу на ' + (names[k] || k) + ' не оставили без внимания.');
        pt.care.oks++;
      } else if (talked) say('warn', 'Жалоба на ' + (names[k] || k) + ' повторяется — одних объяснений мало: снизьте дозу, смените препарат или добавьте корректор.');
      else say('warn', 'Жалобу на ' + (names[k] || k) + ' оставили без ответа: это частая причина бросить лечение.');
    });
    // 3. Самостоятельная отмена
    if (pt.stopped && v.stoppedKnown && v.talks.indexOf('adherence') < 0 && !anyChange && !pt.rx.some((r) => r.route === 'depot')) say('warn', W().pv(pt, 'Пациент бросил', 'Пациентка бросила') + ' лечение — это надо было разобрать: причины, побочные эффекты, другая форма.');
    if (pt.flags.wantsStop && v.talks.indexOf('goal') < 0 && v.talks.indexOf('adherence') < 0) say('warn', W().pv(pt, 'Пациент собирается', 'Пациентка собирается') + ' бросить таблетки — без разговора о рисках ' + W().pv(pt, 'он', 'она') + ' так и сделает.');
    // 4. Ответ на антидепрессант за 4 недели
    pt.rx.forEach((r) => {
      const d = r.kind === 'int' ? null : P().drug(r.id);
      if (!d || d.group !== 'antidepressant' || r.home || r.pre) return;
      const days = bio(s.day - (r.changed || r.since));
      if (days < 28 || pt.sev < 30 || changed(r.id) || pt.stopped || pt.adherence < 0.6) return;
      const startSev = (pt.hist.find((h) => h.d >= (r.changed || r.since)) || { sev: pt.sev0 }).sev;
      if (pt.sev > startSev * 0.75) say('warn', d.name + ': за 4 недели в этой дозе почти нет ответа — повысьте дозу или смените препарат (КР «Депрессивный эпизод…», 2024).');
    });
    // 5. Контроль
    P()
      .dueTests(s, pt)
      .forEach((x) => {
        const ordered = pt.tests.some((t) => t.test === x.test && t.day === s.day);
        if (ordered) return;
        const key = x.test + ':' + x.why;
        if (x.overdue) {
          if (!pt.monMissed[key]) pt.monMissed[key] = s.day;
          say('warn', 'Просрочен обязательный контроль: ' + P().lc(P().TESTS[x.test].name) + ' (' + x.why + ').');
        } else say('info', 'Пора проверить: ' + P().lc(P().TESTS[x.test].name) + ' (' + x.why + ').');
      });
    // 6. Бензодиазепин дольше месяца без плана отмены
    pt.rx.forEach((r) => {
      const d = r.kind === 'int' ? null : P().drug(r.id);
      if (!d || (d.cls !== 'bzd' && d.cls !== 'z') || r.prn || pt.group === 'alcohol_dependence') return;
      if (bio(s.day - r.since) <= 28 || (r.lastDown && s.day - r.lastDown <= 10) || changed(r.id)) return;
      // снижать начинают, когда подействует основной препарат (2–4 недели)
      const base = pt.rx.find((o) => o !== r && !o.pre && !o.home && o.kind !== 'int' && P().line(pt, P().drug(o.id)).line === 'first');
      const waiting = v.kind === 'first' || (base && bio(s.day - base.since) < 28) || (pt.group === 'insomnia' && pt.rx.some((o) => o.id === 'psychotherapy_cbti' && bio(s.day - o.since) < 21));
      if (waiting) say('info', d.name + ' дольше 4 недель: составьте план постепенной отмены — начинают, когда подействует основное лечение.');
      else say('warn', d.name + ' дольше 4 недель: нужен план постепенной отмены (10–25% каждые 1–2 недели).');
    });
    // 6а. Перекрёстная смена затянулась: два препарата одной группы дольше 6 недель
    ['antidepressant', 'antipsychotic'].forEach((gname) => {
      const same = pt.rx.filter((r) => r.kind !== 'int' && !r.prn && P().drug(r.id).group === gname);
      if (same.length < 2) return;
      const ids = [];
      same.forEach((r) => ids.indexOf(r.id) < 0 && !ids.some((x) => P().kin(x, r.id)) && ids.push(r.id));
      if (ids.length < 2) return;
      const newest = Math.max.apply(null, same.map((r) => r.since));
      if (bio(s.day - newest) > 42 && !(pt.rx.some((r) => r.id === 'clozapine') && gname === 'antipsychotic')) say('warn', 'Два ' + (gname === 'antidepressant' ? 'антидепрессанта' : 'антипсихотика') + ' дольше 6 недель: перекрёстную смену пора завершить — прежний препарат отменить.');
    });
    // 6б. Приостановленный препарат так и не возобновили
    pt.rx.forEach((r) => {
      if (!r.held || r.heldDay == null || bio(s.day - r.heldDay) < 6) return;
      say('warn', P().drug(r.id).name + ' приостановлен ' + Math.round(bio(s.day - r.heldDay)) + ' дн. назад: решите — возобновить в меньшей дозе или заменить. Без нормотимика высок риск рецидива.');
    });
    // 7. Суицидальный риск не оценили
    if ((pt.risk.suicide || 0) >= 1 && pt.sev >= 50 && v.talks.indexOf('safety') < 0 && (v.kind === 'first' || pt.sev - v.prevSev >= 5)) say('warn', 'При депрессии с мыслями о смерти суицидальный риск оценивают прямым вопросом на первом визите и при каждом ухудшении.');
    // Итог визита: замечания по назначениям за визит тоже учитываются
    const dErr = pt.rev.err - v.rev0.err;
    const dWarn = pt.rev.warn - v.rev0.warn;
    const errs = msgs.filter((m) => m.lvl === 'err').length + dErr;
    const warns = msgs.filter((m) => m.lvl === 'warn').length + dWarn;
    const oks = msgs.filter((m) => m.lvl === 'ok').length;
    pt.care.errs += msgs.filter((m) => m.lvl === 'err').length;
    pt.care.warns += msgs.filter((m) => m.lvl === 'warn').length;
    const score = U.clamp(Math.round(100 - errs * 25 - warns * 10 + oks * 2), 0, 100);
    // запись в амбулаторную карту
    const rec = {
      day: s.day,
      kind: v.kind,
      who: 'Вы',
      scale: v.scale ? { name: v.scale.name, v: v.scale.value, max: v.scale.max, rev: v.scale.rev } : null,
      complaints: v.report.filter((x) => x.who !== 'chart').map((x) => x.text).slice(0, 4),
      obj: v.obj,
      changes: newLog,
      talks: v.talks.slice(),
      tests: pt.tests.slice(v.tests0).map((t) => t.test),
      next: s.day + interval,
      score,
      msgs: msgs.slice(0, 8),
    };
    pt.visits.push(rec);
    if (pt.visits.length > 60) pt.visits.splice(0, pt.visits.length - 60);
    pt.next = s.day + interval;
    pt.prevSev = pt.sev;
    pt.vis = null;
    const w = M.ensure(s);
    w.visits++;
    if (score >= 85) w.good++;
    return { msgs, score, rec };
  };

  /** Награда за визит: опыт, репутация, в частной клинике — оплата и отзыв. */
  M.reward = function (s, pt, score) {
    const Gm = G();
    const job = Gm.job(s);
    Gm.apply(s, { xp: Math.round(4 + score / 20) });
    if (job) Gm.apply(s, { rep: ((score - 60) / 110) * (job.rep || 1) });
    Gm.learn(s, P().group(pt).topic, score >= 70 ? 0.4 : 0.2);
    Gm.learn(s, 'pharm', score >= 70 ? 0.3 : 0.15);
    let pay = 0;
    if (job && job.perCase) {
      pay = Math.round((job.perCase * 0.35 * Gm.rank(s).mult * (score >= 60 ? 1 : 0.5)) / 10) * 10;
      Gm.apply(s, { money: pay }, 'Оплата приёма');
    }
    return pay;
  };

  /* ---------- Завершение ведения ---------- */
  /** Можно ли перевести пациента на редкие визиты: устойчивая ремиссия. */
  /** Порог стабильного состояния: при деменции — стабилизация без ухудшения, у остальных — ремиссия. */
  M.stableTh = (pt) => (pt.group === 'dementia_mild' ? Math.max(30, Math.min(48, pt.sev0 + 3)) : 25);
  M.canClose = function (s, pt) {
    if (pt.pending) return { ok: false, why: 'Сначала разберитесь со срочной ситуацией.' };
    if (pt.away) return { ok: false, why: 'Пациент сейчас в стационаре.' };
    const days = bio(pt.care.remDays);
    const dem = pt.group === 'dementia_mild';
    if (pt.sev >= M.stableTh(pt)) return { ok: false, why: 'Состояние ещё не стабильно.' };
    if (days < 28) return { ok: false, why: dem ? 'Состояние стабильно меньше месяца лечения — рано.' : 'Ремиссия держится меньше месяца лечения — рано.' };
    const drugs = pt.rx.filter((r) => r.kind !== 'int' && !r.prn).map((r) => P().drug(r.id)).filter(Boolean);
    const bz = pt.rx.find((r) => r.kind !== 'int' && !r.prn && (P().drug(r.id).cls === 'bzd' || P().drug(r.id).cls === 'z') && bio(s.day - r.since) > 28);
    if (bz && pt.group !== 'alcohol_dependence') return { ok: false, why: 'Сначала завершите постепенную отмену: ' + P().drug(bz.id).name.toLowerCase() + '.' };
    const same = (g) => drugs.filter((d) => d.group === g).length >= 2;
    if (same('antidepressant') || same('antipsychotic') || drugs.filter((d) => d.group === 'moodstab').length >= 2) return { ok: false, why: 'Идёт перекрёстная смена препаратов — сначала завершите её.' };
    if (pt.rx.some((r) => r.held)) return { ok: false, why: 'Есть приостановленный препарат — решите, возобновлять ли его.' };
    return { ok: true };
  };

  M.q = {
    on: (pt, id) => pt.rx.some((r) => r.id === id && !r.held),
    dose: (pt, id) => {
      const r = pt.rx.find((x) => x.id === id);
      return r ? r.dose : 0;
    },
    cls: (pt, list) => pt.rx.some((r) => {
      const d = r.kind === 'int' ? null : P().drug(r.id);
      return d && list.indexOf(d.cls) >= 0;
    }),
    tested: (pt, test) => pt.tests.some((t) => t.test === test && !t.pre && t.day >= pt.admitDay),
    talked: (pt, k) => pt.talks[k] != null,
    ever: (pt, ids) => pt.rx.some((r) => ids.indexOf(r.id) >= 0 && !r.pre && !r.hosp) || pt.log.some((l) => ids.some((id) => (P().drug(id) || P().int(id)) && l.text.indexOf('Назначено: ' + ((P().drug(id) || P().int(id)).name.toLowerCase())) === 0)),
    everCls: (pt, list) => pt.log.some((l) => /^Назначено: /.test(l.text) && (D().drugs || []).some((d) => list.indexOf(d.cls) >= 0 && l.text.indexOf('Назначено: ' + d.name.toLowerCase()) === 0)),
    homeOff: (pt, tag) => !pt.meds_home.some((m) => m.tag === tag),
    depotOk: (pt) => {
      const r = pt.rx.find((x) => x.route === 'depot');
      return !!r && W().depotCover(A.state, pt, r) >= 0.99 && !pt.flags.relapsed;
    },
  };

  /** Итоговая оценка ведения. how: rare (перевод на редкие визиты) | transfer (передан коллеге) | hospital. */
  M.score = function (s, pt, how) {
    const t = tpl(pt);
    const g = P().group(pt);
    let outcome;
    if (pt.group === 'dementia_mild') outcome = U.clamp(Math.round(100 - Math.max(0, pt.sev - pt.sev0) * 5), 0, 100);
    else if (pt.sev0 < 35) outcome = U.clamp(Math.round(100 - Math.max(0, pt.care.sevMax - 35) * 2.2 - (pt.flags.relapsed ? 20 : 0)), 0, 100);
    else {
      const imp = (pt.sev0 - pt.sev) / Math.max(1, pt.sev0);
      const target = Math.max(0.3, (pt.sev0 - 20) / pt.sev0);
      const w = how === 'transfer' ? U.clamp(bio(s.day - pt.admitDay) / 40, 0.3, 1) : 1;
      outcome = U.clamp(Math.round((imp / (target * w)) * 87), 0, 100);
    }
    const r = pt.rev;
    let kr = U.clamp(Math.round(100 - r.warn * 8 - r.err * 22 + r.ok), 0, 100);
    if (t.kind === 'new' && !pt.flags.firstLine && P().gl(pt)) kr = Math.max(0, kr - (pt.flags.secondLine ? 12 : 30));
    if (pt.dxOk === false) kr = Math.max(0, kr - 25);
    else if (pt.dxOk === 'part') kr = Math.max(0, kr - 10);
    const safety = U.clamp(100 - pt.harm * 22 - pt.wrong * 14 - pt.missed * 8 - (pt.flags.illegal ? 25 : 0), 0, 100);
    const mon = U.clamp(100 - Object.keys(pt.monMissed).length * 15, 0, 100);
    const adh = pt.care.adhN ? pt.care.adhSum / pt.care.adhN : 1;
    const care = U.clamp(Math.round(100 - pt.care.warns * 7 - pt.care.errs * 18 - pt.care.noShow * 4 + pt.care.oks * 2 - (adh < 0.7 ? 15 : 0)), 0, 100);
    const issues = (t.issues || []).map((x) => {
      let ok = false;
      try {
        ok = !!x.check(s, pt, M.q);
      } catch (e) {
        ok = false;
      }
      return { id: x.id, text: x.text, ok, msg: ok ? x.ok : x.bad };
    });
    const bad = issues.filter((x) => !x.ok).length;
    let total = U.clamp(Math.round(0.3 * outcome + 0.35 * kr + 0.15 * safety + 0.1 * mon + 0.1 * care + issues.filter((x) => x.ok).length * 3 - bad * 10 - 3 * r.err - 4 * pt.harm), 0, 100);
    total = Math.min(total, 30 + outcome);
    const slips = pt.harm + r.err + (r.major || 0) + pt.wrong + (pt.flags.illegal ? 1 : 0);
    if (slips >= 2) total = Math.min(total, 74);
    else if (slips >= 1) total = Math.min(total, 84);
    if (bad) total = Math.min(total, 84 - (bad - 1) * 10);
    if (pt.dxOk === false) total = Math.min(total, 69);
    return { total, outcome, kr, safety, mon, care, issues, adh: Math.round(adh * 100), days: s.day - pt.admitDay, visits: pt.visits.filter((v) => v.kind !== 'past' && v.kind !== 'noshow').length };
  };

  /** Перевести на редкие визиты / передать коллеге. */
  M.close = function (s, pt, how) {
    const sc = M.score(s, pt, how);
    pt.done = true;
    pt.endDay = s.day;
    pt.how = how;
    pt.result = sc;
    const w = M.ensure(s);
    w.done.push({ uid: pt.uid, tpl: pt.tpl, name: pt.name, age: pt.age, sex: pt.sex, dx: pt.dx, group: pt.group, start: pt.admitDay, end: s.day, how, score: sc.total, look: pt.look, issues: sc.issues, rev: pt.rev.list.slice(-10), visits: sc.visits });
    if (w.done.length > 60) w.done.splice(0, w.done.length - 60);
    if (how === 'rare') {
      const Gm = G();
      Gm.apply(s, { xp: Math.round(20 + sc.total / 2), stress: sc.total >= 70 ? -3 : 1 });
      Gm.learn(s, P().group(pt).topic, sc.total >= 70 ? 2 : 1);
      s.stats.ambDone = (s.stats.ambDone || 0) + 1;
      if (sc.total >= 85) s.stats.ambGood = (s.stats.ambGood || 0) + 1;
      if ((s.stats.ambGood || 0) >= 5) Gm.unlock(s, 'amb_good');
      if (pt.tpl === 'a_gad_bzd' || pt.tpl === 'a_insomnia') {
        const iss = sc.issues.find((x) => x.id === 'taper' || x.id === 'z');
        if (iss && iss.ok) Gm.unlock(s, 'bzd_taper');
      }
    }
    return sc;
  };

  /** Сменил работу или ушёл в отпуск надолго: пациентов принимает коллега. */
  M.handoverAll = function (s, why) {
    const act = M.active(s);
    if (!act.length) return 0;
    act.forEach((pt) => M.close(s, pt, 'transfer'));
    M.archiveDone(s);
    if (s.amb) s.amb.seeded = null;
    if (why) G().say(s, why + ' ' + U.cap(U.plural(act.length, ['передан', 'переданы', 'переданы'])) + ' ' + act.length + ' ' + U.plural(act.length, ['пациент', 'пациента', 'пациентов']) + ' участка.', 'info');
    return act.length;
  };

  /** День «на автопилоте» или в отпуске: коллега продлевает назначения без изменений. */
  /** blame — звонки «проспал» сам врач (работа на автопилоте), а не коллега в его отпуск. */
  M.autoDay = function (s, who, blame) {
    M.active(s).forEach((pt) => {
      if (pt.away) return;
      if (pt.pending && s.day - pt.pending.day >= 1) autoResolve(s, pt, !blame);
      if (pt.next > s.day) return;
      pt.visits.push({ day: s.day, kind: 'auto', who: who || 'Коллега', text: 'Приём без изменений: назначения продлены.' });
      pt.next = s.day + 14;
      pt.prevSev = pt.sev;
      // плановая инъекция всё равно делается
      pt.rx.forEach((r) => {
        if (r.route === 'depot') r.lastInj = s.day;
      });
    });
  };

  /** Итог дня приёма для расчётов и ленты. */
  M.dayResult = function (s, p) {
    const seen = Object.keys(p.done || {});
    const scores = seen.map((u) => p.done[u]).filter((x) => typeof x === 'number');
    return { kind: 'amb', visits: seen.length, avg: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0, calls: p.calls || 0, pay: p.pay || 0, closed: p.closed || 0 };
  };
})((window.A = window.A || {}));
