/* Действия игрока по местам: дом, кафедра/работа, подработки, город. */
(function (A) {
  'use strict';
  const U = A.util;
  const C = A.cal;
  const D = A.data;
  const G = A.game;

  const list = [];
  const byId = {};
  function def(a) {
    list.push(a);
    byId[a.id] = a;
  }
  A.actions = { list, byId };

  A.places = {
    home: { name: 'Дом', scene: (s) => G.homeScene(s), tag: (s) => D.housing[s.housing].place },
    uni: { name: 'Кафедра', scene: (s) => (s.phase === 'session' ? 'exam' : s.slot === 0 ? 'lecture' : 'seminar'), tag: () => 'Кафедра психиатрии', phases: ['study', 'session'] },
    work: { name: 'Работа', scene: (s) => (G.job(s) ? G.job(s).scene : 'office'), tag: (s) => (G.job(s) ? G.job(s).place : ''), phases: ['career'] },
    gigs: { name: 'Подработки', scene: (s) => (s.slot === 3 ? 'night' : 'street'), tag: () => 'Подработки' },
    city: { name: 'Город', scene: () => 'street', tag: () => 'Город N' },
  };

  /** Коэффициент усвоения материала от бодрости. */
  G.focus = function (s) {
    let f = s.energy >= 50 ? 1 : s.energy >= 25 ? 0.7 : 0.45;
    if (s.stress > 75) f *= 0.8;
    if (s.flags.wokeTired) f *= 0.85;
    return f;
  };
  /** Прирост знаний с замедлением ближе к 100. */
  G.learn = function (s, dom, base) {
    const cur = s.know[dom] || 0;
    const v = base * Math.max(0.25, 1 - cur / 130);
    return G.apply(s, { know: { [dom]: v } });
  };
  G.domainPick = function (s, hint) {
    return D.domainKeys.map((k) => ({
      value: k,
      label: D.domains[k].name,
      sub: 'Сейчас: ' + Math.round(s.know[k]) + (hint && hint[k] ? ' · ' + hint[k] : ''),
    }));
  };

  /* ================= ДОМ ================= */
  const SLEEP_LINES = [
    'Ты гасишь свет. Кокошка устраивается в ногах и мурчит, как маленький трактор.',
    'Телефон на зарядке, будильник на 7:10. Последняя мысль перед сном — о сертралине. Профдеформация.',
    'Засыпая, ты мысленно перебираешь синдромы. На «онейроиде» тебя уносит.',
    'Кокошка проверяет, не уснул{|а} ли ты, лапой по лицу. Уснул{|а}.',
  ];
  def({
    id: 'sleep',
    place: 'home',
    title: 'Лечь спать',
    sub: (s) => 'Утром: ' + G.sleepForecast(s) + ' энергии',
    slots: [3],
    rest: true,
    sleep: 'full',
    keepsObligation: true,
    primary: () => true,
    run: () => ({ text: U.pick(SLEEP_LINES) }),
  });
  def({
    id: 'sleep_early',
    place: 'home',
    title: 'Лечь пораньше',
    sub: 'Пропустить вечер и как следует выспаться: +10 энергии к утру',
    slots: [2],
    rest: true,
    dur: 2,
    sleep: 'full',
    keepsObligation: true,
    run: () => ({ text: 'В девять вечера ты уже под одеялом. Соседи по общаге считают тебя странным человеком, и ты с ними согласен{|на}.', early: true }),
  });
  def({
    id: 'nap',
    place: 'home',
    title: 'Вздремнуть',
    sub: '+25 энергии',
    slots: [0, 1, 2],
    rest: true,
    chips: [{ t: '+25 энергии', c: 'pos' }],
    run: (s) => {
      G.apply(s, { energy: 25, stress: -3 });
      return { text: 'Ты падаешь на кровать «на пятнадцать минут». Через полтора часа просыпаешься с отпечатком пледа на щеке.' };
    },
  });
  def({
    id: 'study',
    place: 'home',
    title: 'Читать учебник',
    sub: (s) => (s.items.textbook ? 'С толстым учебником дело идёт быстрее' : 'Выбери тему'),
    slots: [0, 1, 2],
    energy: -15,
    chips: [{ t: '−15 энергии', c: 'neg' }, { t: '+знания', c: 'pos' }],
    req: (s) => (s.energy < 15 ? 'Глаза слипаются' : null),
    pick: (s) => G.domainPick(s),
    run: (s, dom) => {
      if (!D.domains[dom]) dom = 'psychopath';
      const base = 4.2 * (s.items.textbook ? 1.4 : 1) * G.focus(s);
      G.learn(s, dom, base);
      G.apply(s, { energy: -15, stress: 3 });
      return {
        text: U.pick([
          'Два часа над главой «' + D.domains[dom].name + '». Половина понятна, четверть — ещё и запомнилась.',
          'Ты конспектируешь «' + D.domains[dom].name + '» и рисуешь на полях схемы. Кокошка спит на открытой странице.',
          'Тема «' + D.domains[dom].name + '» оказалась интереснее, чем ты думал{|а}. Чай остыл.',
        ]),
      };
    },
  });
  def({
    id: 'cram',
    place: 'home',
    title: 'Зубрить всю ночь',
    sub: 'Много знаний, но утром будешь как зомби',
    slots: [3],
    phases: ['study', 'session'],
    sleep: 'none',
    energy: -15,
    chips: [{ t: 'без сна', c: 'neg' }, { t: '++знания', c: 'pos' }],
    pick: (s) => G.domainPick(s),
    run: (s, dom) => {
      if (!D.domains[dom]) dom = 'psychopath';
      G.learn(s, dom, 8.5 * (s.items.textbook ? 1.4 : 1) * Math.max(0.6, G.focus(s)));
      G.apply(s, { energy: -15, stress: 8 });
      return { text: 'Четыре утра. «' + D.domains[dom].name + '» выучено, кофе выпит, за окном светает. Кокошка смотрит на тебя с осуждением.' };
    },
  });
  def({
    id: 'series',
    place: 'home',
    title: (s) => (s.slot === 3 ? 'Залипнуть в сериал до трёх ночи' : 'Сериал и чай'),
    sub: (s) => (s.slot === 3 ? 'Стресс уйдёт, но выспаться не выйдет' : 'Просто отдохнуть'),
    slots: [2, 3],
    rest: true,
    chips: [{ t: '−10 стресса', c: 'pos' }],
    run: (s) => {
      G.apply(s, { stress: -10, energy: s.slot === 3 ? 0 : 4 });
      return {
        text: U.pick([
          'Ещё одна серия. И ещё одна. Психиатр в сериале снова поставил диагноз по взгляду — ты возмущённо фыркаешь.',
          'Ты смотришь кулинарное шоу и ешь гречку. Иронично, но приятно.',
          'Серия про врачей. Ты пять раз говоришь вслух «так не бывает», и Кокошка уходит в другую комнату.',
        ]),
        sleep: s.slot === 3 ? 'short' : undefined,
      };
    },
  });
  const CAT_LINES = [
    'Кокошка подставляет голову под ладонь и тарахтит. Мир ненадолго становится проще.',
    'Ты гладишь Кокошку. Она делает вид, что ей всё равно, но мурлычет на всю комнату.',
    'Кокошка ложится на тебя всем весом. Это называется «глубокая тактильная стимуляция», и она работает.',
    'Кокошка мнёт лапами твой свитер. Пусть. Свитер не так важен, как окситоцин.',
    'Кокошка долго смотрит тебе в глаза и медленно моргает. По-кошачьи это «я тебе доверяю».',
  ];
  def({
    id: 'pet',
    place: 'home',
    title: 'Погладить Кокошку',
    sub: 'Лучшее средство от стресса без рецепта',
    free: true,
    dur: 0,
    rest: true,
    chips: (s) => [{ t: (s.items.catfood ? '−9' : '−6') + ' стресса', c: 'pos' }],
    req: (s) => (s.daily.pets >= 2 ? 'Кокошка ушла спать на шкаф' : null),
    run: (s) => {
      s.daily.pets++;
      s.stats.pets++;
      G.apply(s, { stress: s.items.catfood ? -9 : -6 });
      return { text: U.pick(CAT_LINES) };
    },
  });
  def({
    id: 'coffee',
    place: 'home',
    title: 'Выпить кофе',
    sub: (s) => (s.items.coffee ? 'Капучино из кофемашины' : 'Растворимый «три в одном»'),
    free: true,
    dur: 0,
    rest: true,
    chips: (s) => [{ t: '+' + (s.items.coffee ? 15 : 10) + ' энергии', c: 'pos' }],
    req: (s) => (s.daily.coffee >= 2 ? 'Третья чашка — уже тахикардия' : s.slot === 3 ? 'Ночью кофе — плохая идея' : null),
    run: (s) => {
      s.daily.coffee++;
      G.apply(s, { energy: s.items.coffee ? 15 : 10, stress: 2 });
      return { text: s.items.coffee ? 'Кофемашина урчит почти как Кокошка. Плотная пенка, правильная горечь.' : 'Растворимый кофе со вкусом картона и надежды. Работает.' };
    },
  });
  def({
    id: 'call_mom',
    place: 'home',
    title: 'Позвонить маме',
    sub: 'Раз в неделю',
    free: true,
    dur: 0,
    rest: true,
    chips: [{ t: '−8 стресса', c: 'pos' }],
    req: (s) => (s.weekly.mom >= 1 ? 'На этой неделе уже {звонил|звонила}' : s.slot === 3 ? 'Мама уже спит' : null),
    run: (s) => {
      s.weekly.mom++;
      const bg = G.bg(s);
      G.apply(s, { stress: -8 });
      let text = U.pick([
        'Мама спрашивает, ешь ли ты суп. Ты врёшь, что ешь. Обе стороны понимают, что это ложь, и всем хорошо.',
        'Полчаса про соседей, давление тёти Любы и погоду. Почему-то после этого становится спокойнее.',
        'Мама рассказывает, что прочитала в интернете про «вредные антидепрессанты». Ты терпеливо объясняешь. Психообразование начинается дома.',
      ]);
      if (bg.momMoney && U.chance(0.5)) {
        G.apply(s, { money: bg.momMoney }, 'Перевод от мамы');
        text += '\n\nПосле разговора приходит перевод: «На витамины. И когда ты уже станешь главврачом?»';
      } else if (bg.parcels && U.chance(0.4)) {
        G.apply(s, { money: 1200 }, 'Мамина посылка (сэкономлено)');
        text += '\n\nМама обещает отправить посылку: варенье, сало и тёплые носки. Минус пара походов в магазин.';
      }
      return { text };
    },
  });
  def({
    id: 'food_plan',
    place: 'home',
    title: 'Питание на неделю',
    sub: (s) => D.food[s.food].name + ' · ' + U.money(D.food[s.food].cost) + ' в неделю',
    free: true,
    dur: 0,
    rest: true,
    pick: (s) =>
      Object.keys(D.food).map((k) => ({
        value: k,
        label: D.food[k].name + ' — ' + U.money(D.food[k].cost) + '/нед.',
        sub: D.food[k].desc + (s.food === k ? ' (сейчас)' : ''),
      })),
    run: (s, f) => {
      if (!D.food[f]) return {};
      s.food = f;
      return { text: 'С этой недели: «' + D.food[f].name + '». ' + D.food[f].desc };
    },
  });

  /* ================= КАФЕДРА ================= */
  def({
    id: 'lecture',
    place: 'uni',
    title: (s) => {
      const sch = G.scheduleFor(s.day);
      const L = sch && D.lectureById[sch.lecture];
      return L ? 'Лекция: ' + L.title : 'Лекция';
    },
    sub: (s) => {
      const sch = G.scheduleFor(s.day);
      const L = sch && D.lectureById[sch.lecture];
      return L ? 'Проф. Корсакова · №' + L.n + ' · ' + D.domains[L.domain].name : '';
    },
    slots: [0],
    phases: ['study'],
    energy: -10,
    keepsObligation: true,
    hideOffSlot: true,
    chips: [{ t: '−10 энергии', c: 'neg' }, { t: '+знания', c: 'pos' }],
    hide: (s) => !G.scheduleFor(s.day),
    req: (s) => (s.study.lectures[G.scheduleFor(s.day).lecture] ? 'Уже {прослушал|прослушала}' : null),
    primary: () => true,
    run: (s) => ({ steps: [{ type: 'lecture', id: G.scheduleFor(s.day).lecture }] }),
    finish: (s, res) => G.finishLecture(s, res[0], false),
  });
  def({
    id: 'seminar',
    place: 'uni',
    title: 'Семинар: разбор пациента',
    sub: 'Доц. Кандинский · клиническая задача в отделении',
    slots: [1],
    phases: ['study'],
    energy: -14,
    keepsObligation: true,
    hideOffSlot: true,
    chips: [{ t: '−14 энергии', c: 'neg' }, { t: '+рейтинг', c: 'pos' }],
    hide: (s) => !G.scheduleFor(s.day),
    req: (s) => (s.study.seminars[s.day] ? 'Семинар уже прошёл' : null),
    primary: () => true,
    run: (s) => ({ steps: [{ type: 'case', id: G.scheduleFor(s.day).seminar, mode: 'seminar' }] }),
    finish: (s, res) => G.finishSeminar(s, res[0], s.day),
  });
  def({
    id: 'ward_round',
    place: 'uni',
    title: 'Обход: мои пациенты',
    sub: (s) => {
      const n = A.ward.active(s).filter((p) => p.mode === 'study').length;
      const urgent = A.ward.active(s).some((p) => p.mode === 'study' && p.pending);
      return 'Курация в отделении кафедры · ' + (n ? n + ' ' + U.plural(n, ['пациент', 'пациента', 'пациентов']) : 'новые поступления') + (urgent ? ' · есть срочное' : '');
    },
    slots: [0, 1, 2],
    days: 'weekday',
    phases: ['study'],
    free: true,
    dur: 0,
    energy: -6,
    chips: [{ t: '−6 энергии', c: 'neg' }, { t: 'практика', c: 'pos' }],
    hide: (s) => !A.ward.practiceOn(s),
    req: (s) => (s.ward && s.ward.lastRound === s.day ? 'Обход сегодня уже был' : null),
    primary: (s) => !(s.ward && s.ward.lastRound === s.day),
    run: (s) => {
      const steps = [];
      if (!s.flags.practiceIntro) steps.push({ type: 'story', story: 'practice_start' });
      steps.push({ type: 'ward', mode: 'study' });
      return { steps };
    },
    finish: (s, res) => {
      s.flags.practiceIntro = true;
      const r = res[res.length - 1] || {};
      G.apply(s, { energy: -6, stress: 2, xp: 4 });
      G.learn(s, 'pharm', 0.6 * G.focus(s));
      const out = ['Обход закончен.'];
      if (r.discharged && r.discharged.length) out.push('Выписаны: ' + r.discharged.map((x) => x.name + ' — ' + x.score + ' баллов').join(', ') + '.');
      if (r.patients) out.push('Под вашим наблюдением: ' + r.patients + ' ' + U.plural(r.patients, ['пациент', 'пациента', 'пациентов']) + '. Назначения проверит Кандинский.');
      return out.join(' ');
    },
  });
  def({
    id: 'practice_makeup',
    place: 'uni',
    title: 'Отработать практику',
    sub: 'Без зачёта по клинической практике к ГИА не допустят. Кандинский даст пациента на разбор',
    slots: [0, 1],
    days: 'weekday',
    phases: ['session'],
    energy: -14,
    dur: 1,
    keepsObligation: true,
    chips: [{ t: '−14 энергии', c: 'neg' }, { t: 'зачёт по практике', c: 'pos' }],
    hide: (s) => G.practiceCredit(s) || !(s.ward && s.ward.practice && s.ward.practice.closed),
    primary: () => true,
    run: (s) => {
      const id = G.pickCase(s, ['ward']) || G.pickCase(s, null);
      return { steps: [{ type: 'story', story: 'practice_makeup' }, { type: 'case', id, mode: 'seminar', makeup: true }] };
    },
    finish: (s, res) => {
      const r = res[1];
      G.apply(s, { energy: -14, stress: 4 });
      if (r && r.score >= 60) {
        s.ward.practice.grade = 3;
        s.ward.practice.makeupDone = true;
        return 'Кандинский расписывается в дневнике практики: «Зачтено. Удовлетворительно — но по делу». Теперь вы допущены к ГИА.';
      }
      return 'Разбор не задался (' + (r ? r.score : 0) + ' из 100). Кандинский: «Завтра — ещё раз. Без практики врачом не становятся».';
    },
  });
  def({
    id: 'otrabotka',
    place: 'uni',
    title: 'Отработать пропуск',
    sub: (s) => {
      const d = s.study.debts[0];
      if (!d) return '';
      return (d.type === 'lecture' ? 'Лекция' : 'Семинар') + ' от ' + C.fmtDate(d.day) + ' · долгов: ' + s.study.debts.length;
    },
    slots: [2],
    days: 'weekday',
    phases: ['study', 'session'],
    energy: -12,
    chips: [{ t: '−12 энергии', c: 'neg' }, { t: '−1 долг', c: 'pos' }],
    hide: (s) => !G.inDebt(s),
    primary: (s) => s.phase === 'session',
    run: (s) => {
      const d = s.study.debts[0];
      if (d.type === 'lecture') return { steps: [{ type: 'story', story: 'otrabotka' }, { type: 'lecture', id: d.id, makeup: true }] };
      return { steps: [{ type: 'story', story: 'otrabotka' }, { type: 'case', id: d.id, mode: 'seminar', makeup: true }] };
    },
    finish: (s, res) => {
      const d = s.study.debts.shift();
      G.apply(s, { energy: -12, stress: 4 });
      if (d.type === 'lecture') G.finishLecture(s, res[1], true);
      else G.finishSeminar(s, res[1], null, true);
      return 'Отработка закрыта. Лаборантка Нина ставит в журнале аккуратную галочку поверх «н». ' + (s.study.debts.length ? 'Долгов осталось: ' + s.study.debts.length + '.' : 'Долгов больше нет — ты допущен{|а} к сессии.');
    },
  });
  def({
    id: 'library',
    place: 'uni',
    title: 'Позаниматься в библиотеке',
    sub: 'Тишина, зелёные лампы, никаких соседей с гитарой',
    slots: [1, 2],
    phases: ['study', 'session'],
    energy: -12,
    chips: [{ t: '−12 энергии', c: 'neg' }, { t: '+знания', c: 'pos' }],
    pick: (s) => G.domainPick(s),
    run: (s, dom) => {
      if (!D.domains[dom]) dom = 'psychopath';
      G.learn(s, dom, 5 * (s.items.textbook ? 1.25 : 1) * G.focus(s));
      G.apply(s, { energy: -12, stress: 2 });
      return { text: 'Читальный зал. Библиотекарь выдаёт тебе монографию 1987 года с чьими-то пометками карандашом. Пометки, кстати, толковые. «' + D.domains[dom].name + '» уложилось в голове.' };
    },
  });
  def({
    id: 'consult',
    place: 'uni',
    title: 'Консультация перед экзаменом',
    sub: 'Кандинский объясняет, что будет в билетах',
    slots: [0, 1],
    phases: ['session'],
    days: 'weekday',
    energy: -10,
    chips: [{ t: '−10 энергии', c: 'neg' }, { t: '+знания по билетам', c: 'pos' }],
    hide: (s) => !!G.examOnDay(s.day),
    req: (s) => (s.flags.consultDay === s.day ? 'Сегодня уже была' : null),
    run: (s) => {
      s.flags.consultDay = s.day;
      const doms = U.shuffle(D.domainKeys).slice(0, 3);
      doms.forEach((k) => G.learn(s, k, 3.5 * G.focus(s)));
      G.apply(s, { energy: -10, stress: -2 });
      return {
        text:
          'Кандинский пишет на доске: «Синдром → диагноз → тактика». «Коллеги, на экзамене я жду рассуждения, а не угадывания. Сначала опишите, что видите, потом назовите синдром, и только потом — диагноз». Повторили: ' +
          doms.map((k) => D.domains[k].name.toLowerCase()).join(', ') +
          '.',
      };
    },
  });
  def({
    id: 'exam',
    place: 'uni',
    title: (s) => {
      const ex = G.examAvailable(s);
      if (!ex) return 'Экзамен';
      const r = s.study.exams[ex];
      return (r ? 'Пересдача: ' : '') + A.exams.title(ex);
    },
    sub: (s) => {
      const ex = G.examAvailable(s);
      return ex ? A.exams.sub(ex) : '';
    },
    slots: [0],
    phases: ['session'],
    days: 'weekday',
    energy: -18,
    dur: 2,
    keepsObligation: true,
    hideOffSlot: true,
    chips: [{ t: 'утро и день', c: '' }, { t: '−18 энергии', c: 'neg' }],
    hide: (s) => !G.examAvailable(s),
    req: (s) => (G.inDebt(s) ? 'Без допуска: сначала отработай пропуски (вечером)' : G.examAvailable(s) === 'exam2' && !G.practiceCredit(s) ? 'К ГИА не допущен{|а}: нет зачёта по практике' : null),
    primary: () => true,
    run: (s) => {
      const ex = G.examAvailable(s);
      return { steps: [{ type: 'exam', exam: ex, tasks: A.exams.makeTasks(s, ex) }] };
    },
    finish: (s, res) => A.exams.finish(s, res[0]),
  });
  def({
    id: 'automat',
    place: 'uni',
    title: 'Получить «автомат»',
    sub: 'За отличную работу в семестре Корсакова готова поставить «отлично» без экзамена',
    free: true,
    dur: 0,
    phases: ['session'],
    hide: (s) => s.study.automat !== 'offered' || !!s.study.exams.exam1,
    chips: [{ t: '«отлично» по психопатологии', c: 'pos' }],
    run: (s) => {
      s.study.automat = 'taken';
      s.study.exams.exam1 = { grade: 5, attempts: 0, automat: true, lastDay: s.day };
      G.unlock(s, 'automat');
      G.apply(s, { stress: -10, rep: 2 });
      return { text: 'Корсакова берёт зачётку, неторопливо выводит «отл.» и расписывается. «Заслужено. Не расслабляйтесь: к аккредитации это всё понадобится»' };
    },
  });

  /* ================= РАБОТА ================= */
  def({
    id: 'work',
    place: 'work',
    title: (s) => (s.slot === 1 ? 'Пойти на работу (с опозданием)' : 'Рабочий день'),
    sub: (s) => {
      const job = G.job(s);
      return job ? job.role + ' · ' + job.name : '';
    },
    slots: [0, 1],
    days: 'weekday',
    phases: ['career'],
    keepsObligation: true,
    dur: (s) => (s.slot === 0 ? 2 : 1),
    chips: (s) => {
      const job = G.job(s);
      return [{ t: s.slot === 0 ? 'утро и день' : 'день', c: '' }, { t: '−' + job.energy + ' энергии', c: 'neg' }, { t: 'приём пациентов', c: 'pos' }];
    },
    req: (s) => (s.career.today === s.day ? 'Сегодня уже {отработал|отработала}' : s.career.off === s.day ? 'Сегодня отгул' : s.energy < 12 ? 'Нет сил даже встать' : null),
    primary: () => true,
    run: (s) => G.workPlan(s),
    finish: (s, res, arg, act) => G.finishWork(s, res, act),
  });
  def({
    id: 'work_auto',
    place: 'work',
    title: 'Отработать на автопилоте',
    sub: 'Без сложных случаев. Быстро, но опыт и репутация почти не растут',
    slots: [0],
    days: 'weekday',
    phases: ['career'],
    dur: 2,
    keepsObligation: true,
    chips: [{ t: 'утро и день', c: '' }, { t: 'быстро', c: '' }],
    req: (s) => (s.career.today === s.day ? 'Сегодня уже {отработал|отработала}' : s.career.off === s.day ? 'Сегодня отгул' : null),
    run: (s) => {
      const job = G.job(s);
      s.career.today = s.day;
      s.career.weekWorked++;
      s.stats.workdays++;
      G.apply(s, { energy: -Math.round(job.energy * 0.85), stress: job.stress, xp: 6 });
      const avg = G.knowAvg(s);
      const risk = 0.22 - avg / 600 + (s.energy < 25 ? 0.12 : 0) + (s.burnout.active ? 0.1 : 0);
      if (U.chance(risk)) {
        G.apply(s, { rep: -2, stress: 6 });
        return { text: 'День прошёл на автомате — и в конце ты понимаешь, что не {заметил|заметила} у одной пациентки нарастающую тревогу и не {выяснил|выяснила}, принимает ли она таблетки. Заведующий указал на ошибку при всех. Неприятно и справедливо.' };
      }
      G.apply(s, { rep: 0.5 });
      return {
        text: U.pick([
          'Двенадцать пациентов, двадцать три записи в медицинской системе, ноль сюрпризов. Обычный день.',
          'Повторные приёмы, рецепты, справки. Ты ловишь себя на том, что разговариваешь шаблонами. Зато быстро.',
          'День как конвейер: «Как сон? Как настроение? Таблетки принимаете?» К вечеру язык заплетается.',
        ]),
      };
    },
  });
  def({
    id: 'autoweek',
    place: 'work',
    title: 'Прожить неделю на автопилоте',
    sub: 'Быстрая перемотка до следующего понедельника: работа, сон и выбранный режим подработок',
    slots: [0],
    phases: ['career'],
    free: true,
    dur: 0,
    keepsObligation: true,
    chips: [{ t: '7 дней', c: '' }, { t: 'быстро', c: '' }],
    hide: (s) => C.wd(s.day) !== 0,
    req: (s) => (s.career.today === s.day ? 'Сегодня уже {работал|работала}' : s.stress >= 75 ? 'Слишком высокий стресс — сначала отдохни' : s.health < 40 ? 'Сначала подлечись' : null),
    pick: () => [
      { value: 'calm', label: 'Спокойно', sub: 'Работа, прогулки, сон по режиму. Стресс под контролем' },
      { value: 'gigs', label: 'С подработками', sub: 'Плюс две медкомиссии и одно ночное дежурство' },
      { value: 'max', label: 'Максимум денег', sub: 'Три дежурства и подработки каждый вечер. Риск выгорания' },
    ],
    run: (s, mode) => {
      G.autoWeek(s, mode || 'calm');
      return {};
    },
  });
  def({
    id: 'day_off',
    place: 'work',
    title: 'Взять отгул за свой счёт',
    sub: 'Без оплаты, но и без прогула',
    free: true,
    dur: 0,
    slots: [0],
    days: 'weekday',
    phases: ['career'],
    chips: [{ t: 'день без зарплаты', c: 'neg' }],
    hide: (s) => s.career.today === s.day || s.career.off === s.day,
    run: (s) => {
      s.career.off = s.day;
      G.apply(s, { stress: -3 });
      return { text: 'Ты пишешь заведующему. Ответ — сухое «ок». Сегодняшний день твой.' };
    },
  });
  def({
    id: 'vacation',
    place: 'work',
    title: 'Уйти в отпуск на неделю',
    sub: (s) => (s.career ? 'Оплачиваемый. Доступен раз в 6 недель работы' : ''),
    slots: [0],
    phases: ['career'],
    free: true,
    dur: 0,
    chips: [{ t: '7 дней отдыха', c: 'pos' }, { t: '−много стресса', c: 'pos' }],
    hide: (s) => C.wd(s.day) !== 0,
    req: (s) => (s.day - s.career.lastVacation < 42 ? 'Ещё рано: отпуск через ' + (42 - (s.day - s.career.lastVacation)) + ' дн.' : null),
    pick: () => [
      { value: 'home', label: 'Остаться дома', sub: 'Сон, книги, Кокошка. Бесплатно' },
      { value: 'trip', label: 'Поехать к морю', sub: '−30 000 ₽, но и отдых другой' },
    ],
    run: (s, kind) => {
      s.career.lastVacation = s.day;
      if (kind === 'trip') G.apply(s, { money: -30000 }, 'Отпуск у моря');
      G.vacation(s, kind === 'trip');
      return {};
    },
  });
  def({
    id: 'night_duty',
    place: 'work',
    title: 'Ночное дежурство',
    sub: (s) => 'Дежурный врач по больнице · ' + U.money(G.nightPay(s)),
    slots: [3],
    phases: ['career'],
    sleep: 'none',
    energy: -10,
    keepsObligation: true,
    chips: (s) => [{ t: '+' + U.groups(G.nightPay(s)) + ' ₽', c: 'pos' }, { t: 'без сна', c: 'neg' }],
    hide: (s) => !(G.job(s) && G.job(s).nightDuty),
    req: (s) => (s.energy < 25 ? 'Слишком {устал|устала} для дежурства' : null),
    run: (s) => G.nightPlan(s, 'doctor'),
    finish: (s, res) => G.finishNight(s, res, 'doctor'),
  });
  def({
    id: 'swap_night',
    place: 'work',
    title: 'Дежурство за Марата',
    sub: 'Обещано сегодня · 6 500 ₽',
    slots: [3],
    phases: ['career'],
    sleep: 'none',
    keepsObligation: true,
    chips: [{ t: '+6 500 ₽', c: 'pos' }, { t: 'без сна', c: 'neg' }],
    hide: (s) => s.flags.swapNight !== s.day,
    primary: () => true,
    run: (s) => G.nightPlan(s, 'doctor'),
    finish: (s, res) => {
      s.flags.swapNight = null;
      const r = res[1];
      s.stats.nights++;
      G.apply(s, { energy: -30, stress: 10, xp: 10 });
      if (r) G.apply(s, { rep: (r.right - (r.total - r.right)) * 0.6, xp: r.right * 8 });
      G.apply(s, { money: 6500 }, 'Дежурство за Марата');
      return 'Дежурство за Марата сдано. Утром он присылает фото дочки в костюме снежинки и перевод. Заработано ' + U.money(6500) + '.';
    },
  });
  def({
    id: 'article',
    place: 'work',
    title: 'Писать статью',
    sub: (s) => 'Черновик: ' + s.science.draft + '/3 вечеров · опубликовано: ' + s.science.pubs,
    slots: [2, 3],
    phases: ['career'],
    energy: -18,
    chips: [{ t: '−18 энергии', c: 'neg' }, { t: '+наука', c: 'pos' }],
    req: (s) => (s.energy < 18 ? 'Мысли не складываются' : null),
    run: (s) => {
      const job = G.job(s);
      s.science.draft += job && job.science ? 1.5 : 1;
      if (s.items.laptop) s.science.draft += 0.5;
      G.apply(s, { energy: -18, stress: 5 });
      G.learn(s, U.pick(D.domainKeys), 2);
      if (s.science.draft >= 3) {
        s.science.draft = 0;
        s.science.pubs++;
        G.apply(s, { rep: 4, xp: 40 });
        return { text: 'Статья отправлена в журнал и — о чудо — принята после одной правки рецензента. Публикаций: ' + s.science.pubs + '. Корсакова пишет: «Поздравляю. Следующая — в журнал посерьёзнее».', sleep: s.slot === 3 ? 'short' : undefined };
      }
      return { text: 'Ты сидишь над обзором литературы. Таблица с исследованиями растёт, текст — медленно. Но растёт.', sleep: s.slot === 3 ? 'short' : undefined };
    },
  });

  /* ================= ПОДРАБОТКИ ================= */
  def({
    id: 'gig_nurse',
    place: 'gigs',
    title: (s) => (G.she(s) ? 'Ночная смена медсестрой в ПБ №6' : 'Ночная смена медбратом в ПБ №6'),
    sub: (s) => 'Острое отделение · ' + U.money(3000 + (G.bg(s).nightBonus || 0)),
    slots: [3],
    phases: ['study', 'session'],
    sleep: 'none',
    energy: -10,
    keepsObligation: true,
    chips: (s) => [{ t: '+' + U.groups(3000 + (G.bg(s).nightBonus || 0)) + ' ₽', c: 'pos' }, { t: 'без сна', c: 'neg' }],
    req: (s) => (s.energy < 25 ? 'Слишком {устал|устала} для смены' : null),
    run: (s) => G.nightPlan(s, 'nurse'),
    finish: (s, res) => G.finishNight(s, res, 'nurse'),
  });
  def({
    id: 'gig_courier',
    place: 'gigs',
    title: 'Курьером на велосипеде',
    sub: (s) => (s.items.bike ? 'Свой велосипед — заказы быстрее' : 'Прокатный велосипед и жёлтый короб') + ' · ~' + U.money(G.courierPay(s)),
    slots: [1, 2],
    energy: -24,
    chips: (s) => [{ t: '~' + U.groups(G.courierPay(s)) + ' ₽', c: 'pos' }, { t: '−24 энергии', c: 'neg' }],
    hide: (s) => s.phase === 'career' && G.rankIndex(s) >= 1,
    req: (s) => (s.energy < 24 ? 'Ноги не крутят' : null),
    run: (s) => {
      const season = C.season(s.day);
      let pay = G.courierPay(s);
      const rain = U.chance(season === 'autumn' ? 0.45 : 0.25);
      let text;
      if (rain) {
        pay += 300;
        text = season === 'winter' ? 'Метель. Заказов много, курьеров мало — платят надбавку. Ты возвращаешься с сосульками на бровях.' : 'Ливень. Кроссовки хлюпают, но за погоду доплачивают. Одна бабушка дала тебе яблоко и зонтик «на время».';
      } else {
        text = U.pick([
          'Пицца, роллы, три пакета корма для чужих кошек. Кокошка бы оценила.',
          'Сорок километров по городу. Голова пустая, ноги гудят — отличная разгрузка после семинаров.',
          'Ты доставляешь суши в общагу своего же университета. Первокурсники смотрят с уважением.',
        ]);
      }
      if (U.chance(0.2)) {
        pay += 400;
        text += ' Кто-то оставил щедрые чаевые.';
      }
      s.stats.courier++;
      G.apply(s, { energy: -24, stress: -3, health: 1 });
      G.apply(s, { money: pay }, 'Курьер');
      return { text: text + '\n\nЗаработано: ' + U.money(pay) + '.' };
    },
  });
  def({
    id: 'gig_tutor',
    place: 'gigs',
    title: 'Репетитор по биологии',
    sub: (s) => 'Тимофей, 11 класс, хочет в медицинский · 1 700 ₽ · ещё ' + Math.max(0, 2 - s.weekly.tutor) + ' на этой неделе',
    slots: [1, 2],
    phases: ['study', 'session'],
    energy: -12,
    chips: [{ t: '+1 700 ₽', c: 'pos' }, { t: '−12 энергии', c: 'neg' }],
    req: (s) => (s.weekly.tutor >= 2 ? 'Тимофей занимается дважды в неделю' : null),
    run: (s) => {
      s.weekly.tutor++;
      G.apply(s, { energy: -12, stress: 3 });
      G.apply(s, { money: 1700 }, 'Репетиторство');
      return {
        text: U.pick([
          'Тимофей путает митоз с мейозом и спрашивает, правда ли, что психиатры «читают мысли». Ты объясняешь, что нет, но по его лицу видно, что он не играл в доту, а делал домашку. Шутка. Не делал.',
          'Разбираете генетику. Тимофей внезапно задаёт отличный вопрос про наследуемость шизофрении. Может, из него выйдет толк.',
          'Мама Тимофея просит «заодно посмотреть, нормальный ли он, а то всё в телефоне». Ты вежливо отказываешься ставить диагнозы на репетиторстве.',
        ]),
      };
    },
  });
  def({
    id: 'gig_callcenter',
    place: 'gigs',
    title: 'Колл-центр частной клиники',
    sub: 'Записывать пациентов на приём · 1 400 ₽',
    slots: [1, 2],
    phases: ['study', 'session'],
    energy: -14,
    chips: [{ t: '+1 400 ₽', c: 'pos' }, { t: '+8 стресса', c: 'neg' }],
    run: (s) => {
      G.apply(s, { energy: -14, stress: 8 });
      G.apply(s, { money: 1400 }, 'Колл-центр');
      return {
        text: U.pick([
          '«Девушка, мне к самому лучшему врачу, но чтобы недорого и сегодня». Сорок звонков. Улыбаться голосом ты {научился|научилась}.',
          'Звонящий требует «психиатра, который не ставит на учёт». Ты объясняешь, что такого понятия, как «учёт», в частной клинике нет, и записываешь его на четверг.',
          'Три часа в гарнитуре. В конце смены ты здороваешься с Кокошкой фразой «Клиника, добрый вечер».',
        ]),
      };
    },
  });
  def({
    id: 'gig_dept',
    place: 'gigs',
    title: 'Помочь кафедре',
    sub: 'Проверить тесты студентов, разобрать архив · 700 ₽ и благодарность Корсаковой',
    slots: [2],
    days: 'weekday',
    phases: ['study', 'session'],
    energy: -10,
    chips: [{ t: '+700 ₽', c: 'pos' }, { t: '+рейтинг', c: 'pos' }],
    run: (s) => {
      G.apply(s, { energy: -10, stress: 2, rep: 1 });
      G.apply(s, { money: 700 }, 'Помощь кафедре');
      s.study.rating += 2;
      s.study.ratingMax += 2;
      const dom = U.pick(D.domainKeys);
      G.learn(s, dom, 2.5);
      return { text: 'Ты разбираешь архив историй болезни 1970-х. Почерк врачей того времени — отдельная дисциплина. Зато нашлось описание классического случая «' + D.domains[dom].name.toLowerCase() + '» — выписал{|а} себе.' };
    },
  });
  def({
    id: 'gig_commission',
    place: 'gigs',
    title: 'Медкомиссия в медцентре',
    sub: 'Справки для водителей и на оружие · 3 500 ₽ + премия за точность',
    slots: [1, 2],
    phases: ['career'],
    energy: -16,
    chips: [{ t: '+3 500 ₽', c: 'pos' }, { t: '−16 энергии', c: 'neg' }],
    req: (s) => (G.isWorkday(s) && s.slot === 1 ? 'Днём ты на основной работе' : null),
    run: (s) => ({ steps: [{ type: 'story', story: 'commission' }, { type: 'mini', mode: 'commission', items: A.minis.commission(s, 3) }] }),
    finish: (s, res) => {
      const r = res[1] || { right: 0, total: 3 };
      G.apply(s, { energy: -16, stress: 5, xp: 5 * r.right });
      let pay = 3500 + (r.right === r.total ? 600 : 0);
      G.apply(s, { money: pay }, 'Медкомиссия');
      G.apply(s, { rep: r.right === r.total ? 0.5 : -0.8 * (r.total - r.right) });
      return 'Смена на медкомиссии закрыта: ' + r.right + ' из ' + r.total + ' решений без ошибок. Заработано ' + U.money(pay) + '.';
    },
  });
  def({
    id: 'gig_online',
    place: 'gigs',
    title: 'Онлайн-консультации',
    sub: 'Видеосвязь, два пациента · 2 400 ₽ за каждую толковую консультацию',
    slots: [2],
    phases: ['career'],
    energy: -14,
    chips: [{ t: 'до +4 800 ₽', c: 'pos' }, { t: '−14 энергии', c: 'neg' }],
    req: (s) => (!s.items.laptop ? 'Нужен ноутбук' : s.rep < 15 ? 'Нужна репутация 15+' : null),
    run: (s) => ({ steps: [{ type: 'story', story: 'online' }, { type: 'mini', mode: 'online', ids: G.pickMinis(s, ['online'], 2) }] }),
    finish: (s, res) => {
      const r = res[1] || { right: 0, total: 2 };
      G.apply(s, { energy: -14, stress: 5, rep: r.right * 0.4, xp: 8 * r.right });
      const pay = 2400 * r.right;
      if (pay) G.apply(s, { money: pay }, 'Онлайн-консультации');
      return 'Вечер онлайн-приёма: ' + r.right + ' из ' + r.total + ' консультаций прошли как надо. ' + (pay ? 'Заработано ' + U.money(pay) + '.' : 'Пациенты попросили вернуть деньги — сервис вернул.');
    },
  });
  def({
    id: 'gig_teach',
    place: 'gigs',
    title: 'Провести занятие у студентов',
    sub: 'Почасовая ставка на кафедре · 4 000 ₽',
    slots: [2],
    days: 'weekday',
    phases: ['career'],
    energy: -15,
    chips: [{ t: '+4 000 ₽', c: 'pos' }, { t: '+репутация', c: 'pos' }],
    req: (s) => (s.rep < 25 ? 'Нужна репутация 25+' : null),
    run: (s) => {
      G.apply(s, { energy: -15, stress: 5, rep: 1, xp: 10 });
      G.apply(s, { money: 4000 }, 'Занятие со студентами');
      G.learn(s, U.pick(D.domainKeys), 2);
      return {
        text: U.pick([
          'Пятый курс, вечерняя группа. Ты рассказываешь про синдром Кандинского–Клерамбо, и впервые за семестр никто не смотрит в телефон.',
          'Студентка спрашивает, не страшно ли работать с «буйными». Ты рассказываешь, что пациенты с психическими расстройствами гораздо чаще сами становятся жертвами насилия. Аудитория задумывается.',
        ]),
      };
    },
  });
  def({
    id: 'gig_night',
    place: 'gigs',
    title: 'Дежурство в ПБ №6 по совместительству',
    sub: (s) => 'Дежурный психиатр · ' + U.money(G.nightPay(s)),
    slots: [3],
    phases: ['career'],
    sleep: 'none',
    energy: -10,
    keepsObligation: true,
    chips: (s) => [{ t: '+' + U.groups(G.nightPay(s)) + ' ₽', c: 'pos' }, { t: 'без сна', c: 'neg' }],
    hide: (s) => !!(G.job(s) && G.job(s).nightDuty),
    req: (s) => (s.energy < 25 ? 'Слишком {устал|устала} для дежурства' : null),
    run: (s) => G.nightPlan(s, 'doctor'),
    finish: (s, res) => G.finishNight(s, res, 'doctor'),
  });

  /* ================= ГОРОД ================= */
  def({
    id: 'shop',
    place: 'city',
    title: 'Магазины',
    sub: 'Книги, техника, полезные вещи',
    free: true,
    dur: 0,
    run: () => ({ steps: [{ type: 'shop' }], dur: 0 }),
    finish: () => '',
  });
  def({
    id: 'walk',
    place: 'city',
    title: 'Прогулка в парке',
    sub: (s) => ({ autumn: 'Жёлтые листья, мокрые скамейки', winter: 'Снег скрипит под ногами', spring: 'Капель и первые подснежники', summer: 'Тень лип и мороженое' })[C.season(s.day)],
    slots: [0, 1, 2],
    energy: -5,
    chips: [{ t: '−11 стресса', c: 'pos' }, { t: '+2 здоровья', c: 'pos' }],
    run: (s) => {
      G.apply(s, { energy: -5, stress: -11, health: 2 });
      const season = C.season(s.day);
      const t = {
        autumn: 'Ты идёшь через парк, загребая листья. Мысли о пациентах понемногу укладываются, как листья в кучу.',
        winter: 'Морозный воздух, синие тени на снегу. Дышится так, что хочется жить.',
        spring: 'Пахнет мокрой землёй. Ты замечаешь, что впервые за неделю не думаешь о работе.',
        summer: 'Липы цветут, дети кормят уток. Ты сидишь на скамейке и просто ничего не делаешь. Прекрасно.',
      }[season];
      return { text: t };
    },
  });
  def({
    id: 'gym',
    place: 'city',
    title: 'Бассейн и зал',
    sub: 'Лучший антидепрессант с доказанной эффективностью',
    slots: [0, 1, 2],
    energy: -20,
    chips: [{ t: '−13 стресса', c: 'pos' }, { t: '+4 здоровья', c: 'pos' }],
    hide: (s) => !s.items.gym,
    run: (s) => {
      G.apply(s, { energy: -20, stress: -13, health: 4 });
      return { text: U.pick(['Километр в бассейне. Голова пустая и звонкая.', 'Беговая дорожка, гантели, растяжка. Эндорфины на месте, как и обещали учебники.']) };
    },
  });
  def({
    id: 'cafe',
    place: 'city',
    title: 'Кофе с Лизой и Маратом',
    sub: 'Поболтать о жизни, пожаловаться на Кандинского',
    slots: [1, 2],
    energy: -5,
    money: -900,
    chips: [{ t: '−900 ₽', c: 'neg' }, { t: '−15 стресса', c: 'pos' }],
    run: (s) => {
      G.apply(s, { energy: -5, stress: -15 });
      G.apply(s, { money: -900 }, 'Кафе с друзьями');
      const lines =
        s.phase === 'career'
          ? [
              'Марат устроился в наркологию и рассказывает, как пациент пытался «закодироваться» у него по скайпу. Лиза смеётся так, что проливает латте.',
              'Лиза жалуется на заведующего, Марат — на ипотеку, ты — на медицинскую информационную систему. Терапевтично.',
              'Обсуждаете, кто из однокурсников уже ушёл в фарму. Марат клянётся, что никогда. Лиза напоминает, что он клялся и про курение.',
            ]
          : [
              'Лиза рассказывает, что Кандинский на прошлом семинаре заставил всех описывать психический статус кота. Марат утверждает, что у кота была ангедония.',
              'Марат спит над капучино. Лиза рассказывает, как перепутала «резонёрство» с «ригидностью» прямо при Корсаковой.',
              'Делитесь, кто как готовится к сессии. Оказывается, Лиза делает карточки, а Марат «надеется на клиническое мышление».',
            ];
      return { text: U.pick(lines) };
    },
  });
  def({
    id: 'bar',
    place: 'city',
    title: 'Бар после тяжёлой недели',
    sub: (s) => (s.slot === 3 ? 'До закрытия. Утро будет тяжёлым' : 'Пара бокалов в хорошей компании'),
    slots: [2, 3],
    money: -1800,
    chips: [{ t: '−1 800 ₽', c: 'neg' }, { t: '−24 стресса', c: 'pos' }, { t: '−здоровье', c: 'neg' }],
    run: (s) => {
      const late = s.slot === 3;
      G.apply(s, { stress: -24, health: late ? -4 : -2, energy: -6 });
      G.apply(s, { money: -1800 }, 'Бар');
      if (late) s.flags.hangover = true;
      return {
        text: late
          ? 'Вы закрываете бар. Марат поёт, Лиза объясняет бармену разницу между психологом и психиатром. Ты знаешь, что утром пожалеешь, и всё равно заказываешь ещё сок. Ну, почти сок.'
          : 'Два бокала, много смеха. Ты напоминаешь себе, что «снимать стресс алкоголем» — это строчка из анамнеза твоих же пациентов, и вовремя идёшь домой.',
        sleep: late ? 'short' : undefined,
      };
    },
  });
  def({
    id: 'balint',
    place: 'city',
    title: 'Балинтовская группа',
    sub: 'Бесплатно на кафедре по четвергам: врачи разбирают трудные случаи и свои чувства',
    slots: [2],
    energy: -6,
    chips: [{ t: '−14 стресса', c: 'pos' }, { t: '+психотерапия', c: 'pos' }],
    hide: (s) => C.wd(s.day) !== 3,
    run: (s) => {
      G.apply(s, { energy: -6, stress: -14 });
      G.learn(s, 'personality', 3);
      s.stats.therapy++;
      if (s.burnout.active) s.burnout.calm++;
      return { text: 'В кругу восемь врачей. Кто-то рассказывает о пациентке, которая злит до дрожи, и все узнают в этом себя. Ты уходишь с ощущением, что не одинок{|а}.' };
    },
  });
  def({
    id: 'therapy',
    place: 'city',
    title: 'Сессия с психотерапевтом',
    sub: 'Своя терапия — не слабость, а гигиена профессии · 3 500 ₽',
    slots: [1, 2],
    money: -3500,
    chips: [{ t: '−3 500 ₽', c: 'neg' }, { t: '−26 стресса', c: 'pos' }],
    req: (s) => (s.weekly.therapy >= 1 ? 'Раз в неделю' : null),
    run: (s) => {
      s.weekly.therapy++;
      s.stats.therapy++;
      G.apply(s, { stress: -26, energy: -4 });
      G.apply(s, { money: -3500 }, 'Психотерапия');
      if (s.burnout.active) s.burnout.calm += 2;
      return {
        text: U.pick([
          'Терапевт спрашивает: «А что чувствуете вы, когда пациент говорит, что вы ему не помогаете?» Ты молчишь минуту. Потом говоришь. Становится легче.',
          'Сорок пять минут о тебе, а не о пациентах. Ты замечаешь, что последний раз {ел|ела} горячее позавчера. Записываешь домашнее задание: обед.',
        ]),
      };
    },
  });
  def({
    id: 'library_city',
    place: 'city',
    title: 'Городская библиотека',
    sub: 'Свежие журналы и тишина',
    slots: [0, 1, 2],
    phases: ['career'],
    energy: -12,
    chips: [{ t: '−12 энергии', c: 'neg' }, { t: '+знания', c: 'pos' }],
    pick: (s) => G.domainPick(s),
    run: (s, dom) => {
      if (!D.domains[dom]) dom = 'psychopath';
      G.learn(s, dom, 5 * (s.items.textbook ? 1.25 : 1) * G.focus(s));
      G.apply(s, { energy: -12, stress: 1 });
      return { text: 'Свежий номер журнала с обзором по теме «' + D.domains[dom].name.toLowerCase() + '». Ты выписываешь три ссылки и одну мысль, которая пригодится завтра на приёме.' };
    },
  });
  def({
    id: 'doctor',
    place: 'city',
    title: 'Сходить к терапевту',
    sub: 'Взять больничный на пару дней',
    slots: [0, 1],
    chips: [{ t: '2 дня отдыха', c: 'pos' }],
    hide: (s) => s.health >= 45 || G.isSick(s),
    keepsObligation: true,
    run: (s) => {
      s.flags.sick = 3;
      G.apply(s, { stress: -5 });
      return { text: 'Терапевт смотрит горло, слушает лёгкие и выписывает больничный. «Доктор, вы себя совсем не бережёте». Ты киваешь и понимаешь, что говоришь эту фразу пациентам каждый день.' };
    },
  });
  def({
    id: 'move',
    place: 'city',
    title: 'Сменить жильё',
    sub: (s) => 'Сейчас: ' + D.housing[s.housing].name + ' · ' + U.money(D.housing[s.housing].rent) + '/нед.',
    free: true,
    dur: 0,
    pick: (s) =>
      Object.keys(D.housing)
        .filter((k) => k !== s.housing && !(D.housing[k].studentOnly && s.phase === 'career'))
        .map((k) => {
          const h = D.housing[k];
          return { value: k, label: h.name + ' — ' + U.money(h.rent) + '/нед.', sub: h.desc + (h.move ? ' Переезд и залог: ' + U.money(h.move) + '.' : '') };
        }),
    run: (s, k) => {
      const h = D.housing[k];
      if (!h) return {};
      if (s.money - h.move < G.CREDIT_LIMIT) return { text: 'На переезд не хватает денег.' };
      if (h.move) G.apply(s, { money: -h.move }, 'Переезд и залог');
      s.housing = k;
      s.flags.dormUntil = null;
      return { text: 'Коробки, скотч, Кокошка в переноске орёт на весь подъезд. Новый адрес: ' + h.place + '. ' + h.desc };
    },
  });

  /* ================= Сборка рабочих планов ================= */
  G.sleepForecast = function (s) {
    const h = D.housing[s.housing];
    const f = D.food[s.food];
    let e = 62 + h.sleep + f.energy + (s.items.earplugs ? 5 : 0) + (s.items.mattress ? 10 : 0) + (s.items.coffee ? 8 : 0);
    if (s.stress > 80) e -= 18;
    else if (s.stress > 60) e -= 9;
    if (s.health < 40) e -= 10;
    if (s.flags.hangover) e -= 15;
    e = Math.max(e, s.energy + 12 + (s.items.coffee ? 8 : 0));
    return '~' + Math.round(U.clamp(e, 0, G.maxEnergy(s)));
  };
  G.courierPay = (s) => Math.round(1300 * (s.items.bike ? 1.4 : 1));
  G.nightPay = (s) => Math.round((G.job(s) && G.job(s).nightDuty ? 6500 : 6000) * G.rank(s).mult);

  G.examAvailable = function (s) {
    if (s.phase !== 'session' || C.isWeekend(s.day)) return null;
    const passed = (k) => s.study.exams[k] && s.study.exams[k].grade >= 3;
    const can = (k) => {
      if (passed(k)) return false;
      if (s.day < G.EXAM_DAYS[k]) return false;
      if (k === 'accr' && !(passed('exam1') && passed('exam2'))) return false;
      if (k === 'exam2' && !passed('exam1')) return false;
      const r = s.study.exams[k];
      if (r && r.lastDay === s.day) return false;
      return true;
    };
    const today = G.examOnDay(s.day);
    if (today && can(today)) return today;
    for (const k of ['exam1', 'exam2', 'accr']) if (can(k)) return k;
    return null;
  };

  G.workPlan = function (s) {
    const job = G.job(s);
    const late = s.slot === 1;
    const steps = [];
    if (!s.flags['intro_' + s.career.job]) steps.push({ type: 'story', story: 'job_intro_' + s.career.job });
    else steps.push({ type: 'story', story: 'work_day' });
    if (A.ward && A.ward.capacity(s) > 0) steps.push({ type: 'ward', mode: 'work' });
    let caseId = null;
    if (!late && U.chance(job.caseChance)) caseId = G.pickCase(s, job.settings);
    if (caseId) steps.push({ type: 'case', id: caseId, mode: 'work' });
    else steps.push({ type: 'mini', mode: 'work', ids: G.pickMinis(s, job.settings.concat(['followup']), late ? 1 : 2) });
    return { steps, late };
  };

  G.finishWork = function (s, res, act) {
    const job = G.job(s);
    const late = act && act.dur === 1;
    s.flags['intro_' + s.career.job] = true;
    s.career.today = s.day;
    s.career.weekWorked += late ? 0.5 : 1;
    s.stats.workdays++;
    G.apply(s, { energy: -Math.round(job.energy * (late ? 0.6 : 1)), stress: job.stress });
    const out = [];
    const r = (res || []).find((x) => x && (x.kind === 'case' || x.kind === 'mini'));
    const wr = (res || []).find((x) => x && x.kind === 'ward');
    if (wr && wr.discharged && wr.discharged.length) out.push('Выписаны: ' + wr.discharged.map((x) => x.name + ' (' + x.score + ')').join(', ') + '.');
    if (r && r.kind === 'case') {
      const repGain = ((r.score - 60) / 22) * job.rep;
      G.apply(s, { rep: repGain });
      if (job.perCase && r.score >= 60) {
        const pay = Math.round(job.perCase * G.rank(s).mult);
        G.apply(s, { money: pay }, 'Оплата консультации');
        out.push('Пациент доволен — клиника начисляет ' + U.money(pay) + ' за консультацию.');
      }
      if (job.reviews) {
        const stars = r.score >= 85 ? 5 : r.score >= 70 ? 4 : r.score >= 50 ? 3 : 2;
        s.career.reviews.push(stars);
        out.push('Отзыв на «ДокРейтинге»: ' + '★'.repeat(stars) + '☆'.repeat(5 - stars) + '.');
      }
      out.unshift('Рабочий день окончен. Самый сложный пациент дня разобран на ' + r.score + ' из 100.');
    } else if (r && r.kind === 'mini') {
      G.apply(s, { rep: (r.right - (r.total - r.right) * 1.5) * 0.4 * job.rep });
      out.unshift('Рабочий день окончен. Приём: ' + U.int(9, 14) + ' пациентов, из них ' + r.total + ' — с вопросами посложнее (верно: ' + r.right + ').');
    } else {
      out.unshift('Рабочий день окончен.');
    }
    if (late) out.push('Опоздание заведующий заметил, но промолчал. Оплачено полдня.');
    return out.join(' ');
  };

  G.nightPlan = function (s, kind) {
    const steps = [{ type: 'story', story: kind === 'nurse' ? 'night_nurse' : 'night_doctor' }];
    const p = kind === 'nurse' ? 0.6 : 0.85;
    if (U.chance(p)) {
      const ids = G.pickMinis(s, [kind === 'nurse' ? 'night_nurse' : 'night'], kind === 'nurse' ? 1 : 2);
      if (ids.length) steps.push({ type: 'mini', mode: 'night', ids });
    }
    return { steps };
  };
  G.finishNight = function (s, res, kind) {
    s.stats.nights++;
    const r = res[1];
    let pay = kind === 'nurse' ? 3000 + (G.bg(s).nightBonus || 0) : G.nightPay(s);
    G.apply(s, { energy: -30, stress: kind === 'nurse' ? 10 : 13, xp: kind === 'nurse' ? 4 : 10 });
    let text = kind === 'nurse' ? 'Смена сдана в 8:00. ' : 'Дежурство сдано в 8:00. ';
    if (r) {
      G.apply(s, { rep: (r.right - (r.total - r.right)) * (kind === 'nurse' ? 0.3 : 0.6), xp: r.right * 8 });
      text += 'Ночью ' + (r.total > 1 ? 'были сложные ситуации' : 'была одна сложная ситуация') + ': решено верно ' + r.right + ' из ' + r.total + '. ';
    } else text += 'Ночь выдалась спокойной — редкая удача. ';
    G.apply(s, { money: pay }, kind === 'nurse' ? 'Ночная смена в ПБ №6' : 'Дежурство');
    return text + 'Заработано ' + U.money(pay) + '.';
  };

  /** Неделя на автопилоте: рутинная работа без разборов, режим подработок по выбору. */
  G.autoWeek = function (s, mode) {
    if (A.ward) A.ward.handoverAll(s, 'Неделя на автопилоте: ваших пациентов ведёт коллега.');
    const plans = {
      calm: { nights: [], gigs: [] },
      gigs: { nights: [3], gigs: [1, 3] },
      max: { nights: [0, 2, 4], gigs: [1, 3, 5, 6] },
    };
    const plan = plans[mode] || plans.calm;
    const t = { work: 0, errors: 0, nights: 0, gigs: 0, gigErr: 0 };
    const money0 = s.money;
    const skill = () => U.clamp(0.5 + G.knowAvg(s) / 200 - (s.energy < 30 ? 0.12 : 0) - (s.burnout.active ? 0.1 : 0), 0.3, 0.95);
    let stopped = '';
    for (let d = 0; d < 7; d++) {
      if (s.ended) break;
      const wd = C.wd(s.day);
      if (G.isWorkday(s) && !G.isSick(s) && s.career.today !== s.day && s.career.off !== s.day) {
        const r = A.actions.byId.work_auto.run(s);
        t.work++;
        if (/ошибк/.test(r.text || '')) t.errors++;
      } else if (!G.isSick(s)) G.apply(s, { stress: -7, energy: 6 });
      s.slot = 2;
      if (!G.isSick(s) && plan.gigs.indexOf(wd) >= 0 && s.energy > 30) {
        let right = 0;
        for (let i = 0; i < 3; i++) if (U.chance(skill())) right++;
        G.apply(s, { energy: -16, stress: 5, xp: 5 * right, rep: right === 3 ? 0.5 : -0.8 * (3 - right) });
        G.apply(s, { money: 3500 + (right === 3 ? 600 : 0) }, 'Медкомиссия');
        t.gigs++;
        t.gigErr += 3 - right;
      } else if (!G.isSick(s)) G.apply(s, { stress: -8 });
      s.slot = 3;
      if (!G.isSick(s) && plan.nights.indexOf(wd) >= 0 && s.energy > 35 && s.stress < 80) {
        let right = 0;
        for (let i = 0; i < 2; i++) if (U.chance(skill())) right++;
        G.finishNight(s, [null, { right, total: 2 }], 'doctor');
        t.nights++;
        G.newDay(s, 'none', { vacation: true });
      } else G.newDay(s, 'full', { vacation: true });
      if (s.stress >= 85 || s.health < 25) {
        stopped = 'Автопилот остановлен: ' + (s.health < 25 ? 'здоровье на исходе' : 'стресс зашкаливает') + '. Пора отдохнуть по-настоящему.';
        break;
      }
    }
    const parts = ['Неделя прошла на автопилоте: рабочих дней — ' + t.work + (t.gigs ? ', медкомиссий — ' + t.gigs : '') + (t.nights ? ', дежурств — ' + t.nights : '') + '.'];
    if (t.errors || t.gigErr) parts.push('Без разборов не обошлось без промахов: ' + (t.errors + t.gigErr) + ' ' + U.plural(t.errors + t.gigErr, ['ошибка', 'ошибки', 'ошибок']) + ' на приёме и комиссиях.');
    parts.push('Разница на счету за неделю (с учётом аренды и зарплаты): ' + U.signedMoney(Math.round(s.money - money0)) + '.');
    if (stopped) parts.push(stopped);
    G.say(s, parts.join(' '));
  };

  /** Неделя отпуска: быстрые сутки отдыха. */
  G.vacation = function (s, trip) {
    if (A.ward) A.ward.handoverAll(s, 'Отпуск: ваших пациентов принял коллега.');
    for (let i = 0; i < 7; i++) {
      if (s.career && !C.isWeekend(s.day)) {
        s.career.today = s.day;
        s.career.weekWorked++;
      }
      G.apply(s, { stress: trip ? -9 : -6, health: trip ? 2 : 1 });
      s.slot = 3;
      G.newDay(s, 'full', { vacation: true });
    }
    G.say(s, trip ? 'Неделя у моря. Ты плавал{|а}, спал{|а} и ни разу не открыл{|а} медицинскую систему. Кокошка жила у Лизы и, по слухам, растолстела.' : 'Неделя дома: книги, долгие завтраки, Кокошка на коленях. Отдых без подвигов — тоже отдых.');
  };
})((window.A = window.A || {}));
