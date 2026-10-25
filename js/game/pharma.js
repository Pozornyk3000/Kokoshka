/* Психофармакология: формуляр, проверка назначений по клиническим рекомендациям и стандартам,
   модель действия препаратов (эффект, нежелательные явления, лабораторные показатели). */
(function (A) {
  'use strict';
  const U = A.util;
  const P = (A.pharma = {});
  const D = () => A.data;

  /* ---------- Группы пациентов: домены эффекта и параметры течения ---------- */
  // K — скорость улучшения при полном эффекте (доля тяжести в день), drift — течение без лечения (пунктов в день),
  // discharge — порог тяжести для выписки, los — разумный срок госпитализации [от, до] в днях.
  P.GROUPS = {
    schizophrenia: { name: 'Шизофрения', domains: ['psychosis'], topic: 'psychosis', K: 0.075, drift: 0.4, discharge: 32, los: [14, 35] },
    mania: { name: 'Маниакальный эпизод', domains: ['mania'], topic: 'affective', K: 0.1, drift: 0.5, discharge: 30, los: [10, 28] },
    bipolar_depression: { name: 'Биполярная депрессия', domains: ['bipdep'], topic: 'affective', K: 0.07, drift: 0, discharge: 32, los: [14, 35] },
    depression: { name: 'Депрессивный эпизод', domains: ['depression'], topic: 'affective', K: 0.075, drift: -0.05, discharge: 32, los: [14, 35] },
    depression_psychotic: { name: 'Психотическая депрессия', domains: ['depression', 'psychosis'], topic: 'affective', K: 0.07, drift: 0.2, discharge: 30, los: [18, 40] },
    gad: { name: 'Генерализованное тревожное расстройство', domains: ['anxiety'], topic: 'neurotic', K: 0.07, drift: 0, discharge: 35, los: [10, 28] },
    panic: { name: 'Паническое расстройство', domains: ['anxiety'], topic: 'neurotic', K: 0.075, drift: 0, discharge: 35, los: [10, 24] },
    ocd: { name: 'Обсессивно-компульсивное расстройство', domains: ['ocd'], topic: 'neurotic', K: 0.05, drift: 0, discharge: 42, los: [14, 40] },
    ptsd: { name: 'ПТСР', domains: ['ptsd'], topic: 'neurotic', K: 0.055, drift: 0, discharge: 40, los: [14, 35] },
    alcohol_withdrawal: { name: 'Алкогольный абстинентный синдром', domains: ['withdrawal'], topic: 'addiction', K: 0.3, special: 'withdrawal', discharge: 15, los: [4, 10] },
    delirium_tremens: { name: 'Алкогольный делирий', domains: ['withdrawal'], topic: 'addiction', K: 0.22, special: 'dt', discharge: 15, los: [6, 16] },
    dementia_bpsd: { name: 'Деменция с нарушениями поведения', domains: ['bpsd'], topic: 'organic', K: 0.08, drift: 0.2, discharge: 35, los: [10, 30] },
    bpd_crisis: { name: 'Кризис при пограничном расстройстве личности', domains: ['impulsivity'], topic: 'personality', K: 0.08, drift: -2.5, discharge: 40, los: [3, 10] },
    // Амбулаторные группы: длительное ведение
    bipolar_maint: { name: 'Биполярное расстройство, поддерживающая терапия', domains: ['mania', 'bipdep'], topic: 'affective', K: 0.07, drift: 0.35, discharge: 25, los: [20, 60] },
    alcohol_dependence: { name: 'Синдром зависимости от алкоголя', domains: ['craving'], topic: 'addiction', K: 0.06, drift: 0.3, discharge: 25, los: [20, 60] },
    insomnia: { name: 'Хроническая инсомния', domains: ['sleep'], topic: 'neurotic', K: 0.07, drift: 0.03, discharge: 25, los: [14, 50] },
    dementia_mild: { name: 'Деменция при болезни Альцгеймера', domains: ['cognition'], topic: 'organic', K: 0.012, drift: 0.12, discharge: 45, los: [20, 60] },
  };
  /** Шкалы для амбулаторного приёма: балл из тяжести состояния (0–100). rev — чем меньше, тем хуже (MMSE). */
  P.SCALES = {
    depression: { name: 'PHQ-9', max: 27, k: 0.27, cut: 'меньше 5 — ремиссия, 10 и больше — клинически значимая депрессия' },
    bipolar_depression: { name: 'PHQ-9', max: 27, k: 0.27, cut: 'меньше 5 — ремиссия' },
    depression_psychotic: { name: 'PHQ-9', max: 27, k: 0.27, cut: 'меньше 5 — ремиссия' },
    bipolar_maint: { name: 'YMRS', max: 60, k: 0.5, cut: 'до 12 — эутимия, 20 и больше — мания' },
    mania: { name: 'YMRS', max: 60, k: 0.55, cut: 'до 12 — эутимия' },
    schizophrenia: { name: 'PANSS, позитивная шкала', min: 7, max: 49, k: 0.42, cut: 'до 14 — ремиссия по позитивным симптомам' },
    gad: { name: 'GAD-7', max: 21, k: 0.21, cut: 'меньше 5 — минимальная тревога, 10 и больше — клинически значимая' },
    panic: { name: 'PDSS', max: 28, k: 0.28, cut: 'до 5 — ремиссия панического расстройства' },
    ocd: { name: 'Y-BOCS', max: 40, k: 0.4, cut: 'до 12 — ремиссия, снижение на 35% — ответ' },
    ptsd: { name: 'PCL-5', max: 80, k: 0.8, cut: 'меньше 31 — ниже порога ПТСР' },
    alcohol_dependence: { name: 'PACS (влечение к алкоголю)', max: 30, k: 0.3, cut: 'чем ниже, тем слабее влечение' },
    insomnia: { name: 'ISI (индекс тяжести инсомнии)', max: 28, k: 0.28, cut: 'до 7 — нет клинической инсомнии, 15 и больше — выраженная' },
    dementia_mild: { name: 'MMSE', max: 30, k: 0.2, rev: true, cut: '24–30 — норма, 20–23 — лёгкая деменция, 10–19 — умеренная' },
    dementia_bpsd: { name: 'NPI (поведенческие нарушения)', max: 144, k: 0.9, cut: 'чем ниже, тем меньше нарушений' },
    bpd_crisis: { name: 'BSL-23', max: 92, k: 0.8, cut: 'чем ниже, тем легче' },
  };
  /** Балл по шкале группы: { name, value, max, rev }. */
  P.scale = function (pt, sev) {
    const sc = P.SCALES[pt.group];
    if (!sc) return null;
    const v = sev == null ? pt.sev : sev;
    const min = sc.min || 0;
    const raw = sc.rev ? sc.max - v * sc.k : min + v * sc.k;
    return { name: sc.name, value: Math.round(U.clamp(raw, min, sc.max)), max: sc.max, min, rev: !!sc.rev, cut: sc.cut };
  };
  P.group = (pt) => P.GROUPS[pt.group] || P.GROUPS.depression;

  P.STAGES = [
    { k: 'remission', max: 20, name: 'ремиссия' },
    { k: 'mild', max: 40, name: 'лёгкая' },
    { k: 'moderate', max: 65, name: 'умеренная' },
    { k: 'severe', max: 101, name: 'тяжёлая' },
  ];
  P.stage = (sev) => P.STAGES.find((x) => sev < x.max) || P.STAGES[3];

  P.GROUP_TABS = [
    ['antipsychotic', 'Антипсихотики'],
    ['antidepressant', 'Антидепрессанты'],
    ['moodstab', 'Нормотимики'],
    ['anxiolytic', 'Транквилизаторы'],
    ['hypnotic', 'Снотворные'],
    ['corrector', 'Корректоры'],
    ['dementia', 'При деменции'],
    ['addiction', 'Наркология'],
    ['other', 'Прочее'],
    ['int', 'Без лекарств'],
  ];

  P.ROUTES = { po: 'внутрь', im: 'в/м', iv: 'в/в', depot: 'пролонг. в/м', patch: 'пластырь', sl: 'под язык' };

  /* ---------- Обследования ---------- */
  P.TESTS = {
    ecg: { name: 'ЭКГ', cito: true },
    cbc: { name: 'Общий анализ крови' },
    bio: { name: 'Биохимия крови' },
    lipids: { name: 'Липидный профиль' },
    glucose: { name: 'Глюкоза крови', cito: true },
    lithium: { name: 'Концентрация лития' },
    valproate: { name: 'Концентрация вальпроата' },
    prolactin: { name: 'Пролактин' },
    tsh: { name: 'ТТГ' },
    ck: { name: 'КФК' },
    hcg: { name: 'Тест на беременность (ХГЧ)', cito: true },
    tox: { name: 'Химико-токсикологическое исследование' },
    eeg: { name: 'ЭЭГ' },
    weight: { name: 'Масса тела, ИМТ', cito: true },
  };

  /* ---------- Индексы ---------- */
  P.index = function () {
    const d = D();
    d.drugs = d.drugs || [];
    d.interventions = d.interventions || [];
    d.wardPatients = d.wardPatients || [];
    d.drugById = {};
    d.drugs.forEach((x) => (d.drugById[x.id] = x));
    d.intById = {};
    d.interventions.forEach((x) => (d.intById[x.id] = x));
    d.wardById = {};
    d.wardPatients.forEach((x) => (d.wardById[x.id] = x));
    d.ambPatients = d.ambPatients || [];
    d.ambById = {};
    d.ambPatients.forEach((x) => (d.ambById[x.id] = x));
    // Плановый контроль при длительной амбулаторной терапии (по инструкциям и КР; дни — «биологические»)
    d.drugs.forEach((x) => {
      const add = (list) => {
        x.monitor = (x.monitor || []).filter((m) => m.when !== 'period').concat(list);
      };
      const per = P.PERIODIC[x.id] || (x.group === 'antipsychotic' && x.cls !== 'fga_high' && x.cls !== 'fga_low' ? P.PERIODIC._sga : null);
      if (per) add(per);
    });
  };
  P.PERIODIC = {
    lithium: [
      { test: 'tsh', when: 'period', every: 180, note: 'ТТГ раз в 6–12 месяцев' },
      { test: 'bio', when: 'period', every: 180, note: 'креатинин, СКФ и натрий раз в 6–12 месяцев' },
    ],
    valproate: [
      { test: 'bio', when: 'period', every: 180, note: 'печёночные ферменты раз в 6 месяцев' },
      { test: 'cbc', when: 'period', every: 180, note: 'тромбоциты раз в 6 месяцев' },
    ],
    carbamazepine: [
      { test: 'cbc', when: 'period', every: 180, note: 'общий анализ крови раз в 6 месяцев' },
      { test: 'bio', when: 'period', every: 180, note: 'натрий и печёночные ферменты раз в 6 месяцев' },
    ],
    _sga: [
      { test: 'glucose', when: 'period', every: 180, note: 'глюкоза раз в 6–12 месяцев' },
      { test: 'lipids', when: 'period', every: 365, note: 'липидный профиль раз в год' },
    ],
  };
  P.drug = (id) => D().drugById && D().drugById[id];
  P.int = (id) => D().intById && D().intById[id];
  P.item = (rx) => (rx.kind === 'int' ? P.int(rx.id) : P.drug(rx.id));

  P.form = function (drug, route) {
    const f = (drug.forms || []).find((x) => x.route === route);
    return f || (drug.forms || [])[0] || { route: 'po', steps: [1] };
  };
  P.unit = (drug, route) => (route === 'po' || route === 'patch' || route === 'sl' ? 'мг/сут' : 'мг');
  P.oral = (route) => route === 'po' || route === 'sl';

  /** Дозы препарата для домена группы пациента (или первой подходящей). */
  P.doseRange = function (drug, pt) {
    const doms = P.group(pt).domains;
    for (const k of doms) if (drug.doses && drug.doses[k]) return drug.doses[k];
    const keys = Object.keys(drug.doses || {});
    // препарат «не по профилю»: берём домен с наибольшим эффектом
    let best = null;
    keys.forEach((k) => {
      if (!best || (drug.eff[k] || 0) > (drug.eff[best] || 0)) best = k;
    });
    return best ? drug.doses[best] : null;
  };

  /** Диапазон доз для формы выпуска: у таблеток — по домену пациента, у пластырей и инъекций — свой. */
  P.range = function (drug, route, pt) {
    const f = P.form(drug, route);
    if (f.route === route && f.range) return f.range;
    if (P.oral(route)) return P.doseRange(drug, pt);
    return null;
  };

  /** Относительная доза: 1 — нижняя граница терапевтической. */
  P.doseFactor = function (rx, pt) {
    const drug = P.drug(rx.id);
    if (!drug) return 0;
    const r = P.range(drug, rx.route, pt);
    if (r && r.min) return rx.dose / r.min;
    if (P.oral(rx.route)) return 1;
    const f = P.form(drug, rx.route);
    const steps = f.steps || [rx.dose];
    const mid = steps[Math.floor((steps.length - 1) / 2)] || rx.dose;
    return rx.dose / mid;
  };

  /* ---------- Клинические рекомендации ---------- */
  P.gl = (pt) => (D().guidelines || {})[pt.group] || null;
  P.GEN = 'общий клинический принцип';
  /** Ссылка на КР; для записей gen — пометка «общий принцип». */
  P.cite = function (g, entry) {
    if (entry && entry.gen) return P.GEN;
    if (g && g.nokr) return P.GEN;
    if (!g || !g.title) return '';
    return 'КР «' + (g.short || g.title) + '»' + (g.year ? ' (' + g.year + ')' : '');
  };
  P.citeFull = function (g) {
    if (!g || !g.title) return '';
    if (g.nokr) return g.title + ' — ' + P.GEN + (g.note ? ' (' + g.note + ')' : '');
    return 'КР «' + g.title + '»' + (g.year ? ', ' + g.year : '') + (g.id ? ', ID ' + g.id : '') + (g.by ? '. ' + g.by : '');
  };
  /** Стандарт относится к пациенту, только если совпадает код МКБ (745н — для F33, не для первого эпизода F32). */
  P.standardFor = function (pt, g) {
    g = g || P.gl(pt);
    if (!g || !g.standard) return null;
    const icd = g.standard.icd;
    if (!icd || !icd.length) return g.standard;
    const dx = String((pt && pt.dx) || '');
    return icd.some((c) => dx.indexOf(c) === 0) ? g.standard : null;
  };
  P.phase = function (pt) {
    const g = P.gl(pt);
    const has = (k) => g && g.phases && g.phases[k];
    if (pt.group === 'schizophrenia' && (pt.failed || []).length >= 2 && has('resistant')) return 'resistant';
    if (pt.phase && has(pt.phase)) return pt.phase;
    if (pt.group === 'depression' && (pt.sev0 || 0) >= 65 && has('severe')) return 'severe';
    return 'acute';
  };
  const norm = (e) => (typeof e === 'string' ? { id: e } : e);
  const matchAt = (entry, item, level) => {
    const e = norm(entry);
    if (level === 'id') return !!e.id && e.id === item.id;
    if (level === 'cls') return !e.id && !!e.cls && e.cls === item.cls;
    return !e.id && !e.cls && !!e.group && e.group === item.group;
  };
  /** Место препарата в КР для этого пациента: first | second | adjunct | avoid | null.
      Точное упоминание препарата важнее упоминания класса, класс — важнее группы. */
  P.line = function (pt, item) {
    const g = P.gl(pt);
    if (!g || !g.phases) return { line: null };
    const ph = g.phases[P.phase(pt)] || g.phases.acute || {};
    for (const level of ['id', 'cls', 'group']) {
      for (const k of ['avoid', 'first', 'second', 'adjunct']) {
        const e = (ph[k] || []).find((x) => matchAt(x, item, level));
        if (e) return { line: k, entry: norm(e), phase: ph };
      }
    }
    return { line: null, phase: ph };
  };
  P.inStandard = function (pt, item) {
    const g = P.gl(pt);
    if (!g || !g.standard || !g.standard.drugs) return null;
    return g.standard.drugs.indexOf(item.id) >= 0;
  };

  /* ---------- Метки пациента ---------- */
  P.tags = function (pt) {
    const t = {};
    (pt.traits || []).forEach((x) => (t[x] = true));
    (pt.meds_home || []).forEach((m) => m.tag && (t[m.tag] = true));
    (pt.rx || []).forEach((r) => (t[r.id] = true));
    if (pt.age >= 65) t.elderly = true;
    if (pt.age >= 65 && pt.group === 'dementia_bpsd') t.dementia_elderly = true;
    if (pt.sex === 'f' && pt.age >= 16 && pt.age <= 48) t.woman_childbearing = true;
    if (pt.lab && pt.lab.qtc >= 460) t.qt_long = true;
    if (pt.lab && pt.lab.egfr < 60) t.renal = true;
    if (pt.lab && pt.lab.alt >= 90) t.liver = true;
    if (pt.age >= 65 && pt.group === 'dementia_mild') t.dementia_elderly = true;
    if (pt.group === 'bipolar_depression' || pt.group === 'mania' || pt.group === 'bipolar_maint') t.bipolar = true;
    if (pt.group === 'alcohol_withdrawal' || pt.group === 'delirium_tremens') t.alcohol = true;
    if ((pt.risk && pt.risk.suicide >= 2) || pt.group === 'bpd_crisis') t.suicide_high = true;
    return t;
  };
  P.TAG_NAMES = {
    qt_long: 'удлинённый QTc',
    arrhythmia: 'нарушения ритма',
    heart_failure: 'сердечная недостаточность',
    epilepsy: 'эпилепсия',
    seizure_history: 'судорожные припадки в анамнезе',
    pregnancy: 'беременность',
    breastfeeding: 'грудное вскармливание',
    woman_childbearing: 'женщина детородного возраста',
    liver: 'поражение печени',
    renal: 'сниженная функция почек',
    elderly: 'пожилой возраст',
    dementia_elderly: 'деменция в пожилом возрасте',
    glaucoma: 'глаукома',
    bph: 'аденома простаты',
    diabetes: 'сахарный диабет',
    obesity: 'ожирение',
    dyslipidemia: 'дислипидемия',
    hyperprolactinemia: 'гиперпролактинемия',
    parkinson: 'паркинсонизм',
    myasthenia: 'миастения',
    resp_failure: 'дыхательная недостаточность',
    sleep_apnea: 'апноэ сна',
    alcohol: 'употребление алкоголя',
    addiction_history: 'зависимость в анамнезе',
    bipolar: 'биполярное расстройство',
    suicide_high: 'высокий суицидальный риск',
    smoker: 'курение',
    young: 'молодой возраст',
    hypotension: 'артериальная гипотензия',
    hyponatremia_risk: 'риск гипонатриемии',
    bleeding_risk: 'риск кровотечений',
    thyroid: 'болезнь щитовидной железы',
    agranulocytosis_history: 'агранулоцитоз в анамнезе',
    nms_history: 'ЗНС в анамнезе',
    eps_sensitive: 'высокая чувствительность к антипсихотикам',
    nsaid: 'принимает НПВС',
    acei: 'принимает иАПФ',
    arb: 'принимает сартаны',
    thiazide: 'принимает тиазидный диуретик',
    loop_diuretic: 'принимает петлевой диуретик',
    warfarin: 'принимает варфарин',
    doac: 'принимает антикоагулянт',
    ocp: 'принимает оральные контрацептивы',
    tramadol: 'принимает трамадол',
    triptan: 'принимает триптаны',
    ciprofloxacin: 'принимает ципрофлоксацин',
    macrolide: 'принимает макролид',
    azole: 'принимает азольный антимикотик',
    omeprazole: 'принимает омепразол',
    metoprolol: 'принимает метопролол',
    amiodarone: 'принимает амиодарон',
    levothyroxine: 'принимает левотироксин',
    metformin: 'принимает метформин',
    insulin: 'на инсулине',
    opioid: 'принимает опиоиды',
    antiepileptic_other: 'принимает противоэпилептические',
  };
  /** Сопутствующие лекарства пациента (метки), влияющие на цитохромы. */
  P.TAG_CYP = {
    omeprazole: { inh: { '2C19': 'moderate' } },
    ciprofloxacin: { inh: { '1A2': 'strong' } },
    macrolide: { inh: { '3A4': 'strong' } },
    azole: { inh: { '3A4': 'strong' } },
    amiodarone: { inh: { '2D6': 'moderate', '3A4': 'moderate' } },
    antiepileptic_other: { ind: { '3A4': 'strong' } },
  };
  P.tagName = (t) => P.TAG_NAMES[t] || (P.drug(t) ? 'получает ' + P.drug(t).name.toLowerCase() : t);

  /* ---------- Время приёма ---------- */
  P.TIMES = { am: 'утром', pm: 'на ночь', split: '2–3 раза в день' };
  /** Что советует инструкция и здравый смысл: седативные — на ночь, активирующие — утром. */
  P.timeAdvice = function (drug) {
    if (!drug) return null;
    const label = (drug.forms || []).map((f) => f.label || '').join(' ');
    const se = drug.se || {};
    if (/на ночь/.test(label) || (se.sedation || 0) >= 2) return 'pm';
    if ((se.activation || 0) >= 1 && (se.sedation || 0) < 1) return 'am';
    return null;
  };
  /** Время приёма по умолчанию для нового назначения. */
  P.defaultTime = function (drug, route) {
    if (!P.oral(route)) return null;
    const f = P.form(drug, route);
    if (f.prn) return null;
    const adv = P.timeAdvice(drug);
    if (adv) return adv;
    return (f.split || 1) > 1 ? 'split' : 'am';
  };
  /** Сколько раз в день пациент что-то принимает (для приверженности). */
  P.intakes = function (pt) {
    const times = {};
    (pt.rx || []).forEach((r) => {
      if (r.kind === 'int' || r.prn || !P.oral(r.route)) return;
      const t = r.time || P.defaultTime(P.drug(r.id) || {}, r.route) || 'am';
      if (t === 'split') {
        times.am = 1;
        times.pm = 1;
        if ((P.form(P.drug(r.id), r.route).split || 1) >= 3) times.noon = 1;
      } else times[t] = 1;
    });
    return Object.keys(times).length;
  };

  /* ---------- Проверка назначения ---------- */
  const SERO_STRONG = ['clomipramine', 'fluoxetine', 'paroxetine', 'sertraline', 'escitalopram', 'citalopram', 'fluvoxamine', 'venlafaxine', 'duloxetine', 'vortioxetine'];

  /**
   * Отзыв куратора на изменение в листе назначений.
   * kind: add | up | down | stop | route. Возвращает [{ lvl: ok|info|warn|err, text, cite }].
   */
  P.review = function (s, pt, rx, kind, prev) {
    const out = [];
    const item = P.item(rx);
    if (!item) return out;
    if (kind === 'time') {
      const adv = P.timeAdvice(item);
      if (adv === 'pm' && rx.time === 'am') out.push({ lvl: 'info', text: item.name + ' вызывает сонливость — утром пациент будет вялым весь день; удобнее вечером или на ночь.' });
      else if (adv === 'am' && rx.time === 'pm') out.push({ lvl: 'info', text: item.name + ' может бодрить: вечерний приём мешает уснуть — лучше утром.' });
      else if (adv && rx.time === adv) out.push({ lvl: 'ok', text: item.name + ' — ' + P.TIMES[adv] + ': так меньше мешают побочные эффекты.' });
      else if (rx.time !== 'split' && (P.form(item, rx.route).split || 1) > 1 && item.id === 'lithium') out.push({ lvl: 'info', text: 'Литий можно принимать один раз в день вечером — это не хуже и проще для приверженности; концентрацию тогда оценивают через 12 часов после приёма.' });
      return out;
    }
    const g = P.gl(pt);
    const cite = P.cite(g);
    const day = s.day - pt.admitDay;

    if (rx.kind === 'int') {
      if (kind === 'add') {
        const l = P.line(pt, { id: rx.id, cls: 'int', group: 'int' });
        const c = P.cite(g, l.entry);
        if (l.line === 'avoid') out.push({ lvl: 'err', text: l.entry.why || 'Не рекомендуется при этом состоянии.', cite: c });
        else if (l.line === 'first') out.push({ lvl: 'ok', text: item.name + ' — входит в основную тактику.' + recText(l.entry), cite: c });
        else if (l.line) out.push({ lvl: 'ok', text: item.name + ' — уместно как дополнение.' + recText(l.entry), cite: c });
        else if (rx.id === 'infusion' && pt.flags && pt.flags.dehydrated) out.push({ lvl: 'ok', text: 'Инфузия при обезвоживании необходима: восполнить жидкость, натрий и калий.' });
        else if (item.kind !== 'observation') {
          const doms = P.group(pt).domains;
          const e = Math.max.apply(null, doms.map((k) => (item.eff && item.eff[k]) || 0));
          if (e < 0.1 && rx.id !== 'ect') out.push({ lvl: 'info', text: item.name + ' мало что даёт при этом состоянии.' });
        }
        if (rx.id === 'ect' && ['depression_psychotic', 'depression', 'bipolar_depression', 'mania', 'schizophrenia'].indexOf(pt.group) < 0)
          out.push({ lvl: 'warn', text: 'ЭСТ здесь не показана: её назначают при тяжёлой и психотической депрессии, кататонии, резистентности.' });
        else if (rx.id === 'ect' && (pt.group === 'depression' || pt.group === 'schizophrenia') && day < 14 && (pt.risk.suicide || 0) < 3)
          out.push({ lvl: 'info', text: 'ЭСТ обычно назначают при резистентности к лекарствам или когда ждать нельзя (отказ от еды, высокий суицидальный риск).' });
        if (rx.id === 'ect') out.push({ lvl: 'info', text: 'Нужны письменное согласие, осмотр терапевта и анестезиолога.' });
        if (rx.id === 'observation_strict') {
          if ((pt.risk.suicide || 0) >= 2 || (pt.risk.aggression || 0) >= 2) out.push({ lvl: 'ok', text: 'Строгий надзор оправдан: риск самоповреждения или агрессии высок.' });
          else out.push({ lvl: 'info', text: 'Строгий надзор без явного риска ограничивает свободу пациента — пересматривайте показания ежедневно.' });
        }
      }
      if (kind === 'stop' && rx.id === 'observation_strict' && (pt.risk.suicide || 0) >= 2 && pt.sev > 50)
        out.push({ lvl: 'warn', text: 'Суицидальный риск остаётся высоким — снимать строгий надзор рано.' });
      return out;
    }

    const drug = item;
    const tags = P.tags(pt);
    const r = P.range(drug, rx.route, pt);
    const oral = P.oral(rx.route) || rx.route === 'patch';

    if (kind === 'add') {
      // 1. Место в КР
      const l = P.line(pt, drug);
      const c = P.cite(g, l.entry);
      if (l.line === 'avoid') out.push({ lvl: 'err', text: l.entry.why || drug.name + ' при этом состоянии не рекомендуется.', cite: c });
      else if (l.line === 'first') out.push({ lvl: 'ok', text: drug.name + ' — препарат выбора.' + recText(l.entry), cite: c });
      else if (l.line === 'second') out.push({ lvl: 'info', text: drug.name + ' — не первая линия: обычно его назначают при неэффективности или непереносимости препаратов выбора. Отразите обоснование в дневнике.' + recText(l.entry), cite: c });
      else if (l.line === 'adjunct') out.push({ lvl: 'ok', text: drug.name + ' — допустимо как дополнительная терапия.' + recText(l.entry), cite: c });
      else {
        const doms = P.group(pt).domains;
        const e = Math.max.apply(null, doms.map((k) => drug.eff[k] || 0));
        if (e < 0.2 && !isSymptomatic(drug, pt)) out.push({ lvl: 'warn', text: drug.name + ' не действует на основное расстройство. Зачем он здесь?' });
        else if (g) out.push({ lvl: 'info', text: drug.name + ' прямо не упомянут в рекомендациях для этого состояния.', cite });
      }
      // 2. Стандарт
      const st = P.inStandard(pt, drug);
      if (st === false && l.line !== 'avoid') out.push({ lvl: 'info', text: 'Препарата нет в стандарте медицинской помощи — назначение через врачебную комиссию.', cite: g.standard.order });
      // 3. Ранее не помог / не переносил
      if ((pt.failed || []).indexOf(drug.id) >= 0) out.push({ lvl: 'warn', text: drug.name + ' уже был неэффективен у этого пациента в адекватной дозе.' });
      if ((pt.intolerant || []).indexOf(drug.id) >= 0) out.push({ lvl: 'warn', text: 'Этот препарат пациент раньше не перенёс.' });
      // 4. Стартовая доза
      if (r && oral && !rx.home) {
        let start = r.start;
        if (drug.id === 'lamotrigine' && tags.valproate) start = 12.5;
        if (start && rx.dose > start * 1.6 && !urgentStart(pt, drug)) out.push({ lvl: rx.dose > start * 3 ? 'err' : 'warn', text: (rx.dose > start * 3 ? 'Опасно высокая стартовая доза. ' : 'Высокая стартовая доза. ') + 'Начните с ' + fmtDose(start) + ' и титруйте.' + (drug.id === 'lamotrigine' && tags.valproate ? ' С вальпроатом дозы ламотриджина вдвое ниже.' : '') });
      }
      special(s, pt, drug, rx).forEach((m) => out.push(m));
      const adv = P.timeAdvice(drug);
      if (adv && rx.time && rx.time !== adv && P.oral(rx.route) && !rx.prn) out.push({ lvl: 'info', text: drug.name + ' лучше принимать ' + P.TIMES[adv] + '.' });
      // 5. Полипрагмазия и сочетания классов
      polypharmacy(s, pt, drug, rx).forEach((m) => out.push(m));
      // 6. Мониторинг
      const need = (drug.monitor || []).filter((m) => m.when === 'start' && monitorApplies(pt, m) && !P.recentTest(pt, m.test, 14));
      if (need.length) out.push({ lvl: 'info', text: 'Не забудьте: ' + U.list(need.map((m) => (P.TESTS[m.test] || { name: m.test }).name + (m.note ? ' (' + m.note.replace(/\.$/, '') + ')' : ''))) + '.' });
    }

    if (kind === 'up' || kind === 'add') {
      if (r && r.max && rx.dose > r.max) out.push({ lvl: 'err', text: (oral ? 'Превышена максимальная суточная доза (' : 'Превышена максимальная доза (') + fmtDose(r.max) + ').' });
      const eMax = drug.elderlyMax || (r && r.max ? r.max * 0.6 : 0);
      if (eMax && tags.elderly && P.oral(rx.route) && rx.dose > eMax + 0.01 && drug.group !== 'dementia' && drug.group !== 'other') out.push({ lvl: 'warn', text: 'У пожилых дозы ниже: не больше ' + fmtDose(eMax) + ', титрация — медленнее.' });
      if (kind === 'up' && prev != null && drug.titration && drug.titration.maxUpPerDay) {
        const days = Math.max(1, daysOn(s, { since: rx.changed || rx.since }, pt));
        const allowed = drug.titration.maxUpPerDay * days;
        if (rx.dose - prev > allowed * 1.05) out.push({ lvl: 'warn', text: 'Слишком быстрая титрация. ' + (drug.titration.note || '') });
      }
      if (rx.route === 'depot' && rx.since === s.day) {
        const f = P.form(drug, 'depot');
        if (f.testDose) {
          if (rx.dose > f.testDose && !pt.rx.some((o) => o !== rx && o.id === drug.id)) out.push({ lvl: 'warn', text: 'Таблеток у препарата нет: начинают с пробной дозы ' + fmtDose(f.testDose) + ' и оценивают переносимость.' });
        } else if (!hadOral(pt, drug)) out.push({ lvl: 'warn', text: 'Пролонгированную форму вводят, когда переносимость препарата уже проверена на таблетках.' });
      }
    }
    if (kind === 'add') {
      // 7. Противопоказания и осторожность — по меткам пациента и другим назначениям
      (drug.contra || []).forEach((c) => {
        if (tags[c.t] && c.t !== drug.id) out.push({ lvl: c.sev === 'moderate' ? 'warn' : 'err', major: c.sev !== 'moderate', text: cap(P.tagName(c.t)) + ': ' + (c.note || 'противопоказано.') });
      });
      (drug.caution || []).forEach((c) => {
        if (tags[c.t]) out.push({ lvl: 'info', text: cap(P.tagName(c.t)) + ': ' + (c.note || 'с осторожностью.') });
      });
      // обратная сторона взаимодействия: этот препарат упомянут в противопоказаниях уже назначенных
      (pt.rx || []).forEach((o) => {
        if (o === rx || o.kind === 'int') return;
        const od = P.drug(o.id);
        if (!od) return;
        (od.contra || []).forEach((c) => {
          if (c.t === drug.id) out.push({ lvl: c.sev === 'moderate' ? 'warn' : 'err', text: od.name + ' + ' + drug.name.toLowerCase() + ': ' + (c.note || 'опасное сочетание.') });
        });
      });
      cyp(pt, drug).forEach((m) => out.push(m));
    }
    if (kind === 'down' && drug.cls === 'bzd' && prev && daysOn(s, rx, pt) > 28) {
      const cut = (prev - rx.dose) / prev;
      const since = s.day - (rx.lastDown || rx.since);
      const low = (P.form(drug, rx.route).steps || [rx.dose])[0];
      if (prev > low * 2 + 0.001 && (cut > 0.5 || (cut > 0.3 && since < 3))) out.push({ lvl: 'warn', text: 'Слишком быстрое снижение после длительного приёма: безопаснее 10–25% за шаг, раз в несколько дней — неделю.' });
      rx.lastDown = s.day;
    }
    if (kind === 'down' && r && r.min && P.oral(rx.route) && rx.dose < r.min && day > 3 && P.group(pt).domains.some((k) => (drug.eff[k] || 0) >= 0.3))
      out.push({ lvl: 'info', text: 'Доза ниже терапевтической — эффект ослабнет.' });
    if (kind === 'stop') {
      const low = (P.form(drug, rx.route).steps || [rx.dose])[0];
      if (drug.cls === 'bzd' && daysOn(s, rx, pt) > 28 && !otherBzd(pt, rx) && rx.dose > low * 2 + 0.001)
        out.push({ lvl: 'err', text: 'Резкая отмена бензодиазепина после длительного приёма — синдром отмены вплоть до судорог. Снижайте дозу на 10–25% каждые 1–2 недели.' });
      else if (drug.cls === 'bzd' && daysOn(s, rx, pt) > 28 && !otherBzd(pt, rx)) out.push({ lvl: 'ok', text: 'Последний шаг постепенной отмены бензодиазепина.' });
      else if (drug.cls === 'bzd' && daysOn(s, rx, pt) > 10) out.push({ lvl: 'info', text: 'Бензодиазепин после приёма дольше полутора недель лучше снижать постепенно.' });
      if (drug.cls === 'z' && daysOn(s, rx, pt) > 28 && rx.dose > low + 0.001)
        out.push({ lvl: 'warn', text: 'Резкая отмена снотворного после долгого приёма — рикошетная бессонница и тревога. Снижайте дозу постепенно, параллельно — КПТ инсомнии.' });
      else if (drug.cls === 'z' && daysOn(s, rx, pt) > 28) out.push({ lvl: 'ok', text: 'Последний шаг постепенной отмены снотворного.' });
      if ((drug.cls === 'ssri' || drug.cls === 'snri') && (drug.id === 'paroxetine' || drug.id === 'venlafaxine') && daysOn(s, rx, pt) > 14)
        out.push({ lvl: 'info', text: 'Пароксетин и венлафаксин отменяют постепенно: выражен синдром отмены.' });
      if (drug.id === 'clozapine' && daysOn(s, rx, pt) > 7) out.push({ lvl: 'info', text: 'Резкая отмена клозапина — риск холинергического «отката» и быстрого рецидива психоза.' });
    }
    return out;
  };

  function recText(e) {
    if (!e || !e.rec) return '';
    const lv = [e.uur ? 'УУР ' + e.uur : '', e.udd ? 'УДД ' + e.udd : ''].filter(Boolean).join(', ');
    return ' ' + e.rec + (lv ? ' (' + lv + ')' : '');
  }
  function isSymptomatic(drug, pt) {
    // корректоры, снотворные, витамины и транквилизаторы — симптоматическая терапия; наркологические средства — при алкоголе
    if (drug.group === 'addiction') return !!P.tags(pt).alcohol || (pt.traits || []).indexOf('alcohol_use') >= 0;
    return drug.group === 'corrector' || drug.group === 'hypnotic' || drug.cls === 'vitamin' || drug.cls === 'bzd' || drug.group === 'anxiolytic';
  }
  /** Условие проверки (например, тест на беременность — только женщинам детородного возраста). */
  function monitorApplies(pt, m) {
    return !m.only || !!P.tags(pt)[m.only];
  }
  P.monitorApplies = monitorApplies;

  /** Особые правила безопасности, которые не сводятся к противопоказаниям по меткам. */
  function special(s, pt, drug, rx) {
    const out = [];
    const tags = P.tags(pt);
    const parenteral = (r) => r.route === 'im' || r.route === 'iv';
    // Клозапин: стартовый анализ крови
    if (drug.id === 'clozapine') {
      const cbc = (pt.tests || []).filter((t) => t.test === 'cbc' && t.value).pop();
      if (cbc && (cbc.value.anc < 2 || cbc.value.wbc < 3.5)) out.push({ lvl: 'err', text: 'Клозапин нельзя начинать: нейтрофилы ниже 2,0 или лейкоциты ниже 3,5 ×10⁹/л.', cite: 'КР «Биполярное аффективное расстройство» (2025)' });
    }
    // Клозапин + парентеральные бензодиазепины
    const clozOn = drug.id === 'clozapine' || (pt.rx || []).some((o) => o.id === 'clozapine');
    const bzdIm = (drug.cls === 'bzd' && parenteral(rx)) || (pt.rx || []).some((o) => o !== rx && parenteral(o) && (P.drug(o.id) || {}).cls === 'bzd');
    if (clozOn && bzdIm) out.push({ lvl: 'err', text: 'Внутримышечные бензодиазепины с клозапином не сочетают — риск угнетения дыхания.', cite: 'КР «Шизофрения» (2024)' });
    // Сенсибилизирующая терапия — только после купирования абстиненции
    if ((drug.id === 'disulfiram' || drug.id === 'cyanamide') && (tags.alcohol || pt.group === 'alcohol_dependence')) {
      // в отделении — после купирования отмены; на амбулаторном приёме — пока пациент трезв
      const acute = pt.mode === 'amb' ? pt.sev >= 68 : pt.sev > 25 || s.day - pt.admitDay < 3;
      if (acute) out.push({ lvl: 'err', text: (drug.id === 'disulfiram' ? 'Дисульфирам' : 'Цианамид') + ' назначают только после купирования абстиненции и с письменного информированного согласия.', cite: 'КР «Синдром зависимости от алкоголя» (2024)' });
      else out.push({ lvl: 'info', text: 'Нужно письменное информированное согласие: пациент должен понимать, что будет при приёме алкоголя.' });
    }
    // Пролонгированные формы при шизофрении
    if (rx.route === 'depot' && drug.group === 'antipsychotic' && pt.group === 'schizophrenia')
      out.push({ lvl: 'ok', text: 'Пролонгированная форма рекомендована для профилактики рецидивов при длительной терапии.', cite: 'КР «Шизофрения» (2024)' });
    // Тиамин и глюкоза
    if (drug.id === 'thiamine' && tags.alcohol) out.push({ lvl: 'ok', text: 'Тиамин при отмене алкоголя — с первого дня и до глюкозы.', cite: P.GEN });
    // Вальпроат у женщин детородного возраста: тест на беременность
    if (drug.id === 'valproate' && tags.woman_childbearing && !(pt.tests || []).some((t) => t.test === 'hcg')) out.push({ lvl: 'warn', text: 'До назначения вальпроата — тест на беременность и обсуждение контрацепции.' });
    return out;
  }
  function urgentStart(pt, drug) {
    return pt.group === 'alcohol_withdrawal' || pt.group === 'delirium_tremens' || (drug.group === 'anxiolytic' && pt.sev > 70);
  }
  /** Тот же препарат или его ближайший родственник (рисперидон и палиперидон). */
  const kin = (a, b) => a === b || ((P.drug(a) || {}).kin || []).indexOf(b) >= 0 || ((P.drug(b) || {}).kin || []).indexOf(a) >= 0;
  P.kin = kin;
  function hadOral(pt, drug) {
    return (pt.rx || []).some((r) => kin(r.id, drug.id) && P.oral(r.route)) || (pt.oralTried || []).some((id) => kin(id, drug.id));
  }
  function otherBzd(pt, rx) {
    return (pt.rx || []).some((o) => o !== rx && o.kind !== 'int' && (P.drug(o.id) || {}).cls === 'bzd');
  }
  /** Сколько дней пациент принимает препарат (на амбулаторном приёме — дни лечения, а не игровые). */
  function daysOn(s, rx, pt) {
    return (s.day - rx.since) * (pt && pt.mode === 'amb' && A.ward ? A.ward.speed(pt) : 1);
  }
  function cap(t) {
    return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
  }
  function fmtDose(x) {
    return String(x).replace('.', ',') + ' мг';
  }
  P.fmtDose = fmtDose;
  /** Строчная первая буква, но аббревиатуры (ЭКГ, ТТГ) не трогаем. */
  P.lc = (t) => {
    t = String(t || '');
    if (t.length > 1 && t[1] !== t[1].toLowerCase()) return t;
    return t.charAt(0).toLowerCase() + t.slice(1);
  };

  function polypharmacy(s, pt, drug, rx) {
    const out = [];
    const others = (pt.rx || []).filter((o) => o !== rx && o.kind !== 'int').map((o) => ({ o, d: P.drug(o.id) })).filter((x) => x.d);
    const ap = (d) => d.group === 'antipsychotic';
    const ad = (d) => d.group === 'antidepressant';
    // перекрёстная смена: прежний препарат той же группы пациент принимает давно
    const old = (x) => !x.o.prn && (x.o.pre || x.o.home || daysOn(s, x.o, pt) > 28);
    const XT = 'Перекрёстная смена: новый препарат добавляют, а прежний за 2–4 недели снижают до отмены. Две полные дозы надолго не оставляйте.';
    if (ap(drug) && rx.route !== 'im') {
      const apOthers = others.filter((x) => ap(x.d) && x.o.route !== 'im' && !x.o.prn && !kin(x.d.id, drug.id));
      if (apOthers.length) {
        const clozAug = drug.id === 'clozapine' || apOthers.some((x) => x.d.id === 'clozapine');
        const sw = !clozAug && apOthers.every(old);
        out.push({ lvl: clozAug || sw ? 'info' : 'warn', text: clozAug ? 'Комбинация с клозапином допустима только при частичном ответе на клозапин.' : sw ? XT : 'Два антипсихотика одновременно — рекомендации требуют монотерапии. Замените, а не добавляйте.' });
      }
    }
    const adOthers = others.filter((x) => ad(x.d) && x.d.id !== drug.id);
    const adSwitch = adOthers.length > 0 && adOthers.every(old);
    if (ad(drug) && adOthers.length) out.push({ lvl: adSwitch ? 'info' : 'warn', text: adSwitch ? XT : 'Два антидепрессанта сразу — без явных показаний это полипрагмазия.' });
    if (drug.group === 'antidepressant' && (pt.group === 'bipolar_depression' || pt.group === 'mania') && !others.some((x) => x.d.group === 'moodstab' || (x.d.group === 'antipsychotic' && (x.d.eff.mania || 0) >= 0.5)))
      out.push({ lvl: 'err', text: 'Антидепрессант без нормотимика при биполярном расстройстве — риск инверсии в манию.' });
    if (drug.group === 'corrector' && drug.cls === 'anticholinergic' && (pt.sx.eps || 0) < 0.8)
      out.push({ lvl: 'warn', text: 'Корректор «на всякий случай» не назначают: только при появлении экстрапирамидных расстройств.' });
    if (drug.cls === 'bzd' && ['dementia_bpsd', 'bpd_crisis'].indexOf(pt.group) >= 0) out.push({ lvl: 'warn', text: 'Бензодиазепины здесь опасны: растормаживание, падения, зависимость.' });
    const sedGaba = (d) => d.cls === 'bzd' || d.cls === 'z';
    if (sedGaba(drug) && !rx.prn && rx.route !== 'im' && others.some((x) => sedGaba(x.d) && !x.o.prn && x.o.route !== 'im' && x.d.id !== drug.id))
      out.push({ lvl: 'warn', text: 'Два препарата одного действия — бензодиазепин или Z-гипнотик уже назначен: седация суммируется, растут риск падений и зависимости. Замените, а не добавляйте.' });
    // серотонинергическая нагрузка
    if ((drug.flags || []).indexOf('serotonergic') >= 0) {
      const sero = others.filter((x) => (x.d.flags || []).indexOf('serotonergic') >= 0);
      const t = P.tags(pt);
      if (sero.length && (SERO_STRONG.indexOf(drug.id) >= 0 || sero.some((x) => SERO_STRONG.indexOf(x.d.id) >= 0))) {
        // при смене антидепрессанта прежний сначала снижают до минимальной дозы
        const low = adSwitch && sero.every((x) => P.doseFactor(x.o, pt) <= 1.01);
        out.push(low ? { lvl: 'info', text: 'При перекрёстной смене следите за признаками серотонинового синдрома: тремор, потливость, диарея, возбуждение.' } : { lvl: 'warn', text: 'Два серотонинергических препарата — риск серотонинового синдрома.' + (adSwitch ? ' При смене сначала снизьте прежний антидепрессант до минимальной дозы.' : '') });
      }
      if (t.tramadol || t.triptan) out.push({ lvl: 'warn', text: 'Пациент принимает ' + (t.tramadol ? 'трамадол' : 'триптаны') + ' — риск серотонинового синдрома.' });
    }
    return out;
  }

  /** Взаимодействия через цитохромы: сильный ингибитор/индуктор + субстрат. */
  function cyp(pt, drug) {
    const out = [];
    const others = (pt.rx || []).filter((o) => o.kind !== 'int' && o.id !== drug.id).map((o) => P.drug(o.id)).filter(Boolean);
    const sub = (d) => (d.cyp && d.cyp.sub) || [];
    const inh = (d) => (d.cyp && d.cyp.inh) || {};
    const ind = (d) => (d.cyp && d.cyp.ind) || {};
    others.forEach((o) => {
      Object.keys(inh(o)).forEach((e) => {
        if (inh(o)[e] === 'strong' && sub(drug).indexOf(e) >= 0) out.push({ lvl: narrow(drug) ? 'warn' : 'info', text: o.name + ' сильно ингибирует CYP' + e + ': концентрация препарата «' + drug.name.toLowerCase() + '» вырастет.' });
      });
      Object.keys(ind(o)).forEach((e) => {
        if (ind(o)[e] === 'strong' && sub(drug).indexOf(e) >= 0) out.push({ lvl: 'info', text: o.name + ' индуцирует CYP' + e + ': концентрация препарата «' + drug.name.toLowerCase() + '» снизится.' });
      });
      Object.keys(inh(drug)).forEach((e) => {
        if (inh(drug)[e] === 'strong' && sub(o).indexOf(e) >= 0) out.push({ lvl: narrow(o) ? 'warn' : 'info', text: drug.name + ' сильно ингибирует CYP' + e + ': концентрация препарата «' + o.name.toLowerCase() + '» вырастет.' });
      });
      Object.keys(ind(drug)).forEach((e) => {
        if (ind(drug)[e] === 'strong' && sub(o).indexOf(e) >= 0) out.push({ lvl: 'info', text: drug.name + ' индуцирует CYP' + e + ': концентрация препарата «' + o.name.toLowerCase() + '» снизится.' });
      });
    });
    const t = P.tags(pt);
    Object.keys(P.TAG_CYP).forEach((tag) => {
      if (!t[tag]) return;
      const x = P.TAG_CYP[tag];
      Object.keys(x.inh || {}).forEach((e) => {
        if (sub(drug).indexOf(e) >= 0) out.push({ lvl: x.inh[e] === 'strong' && narrow(drug) ? 'warn' : 'info', text: cap(P.tagName(tag)) + ' — ингибитор CYP' + e + ': концентрация препарата «' + drug.name.toLowerCase() + '» вырастет.' });
      });
      Object.keys(x.ind || {}).forEach((e) => {
        if (sub(drug).indexOf(e) >= 0) out.push({ lvl: 'info', text: cap(P.tagName(tag)) + ' — индуктор CYP' + e + ': концентрация препарата «' + drug.name.toLowerCase() + '» снизится.' });
      });
    });
    if (t.smoker && sub(drug).indexOf('1A2') >= 0) out.push({ lvl: 'info', text: 'Курение индуцирует CYP1A2: если пациент бросит курить в отделении, концентрация вырастет.' });
    return out;
  }
  function narrow(d) {
    return (d.flags || []).indexOf('narrowIndex') >= 0 || d.id === 'clozapine';
  }

  /** Множитель уровня препарата в крови из-за взаимодействий (для модели эффекта и лабораторий). */
  P.levelMult = function (pt, drug) {
    let m = 1;
    const others = (pt.rx || []).filter((o) => o.kind !== 'int' && o.id !== drug.id).map((o) => P.drug(o.id)).filter(Boolean);
    const sub = (drug.cyp && drug.cyp.sub) || [];
    others.forEach((o) => {
      const inh = (o.cyp && o.cyp.inh) || {};
      const ind = (o.cyp && o.cyp.ind) || {};
      sub.forEach((e) => {
        if (inh[e] === 'strong') m *= sub.length > 1 ? 1.5 : 2;
        else if (inh[e]) m *= 1.2;
        if (ind[e] === 'strong') m *= 0.55;
        else if (ind[e]) m *= 0.8;
      });
      if (drug.id === 'lamotrigine' && o.id === 'valproate') m *= 2;
    });
    const t = P.tags(pt);
    Object.keys(P.TAG_CYP).forEach((tag) => {
      if (!t[tag]) return;
      const x = P.TAG_CYP[tag];
      sub.forEach((e) => {
        const i = (x.inh || {})[e];
        const n = (x.ind || {})[e];
        if (i === 'strong') m *= sub.length > 1 ? 1.5 : 2;
        else if (i) m *= 1.25;
        if (n === 'strong') m *= 0.55;
        else if (n) m *= 0.8;
      });
    });
    if (sub.indexOf('1A2') >= 0 && t.smoker && !pt.quitSmoking) m *= 0.65;
    if (t.renal && ['lithium', 'amisulpride', 'sulpiride', 'paliperidone', 'pregabalin', 'memantine'].indexOf(drug.id) >= 0) m *= 1.4;
    if (t.liver && ['valproate', 'duloxetine', 'agomelatine', 'olanzapine', 'diazepam', 'phenazepam', 'clonazepam', 'alprazolam'].indexOf(drug.id) >= 0) m *= 1.3;
    if (t.elderly) m *= 1.2;
    return m;
  };

  /** Был ли тест сделан/назначен за последние n дней. */
  P.recentTest = function (pt, test, n) {
    return (pt.tests || []).some((t) => t.test === test && t.day >= pt.today - n);
  };

  /* ---------- Обязательный мониторинг ---------- */
  /** Что пора проверить: [{ test, why, overdue }] */
  P.dueTests = function (s, pt) {
    const out = [];
    const add = (test, why, overdue) => {
      if (out.some((x) => x.test === test)) return;
      out.push({ test, why, overdue: !!overdue });
    };
    // На амбулаторном приёме время между визитами «сжато»: считаем в днях лечения
    const amb = pt.mode === 'amb';
    const sp = amb && A.ward ? A.ward.speed(pt) : 1;
    const bio = (n) => n * sp;
    (pt.rx || []).forEach((rx) => {
      if (rx.kind === 'int' || rx.prn) return; // «по требованию» — без планового мониторинга
      const d = P.drug(rx.id);
      if (!d) return;
      const on = bio(s.day - rx.since);
      (d.monitor || []).forEach((m) => {
        if (!monitorApplies(pt, m)) return;
        const last = lastTestDay(pt, m.test);
        const sinceLast = bio(s.day - last);
        if (m.when === 'start') {
          if (amb && rx.pre) return; // терапия начата до нас — важен плановый контроль
          if (!(last >= rx.since - 14)) add(m.test, d.name + ': ' + (m.note || 'контроль в начале терапии'), on > 3);
        }
        if (m.when === 'week') {
          // в амбулатории со временем реже: первые 18 недель — по графику, затем раз в месяц, после года — раз в 3 месяца
          const every = !amb ? 7 : on > 365 && d.id !== 'clozapine' ? 90 : on > 126 ? 28 : 7;
          const ref = last >= rx.since - 3 ? last : rx.since;
          const since = bio(s.day - ref);
          const why = every === 7 ? m.note || 'еженедельный контроль' : (P.TESTS[m.test] || { name: m.test }).name + (every === 28 ? ' раз в месяц' : ' раз в 3 месяца') + ' при длительном приёме';
          if (since >= every && on >= 6) add(m.test, d.name + ': ' + why, since > every * 1.5);
        }
        if (m.when === 'level') {
          const ch = rx.changed || rx.since;
          const sinceCh = bio(s.day - ch);
          if (amb && sinceCh > 60) {
            // доза давно не менялась: плановая концентрация раз в 3–6 месяцев
            if (sinceLast >= 120) add(m.test, d.name + ': плановый контроль концентрации — раз в 3–6 месяцев', sinceLast > 180);
          } else {
            const after = Math.ceil(4 / sp);
            const ok = last >= ch + after && sinceLast < 8;
            if (!ok && sinceCh >= 5) add(m.test, d.name + ': ' + (m.note || 'контроль концентрации'), (sinceCh > 9 && !(last >= ch + after)) || sinceLast > 11);
          }
        }
        if (m.when === 'period' && amb && on >= 30) {
          if (sinceLast >= m.every) add(m.test, d.name + ': ' + m.note, sinceLast > m.every * 1.5);
        }
      });
    });
    return out;
  };

  function lastTestDay(pt, test) {
    let d = -999;
    (pt.tests || []).forEach((t) => {
      if (t.test === test && t.day > d) d = t.day;
    });
    return d;
  }
  P.lastTestDay = lastTestDay;

  /* ---------- Лабораторные показатели ---------- */
  P.labValue = function (s, pt, test) {
    const b = pt.base || {};
    const L = pt.lab;
    const n = (x, sd) => x + (Math.random() * 2 - 1) * sd;
    const r1 = (x) => Math.round(x * 10) / 10;
    switch (test) {
      case 'ecg':
        return { qtc: Math.round(n(L.qtc, 4)), hr: Math.round(n(72 + (pt.sx.anticholinergic || 0) * 8 + (pt.group === 'delirium_tremens' || pt.group === 'alcohol_withdrawal' ? pt.sev * 0.3 : 0), 4)) };
      case 'cbc':
        return { anc: r1(Math.max(0.2, n(L.anc, 0.2))), wbc: r1(Math.max(1, n(L.anc + 2.2, 0.3))), hb: Math.round(n(b.hb || 138, 3)) };
      case 'bio':
        return { glucose: r1(n(L.glucose, 0.2)), alt: Math.round(n(L.alt, 3)), creat: Math.round(n(L.creat, 4)), egfr: Math.round(n(L.egfr, 3)), na: Math.round(n(L.na, 1)) };
      case 'lipids':
        return { ldl: r1(n(L.ldl, 0.1)), tg: r1(n(L.tg, 0.1)) };
      case 'glucose':
        return { glucose: r1(n(L.glucose, 0.2)) };
      case 'lithium':
        return { li: r1(Math.max(0, n(L.li, 0.05))), steady: L.liSteady };
      case 'valproate':
        return { vpa: Math.round(Math.max(0, n(L.vpa, 4))) };
      case 'prolactin':
        return { prl: Math.round(n(L.prl, 3)) };
      case 'tsh':
        return { tsh: r1(n(L.tsh, 0.2)) };
      case 'ck':
        return { ck: Math.round(n(L.ck, 15)) };
      case 'hcg':
        return { hcg: (pt.traits || []).indexOf('pregnancy') >= 0 };
      case 'tox':
        return { tox: pt.toxText || 'не обнаружено' };
      case 'eeg':
        return { eeg: pt.group === 'delirium_tremens' || pt.events.some((e) => e.k === 'delirium_anticholinergic') ? 'диффузное замедление основного ритма' : (pt.traits || []).indexOf('epilepsy') >= 0 ? 'эпилептиформная активность в височных отведениях' : 'без патологических изменений' };
      case 'weight':
        return { weight: r1(L.weight), bmi: r1(L.weight / Math.pow((b.height || 170) / 100, 2)) };
    }
    return {};
  };

  /** Человекочитаемый результат с флагами отклонений. */
  P.labText = function (test, v) {
    const f = (x, lo, hi) => (x < lo ? ' ↓' : x > hi ? ' ↑' : '');
    const c = (x) => String(x).replace('.', ',');
    switch (test) {
      case 'ecg':
        return 'ЧСС ' + v.hr + ' в мин, QTc ' + v.qtc + ' мс' + (v.qtc >= 500 ? ' ↑↑' : v.qtc >= 460 ? ' ↑' : '');
      case 'cbc':
        return 'лейкоциты ' + c(v.wbc) + f(v.wbc, 4, 9) + ', нейтрофилы ' + c(v.anc) + f(v.anc, 1.8, 7.5) + ' ×10⁹/л, Hb ' + v.hb + ' г/л';
      case 'bio':
        return 'глюкоза ' + c(v.glucose) + f(v.glucose, 3.3, 6.1) + ', АЛТ ' + v.alt + f(v.alt, 0, 40) + ' Ед/л, креатинин ' + v.creat + ' мкмоль/л (СКФ ' + v.egfr + f(v.egfr, 60, 999) + '), натрий ' + v.na + f(v.na, 135, 145) + ' ммоль/л';
      case 'lipids':
        return 'ЛПНП ' + c(v.ldl) + f(v.ldl, 0, 3) + ', триглицериды ' + c(v.tg) + f(v.tg, 0, 1.7) + ' ммоль/л';
      case 'glucose':
        return 'глюкоза ' + c(v.glucose) + f(v.glucose, 3.3, 6.1) + ' ммоль/л';
      case 'lithium':
        return 'литий ' + c(v.li) + ' ммоль/л' + (v.li > 1.2 ? ' ↑' : v.li < 0.6 ? ' ↓' : '') + (v.steady ? '' : ' (равновесие ещё не достигнуто)');
      case 'valproate':
        return 'вальпроат ' + v.vpa + ' мкг/мл' + f(v.vpa, 50, 100);
      case 'prolactin':
        return 'пролактин ' + v.prl + ' нг/мл' + f(v.prl, 0, 25);
      case 'tsh':
        return 'ТТГ ' + c(v.tsh) + ' мМЕ/л' + f(v.tsh, 0.4, 4);
      case 'ck':
        return 'КФК ' + v.ck + ' Ед/л' + (v.ck > 1000 ? ' ↑↑' : v.ck > 200 ? ' ↑' : '');
      case 'hcg':
        return v.hcg ? 'положительный' : 'отрицательный';
      case 'tox':
        return v.tox;
      case 'eeg':
        return v.eeg;
      case 'weight':
        return c(v.weight) + ' кг, ИМТ ' + c(v.bmi) + f(v.bmi, 18.5, 25);
    }
    return '';
  };
})((window.A = window.A || {}));
