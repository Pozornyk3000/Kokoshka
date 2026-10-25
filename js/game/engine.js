/* Движок: состояние, время, сон, недельный расчёт, фазы игры, план активностей, концовки. */
(function (A) {
  'use strict';
  const U = A.util;
  const C = A.cal;
  const D = A.data;
  const G = (A.game = A.game || {});

  G.CREDIT_LIMIT = -30000;
  G.EXAM_DAYS = { exam1: 22, exam2: 24, accr: 26 };

  /* ---------- Новое состояние ---------- */
  G.newState = function (opt) {
    const bg = D.backgrounds[opt.background] || D.backgrounds.excellent;
    const know = {};
    D.domainKeys.forEach((k) => {
      know[k] = 10 + (bg.know.all || 0) + (bg.know[k] || 0);
    });
    const s = {
      v: 1,
      id: U.uid(),
      createdAt: Date.now(),
      savedAt: Date.now(),
      player: {
        name: (opt.name || 'Саша').trim().slice(0, 24) || 'Саша',
        gender: opt.gender === 'f' ? 'f' : 'm',
        background: opt.background,
        dream: opt.dream,
      },
      mode: opt.mode === 'doctor' ? 'doctor' : 'full',
      difficulty: D.difficulty && D.difficulty[opt.difficulty] ? opt.difficulty : 'normal',
      day: 1,
      slot: 0,
      money: bg.money,
      energy: 92,
      stress: 18,
      health: 82,
      rep: bg.rep,
      xp: 0,
      know,
      phase: 'study',
      study: { lectures: {}, seminars: {}, debts: [], rating: 0, ratingMax: 0, exams: {}, automat: null, diploma: null, accr: null },
      ward: A.ward ? A.ward.blank() : null,
      amb: A.clinic ? A.clinic.blank() : null,
      career: null,
      science: { pubs: 0, draft: 0, talk: false },
      housing: 'dorm',
      food: 'normal',
      items: {},
      flags: {},
      daily: { pets: 0, coffee: 0 },
      weekly: { mom: 0, therapy: 0, tutor: 0 },
      burnout: { active: false, streak: 0, days: 0, episodes: 0, calm: 0 },
      seen: { cases: {}, minis: {}, events: {} },
      caseLog: [],
      stats: {
        cases: 0,
        dxRight: 0,
        earned: 0,
        nights: 0,
        courier: 0,
        pets: 0,
        therapy: 0,
        ethics: 0,
        perfect: 0,
        askSuicide: 0,
        workdays: 0,
        skips: 0,
        minis: 0,
        minisRight: 0,
      },
      ach: {},
      week: { n: 1, income: [], expense: [] },
      log: [],
      feed: [],
      delta: null,
      activity: null,
      place: 'home',
      ended: null,
      acc: { health: 0 },
    };
    if (s.mode === 'doctor') G.setupDoctor(s);
    return s;
  };

  /** Режим «Старт с врача»: ординатура позади — диплом, аккредитация и знания выпускника,
      впереди выбор работы. Оценки в дипломе зависят от предыстории. Даты — прошлого лета. */
  G.setupDoctor = function (s) {
    const bg = G.bg(s);
    const dc = bg.doctor || { grades: { exam1: 4, practice: 4, gia: 4, accr: 4 }, accrPct: 80 };
    const g = dc.grades;
    s.phase = 'graduate';
    D.domainKeys.forEach((k) => (s.know[k] = U.clamp(s.know[k] + 24, 0, 100)));
    s.money += 18000;
    s.rep += 6;
    s.xp = 400;
    s.stress = 22;
    s.housing = 'room';
    const pct = (gr) => (gr >= 5 ? 90 : gr >= 4 ? 78 : 62);
    const ex = (gr, p, date) => ({ grade: gr, attempts: 1, lastDay: null, date, pct: p });
    s.study.exams = { exam1: ex(g.exam1, pct(g.exam1), '16 июня'), exam2: ex(g.gia, pct(g.gia), '27 июня'), accr: ex(g.accr, dc.accrPct, '11 июля') };
    if (s.ward) Object.assign(s.ward.practice, { closed: true, grade: g.practice, pre: true, date: '30 мая' });
    if (A.exams) {
      const d = A.exams.issueDiploma(s);
      d.day = null;
      d.date = '30 июня';
    }
    s.study.accr = { day: null, date: '11 июля', pct: dc.accrPct, testPct: Math.min(100, dc.accrPct + 3) };
    return s;
  };
  /** Сложность: easy | normal | hard (сложная — диагноз из полного списка МКБ-10, без подсказок). */
  G.difficulty = (s) => (s && D.difficulty && D.difficulty[s.difficulty] ? s.difficulty : 'normal');
  G.hard = (s) => G.difficulty(s) === 'hard';
  /** Начальные сцены новой игры: пролог ординатуры или первый день врача. */
  G.prologue = function (s) {
    if (s.mode === 'doctor') return [{ type: 'story', story: 'doctor_home' }, { type: 'story', story: 'doctor_offers' }, { type: 'jobs' }];
    return [{ type: 'story', story: 'prologue_home' }, { type: 'story', story: 'prologue_dept' }];
  };
  /** Дата записи: игровой день или текст (для документов, выданных до начала игры). */
  G.when = (day, text) => (typeof day === 'number' && day > 0 ? C.fmtDate(day) : text || '');

  /* ---------- Справочные функции ---------- */
  G.bg = (s) => D.backgrounds[s.player.background] || D.backgrounds.excellent;
  G.maxEnergy = (s) => G.bg(s).maxEnergy || 100;
  G.knowAvg = function (s) {
    const ks = D.domainKeys;
    return ks.reduce((a, k) => a + (s.know[k] || 0), 0) / ks.length;
  };
  /** Опыт, набранный уже врачом: категории растут только от практики. */
  G.careerXp = (s) => (s.career ? Math.max(0, s.xp - (s.career.xp0 || 0)) : 0);
  G.rankIndex = function (s) {
    const xp = G.careerXp(s);
    let r = 0;
    D.ranks.forEach((x, i) => {
      if (xp >= x.xp) r = i;
    });
    return r;
  };
  G.rank = (s) => D.ranks[G.rankIndex(s)];
  /** Зачёт по производственной (клинической) практике — условие допуска к ГИА. */
  G.practiceCredit = (s) => !!(A.ward && A.ward.practiceCredit(s));
  G.gradeAvg = function (s) {
    const g = ['exam1', 'exam2', 'accr'].map((k) => s.study.exams[k] && s.study.exams[k].grade).filter((x) => x >= 3);
    if (!g.length) return 0;
    return g.reduce((a, b) => a + b, 0) / g.length;
  };
  G.scheduleFor = (day) => (D.schedule || []).find((x) => x.day === day) || null;
  G.isStudyDay = (s, day) => s.phase === 'study' && !!G.scheduleFor(day == null ? s.day : day);
  G.isWorkday = (s, day) => s.phase === 'career' && !!s.career && !C.isWeekend(day == null ? s.day : day);
  G.job = (s) => (s.career ? D.jobs[s.career.job] : null);
  G.isSick = (s) => (s.flags.sick || 0) > 0;
  G.inDebt = (s) => s.study.debts.length > 0;
  G.homeScene = (s) => (s.housing === 'dorm' ? 'dorm' : s.housing === 'room' ? 'room' : 'studio');
  G.she = (s) => s.player.gender === 'f';

  /* ---------- Изменение показателей ---------- */
  G.apply = function (s, eff, label) {
    const d = {};
    if (!eff) return d;
    const bg = G.bg(s);
    const burn = s.burnout.active;
    if (eff.energy) {
      const b = s.energy;
      s.energy = U.clamp(s.energy + eff.energy, 0, G.maxEnergy(s));
      d.energy = s.energy - b;
    }
    if (eff.stress) {
      let v = eff.stress;
      if (v > 0) v *= (1 - (bg.stressResist || 0)) * (burn ? 1.25 : 1);
      else if (burn) v *= 0.75;
      const b = s.stress;
      s.stress = U.clamp(s.stress + v, 0, 100);
      d.stress = s.stress - b;
    }
    if (eff.health) {
      const b = s.health;
      s.health = U.clamp(s.health + eff.health, 0, 100);
      d.health = s.health - b;
    }
    if (eff.rep) {
      let v = eff.rep;
      if (v > 0 && s.items.suit) v *= 1.15;
      const b = s.rep;
      s.rep = U.clamp(s.rep + v, 0, 100);
      d.rep = s.rep - b;
    }
    if (eff.xp) {
      s.xp += eff.xp;
      d.xp = eff.xp;
    }
    if (eff.money) {
      s.money += eff.money;
      d.money = eff.money;
      const row = [label || (eff.money > 0 ? 'Доход' : 'Расход'), Math.abs(eff.money)];
      (eff.money > 0 ? s.week.income : s.week.expense).push(row);
      if (eff.money > 0) s.stats.earned += eff.money;
    }
    if (eff.know) {
      d.know = {};
      Object.keys(eff.know).forEach((k) => {
        if (!(k in s.know)) return;
        let v = eff.know[k];
        if (v > 0) {
          v *= 1 + (bg.studyBonus || 0);
          if (burn) v *= 0.7;
          if (k === 'pharm' && s.items.pharmguide) v *= 1.5;
        }
        const b = s.know[k];
        s.know[k] = U.clamp(s.know[k] + v, 0, 100);
        d.know[k] = s.know[k] - b;
      });
    }
    return d;
  };

  G.snap = (s) => ({
    energy: s.energy,
    stress: s.stress,
    health: s.health,
    money: s.money,
    rep: s.rep,
    xp: s.xp,
    know: Object.assign({}, s.know),
  });
  G.diff = function (a, s) {
    if (!a) return null;
    const d = {
      energy: s.energy - a.energy,
      stress: s.stress - a.stress,
      health: s.health - a.health,
      money: s.money - a.money,
      rep: s.rep - a.rep,
      xp: s.xp - a.xp,
      know: 0,
    };
    D.domainKeys.forEach((k) => (d.know += (s.know[k] || 0) - (a.know[k] || 0)));
    return d;
  };

  /* ---------- Лента событий ---------- */
  G.say = function (s, text, kind) {
    if (!text) return;
    const e = { day: s.day, slot: s.slot, text, kind: kind || '' };
    s.feed.push(e);
    if (s.feed.length > 12) s.feed.splice(0, s.feed.length - 12);
    s.log.push(e);
    if (s.log.length > 80) s.log.splice(0, s.log.length - 80);
  };
  G.finishText = function (s, text, snap) {
    if (text) G.say(s, text);
    s.delta = G.diff(snap, s);
  };

  /* ---------- Время ---------- */
  G.advance = function (s, n, opt) {
    opt = opt || {};
    for (let i = 0; i < n; i++) {
      G.closeSlot(s);
      if (s.slot >= 3) {
        G.newDay(s, opt.sleep || 'none', opt);
        return;
      }
      s.slot++;
    }
  };

  /** Проверка обязательств уходящей части дня. */
  G.closeSlot = function (s) {
    if (G.isSick(s)) return;
    const sch = G.scheduleFor(s.day);
    if (s.phase === 'study' && sch) {
      if (s.slot === 0 && !s.study.lectures[sch.lecture]) {
        s.study.debts.push({ type: 'lecture', id: sch.lecture, day: s.day });
        s.stats.skips++;
        G.apply(s, { rep: -1 });
        const L = A.data.lectureById[sch.lecture];
        G.say(s, 'Лекция «' + (L ? L.title : '') + '» прошла без тебя. В журнале — «н», а значит, будет отработка.', 'warn');
      }
      if (s.slot === 1 && !s.study.seminars[sch.day]) {
        s.study.debts.push({ type: 'seminar', id: sch.seminar, day: s.day });
        s.stats.skips++;
        G.apply(s, { rep: -1 });
        G.say(s, 'Семинар у Кандинского прошёл без тебя. Он отметил «н» и пообещал, что отработка будет «познавательной».', 'warn');
      }
    }
    if (G.isWorkday(s) && s.slot === 1 && s.career.today !== s.day && s.career.off !== s.day) {
      s.career.missed = (s.career.missed || 0) + 1;
      G.apply(s, { rep: -6, stress: 5 });
      G.say(s, 'Ты не {пришёл|пришла} на работу и никого не {предупредил|предупредила}. Заведующий звонил трижды. Прогул не оплачивается, а репутация страдает.', 'warn');
    }
  };

  G.newDay = function (s, sleep, opt) {
    opt = opt || {};
    const prevDay = s.day;
    const housing = D.housing[s.housing];
    const food = D.food[s.food];
    const maxE = G.maxEnergy(s);
    const parts = [];

    if (sleep === 'full' || sleep === 'short') {
      let e = 62 + housing.sleep + food.energy;
      if (s.items.earplugs) e += 5;
      if (s.items.mattress) e += 10;
      if (opt.early) e += 10;
      if (sleep === 'short') e -= 22;
      if (s.stress > 80) e -= 18;
      else if (s.stress > 60) e -= 9;
      if (s.health < 40) e -= 10;
      if (s.flags.hangover) e -= 15;
      if (s.housing === 'dorm' && !s.items.earplugs && U.chance(0.18)) {
        e -= 12;
        parts.push('Сосед полночи играл «Группу крови» на гитаре. Выспаться не вышло.');
      }
      s.energy = U.clamp(Math.max(e, s.energy + 12), 0, maxE);
      G.apply(s, { stress: -(7 + housing.relief + (opt.early ? 4 : 0)) });
      if (s.food !== 'cheap') s.acc.health += 0.4;
    } else {
      s.energy = U.clamp(s.energy + 8, 0, maxE);
      G.apply(s, { stress: 6, health: -3 });
      s.flags.noSleep = true;
    }

    // Фоновый стресс жизни: счета, дорога, сессия, долги
    G.apply(s, { stress: (s.phase === 'session' ? 5 : 3) + (s.money < 0 ? 4 : 0) });
    s.acc.health += food.health;
    if (s.stress >= 80) s.acc.health -= 2;
    else if (s.stress >= 65) s.acc.health -= 1;
    if (s.acc.health >= 1 || s.acc.health <= -1) {
      const whole = Math.trunc(s.acc.health);
      s.acc.health -= whole;
      G.apply(s, { health: whole });
    }

    // Выгорание
    const b = s.burnout;
    if (s.stress >= 85) b.streak++;
    else b.streak = Math.max(0, b.streak - 1);
    let burnoutStory = null;
    if (!b.active && b.streak >= 3) {
      b.active = true;
      b.days = 0;
      b.calm = 0;
      b.episodes++;
      G.unlock(s, 'burnout');
      burnoutStory = 'burnout_start';
    } else if (b.active) {
      b.days++;
      if (s.stress < 40) b.calm++;
      else b.calm = Math.max(0, b.calm - 1);
      if (b.calm >= 4) {
        b.active = false;
        b.streak = 0;
        G.unlock(s, 'recovered');
        burnoutStory = 'burnout_end';
      }
    }

    // Больничный
    if (s.flags.sick > 0) s.flags.sick--;
    let sickStory = null;
    if (s.health <= 8 && !G.isSick(s)) {
      s.flags.sick = 3;
      sickStory = true;
      G.apply(s, { health: 25 });
    }

    // Новый день
    s.day++;
    s.slot = 0;
    s.daily = { pets: 0, coffee: 0 };
    s.flags.hangover = false;
    s.flags.wokeTired = !!s.flags.noSleep;
    s.flags.noSleep = false;
    if (s.items.coffee) G.apply(s, { energy: 8 });
    if (G.isSick(s) && G.isWorkday(s)) s.career.weekSick = (s.career.weekSick || 0) + 1;

    const steps = [];
    // Пациенты в отделении живут своей жизнью и без врача
    if (A.ward && s.ward) A.ward.tick(s, steps);
    // и пациенты амбулаторного участка — между визитами
    if (A.clinic && s.amb) A.clinic.tick(s);
    // Неделя закончилась
    if (C.wd(s.day) === 0) {
      const sum = G.settleWeek(s, prevDay);
      steps.push({ type: 'payslip', data: sum });
    }
    if (sickStory) steps.push({ type: 'story', story: 'sick' });
    if (burnoutStory) steps.push({ type: 'story', story: burnoutStory });
    G.phaseTick(s, steps);
    if (s.flags.swapNight && s.flags.swapNight < s.day) {
      s.flags.swapNight = null;
      G.apply(s, { rep: -3 });
      parts.push('Марат так и не дождался подмены: дежурство за него никто не вышел. Он пишет короткое «понятно».');
    }
    const ev = A.events && !opt.vacation ? A.events.morning(s) : null;
    if (ev) steps.push({ type: 'event', id: ev });

    G.say(s, G.morningText(s, parts), 'morning');

    if (C.wd(s.day) === 0) A.store.checkpoint(s);

    if (steps.length) G.queue(s, steps, 'morning');
  };

  G.morningText = function (s, extra) {
    const out = [];
    const e = s.energy;
    const head = '**' + U.cap(C.fmt(s.day)) + '.** ';
    let line;
    if (s.flags.wokeTired) line = 'Ночь без сна даёт о себе знать: голова гудит, кофе не помогает.';
    else if (e >= 85) line = 'Ты просыпаешься раньше будильника — бодр{ый|ая} и почти счастлив{ый|ая}.';
    else if (e >= 65) line = 'Будильник, второй будильник, подъём. В целом жить можно.';
    else if (e >= 45) line = 'Встаёшь с трудом. Хочется ещё часик, а лучше — неделю.';
    else line = 'Ты будто не спал{|а} вовсе. Тело ватное, мысли вязкие.';
    if (s.burnout.active) line += ' Работа кажется бессмысленной, пациенты — бесконечными. Это выгорание, и с ним надо что-то делать.';
    if (G.isSick(s)) line = 'Ты на больничном. Температура, слабость, Кокошка греет ноги.';
    out.push(head + line);
    (extra || []).forEach((x) => out.push(x));
    const hint = G.dayHint(s);
    if (hint) out.push(hint);
    return out.join('\n\n');
  };

  G.dayHint = function (s) {
    const sch = G.scheduleFor(s.day);
    if (s.phase === 'study' && sch) {
      const L = A.data.lectureById[sch.lecture];
      return 'Сегодня по расписанию: лекция «' + (L ? L.title : '') + '» и семинар у Кандинского.';
    }
    if (s.phase === 'study' && C.isWeekend(s.day)) return 'Выходной. Можно подработать, выспаться или наконец-то открыть учебник.';
    if (s.phase === 'session') {
      const ex = G.examOnDay(s.day);
      if (ex) return 'Сегодня — ' + A.exams.title(ex) + '. Начало в 9:00, аудитория 3.';
      return 'Сессия. До следующего экзамена ' + G.daysToNextExam(s) + '.';
    }
    if (s.phase === 'career' && G.isWorkday(s)) {
      const job = G.job(s);
      return 'Рабочий день. ' + job.role + ', ' + job.name + '.';
    }
    if (s.phase === 'career') return 'Выходной. Можно отдохнуть или взять подработку.';
    return '';
  };

  G.examOnDay = function (day) {
    for (const k in G.EXAM_DAYS) if (G.EXAM_DAYS[k] === day) return k;
    return null;
  };
  G.daysToNextExam = function (s) {
    let best = null;
    for (const k in G.EXAM_DAYS) {
      const d = G.EXAM_DAYS[k];
      if (d >= s.day && !(s.study.exams[k] && s.study.exams[k].grade >= 3)) {
        if (best == null || d < best) best = d;
      }
    }
    if (best == null) return 'пересдачи';
    const n = best - s.day;
    return n + ' ' + U.plural(n, ['день', 'дня', 'дней']);
  };

  /* ---------- Недельный расчёт ---------- */
  G.settleWeek = function (s, lastDay) {
    const housing = D.housing[s.housing];
    const food = D.food[s.food];
    const bg = G.bg(s);
    const accrual = [];
    const charges = [];
    if (s.phase !== 'career') accrual.push(['Стипендия ординатора', 2600]);
    if (s.career) {
      const job = G.job(s);
      const worked = Math.min(5, s.career.weekWorked || 0);
      const sickDays = Math.min(5 - worked, s.career.weekSick || 0);
      const mult = G.rank(s).mult;
      const pay = Math.round(((job.salary * mult) / 5) * worked);
      if (pay > 0) accrual.push(['Зарплата: ' + worked + ' ' + U.plural(worked, ['рабочий день', 'рабочих дня', 'рабочих дней']), pay]);
      if (sickDays > 0) accrual.push(['Больничный: ' + sickDays + ' дн.', Math.round(((job.salary * mult) / 5) * sickDays * 0.8)]);
      if (s.career.weekBonus) accrual.push(['Премия', s.career.weekBonus]);
      if (pay > 0 && !s.ach.first_salary) G.unlock(s, 'first_salary');
      s.career.weekWorked = 0;
      s.career.weekSick = 0;
      s.career.weekBonus = 0;
    }
    charges.push([housing.name + ' — аренда', housing.rent]);
    let foodCost = food.cost;
    if (bg.parcels && s.food !== 'healthy') foodCost = Math.round(foodCost * 0.75);
    charges.push(['Еда: ' + food.name.toLowerCase(), foodCost]);
    charges.push(['Проезд', s.items.bike ? 300 : D.weekly.transport]);
    charges.push(['Связь и интернет', D.weekly.phone]);
    charges.push(['Корм и наполнитель для Кокошки', D.weekly.cat]);
    if (s.money < 0) charges.push(['Проценты по кредитке', Math.round(Math.abs(s.money) * 0.03)]);

    const gigs = s.week.income.slice();
    const spent = s.week.expense.slice();
    const startMoney = s.money;
    accrual.forEach(([l, v]) => G.apply(s, { money: v }, l));
    charges.forEach(([l, v]) => G.apply(s, { money: -v }, l));

    const sum = {
      week: s.week.n,
      until: lastDay,
      gigs,
      spent,
      accrual,
      charges,
      before: startMoney,
      after: s.money,
      net: gigs.reduce((a, r) => a + r[1], 0) - spent.reduce((a, r) => a + r[1], 0) + accrual.reduce((a, r) => a + r[1], 0) - charges.reduce((a, r) => a + r[1], 0),
    };
    s.week = { n: s.week.n + 1, income: [], expense: [] };
    s.weekly = { mom: 0, therapy: 0, tutor: 0 };
    if (s.money < G.CREDIT_LIMIT) {
      if (!s.flags.bailout) {
        s.flags.bailout = true;
        sum.bailout = true;
        G.apply(s, { money: 45000, stress: 8 }, 'Родители закрыли долг');
        sum.after = s.money;
      } else {
        sum.broke = true;
        s.flags.broke = true;
      }
    }
    return sum;
  };

  /* ---------- Фазы и сюжет ---------- */
  G.phaseTick = function (s, steps) {
    if (s.phase === 'study' && s.day >= 22) {
      s.phase = 'session';
      steps.push({ type: 'story', story: 'session_start' });
      if (s.study.ratingMax > 0 && s.study.rating / s.study.ratingMax >= 0.85 && !s.study.debts.length) {
        s.study.automat = 'offered';
      }
    }
    if (s.flags.dormUntil && s.housing === 'dorm' && s.day >= s.flags.dormUntil) {
      s.housing = 'room';
      s.flags.dormUntil = null;
      G.apply(s, { money: -D.housing.room.move }, 'Срочный переезд');
      steps.push({ type: 'story', story: 'dorm_evicted' });
    }
    const st = A.stories && A.stories.scheduled(s);
    if (st) steps.push({ type: 'story', story: st });
  };

  /** Начать карьеру после выбора работы. */
  G.startCareer = function (s, jobId) {
    s.phase = 'career';
    s.career = {
      job: jobId,
      since: s.day,
      today: null,
      off: null,
      weekWorked: 0,
      weekSick: 0,
      weekBonus: 0,
      missed: 0,
      reviews: [],
      lastVacation: s.day,
      xp0: s.xp,
    };
    const avg = G.gradeAvg(s);
    G.apply(s, { rep: avg >= 4.75 ? 15 : avg >= 4 ? 8 : avg >= 3 ? 3 : 0 });
    if (s.housing === 'dorm') s.flags.dormUntil = s.day + 16;
  };

  /* ---------- План активностей ---------- */
  G.queue = function (s, steps, action, extra) {
    if (s.activity) {
      s.activity.steps.push.apply(s.activity.steps, steps);
      return;
    }
    s.activity = Object.assign({ action: action || 'system', steps, i: 0, results: [], snap: G.snap(s), dur: 0 }, extra || {});
  };

  G.perform = function (id, arg) {
    const s = A.state;
    const a = A.actions.byId[id];
    if (!a || s.activity || s.ended) return;
    const st = G.status(s, a);
    if (st.hidden || st.disabled) return;
    const snap = G.snap(s);
    const res = a.run(s, arg) || {};
    const dur = res.dur != null ? res.dur : G.dur(s, a);
    if (res.steps && res.steps.length) {
      s.activity = {
        action: id,
        arg: arg == null ? null : arg,
        steps: res.steps,
        i: 0,
        results: [],
        snap,
        dur,
        sleep: res.sleep || a.sleep || null,
        early: !!res.early,
      };
    } else {
      const sl = res.sleep || a.sleep;
      // Текст «перед сном» остаётся во вчерашнем дне, утром первым идёт утренний текст
      if (sl === 'full' || sl === 'short') {
        G.say(s, res.text);
        if (dur > 0) G.advance(s, dur, { sleep: sl, early: res.early });
        G.finishText(s, '', snap);
      } else {
        if (dur > 0) G.advance(s, dur, { sleep: sl, early: res.early });
        G.finishText(s, res.text, snap);
      }
    }
    G.after(s);
    G.save();
  };

  G.stepDone = function (result) {
    const s = A.state;
    const act = s.activity;
    if (!act) return;
    act.results[act.i] = result == null ? null : result;
    act.i++;
    if (act.i >= act.steps.length) G.finishActivity();
    G.save();
  };

  G.finishActivity = function () {
    const s = A.state;
    const act = s.activity;
    if (!act) return;
    s.activity = null;
    let text = '';
    const def = A.actions.byId[act.action];
    if (def && def.finish) text = def.finish(s, act.results, act.arg, act) || '';
    if (act.sleep === 'full' || act.sleep === 'short') {
      G.say(s, text);
      text = '';
    }
    if (act.dur > 0) G.advance(s, act.dur, { sleep: act.sleep, early: act.early });
    G.finishText(s, text, act.snap);
    G.after(s);
  };

  G.dur = function (s, a) {
    if (typeof a.dur === 'function') return a.dur(s);
    return a.dur == null ? 1 : a.dur;
  };

  /* ---------- Доступность действий ---------- */
  G.status = function (s, a) {
    const out = { hidden: false, disabled: false, reason: '', warn: '', primary: false };
    if (a.phases && a.phases.indexOf(s.phase) < 0) return { hidden: true };
    if (a.hide && a.hide(s)) return { hidden: true };
    if (a.slots && a.slots.indexOf(s.slot) < 0) {
      if (a.hideOffSlot) return { hidden: true };
      out.disabled = true;
      out.reason = 'Только ' + a.slots.map((x) => C.SLOTS_LOW[x]).join(' / ');
    }
    if (!out.disabled && a.days === 'weekday' && C.isWeekend(s.day)) {
      out.disabled = true;
      out.reason = 'Только в будни';
    }
    if (!out.disabled && a.days === 'weekend' && !C.isWeekend(s.day)) {
      out.disabled = true;
      out.reason = 'Только в выходные';
    }
    if (!out.disabled && G.isSick(s) && !a.rest) {
      out.disabled = true;
      out.reason = 'Ты на больничном';
    }
    if (!out.disabled && a.energy && a.energy < 0 && s.energy + a.energy < 0) {
      out.disabled = true;
      out.reason = 'Не хватит сил';
    }
    const cost = typeof a.money === 'function' ? a.money(s) : a.money;
    if (!out.disabled && cost && cost < 0 && s.money + cost < G.CREDIT_LIMIT) {
      out.disabled = true;
      out.reason = 'Не хватает денег';
    }
    if (!out.disabled && a.req) {
      const r = a.req(s);
      if (r) {
        out.disabled = true;
        out.reason = r;
      }
    }
    if (!out.disabled && a.warn) out.warn = a.warn(s) || '';
    if (!out.disabled && !out.warn) out.warn = G.obligationWarn(s, a);
    if (a.primary) out.primary = !!a.primary(s);
    return out;
  };

  /** Предупреждение, если действие сорвёт пару или работу. */
  G.obligationWarn = function (s, a) {
    if (a.free || a.keepsObligation) return '';
    const dur = G.dur(s, a);
    if (dur <= 0) return '';
    const sch = G.scheduleFor(s.day);
    if (s.phase === 'study' && sch && !G.isSick(s)) {
      if (s.slot === 0 && !s.study.lectures[sch.lecture]) return 'Пропустишь лекцию';
      if (s.slot === 1 && !s.study.seminars[sch.day]) return 'Пропустишь семинар';
      if (s.slot === 0 && dur > 1 && !s.study.seminars[sch.day]) return 'Пропустишь пары';
    }
    if (G.isWorkday(s) && !G.isSick(s) && s.career.today !== s.day && s.career.off !== s.day && s.slot <= 1) {
      return 'Это прогул работы';
    }
    return '';
  };

  /* ---------- После действия: достижения, мечта, конец игры ---------- */
  G.after = function (s) {
    if (s.money >= 100000) G.unlock(s, 'saver');
    if (s.money >= 1000000) G.unlock(s, 'rich');
    if (D.domainKeys.some((k) => s.know[k] >= 80)) G.unlock(s, 'bookworm');
    if (D.domainKeys.every((k) => s.know[k] >= 60)) G.unlock(s, 'polymath');
    if (s.stats.pets >= 30) G.unlock(s, 'kokoshka');
    if (s.stats.nights >= 10) G.unlock(s, 'night_owl');
    if (s.stats.courier >= 8) G.unlock(s, 'courier');
    if (s.stats.therapy >= 5) G.unlock(s, 'therapy');
    if (s.stats.dxRight >= 25) G.unlock(s, 'diagnostician');
    if (s.stats.askSuicide >= 3) G.unlock(s, 'ask_suicide');
    if (s.stats.ethics >= 3) G.unlock(s, 'ethics');
    if (s.ended) return;
    if (s.phase === 'graduate' && !s.career && !s.activity) G.queue(s, [{ type: 'jobs' }], 'graduation');
    const dream = D.dreams[s.player.dream];
    if (dream && !s.flags.dreamDone && s.phase === 'career' && dream.check(s)) {
      s.flags.dreamDone = true;
      G.unlock(s, 'dream');
      G.queue(s, [{ type: 'ending', id: dream.ending }], 'ending');
      return;
    }
    if (s.burnout.active && s.burnout.days >= 24 && !s.flags.quitWarned) {
      s.flags.quitWarned = true;
      G.queue(s, [{ type: 'ending', id: 'quit' }], 'ending');
      return;
    }
    if (s.flags.broke) {
      s.flags.broke = false;
      G.queue(s, [{ type: 'ending', id: 'debt' }], 'ending');
    }
  };

  G.unlock = function (s, id) {
    if (s.ach[id] || !D.achievements[id]) return false;
    s.ach[id] = s.day;
    s.flags.newAch = (s.flags.newAch || []).concat([id]);
    return true;
  };

  /* ---------- Сохранение ---------- */
  G.save = function () {
    if (A.state) A.store.save(A.state);
  };

  /* ---------- Выбор клинических случаев ---------- */
  G.pickCase = function (s, settings, opt) {
    opt = opt || {};
    const pool = A.data.cases.filter((c) => {
      if (opt.exclude && opt.exclude.indexOf(c.id) >= 0) return false;
      if (opt.topics && opt.topics.indexOf(c.topic) < 0) return false;
      if (settings && !c.settings.some((x) => settings.indexOf(x) >= 0)) return false;
      if (c.seminarOnly && !s.seen.cases[c.id]) return false;
      return true;
    });
    if (!pool.length) return null;
    const picked = U.weighted(pool, (c) => (s.seen.cases[c.id] ? 1 : 6) * (opt.preferUnseen === false ? 1 : 1));
    return picked ? picked.id : null;
  };
  G.pickMinis = function (s, tags, n) {
    const pool = A.data.minis.filter((m) => m.tags.some((t) => tags.indexOf(t) >= 0) && (!m.cond || m.cond(s)));
    const out = [];
    const used = {};
    for (let i = 0; i < n && pool.length; i++) {
      const m = U.weighted(pool, (x) => (used[x.id] ? 0 : s.seen.minis[x.id] ? 1 : 5));
      if (!m) break;
      used[m.id] = true;
      out.push(m.id);
    }
    return out;
  };
})((window.A = window.A || {}));
