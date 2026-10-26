/* Экраны вне активностей: титул, создание персонажа, зачётка/карьера, справочник, меню, об игре. */
(function (A) {
  'use strict';
  const U = A.util;
  const C = A.cal;
  const D = A.data;
  const G = A.game;
  const UI = A.ui;
  const S = (UI.screens = {});

  /* ---------- Титул ---------- */
  S.title = function () {
    const save = A.boot && A.boot.save;
    const cloud = A.store.cloudState;
    const name = save && save.player ? save.player.name : '';
    return (
      '<main class="title-screen"><div class="wrap">' +
      '<figure class="scene cover-art">' +
      A.art.scene('title', { slot: 2, season: 'autumn', seed: 7 }) +
      '</figure>' +
      '<section class="cover">' +
      '<div class="cover-top"><span>Мед. университет города N</span><span>Форма № 003/у</span></div>' +
      '<h1 class="cover-title">Анамнез</h1>' +
      '<p class="cover-latin">anamnesis vitae · история жизни</p>' +
      '<p class="cover-pitch">Симулятор ординатора-психиатра. Лекции и семинары, клинические задачи на приёме, сессия и аккредитация, а потом — работа, ночные дежурства, подработки, аренда и рыжая кошка Кокошка.</p>' +
      '<dl class="cover-fields">' +
      '<div><dt>Ф. И. О.</dt><dd class="hand">' + (name ? U.esc(name) : '&nbsp;') + '</dd></div>' +
      '<div><dt>Специальность</dt><dd class="hand">психиатрия</dd></div>' +
      '<div><dt>Последняя запись</dt><dd class="hand">' + (save ? C.fmtDate(save.day) + ', ' + C.SLOTS_LOW[save.slot] : '&nbsp;') + '</dd></div>' +
      '</dl>' +
      '<div class="cover-btns">' +
      (save ? '<button type="button" class="btn primary" data-act="continue">Продолжить</button>' : '') +
      '<button type="button" class="btn' + (save ? '' : ' primary') + '" data-act="new">Новая игра</button>' +
      '<button type="button" class="btn ghost" data-act="refs-open">Справочники</button>' +
      '<button type="button" class="btn ghost" data-act="tr-open" data-arg="title">Тренажёр: тесты и задачи</button>' +
      '<button type="button" class="btn ghost" data-act="about">Об игре</button>' +
      '</div>' +
      '<p class="cover-note">' +
      (cloud === 'on' ? 'Сохранения хранятся в браузере и в вашем личном разделе Claude.' : cloud === 'connecting' ? 'Проверяем облачное сохранение…' : 'Игра сохраняется автоматически ' + (window.AnamnezAndroid ? 'на этом телефоне.' : 'в этом браузере.')) +
      '</p>' +
      S.soundToggle() +
      '</section></div></main>'
    );
  };
  /** Переключатель фоновой музыки (на титуле и в меню). */
  S.soundToggle = function () {
    if (!A.sound || !(window.AudioContext || window.webkitAudioContext)) return '';
    const on = A.sound.enabled();
    return '<button type="button" class="sound-toggle" data-act="sound-toggle" aria-pressed="' + on + '">' + UI.icon(on ? 'sound' : 'mute') + '<span>Фоновая музыка: ' + (on ? 'включена' : 'выключена') + '</span></button>';
  };
  UI.on('sound-toggle', () => {
    A.sound.setEnabled(!A.sound.enabled());
    UI.render();
  });

  /* ---------- Выбор режима ---------- */
  S.mode = function () {
    const art = { full: 'lecture', doctor: 'office' };
    const cards = Object.keys(D.modes)
      .map((k) => {
        const m = D.modes[k];
        return (
          '<button type="button" class="mode-card" data-act="mode-pick" data-arg="' + k + '">' +
          '<span class="mode-art" aria-hidden="true">' + A.art.scene(art[k] || 'street', { slot: k === 'doctor' ? 1 : 0, season: 'autumn', seed: 11 }) + '</span>' +
          '<span class="mode-body"><span class="eyebrow">' + U.esc(m.eyebrow) + '</span>' +
          '<span class="mode-t">' + U.esc(m.name) + '</span>' +
          '<span class="mode-d">' + U.esc(m.desc) + '</span></span>' +
          '</button>'
        );
      })
      .join('');
    return (
      '<main class="wrap create">' +
      '<header class="create-head"><span class="eyebrow">Новая игра</span><h1 class="display">С чего начнём?</h1></header>' +
      '<div class="mode-grid">' + cards + '</div>' +
      '<div class="create-btns"><button type="button" class="btn ghost" data-act="mode-back">Назад</button></div>' +
      '</main>'
    );
  };
  UI.on('mode-pick', (k) => {
    if (!D.modes[k]) return;
    const prev = UI.view.create;
    UI.view.create = Object.assign({ name: 'Саша', gender: 'm', background: 'excellent', dream: 'flat' }, prev || {}, { mode: k });
    UI.view.screen = 'create';
    UI.render({ scroll: 'top' });
  });
  UI.on('mode-back', () => {
    UI.view.screen = null;
    UI.view.create = null;
    UI.render({ scroll: 'top' });
  });

  /* ---------- Создание персонажа ---------- */
  S.create = function () {
    const c = UI.view.create || (UI.view.create = { name: 'Саша', gender: 'm', background: 'excellent', dream: 'flat', mode: 'full', difficulty: 'normal' });
    if (!D.difficulty[c.difficulty]) c.difficulty = 'normal';
    const diffCards = Object.keys(D.difficulty)
      .map((k) => '<button type="button" class="pick-card" data-act="cr-diff" data-arg="' + k + '" aria-pressed="' + (c.difficulty === k) + '"><span class="pick-t">' + U.esc(D.difficulty[k].name) + '</span><span class="pick-d">' + U.esc(D.difficulty[k].desc) + '</span></button>')
      .join('');
    const mode = D.modes[c.mode] ? c.mode : 'full';
    const doc = mode === 'doctor';
    const f = c.gender === 'f';
    const bgCards = Object.keys(D.backgrounds)
      .map((k) => {
        const b = D.backgrounds[k];
        return (
          '<button type="button" class="pick-card" data-act="cr-bg" data-arg="' + k + '" aria-pressed="' + (c.background === k) + '">' +
          '<span class="pick-t">' + b.name[f ? 1 : 0] + '</span>' +
          '<span class="pick-d">' + U.esc(b.desc.replace(/\{([^{}|]*)\|([^{}|]*)\}/g, (m, a, bb) => (f ? bb : a))) + '</span>' +
          '<span class="pick-p">' + U.esc(b.perk) + '</span>' +
          (doc && b.doctor ? '<span class="pick-p doc">' + U.esc(b.doctor.note) + '</span>' : '') +
          '</button>'
        );
      })
      .join('');
    const dreamCards = Object.keys(D.dreams)
      .map((k) => {
        const d = D.dreams[k];
        return '<button type="button" class="pick-card" data-act="cr-dream" data-arg="' + k + '" aria-pressed="' + (c.dream === k) + '"><span class="pick-t">' + U.esc(d.title) + '</span><span class="pick-d">' + U.esc(d.goal) + '</span></button>';
      })
      .join('');
    return (
      '<main class="wrap create">' +
      '<header class="create-head"><span class="eyebrow">' + U.esc(D.modes[mode].card) + '</span><h1 class="display">Кто ты?</h1>' +
      '<p class="mode-line">Режим: <b>' + U.esc(D.modes[mode].name) + '</b> · <button type="button" class="link" data-act="cr-mode">сменить</button></p></header>' +
      '<div class="create-portrait">' + A.art.portrait(S.playerLook(c.name, c.gender), 'smile', { seed: 3 }) + '</div>' +
      '<label class="field" for="pname"><span class="label">Имя</span><input id="pname" name="pname" maxlength="24" value="' + U.esc(c.name) + '" autocomplete="off" spellcheck="false"></label>' +
      '<div class="field"><span class="label">Как к тебе обращаться</span><div class="seg" role="group">' +
      '<button type="button" data-act="cr-gender" data-arg="m" aria-pressed="' + !f + '">Он</button>' +
      '<button type="button" data-act="cr-gender" data-arg="f" aria-pressed="' + f + '">Она</button>' +
      '</div></div>' +
      '<div class="field"><span class="label">Предыстория' + (doc ? ' — от неё зависят оценки в дипломе' : '') + '</span><div class="pick-grid">' + bgCards + '</div></div>' +
      '<div class="field"><span class="label">Мечта — цель игры</span><div class="pick-grid">' + dreamCards + '</div></div>' +
      '<div class="field"><span class="label">Сложность — можно сменить в меню</span><div class="pick-grid">' + diffCards + '</div></div>' +
      '<div class="create-btns"><button type="button" class="btn primary wide" data-act="cr-start">' + U.esc(D.modes[mode].start) + '</button><button type="button" class="btn ghost" data-act="cr-back">Назад</button></div>' +
      '</main>'
    );
  };
  S.playerLook = function (name, gender) {
    const look = A.art.randomLook(U.hash('player:' + name + gender), { sex: gender === 'f' ? 'f' : 'm', age: 27 });
    look.clothes = 'coat';
    look.beard = null;
    return look;
  };
  document.addEventListener('input', (e) => {
    if (e.target && e.target.id === 'sound-vol' && A.sound) A.sound.setVolume(+e.target.value / 100);
    if (e.target && e.target.id === 'pname' && UI.view.create) UI.view.create.name = e.target.value;
    if (e.target && e.target.id === 'gloss-filter') {
      UI.view.glossFilter = e.target.value;
      const list = document.getElementById('gloss-list');
      if (list) list.innerHTML = S.glossList(e.target.value);
    }
  });
  UI.on('cr-gender', (g) => {
    UI.view.create.gender = g;
    UI.render();
  });
  UI.on('cr-bg', (k) => {
    UI.view.create.background = k;
    UI.render();
  });
  UI.on('cr-dream', (k) => {
    UI.view.create.dream = k;
    UI.render();
  });
  UI.on('cr-diff', (k) => {
    if (!D.difficulty[k]) return;
    const inp = document.getElementById('pname');
    if (inp) UI.view.create.name = inp.value;
    UI.view.create.difficulty = k;
    UI.render();
  });
  UI.on('cr-back', () => {
    UI.view.screen = 'mode';
    UI.render({ scroll: 'top' });
  });
  UI.on('cr-mode', () => {
    const inp = document.getElementById('pname');
    if (inp && UI.view.create) UI.view.create.name = inp.value;
    UI.view.screen = 'mode';
    UI.render({ scroll: 'top' });
  });
  UI.on('cr-start', () => {
    const c = UI.view.create;
    const inp = document.getElementById('pname');
    if (inp) c.name = inp.value;
    A.state = G.newState(c);
    A.store.wipe();
    G.queue(A.state, G.prologue(A.state), 'prologue');
    G.say(A.state, G.morningText(A.state), 'morning');
    G.save();
    A.store.checkpoint(A.state);
    UI.view.screen = null;
    UI.view.tab = 'hub';
    UI.render({ scroll: 'top' });
  });

  /* ---------- Об игре ---------- */
  S.about = function () {
    return (
      '<main class="wrap about">' +
      '<header class="create-head"><span class="eyebrow">Об игре</span><h1 class="display">Анамнез</h1></header>' +
      '<div class="prose">' +
      U.md(
        'Текстовая RPG о последнем семестре ординатуры по психиатрии и первом годе самостоятельной работы.\n\n' +
          '**Режимы.** «Полный путь» — с последнего семестра ординатуры: учёба, практика в отделении, ГИА, диплом и аккредитация, потом работа. «Старт с врача» — диплом и аккредитация уже есть, игра начинается с выбора работы.\n\n' +
          '**Учёба.** Утром — лекции профессора Корсаковой с блиц-опросом, днём — семинары у доцента Кандинского: беседа с пациентом, психический статус, синдром, диагноз по МКБ-10 и тактика. Пропуски отрабатываются, без отработок к сессии не допустят.\n\n' +
          '**Сессия.** Два экзамена с ситуационными задачами и аккредитация: тест плюс клиническая задача.\n\n' +
          '**Жизнь.** Аренда, еда, сон, стресс и выгорание. Подработки: ночные смены в больнице, курьерство, репетиторство, медкомиссии, онлайн-консультации. Знания дают подсказки «клинического чутья», усталость — отнимает вопросы к пациенту.\n\n' +
          '**Тренажёр.** Тесты по темам и в формате аккредитации на трёх уровнях сложности, задачи на диагноз по МКБ-10, свои достижения. Вопросы написаны для игры и не являются официальными заданиями аккредитации — настоящие можно пройти в репетиционном экзамене Методического центра аккредитации специалистов (ссылка — в тренажёре).\n\n' +
          '**Звук.** Тихий фоновый эмбиент меняется по месту и времени суток: дома иногда мурлычет Кокошка, в дождливые дни слышен дождь, на экзаменах тикают часы. Выключить и настроить громкость можно в меню.\n\n' +
          '**Важно.** Клинические случаи вымышлены и упрощены для обучения. Игра опирается на современные клинические рекомендации, но не заменяет учебник, супервизию и консультацию врача. Не используйте её для самолечения.\n\n' +
          '**Если тяжело вам самим** — обратитесь к врачу или позвоните: **112** — экстренные службы; **8-800-2000-122** — бесплатный телефон доверия для детей, подростков и их родителей.'
      ) +
      '</div>' +
      (S.appVersion() ? '<p class="dim small">Версия приложения ' + U.esc(S.appVersion()) + '</p>' : '') +
      '<button type="button" class="btn primary wide" data-act="about-back">Понятно</button>' +
      '</main>'
    );
  };
  UI.on('about', () => {
    UI.view.screen = 'about';
    UI.render({ scroll: 'top' });
  });
  UI.on('about-back', () => {
    UI.view.screen = null;
    UI.render({ scroll: 'top' });
  });
  UI.on('new', () => {
    const go = () => {
      // Если игрок передумает и вернётся на титул, «Продолжить» должно вести в текущую игру, а не в ту, что была при запуске
      if (A.state) {
        G.save();
        A.boot.save = A.state;
      }
      UI.view.create = null;
      UI.view.screen = 'mode';
      A.state = null;
      UI.render({ scroll: 'top' });
    };
    if (A.state || (A.boot && A.boot.save)) UI.ask('Новая игра', 'Текущее сохранение будет удалено. Начать заново?', 'Начать заново', go);
    else go();
  });
  UI.on('continue', () => {
    if (!A.boot.save) return;
    A.state = A.migrate(A.boot.save);
    UI.view.screen = null;
    UI.view.tab = 'hub';
    UI.render({ scroll: 'top' });
  });

  /* ---------- Зачётка / карьера ---------- */
  const W_TO = () => (A.ward ? A.ward.PRACTICE_TO : 19);
  S.profile = function (s) {
    const dream = D.dreams[s.player.dream];
    const prog = dream.progress(s);
    const rankI = G.rankIndex(s);
    const rank = D.ranks[rankI];
    const next = D.ranks[rankI + 1];
    const role = s.phase === 'career' ? rank.name + ' · ' + G.job(s).name : s.phase === 'graduate' ? 'Врач-психиатр без места работы' : 'Ординатор второго года, кафедра психиатрии';
    const knows = D.domainKeys
      .map((k) => {
        const v = s.know[k];
        const lvl = v >= 75 ? 'чутьё III' : v >= 55 ? 'чутьё II' : v >= 35 ? 'чутьё I' : '';
        return '<div class="kbar"><div class="kbar-head"><span>' + D.domains[k].name + '</span><b>' + Math.round(v) + '</b></div><div class="mini-track"><div style="width:' + v + '%"></div></div>' + (lvl ? '<span class="klvl">' + lvl + '</span>' : '') + '</div>';
      })
      .join('');
    const stat = (l, v) => '<div class="stat"><span>' + l + '</span><b>' + v + '</b></div>';
    const row = (name, grade, when, sign) => '<tr><td>' + name + '</td><td class="hand grade">' + (grade || '') + '</td><td class="mono dim">' + (when || '') + '</td><td class="hand sign">' + (sign || '') + '</td></tr>';
    const pr = s.ward && s.ward.practice;
    const exams = ['exam1', 'practice', 'exam2', 'accr']
      .map((k) => {
        if (k === 'practice') {
          if (!pr || !pr.closed) return row('Практика', '', null, '');
          return row('Практика', pr.grade >= 3 ? A.exams.gradeShort(pr.grade) : 'н/з', pr.pre ? pr.date : C.fmtDate(W_TO()), pr.grade >= 3 ? 'Кандинский' : '');
        }
        const r = s.study.exams[k];
        const def = A.exams.defs[k];
        const examiner = def.examiner === 'korsakova' ? 'Корсакова' : def.examiner === 'kandinsky' ? 'Кандинский' : def.examiner === 'gek' ? 'ГЭК' : 'Подкомиссия';
        const g = r ? (def.passFail ? (r.grade >= 3 ? 'сдано' : 'не сдано') : A.exams.gradeShort(r.grade) + (r.automat ? ' (авт.)' : '')) : '';
        return row(def.short, g, r ? G.when(r.lastDay, r.date) : '', r && r.grade >= 3 ? examiner : '');
      })
      .join('');
    const achKeys = Object.keys(D.achievements).filter((k) => !(D.achievements[k].study && s.mode === 'doctor'));
    const achs = achKeys
      .map((k) => {
        const a = D.achievements[k];
        const got = s.ach[k];
        return '<li class="ach' + (got ? ' got' : '') + '"><b>' + U.esc(U.t(a.name)) + '</b><span>' + U.esc(U.t(a.desc)) + '</span></li>';
      })
      .join('');
    let career = '';
    if (s.career) {
      const job = G.job(s);
      const rv = s.career.reviews || [];
      career =
        '<section class="card"><h2 class="h2">Работа</h2><div class="stats">' +
        stat('Место', U.esc(job.name)) +
        stat('Должность', U.esc(job.role)) +
        stat('Оклад в неделю', U.money(Math.round(job.salary * rank.mult))) +
        (rv.length ? stat('Отзывы', (rv.reduce((a, b) => a + b, 0) / rv.length).toFixed(1).replace('.', ',') + ' ★ (' + rv.length + ')') : '') +
        stat('В профессии', s.day - s.career.since + ' дн.') +
        '</div></section>';
    }
    return (
      UI.hud(s) +
      '<main class="wrap profile">' +
      '<section class="id-card"><div class="id-photo">' +
      A.art.portrait(S.playerLook(s.player.name, s.player.gender), s.burnout.active ? 'tired' : s.stress > 70 ? 'anxious' : 'smile', { seed: 3 }) +
      '</div><div class="id-main"><span class="eyebrow">' + (s.phase === 'career' ? 'Карточка врача' : 'Зачётная книжка') + '</span><h1 class="display">' + U.esc(s.player.name) + '</h1><p class="dim">' + U.esc(role) + '</p></div></section>' +
      '<section class="card"><h2 class="h2">Мечта: ' + U.esc(dream.title) + '</h2><p class="dim">' + U.esc(dream.goal) + '</p><div class="mini-track big"><div style="width:' + U.clamp((prog.value / prog.max) * 100, 0, 100) + '%"></div></div><p class="mono small">' + U.esc(prog.label) + '</p>' +
      '<button type="button" class="link" data-act="change-dream">Сменить мечту</button></section>' +
      '<section class="card"><h2 class="h2">Показатели</h2><div class="stats">' +
      stat('Деньги', U.money(s.money)) +
      stat('Репутация', Math.round(s.rep) + ' / 100') +
      stat(s.career ? 'Врачебный опыт' : 'Опыт учёбы', s.career ? Math.round(G.careerXp(s)) + (next ? ' / ' + next.xp : '') : Math.round(s.xp)) +
      stat('Категория', rank.name) +
      stat('Случаев разобрано', s.stats.cases) +
      stat('Верных диагнозов', s.stats.dxRight) +
      stat('Ночных смен', s.stats.nights) +
      stat('Жильё', D.housing[s.housing].name) +
      '</div></section>' +
      career +
      UI.ward.profileCards(s) +
      UI.clinic.profileCard(s) +
      '<section class="card"><h2 class="h2">Знания</h2><p class="dim small">С 35, 55 и 75 баллами по теме открываются подсказки «клинического чутья».</p><div class="kbars">' + knows + '</div></section>' +
      '<section class="card zachetka"><h2 class="h2">Зачётная книжка</h2><div class="table-wrap"><table><thead><tr><th>Дисциплина</th><th>Оценка</th><th>Дата</th><th>Подпись</th></tr></thead><tbody>' + exams + '</tbody></table></div>' +
      (s.phase === 'study' ? '<p class="small dim">Рейтинг семестра: ' + (s.study.ratingMax ? Math.round((s.study.rating / s.study.ratingMax) * 100) : 0) + '%. С 85% и без долгов — шанс на «автомат».</p>' : '') +
      '</section>' +
      '<section class="card"><h2 class="h2">Достижения · ' + achKeys.filter((k) => s.ach[k]).length + ' из ' + achKeys.length + '</h2><ul class="achs">' + achs + '</ul></section>' +
      '</main>' +
      UI.tabbar('profile')
    );
  };
  UI.on('change-dream', () => {
    const s = A.state;
    const order = Object.keys(D.dreams);
    const i = order.indexOf(s.player.dream);
    const next = order[(i + 1) % order.length];
    UI.ask('Сменить мечту?', 'Новая мечта: «' + D.dreams[next].title + '». ' + D.dreams[next].goal, 'Сменить', () => {
      s.player.dream = next;
      s.flags.dreamDone = false;
      G.save();
      UI.render();
    });
  });

  /* ---------- Справочник ---------- */
  S.ref = function (s) {
    const tab = UI.view.ref || 'notes';
    const tabs = [
      ['notes', 'Конспекты'],
      ['gloss', 'Симптомы'],
      ['drugs', 'Препараты'],
      ['kr', 'КР'],
      ['ward', 'Курация'],
      ['amb', 'Участок'],
      ['patients', 'Пациенты'],
      ['log', 'Дневник'],
    ]
      .map((t) => '<button type="button" class="tab" role="tab" data-act="ref-tab" data-arg="' + t[0] + '" aria-selected="' + (tab === t[0]) + '">' + t[1] + '</button>')
      .join('');
    let body = '';
    if (tab === 'notes' || tab === 'gloss') body = S.refCommon(s, tab);
    else if (tab === 'patients') body = S.patients(s);
    else if (tab === 'drugs') body = UI.ward.drugsRef(s);
    else if (tab === 'kr') body = UI.ward.krRef(s);
    else if (tab === 'ward') body = UI.ward.archive(s);
    else if (tab === 'amb') body = UI.clinic.fileRef(s);
    else body = S.journal(s);
    return UI.hud(s) + '<main class="wrap ref"><h1 class="display page-h">Справочник</h1><div class="tabs" role="tablist">' + tabs + '</div><div class="folder pad">' + body + '</div></main>' + UI.tabbar('ref');
  };
  UI.on('ref-tab', (t) => {
    UI.view.ref = t;
    UI.view.refItem = null;
    UI.render();
  });
  /** Разделы справочника, которым не нужна игра: доступны и с титульного экрана. */
  S.refCommon = function (s, tab) {
    if (tab === 'notes') return S.notes(s);
    if (tab === 'gloss') return '<label class="field" for="gloss-filter"><span class="label">Поиск по симптомам</span><input id="gloss-filter" type="search" value="' + U.esc(UI.view.glossFilter || '') + '" placeholder="например, бред"></label><div id="gloss-list">' + S.glossList(UI.view.glossFilter || '') + '</div>';
    if (tab === 'drugs') return UI.ward.drugsRef(s);
    if (tab === 'kr') return UI.ward.krRef(s);
    return '';
  };

  /* ---------- Справочники с титульного экрана (без игры) ---------- */
  const REFS_TABS = [
    ['drugs', 'Препараты'],
    ['kr', 'Клинические рекомендации'],
    ['gloss', 'Симптомы'],
    ['notes', 'Конспекты'],
  ];
  S.refs = function () {
    const tab = REFS_TABS.some((t) => t[0] === UI.view.refsTab) ? UI.view.refsTab : 'drugs';
    const tabs = REFS_TABS.map((t) => '<button type="button" class="tab" role="tab" data-act="refs-tab" data-arg="' + t[0] + '" aria-selected="' + (tab === t[0]) + '">' + t[1] + '</button>').join('');
    return (
      '<main class="wrap ref refs-home">' +
      '<header class="create-head"><span class="eyebrow">Анамнез</span><h1 class="display">Справочники</h1>' +
      '<p class="dim">Препараты, клинические рекомендации Минздрава России, симптомы и конспекты лекций — можно читать, не начиная игру.</p></header>' +
      '<div class="tabs" role="tablist">' + tabs + '</div>' +
      '<div class="folder pad">' + S.refCommon(null, tab) + '</div>' +
      '<div class="create-btns"><button type="button" class="btn ghost" data-act="refs-back">На титульный экран</button></div>' +
      '</main>'
    );
  };
  UI.on('refs-open', () => {
    UI.view.screen = 'refs';
    UI.view.refItem = null;
    UI.render({ scroll: 'top' });
  });
  UI.on('refs-tab', (t) => {
    UI.view.refsTab = t;
    UI.view.refItem = null;
    UI.render();
  });
  UI.on('refs-back', () => {
    UI.view.screen = null;
    UI.view.refItem = null;
    UI.render({ scroll: 'top' });
  });
  UI.on('menu-ref', (t) => {
    UI.view.tab = 'ref';
    UI.view.ref = t;
    UI.view.refItem = null;
    UI.render({ scroll: 'top' });
  });

  S.notes = function (s) {
    return D.lectures
      .map((L) => {
        const open = !s || s.study.lectures[L.id] || s.phase === 'career' || s.phase === 'graduate';
        if (!open) return '<div class="note locked"><span class="mono dim">№' + L.n + '</span> ' + U.esc(L.title) + ' <span class="chip off">не прослушано</span></div>';
        return (
          '<details class="note"><summary><span class="mono dim">№' + L.n + '</span> ' + U.esc(L.title) + '</summary>' +
          L.slides.map((sl) => '<div class="note-slide"><h3>' + U.esc(sl.h) + '</h3>' + U.md(sl.b) + '</div>').join('') +
          '</details>'
        );
      })
      .join('');
  };
  S.glossList = function (q) {
    q = (q || '').trim().toLowerCase();
    const G2 = D.glossary || {};
    const items = Object.keys(G2)
      .map((k) => G2[k])
      .filter((g) => !q || g.name.toLowerCase().indexOf(q) >= 0 || g.def.toLowerCase().indexOf(q) >= 0)
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    if (!items.length) return '<p class="empty">Ничего не нашлось.</p>';
    return '<dl class="gloss">' + items.map((g) => '<div><dt>' + U.esc(g.name) + '</dt><dd>' + U.esc(g.def) + '</dd></div>').join('') + '</dl>';
  };
  S.patients = function (s) {
    if (!s.caseLog.length) return '<p class="empty">Здесь появятся разобранные пациенты — с диагнозами и разбором ошибок.</p>';
    const open = UI.view.refItem;
    return s.caseLog
      .map((e, i) => {
        const c = D.caseById[e.id];
        if (!c) return '';
        const isOpen = open === i;
        return (
          '<div class="pt-row"><button type="button" class="pt-head" data-act="pt-open" data-arg="' + i + '" aria-expanded="' + isOpen + '">' +
          '<span><b>' + U.esc(e.name) + '</b> · ' + U.esc(c.title) + '<br><span class="dim small">' + C.fmtDate(e.day) + ' · ' + ({ seminar: 'семинар', work: 'приём', exam: 'экзамен' }[e.mode] || '') + '</span></span>' +
          '<span class="score-pill s' + (e.score >= 85 ? 5 : e.score >= 70 ? 4 : e.score >= 50 ? 3 : 2) + '">' + e.score + '</span></button>' +
          (isOpen ? '<div class="pt-body"><p class="mono small">' + U.esc(c.dx.opts.find((o) => o.ok).t) + '</p>' + U.md(c.debrief) + (c.pearl ? '<div class="pearl"><span class="eyebrow">Клиническая жемчужина</span>' + U.md(c.pearl) + '</div>' : '') + '</div>' : '') +
          '</div>'
        );
      })
      .join('');
  };
  UI.on('pt-open', (i) => {
    i = +i;
    UI.view.refItem = UI.view.refItem === i ? null : i;
    UI.render();
  });
  S.journal = function (s) {
    if (!s.log.length) return '<p class="empty">Пока пусто.</p>';
    return s.log
      .slice()
      .reverse()
      .map((e) => '<div class="log-item"><span class="mono dim small">' + C.fmtShort(e.day) + ' · ' + C.SLOTS_LOW[e.slot] + '</span>' + U.md(e.text) + '</div>')
      .join('');
  };

  /* ---------- Меню ---------- */
  S.canShare = function () {
    const app = window.AnamnezAndroid;
    if (app && app.shareText) return true;
    try {
      return !!navigator.share && window.top === window;
    } catch (e) {
      return false;
    }
  };
  S.appVersion = function () {
    const app = window.AnamnezAndroid;
    try {
      return app && app.version ? String(app.version()) : '';
    } catch (e) {
      return '';
    }
  };
  S.menu = function (s) {
    const prefs = A.store.prefs();
    const cloud = A.store.cloudState;
    const cp = A.store.readLocal('checkpoint');
    return (
      UI.hud(s) +
      '<main class="wrap menu"><h1 class="display page-h">Меню</h1>' +
      '<section class="card"><h2 class="h2">Справочники</h2><p class="dim small">Препараты с дозами, противопоказаниями и взаимодействиями, клинические рекомендации Минздрава, симптомы и конспекты лекций.</p><div class="row-btns">' +
      '<button type="button" class="btn" data-act="menu-ref" data-arg="drugs">Препараты</button>' +
      '<button type="button" class="btn" data-act="menu-ref" data-arg="kr">Клинические рекомендации</button>' +
      '<button type="button" class="btn ghost" data-act="menu-ref" data-arg="gloss">Симптомы</button>' +
      '<button type="button" class="btn ghost" data-act="menu-ref" data-arg="notes">Конспекты</button>' +
      '</div></section>' +
      '<section class="card"><h2 class="h2">Тренажёр</h2><p class="dim small">Тесты в формате аккредитации и по темам на трёх уровнях сложности, работа над ошибками, задачи «поставьте диагноз по МКБ-10», свои достижения и ссылка на официальный репетиционный экзамен. Вопросы игры — не настоящие задания аккредитации. На игру не влияет.</p><div class="row-btns"><button type="button" class="btn" data-act="tr-open" data-arg="game">Открыть тренажёр</button></div></section>' +
      '<section class="card"><h2 class="h2">Сохранение</h2><p class="dim">' +
      (cloud === 'on'
        ? 'Игра сохраняется автоматически: в этом браузере и в вашем личном облачном разделе Claude.'
        : 'Игра сохраняется автоматически ' + (window.AnamnezAndroid ? 'в приложении на этом телефоне' : 'в этом браузере') + '. Чтобы перенести её на другое устройство, скопируйте код сохранения.') +
      '</p><div class="row-btns"><button type="button" class="btn" data-act="export">Скопировать код сохранения</button>' +
      (S.canShare() ? '<button type="button" class="btn ghost" data-act="share-code">Отправить код</button>' : '') +
      '</div>' +
      '<label class="field" for="import-code"><span class="label">Загрузить из кода</span><textarea id="import-code" rows="2" placeholder="ANM1…"></textarea></label>' +
      '<div class="row-btns"><button type="button" class="btn" data-act="import">Загрузить</button></div>' +
      (UI.view.exportCode ? '<label class="field" for="export-code"><span class="label">Ваш код</span><textarea id="export-code" rows="3" readonly>' + U.esc(UI.view.exportCode) + '</textarea></label>' : '') +
      '</section>' +
      '<section class="card"><h2 class="h2">Чекпоинт</h2><p class="dim">Каждый понедельник игра запоминает начало недели. ' + (cp ? 'Последний: ' + C.fmt(cp.day) + '.' : '') + '</p><div class="row-btns"><button type="button" class="btn" data-act="load-cp"' + (cp ? '' : ' aria-disabled="true"') + '>Вернуться к началу недели</button></div></section>' +
      (S.soundToggle()
        ? '<section class="card"><h2 class="h2">Звук</h2><p class="dim small">Тихий фоновый эмбиент: меняется по месту и времени суток, в дождь слышно дождь, дома иногда мурлычет Кокошка.</p>' +
          S.soundToggle() +
          '<label class="field vol" for="sound-vol"><span class="label">Громкость</span><input id="sound-vol" type="range" min="0" max="100" step="5" value="' + Math.round(A.sound.volume() * 100) + '"' + (A.sound.enabled() ? '' : ' disabled') + '></label></section>'
        : '') +
      '<section class="card"><h2 class="h2">Чтение</h2><div class="row-btns"><button type="button" class="btn" data-act="big-text" aria-pressed="' + !!prefs.bigText + '">' + (prefs.bigText ? 'Обычный текст' : 'Крупный текст') + '</button></div></section>' +
      '<section class="card"><h2 class="h2">Сложность</h2><p class="dim small">' + U.esc(D.difficulty[G.difficulty(s)].desc) + '</p><div class="seg segb" role="group" aria-label="Сложность">' +
      Object.keys(D.difficulty).map((k) => '<button type="button" class="seg-b" data-act="set-diff" data-arg="' + k + '" aria-pressed="' + (G.difficulty(s) === k) + '">' + U.esc(D.difficulty[k].name) + '</button>').join('') +
      '</div><p class="small dim">Новая сложность действует со следующего пациента.</p></section>' +
      '<section class="card"><h2 class="h2">Игра</h2><p class="dim small">Режим: ' + U.esc((D.modes[s.mode] || D.modes.full).name) + '.</p><div class="row-btns"><button type="button" class="btn" data-act="to-title">На титульный экран</button><button type="button" class="btn ghost" data-act="about">Об игре</button><button type="button" class="btn danger" data-act="new">Новая игра</button></div></section>' +
      '</main>' +
      UI.tabbar('menu')
    );
  };
  UI.on('export', () => {
    const code = A.store.exportCode(A.state);
    UI.view.exportCode = code;
    const done = () => UI.toast('Код сохранения скопирован');
    const app = window.AnamnezAndroid;
    if (app && app.copyText) {
      let ok = false;
      try {
        ok = app.copyText(code);
      } catch (e) {
        ok = false;
      }
      UI.render();
      if (ok) done();
      return;
    }
    try {
      navigator.clipboard.writeText(code).then(done, () => {
        UI.render();
        const t = document.getElementById('export-code');
        if (t) t.select();
      });
    } catch (e) {
      UI.render();
    }
    UI.render();
  });
  UI.on('share-code', () => {
    const code = A.store.exportCode(A.state);
    UI.view.exportCode = code;
    const app = window.AnamnezAndroid;
    try {
      if (app && app.shareText) app.shareText(code);
      else if (navigator.share) navigator.share({ title: 'Анамнез: код сохранения', text: code }).catch(() => {});
    } catch (e) {
      /* поделиться не вышло — код всё равно показан ниже */
    }
    UI.render();
  });
  UI.on('import', () => {
    const t = document.getElementById('import-code');
    const st = A.store.importCode(t ? t.value : '');
    if (!st) {
      UI.toast('Код не подошёл. Скопируйте его целиком, начиная с ANM1.');
      return;
    }
    UI.ask('Загрузить сохранение?', 'Текущая игра будет заменена сохранением от ' + C.fmt(st.day) + '.', 'Загрузить', () => {
      A.state = A.migrate(st);
      G.save();
      // Чекпоинт прежней игры больше не подходит: начало недели — теперь загруженная игра
      A.store.checkpoint(A.state);
      UI.view.tab = 'hub';
      UI.render({ scroll: 'top' });
    });
  });
  UI.on('load-cp', () => {
    const cp = A.store.readLocal('checkpoint');
    if (!cp) return;
    UI.ask('Вернуться к началу недели?', 'Всё, что было после ' + C.fmt(cp.day) + ', будет потеряно.', 'Вернуться', () => {
      A.state = A.migrate(cp);
      G.save();
      UI.view.tab = 'hub';
      UI.render({ scroll: 'top' });
    });
  });
  UI.on('set-diff', (k) => {
    const s = A.state;
    if (!s || !D.difficulty[k]) return;
    s.difficulty = k;
    G.save();
    UI.render();
    UI.toast('Сложность: ' + U.esc(D.difficulty[k].name.toLowerCase()) + '.');
  });
  UI.on('big-text', () => {
    A.store.setPref('bigText', !A.store.prefs().bigText);
    UI.render();
  });
  UI.on('to-title', () => {
    G.save();
    A.boot.save = A.state;
    A.state = null;
    UI.view.tab = 'hub';
    UI.render({ scroll: 'top' });
  });
})((window.A = window.A || {}));
