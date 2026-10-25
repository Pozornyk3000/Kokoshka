/* Мир игры: области знаний, персонажи, предыстории, мечты, жильё, еда, работа, магазин, достижения. */
(function (A) {
  'use strict';
  const D = (A.data = A.data || {});

  D.domains = {
    psychopath: { name: 'Психопатология', short: 'Психопатология' },
    affective: { name: 'Аффективные расстройства', short: 'Аффективные' },
    psychosis: { name: 'Шизофрения и психозы', short: 'Психозы' },
    neurotic: { name: 'Тревога, ОКР и стресс', short: 'Тревога и стресс' },
    addiction: { name: 'Зависимости', short: 'Зависимости' },
    organic: { name: 'Органика и деменции', short: 'Органика' },
    child: { name: 'Детская психиатрия и РПП', short: 'Детская' },
    personality: { name: 'Личность и психотерапия', short: 'Психотерапия' },
    pharm: { name: 'Психофармакология', short: 'Фармакология' },
    emergency: { name: 'Неотложка и право', short: 'Неотложка' },
  };
  D.domainKeys = Object.keys(D.domains);

  /* ---------- Персонажи ---------- */
  D.npc = {
    korsakova: {
      name: 'Вера Павловна Корсакова',
      short: 'Корсакова',
      role: 'профессор, заведующая кафедрой',
      look: { sex: 'f', age: 63, skin: 0, hair: 'bun', hairColor: '#C9C3BA', glasses: 'round', clothes: 'coat', accessory: 'brooch' },
    },
    kandinsky: {
      name: 'Виктор Андреевич Кандинский',
      short: 'Кандинский',
      role: 'доцент, ведёт семинары',
      look: { sex: 'm', age: 46, skin: 1, hair: 'side', hairColor: '#3A2C24', beard: 'short', clothes: 'coat' },
    },
    liza: {
      name: 'Лиза Белова',
      short: 'Лиза',
      role: 'ординатор, одногруппница',
      look: { sex: 'f', age: 26, skin: 0, hair: 'long', hairColor: '#8A4B2A', clothes: 'sweater', clothesColor: '#5E7E6B', accessory: 'earrings' },
    },
    marat: {
      name: 'Марат Хайруллин',
      short: 'Марат',
      role: 'ординатор, вечно невыспавшийся',
      look: { sex: 'm', age: 27, skin: 2, hair: 'messy', hairColor: '#1E1A18', stubble: true, clothes: 'hoodie', clothesColor: '#3F4B66' },
    },
    galina: {
      name: 'Галина Петровна',
      short: 'Галина Петровна',
      role: 'старшая медсестра ПБ №6',
      look: { sex: 'f', age: 58, skin: 1, hair: 'bob', hairColor: '#7B2E3A', glasses: 'rect', clothes: 'scrubs', clothesColor: '#5FA39A' },
    },
    shubin: {
      name: 'Олег Германович Шубин',
      short: 'Шубин',
      role: 'заведующий отделением',
      look: { sex: 'm', age: 56, skin: 0, hair: 'bald', hairColor: '#8E8780', glasses: 'rect', clothes: 'coat', beard: 'mustache' },
    },
    mom: {
      name: 'Мама',
      short: 'Мама',
      role: '',
      look: { sex: 'f', age: 54, skin: 1, hair: 'bob', hairColor: '#6B4A33', clothes: 'cardigan', clothesColor: '#A35D6A' },
    },
  };

  /* ---------- Предыстории ---------- */
  D.backgrounds = {
    excellent: {
      name: ['Отличник', 'Отличница'],
      desc: 'Красный диплом, конспекты в пяти цветах. Знаний больше, денег — меньше.',
      perk: '+8 ко всем знаниям, учёба даёт на 15% больше',
      money: 12000,
      rep: 5,
      know: { all: 8 },
      studyBonus: 0.15,
      doctor: { grades: { exam1: 5, practice: 5, gia: 5, accr: 5 }, accrPct: 93, note: 'В дипломе — одни «отлично»: открыты все места работы.' },
    },
    dynasty: {
      name: ['Из семьи врачей', 'Из семьи врачей'],
      desc: 'Мама — невролог, папа — хирург. Помогают деньгами, но ждут великих свершений.',
      perk: 'Старт с 30 000 ₽, +10 репутации, мама иногда присылает деньги',
      money: 30000,
      rep: 12,
      know: { all: 4 },
      momMoney: 3000,
      doctor: { grades: { exam1: 4, practice: 5, gia: 5, accr: 5 }, accrPct: 88, note: 'В дипломе «хорошо» и «отлично», плюс связи семьи: открыты все места работы.' },
    },
    orderly: {
      name: ['Бывший санитар', 'Бывшая санитарка'],
      desc: 'Три года ночных смен в «шестёрке». Отделение знаешь изнутри, возбуждённых пациентов не боишься.',
      perk: 'Знания неотложки и психопатологии выше, стресс копится на 15% медленнее, ночные смены платят больше',
      money: 15000,
      rep: 3,
      know: { all: 2, psychopath: 12, emergency: 14, psychosis: 8 },
      stressResist: 0.15,
      nightBonus: 700,
      doctor: { grades: { exam1: 4, practice: 5, gia: 4, accr: 4 }, accrPct: 79, note: 'В дипломе «хорошо», практика — «отлично». Сразу берут в ПНД и в больницу.' },
    },
    province: {
      name: ['Из маленького города', 'Из маленького города'],
      desc: 'Приехал{|а} из райцентра. Денег мало, зато выносливости на троих, а мама шлёт посылки.',
      perk: 'Максимум энергии 115, мамины посылки экономят на еде',
      money: 7000,
      rep: 0,
      know: { all: 5 },
      maxEnergy: 115,
      parcels: true,
      doctor: { grades: { exam1: 4, practice: 4, gia: 4, accr: 4 }, accrPct: 82, note: 'В дипломе твёрдые «хорошо». Сразу берут в ПНД и в больницу.' },
    },
  };

  /* ---------- Режимы игры ---------- */
  D.modes = {
    full: {
      name: 'Полный путь',
      eyebrow: 'Ординатура → диплом → работа',
      desc: 'Последний семестр ординатуры: лекции и семинары, практика с пациентами в отделении, ГИА, диплом и аккредитация. Потом — работа, дежурства и взрослая жизнь.',
      card: 'Личная карточка ординатора',
      start: 'Начать семестр',
    },
    doctor: {
      name: 'Старт с врача',
      eyebrow: 'Сразу на работу',
      desc: 'Ординатура, диплом и аккредитация уже позади. Выбираешь место работы — ПНД, больница, частная клиника или кафедра — и сразу ведёшь своих пациентов.',
      card: 'Личная карточка врача',
      start: 'Выйти на работу',
    },
  };

  /* ---------- Мечты (цель игры) ---------- */
  D.dreams = {
    flat: {
      title: 'Своя квартира',
      goal: 'Накопить 1 000 000 ₽ на первый взнос по ипотеке.',
      progress: (s) => ({ value: Math.max(0, s.money), max: 1000000, label: A.util.money(Math.max(0, s.money)) + ' из 1 000 000 ₽' }),
      check: (s) => s.money >= 1000000,
      ending: 'flat',
    },
    office: {
      title: 'Свой кабинет',
      goal: 'Открыть частный кабинет: 600 000 ₽, репутация 70 и вторая категория.',
      progress: (s) => {
        const rank = A.game ? A.game.rankIndex(s) : 0;
        const parts = [Math.min(1, Math.max(0, s.money) / 600000), Math.min(1, s.rep / 70), Math.min(1, rank / 2)];
        return {
          value: parts.reduce((a, b) => a + b, 0),
          max: 3,
          label: A.util.money(Math.max(0, s.money)) + ' / 600 000 ₽ · репутация ' + Math.round(s.rep) + '/70 · категория ' + (rank >= 2 ? 'есть' : 'нет'),
        };
      },
      check: (s) => s.money >= 600000 && s.rep >= 70 && A.game.rankIndex(s) >= 2,
      ending: 'office',
    },
    science: {
      title: 'Наука',
      goal: 'Стать кандидатом наук: 3 статьи, доклад на конференции, средние знания 70+.',
      progress: (s) => {
        const avg = A.game ? A.game.knowAvg(s) : 0;
        const pubs = s.science ? s.science.pubs : 0;
        const talk = s.science && s.science.talk ? 1 : 0;
        return {
          value: Math.min(3, pubs) + talk + Math.min(1, avg / 70),
          max: 5,
          label: 'Статей ' + pubs + '/3 · доклад ' + (talk ? 'есть' : 'нет') + ' · знания ' + Math.round(avg) + '/70',
        };
      },
      check: (s) => s.science && s.science.pubs >= 3 && s.science.talk && A.game.knowAvg(s) >= 70,
      ending: 'science',
    },
    balance: {
      title: 'Жить, а не выживать',
      goal: 'Встретить 1 марта врачом без выгорания: накопления 200 000 ₽, здоровье 70+, стресс ниже 40.',
      progress: (s) => {
        const target = A.cal.dayOf(2, 1);
        return {
          value: Math.min(s.day, target),
          max: target,
          label: 'До 1 марта: ' + Math.max(0, target - s.day) + ' дн. · ' + A.util.money(Math.max(0, s.money)) + ' / 200 000 ₽',
        };
      },
      check: (s) =>
        s.day >= A.cal.dayOf(2, 1) && s.phase === 'career' && s.money >= 200000 && s.health >= 70 && s.stress < 40 && !s.burnout.active,
      ending: 'balance',
    },
  };

  /* ---------- Жильё (аренда за неделю) ---------- */
  D.housing = {
    dorm: {
      name: 'Общежитие',
      place: 'Общежитие, комн. 412',
      rent: 600,
      sleep: 0,
      relief: 0,
      move: 0,
      desc: 'Комната на двоих. Сосед играет на гитаре в два ночи, зато дёшево и до кафедры пять минут.',
      studentOnly: true,
    },
    room: {
      name: 'Комната в квартире',
      place: 'Комната на Садовой',
      rent: 4200,
      sleep: 8,
      relief: 2,
      move: 6000,
      desc: 'Своя комната в двушке. Хозяйка строгая, зато тишина и окно во двор.',
    },
    studio: {
      name: 'Студия у метро',
      place: 'Студия у метро',
      rent: 9500,
      sleep: 15,
      relief: 4,
      move: 14000,
      desc: 'Светлая студия с кухней-нишей. Кокошка сразу заняла подоконник.',
    },
  };

  /* ---------- Питание (за неделю) ---------- */
  D.food = {
    cheap: { name: 'Гречка и макароны', cost: 1800, health: -0.6, energy: -6, desc: 'Экономно, но к пятнице хочется плакать.' },
    normal: { name: 'Нормальная еда', cost: 3700, health: 0, energy: 0, desc: 'Супы, котлеты, иногда фрукты.' },
    healthy: { name: 'Правильное питание', cost: 6400, health: 0.7, energy: 6, desc: 'Овощи, рыба, никаких «перекусов из автомата».' },
  };

  D.weekly = { transport: 700, phone: 350, cat: 450 };

  /* ---------- Основная работа ---------- */
  D.jobs = {
    pnd: {
      name: 'ПНД №2',
      role: 'Участковый врач-психиатр',
      desc: 'Амбулаторный приём: депрессии, тревога, пациенты с шизофренией в ремиссии, пожилые с деменцией. Много бумаг.',
      salary: 17500,
      energy: 30,
      stress: 10,
      settings: ['pnd', 'consult'],
      caseChance: 0.55,
      rep: 1,
      scene: 'office',
      place: 'ПНД №2, кабинет 14',
      req: () => null,
    },
    hospital: {
      name: 'Психиатрическая больница №6',
      role: 'Врач острого отделения',
      desc: 'Острые психозы, мании, делирии, неотложка. Платят чуть больше, можно брать дежурства. Стресс — выше.',
      salary: 19000,
      energy: 36,
      stress: 12,
      settings: ['ward', 'er'],
      caseChance: 0.65,
      rep: 1.3,
      scene: 'ward',
      place: 'ПБ №6, острое отделение',
      nightDuty: true,
      req: (s) => (A.game.gradeAvg(s) >= 3.5 || s.rep >= 15 ? null : 'Нужен средний балл 3,5+ или репутация 15+'),
    },
    private: {
      name: 'Клиника «Ясный ум»',
      role: 'Психиатр-консультант',
      desc: 'Частный приём: тревога, депрессия, ОКР, бессонница, расстройства личности. Оклад небольшой, но платят за каждого довольного пациента.',
      salary: 8000,
      perCase: 3200,
      energy: 26,
      stress: 8,
      settings: ['private'],
      caseChance: 0.85,
      rep: 1.1,
      scene: 'private',
      place: 'Клиника «Ясный ум»',
      reviews: true,
      req: (s) => (A.game.gradeAvg(s) >= 4.5 || s.rep >= 30 ? null : 'Нужен средний балл 4,5+ или репутация 30+'),
    },
    uni: {
      name: 'Университетская клиника',
      role: 'Ассистент кафедры психиатрии',
      desc: 'Лечение, преподавание и наука. Статьи пишутся быстрее, а Корсакова зовёт на конференции.',
      salary: 15000,
      energy: 30,
      stress: 9,
      settings: ['ward', 'pnd', 'private', 'consult'],
      caseChance: 0.5,
      rep: 1.2,
      scene: 'seminar',
      place: 'Кафедра психиатрии',
      science: true,
      req: (s) => (A.game.gradeAvg(s) >= 4.5 ? null : 'Нужен средний балл 4,5+'),
    },
  };

  D.ranks = [
    { xp: 0, name: 'Молодой специалист', mult: 1 },
    { xp: 600, name: 'Врач-психиатр', mult: 1.08 },
    { xp: 2600, name: 'Врач второй категории', mult: 1.18 },
    { xp: 6000, name: 'Врач первой категории', mult: 1.3 },
    { xp: 10000, name: 'Врач высшей категории', mult: 1.45 },
  ];

  /* ---------- Магазин ---------- */
  D.shop = [
    { id: 'earplugs', name: 'Беруши и маска для сна', price: 600, desc: 'Сон крепче: +5 энергии утром. Сосед с гитарой больше не страшен.' },
    { id: 'textbook', name: 'Толстый учебник психиатрии', price: 3800, desc: 'Самостоятельная учёба даёт на 40% больше знаний.' },
    { id: 'pharmguide', name: 'Карманный справочник по психофармакологии', price: 1900, desc: 'Фармакология учится в полтора раза быстрее, а на приёме подсказывает с назначениями.' },
    { id: 'coffee', name: 'Кофемашина', price: 12000, desc: 'Каждое утро +8 энергии, домашний кофе бодрит сильнее.' },
    { id: 'mattress', name: 'Ортопедический матрас', price: 16000, desc: '+10 энергии после сна.' },
    { id: 'gym', name: 'Годовой абонемент в бассейн и зал', price: 14000, desc: 'Открывает тренировки: здоровье растёт, стресс уходит.' },
    { id: 'bike', name: 'Велосипед', price: 22000, desc: 'Курьером — на 40% больше заработок, транспорт дешевле.' },
    { id: 'laptop', name: 'Ноутбук', price: 48000, desc: 'Открывает онлайн-консультации и ускоряет написание статей.' },
    { id: 'suit', name: 'Хороший костюм', price: 18000, desc: 'Пациенты доверяют больше: +15% к росту репутации.' },
    { id: 'catfood', name: 'Годовой запас премиум-корма для Кокошки', price: 6000, desc: 'Кокошка счастлива: поглаживания снимают стресс в полтора раза лучше.' },
    { id: 'course_cbt', name: 'Интенсив по КПТ (баллы НМО)', price: 15000, desc: '+12 к знаниям психотерапии и тревожных расстройств. Нужен для доклада о психотерапии.', phase: 'career' },
    { id: 'course_child', name: 'Курс по детской психиатрии (баллы НМО)', price: 9000, desc: '+15 к знаниям детской психиатрии.', phase: 'career' },
  ];
  D.shopById = {};
  D.shop.forEach((it) => (D.shopById[it.id] = it));

  /* ---------- Достижения ---------- */
  D.achievements = {
    first_case: { name: 'Первый пациент', desc: 'Разобрать первый клинический случай.' },
    perfect: { name: 'Как по учебнику', desc: 'Набрать 100 баллов за случай.' },
    ask_suicide: { name: 'Не бойся спросить', desc: 'Трижды прямо спросить о суицидальных мыслях там, где это было нужно.' },
    thiamine: { name: 'Сначала тиамин', desc: 'Назначить тиамин пациенту с алкогольным поражением мозга.' },
    red_diploma: { study: true, name: 'Круглый отличник', desc: '«Отлично» на экзамене и ГИА и не меньше 85% на аккредитации. Диплома ординатуры «с отличием» не бывает — но гордиться можно.' },
    first_discharge: { name: 'Первая выписка', desc: 'Выписать своего первого пациента из отделения.' },
    ward_good: { name: 'По клиническим рекомендациям', desc: 'Пять пациентов, выписанных на «отлично».' },
    automat: { study: true, name: 'Автомат', desc: 'Получить оценку «автоматом» за работу в семестре.' },
    no_skips: { study: true, name: 'Ни одного прогула', desc: 'Посетить все лекции и семинары семестра.' },
    night_owl: { name: 'Ночная смена', desc: 'Отработать 10 ночей.' },
    courier: { name: 'Доставка за 15 минут', desc: 'Отработать 8 смен курьером.' },
    kokoshka: { name: 'Лучший друг Кокошки', desc: 'Погладить Кокошку 30 раз.' },
    saver: { name: 'Подушка безопасности', desc: 'Накопить 100 000 ₽.' },
    rich: { name: 'Миллион', desc: 'Накопить 1 000 000 ₽.' },
    burnout: { name: 'Сгорел{|а} на работе', desc: 'Дойти до выгорания.' },
    recovered: { name: 'Сначала маску на себя', desc: 'Восстановиться после выгорания.' },
    therapy: { name: 'Врачу, исцелися сам', desc: 'Сходить на 5 сессий супервизии или терапии.' },
    bookworm: { name: 'Книжный червь', desc: 'Довести любую область знаний до 80.' },
    polymath: { name: 'Энциклопедист', desc: 'Все области знаний — 60 и выше.' },
    ethics: { name: 'Клятва', desc: 'Трижды поступить по совести, когда было выгодно иначе.' },
    diagnostician: { name: 'Диагност', desc: 'Поставить 25 верных диагнозов.' },
    first_salary: { name: 'Первая зарплата', desc: 'Получить первую врачебную зарплату.' },
    dream: { name: 'Мечта сбылась', desc: 'Достичь своей мечты.' },
  };
})((window.A = window.A || {}));
