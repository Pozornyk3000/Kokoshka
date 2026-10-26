#!/usr/bin/env node
/* Проверка формата игровых данных.
   Запуск: node tools/validate.mjs            — все файлы js/data/*.js
           node tools/validate.mjs FILE...    — только указанные (глоссарий подгружается всегда) */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(root, 'js/data');
const args = process.argv.slice(2);
const always = ['glossary.js', 'world.js', 'schedule.js'].map((f) => path.join(dataDir, f));
const files = args.length
  ? [...new Set([...always, ...args.map((f) => path.resolve(f))])]
  : fs.readdirSync(dataDir).filter((f) => f.endsWith('.js')).map((f) => path.join(dataDir, f));

const ctx = { console, Math, JSON, Object, Array, String, Number, Date };
ctx.window = ctx;
ctx.A = {};
ctx.window.A = ctx.A;
vm.createContext(ctx);
// Минимальные заглушки для файлов, которые обращаются к утилитам при загрузке
vm.runInContext(fs.readFileSync(path.join(root, 'js/core/util.js'), 'utf8'), ctx, { filename: 'util.js' });
vm.runInContext(fs.readFileSync(path.join(root, 'js/core/calendar.js'), 'utf8'), ctx, { filename: 'calendar.js' });

const errors = [];
const warns = [];
for (const f of files) {
  try {
    vm.runInContext(fs.readFileSync(f, 'utf8'), ctx, { filename: path.basename(f) });
  } catch (e) {
    errors.push(`${path.basename(f)}: не загружается — ${e.message}`);
  }
}
const D = ctx.A.data || {};
const DOMAINS = ['psychopath', 'affective', 'psychosis', 'neurotic', 'addiction', 'organic', 'child', 'personality', 'pharm', 'emergency'];
const SETTINGS = ['pnd', 'ward', 'er', 'private', 'consult'];
const SCENES = ['office', 'private', 'ward', 'er', 'night'];
const EMOTIONS = ['neutral', 'smile', 'sad', 'anxious', 'elated', 'flat', 'suspicious', 'confused', 'angry', 'tired', 'stern', 'smirk', 'fear'];
const CRIT = ['suicide', 'substance', 'somatic', 'safety', 'mania', 'onset', 'child', 'meds'];
const MINI_TAGS = ['followup', 'pnd', 'private', 'ward', 'er', 'consult', 'online', 'night', 'night_nurse'];
const gloss = D.glossary || {};
const ids = new Map();
const seen = (id, where) => {
  if (ids.has(id)) errors.push(`${where}: повтор id «${id}» (уже есть в ${ids.get(id)})`);
  else ids.set(id, where);
};
const str = (v, min, max) => typeof v === 'string' && v.trim().length >= (min || 1) && (!max || v.length <= max);
const words = (v) => (typeof v === 'string' ? v.trim().split(/\s+/).length : 0);
const badChars = (v, where) => {
  if (typeof v !== 'string') return;
  if (/[a-z]{4,}/i.test(v.replace(/(F|G|T|E|X|H|K|O)\d{1,2}(\.\d{1,2})?/g, '').replace(/CIWA-Ar|NMDA|CYP\w*|ICOCS|CANMAT|MMSE|PHQ|YMRS|PANSS|GAD|ISI|PDSS|PCL|PACS|Y-BOCS/g, ''))) warns.push(`${where}: латиница в тексте: «${v.slice(0, 60)}…»`);
  if (/\{[^}|]*\}/.test(v.replace(/\{(P|age|purpose|name)\}/g, '')) && !/\{[^{}|]*\|[^{}|]*\}/.test(v)) errors.push(`${where}: странные фигурные скобки: «${v.slice(0, 60)}»`);
};

/* ---------- Глоссарий ---------- */
for (const k of Object.keys(gloss)) {
  if (!str(gloss[k].name)) errors.push(`glossary.${k}: нет name`);
  if (args.some((a) => a.includes('glossary')) && !str(gloss[k].def, 20)) errors.push(`glossary.${k}: пустое или слишком короткое определение`);
}

/* ---------- Лекции ---------- */
for (const L of D.lectures || []) {
  const w = `лекция ${L.id}`;
  seen(L.id, w);
  if (!/^l\d\d$/.test(L.id)) errors.push(`${w}: id должен быть вида l01`);
  if (typeof L.n !== 'number') errors.push(`${w}: нет номера n`);
  if (!str(L.title)) errors.push(`${w}: нет title`);
  if (!DOMAINS.includes(L.domain)) errors.push(`${w}: неверный domain ${L.domain}`);
  if (L.domain2 && !DOMAINS.includes(L.domain2)) errors.push(`${w}: неверный domain2 ${L.domain2}`);
  if (!Array.isArray(L.slides) || L.slides.length < 5 || L.slides.length > 8) errors.push(`${w}: слайдов должно быть 5–8`);
  (L.slides || []).forEach((s, i) => {
    if (!str(s.h)) errors.push(`${w}: слайд ${i} без заголовка`);
    if (words(s.b) < 35 || words(s.b) > 170) warns.push(`${w}: слайд ${i} — ${words(s.b)} слов (нужно 50–130)`);
    badChars(s.b, `${w}.слайд${i}`);
  });
  if (!Array.isArray(L.quiz) || L.quiz.length < 3 || L.quiz.length > 5) errors.push(`${w}: вопросов блиц-опроса должно быть 3–5`);
  (L.quiz || []).forEach((q, i) => {
    if (!str(q.q)) errors.push(`${w}: вопрос ${i} без текста`);
    if (!Array.isArray(q.opts) || q.opts.length < 3 || q.opts.length > 5) errors.push(`${w}: вопрос ${i} — нужно 3–5 вариантов`);
    if (typeof q.ok !== 'number' || q.ok < 0 || q.ok >= (q.opts || []).length) errors.push(`${w}: вопрос ${i} — неверный ok`);
    if (!str(q.why, 15)) errors.push(`${w}: вопрос ${i} без пояснения why`);
  });
}
for (const s of D.schedule || []) {
  if ((D.lectures || []).length && !(D.lectures || []).some((L) => L.id === s.lecture)) warns.push(`расписание: нет лекции ${s.lecture}`);
  if ((D.cases || []).length && !(D.cases || []).some((c) => c.id === s.seminar)) warns.push(`расписание: нет случая ${s.seminar}`);
}

/* ---------- Клинические случаи ---------- */
const exactlyOne = (opts) => opts.filter((o) => o.ok).length === 1;
for (const c of D.cases || []) {
  const w = `случай ${c.id}`;
  seen(c.id, w);
  if (!/^c_[a-z0-9_]+$/.test(c.id || '')) errors.push(`${w}: id должен начинаться с c_`);
  if (!str(c.title, 5, 70)) errors.push(`${w}: title 5–70 символов`);
  if (!DOMAINS.includes(c.topic)) errors.push(`${w}: неверный topic`);
  if (c.topic2 && !DOMAINS.includes(c.topic2)) errors.push(`${w}: неверный topic2`);
  if (!Array.isArray(c.settings) || !c.settings.length || c.settings.some((x) => !SETTINGS.includes(x))) errors.push(`${w}: settings — из ${SETTINGS.join(', ')}`);
  if (![1, 2, 3].includes(c.difficulty)) errors.push(`${w}: difficulty 1–3`);
  if (!SCENES.includes(c.scene)) errors.push(`${w}: scene — из ${SCENES.join(', ')}`);
  if (!str(c.where)) errors.push(`${w}: нет where`);
  const p = c.patient || {};
  if (!str(p.name) || typeof p.age !== 'number' || !['m', 'f'].includes(p.sex)) errors.push(`${w}: patient {name, age, sex}`);
  if (!EMOTIONS.includes(p.emotion)) errors.push(`${w}: patient.emotion из ${EMOTIONS.join(', ')}`);
  if (!str(c.intro, 40)) errors.push(`${w}: короткий intro`);
  if (!str(c.complaint, 10)) errors.push(`${w}: нет complaint`);
  if (!Array.isArray(c.q) || c.q.length < 6 || c.q.length > 10) errors.push(`${w}: вопросов q должно быть 6–10`);
  const q = c.q || [];
  q.forEach((x, i) => {
    if (!str(x.t) || !str(x.a)) errors.push(`${w}: вопрос ${i} без t/a`);
    if (typeof x.v !== 'number' || x.v < -3 || x.v > 3) errors.push(`${w}: вопрос ${i} — v от −3 до 3`);
    if (x.crit && !CRIT.includes(x.crit)) errors.push(`${w}: вопрос ${i} — crit из ${CRIT.join(', ')}`);
    if (x.v < 0 && !str(x.bad)) errors.push(`${w}: вопрос ${i} с v<0 должен иметь bad`);
    badChars(x.a, `${w}.q${i}`);
  });
  if (!q.some((x) => x.key || x.crit)) errors.push(`${w}: нет ключевых вопросов (key/crit)`);
  if (!q.some((x) => x.v < 0)) errors.push(`${w}: нужен хотя бы один неудачный вопрос (v<0, bad, rap<0)`);
  if (typeof c.maxQ !== 'number' || c.maxQ < 3 || c.maxQ >= q.length) errors.push(`${w}: maxQ от 3 и меньше числа вопросов`);
  // Идеальный расспрос (все обязательные вопросы + самые полезные) должен давать максимум за беседу
  const crit = q.filter((x) => x.crit);
  if (crit.length > c.maxQ) errors.push(`${w}: обязательных вопросов (crit) ${crit.length} — больше, чем можно задать (maxQ ${c.maxQ})`);
  const bestQ = q.map((x) => x.v).filter((v) => v > 0).sort((a, b) => b - a).slice(0, c.maxQ).reduce((a, b) => a + b, 0);
  const restQ = q.filter((x) => !x.crit && x.v > 0).map((x) => x.v).sort((a, b) => b - a);
  const idealQ = crit.reduce((a, x) => a + Math.max(0, x.v), 0) + restQ.slice(0, Math.max(0, c.maxQ - crit.length)).reduce((a, b) => a + b, 0);
  if (crit.length <= c.maxQ && idealQ < bestQ) warns.push(`${w}: расспрос с обязательными вопросами набирает ${idealQ} из ${bestQ} — поднимите v у вопросов crit`);
  const st = c.status || {};
  if (!str(st.text, 60)) errors.push(`${w}: status.text короткий`);
  const so = st.opts || [];
  if (so.length < 7 || so.length > 11) errors.push(`${w}: status.opts — 7–11 вариантов`);
  const sok = so.filter((o) => o.ok).length;
  if (sok < 3 || sok > 6) errors.push(`${w}: status.opts — 3–6 верных (сейчас ${sok})`);
  so.forEach((o, i) => {
    if (o.k && !gloss[o.k]) errors.push(`${w}: status.opts[${i}] — нет ключа «${o.k}» в глоссарии`);
    if (!o.k && !str(o.t)) errors.push(`${w}: status.opts[${i}] — нужен k или t`);
    if (!o.k && o.t && !str(o.def, 10)) warns.push(`${w}: status.opts[${i}] «${o.t}» без def`);
  });
  const syn = (c.syndrome || {}).opts || [];
  if (syn.length < 3 || syn.length > 5 || !exactlyOne(syn)) errors.push(`${w}: syndrome — 3–5 вариантов, ровно один ok`);
  const dx = (c.dx || {}).opts || [];
  if (dx.length < 4 || dx.length > 5 || !exactlyOne(dx)) errors.push(`${w}: dx — 4–5 вариантов, ровно один ok`);
  dx.forEach((o, i) => {
    if (!o.ok && !str(o.why, 10)) warns.push(`${w}: dx[${i}] без why`);
  });
  const tx = (c.tx || {}).opts || [];
  if (tx.length < 5 || tx.length > 9) errors.push(`${w}: tx — 5–9 вариантов`);
  const tok = tx.filter((o) => o.ok).length;
  if (tok < 2 || tok > 5) errors.push(`${w}: tx — 2–5 верных (сейчас ${tok})`);
  if (!tx.some((o) => o.bad)) errors.push(`${w}: tx — нужен хотя бы один опасный вариант bad:true`);
  tx.forEach((o, i) => {
    if (o.ok && o.bad) errors.push(`${w}: tx[${i}] одновременно ok и bad`);
    if (!o.ok && !str(o.why, 10)) errors.push(`${w}: tx[${i}] неверный вариант без why`);
  });
  if (!str(c.debrief, 200)) errors.push(`${w}: debrief короткий`);
  if (words(c.debrief) > 260) warns.push(`${w}: debrief ${words(c.debrief)} слов (до 220)`);
  if (!str(c.pearl, 20)) errors.push(`${w}: нет pearl`);
  if (!str(c.vignette, 200)) errors.push(`${w}: vignette короткая`);
  if (c.thiamine && !tx.some((o) => o.thiamine)) errors.push(`${w}: thiamine:true, но в tx нет варианта с thiamine:true`);
  [c.intro, c.complaint, c.debrief, c.pearl, c.vignette, st.text].forEach((t, i) => badChars(t, `${w}.text${i}`));
}

/* ---------- Мини-задачи ---------- */
for (const m of D.minis || []) {
  const w = `мини ${m.id}`;
  seen(m.id, w);
  if (!/^m_[a-z0-9_]+$/.test(m.id || '')) errors.push(`${w}: id должен начинаться с m_`);
  if (!Array.isArray(m.tags) || !m.tags.length || m.tags.some((t) => !MINI_TAGS.includes(t))) errors.push(`${w}: tags из ${MINI_TAGS.join(', ')}`);
  if (!DOMAINS.includes(m.topic)) errors.push(`${w}: неверный topic`);
  if (!str(m.setting)) errors.push(`${w}: нет setting`);
  const p = m.patient || {};
  if (!str(p.name) || typeof p.age !== 'number' || !['m', 'f'].includes(p.sex) || !EMOTIONS.includes(p.emotion)) errors.push(`${w}: patient {name, age, sex, emotion}`);
  if (!str(m.text, 60)) errors.push(`${w}: короткий text`);
  if (!str(m.q)) errors.push(`${w}: нет q`);
  const o = m.options || [];
  if (o.length < 3 || o.length > 4 || !exactlyOne(o)) errors.push(`${w}: 3–4 варианта, ровно один ok`);
  o.forEach((x, i) => {
    if (!str(x.t) || !str(x.why, 10)) errors.push(`${w}: вариант ${i} без t/why`);
  });
  if (!str(m.explain, 20)) errors.push(`${w}: нет explain`);
  badChars(m.text, w);
}

/* ---------- Медкомиссия, имена, финалы, доп. тест ---------- */
for (const t of D.commissionTemplates || []) {
  const w = `комиссия ${t.id}`;
  seen(t.id, w);
  if (!Array.isArray(t.age) || t.age.length !== 2) errors.push(`${w}: age [от, до]`);
  if (t.sex && !['m', 'f'].includes(t.sex)) errors.push(`${w}: sex m/f`);
  if (t.purpose && !['driver', 'weapon'].includes(t.purpose)) errors.push(`${w}: purpose driver/weapon`);
  if (!str(t.text, 60)) errors.push(`${w}: короткий text`);
  const o = t.options || [];
  if (o.length < 2 || o.length > 4 || !exactlyOne(o)) errors.push(`${w}: 2–4 варианта, ровно один ok`);
  o.forEach((x, i) => {
    if (!str(x.t) || !str(x.why, 10)) errors.push(`${w}: вариант ${i} без t/why`);
  });
  if (!str(t.explain, 20)) errors.push(`${w}: нет explain`);
}
if (D.namesM && D.namesM.length < 15) errors.push('namesM: нужно 15+ имён');
if (D.namesF && D.namesF.length < 15) errors.push('namesF: нужно 15+ имён');
for (const k of Object.keys(D.endings || {})) {
  const e = D.endings[k];
  if (!str(e.title) || !(typeof e.text === 'function' || str(e.text, 100))) errors.push(`финал ${k}: нужны title и text`);
}
(D.extraTest || []).forEach((q, i) => {
  if (!str(q.q) || !Array.isArray(q.opts) || typeof q.ok !== 'number' || q.ok >= q.opts.length || !str(q.why, 15)) errors.push(`extraTest[${i}]: формат {q, opts, ok, why}`);
  if (q.topic && !DOMAINS.includes(q.topic)) errors.push(`extraTest[${i}]: неверный topic ${q.topic}`);
});

/* ---------- Банк тестовых вопросов (тренажёр и тест аккредитации) ---------- */
const qTexts = new Map();
const normQ = (t) => String(t || '').toLowerCase().replace(/ё/g, 'е').replace(/[^а-яa-z0-9]+/g, ' ').trim();
(D.lectures || []).forEach((L) => (L.quiz || []).forEach((q, i) => qTexts.set(normQ(q.q), `лекция ${L.id}, вопрос ${i}`)));
(D.extraTest || []).forEach((q, i) => qTexts.set(normQ(q.q), `extraTest[${i}]`));
for (const q of D.testBank || []) {
  const w = `testBank.${q.id}`;
  seen('t:' + q.id, w);
  if (!/^[a-z]{2}\d\d$/.test(q.id || '')) errors.push(`${w}: id вида af01`);
  if (!DOMAINS.includes(q.topic)) errors.push(`${w}: неверный topic ${q.topic}`);
  if (!str(q.q, 15)) errors.push(`${w}: нет текста вопроса`);
  if (!Array.isArray(q.opts) || q.opts.length !== 4 || q.opts.some((o) => !str(o))) errors.push(`${w}: нужно ровно 4 непустых варианта`);
  else if (new Set(q.opts.map(normQ)).size !== 4) errors.push(`${w}: повторяющиеся варианты`);
  if (!Number.isInteger(q.ok) || q.ok < 0 || q.ok >= (q.opts || []).length) errors.push(`${w}: неверный ok`);
  if (!str(q.why, 60)) errors.push(`${w}: короткое пояснение why`);
  if (q.lvl != null && ![1, 2, 3].includes(q.lvl)) errors.push(`${w}: уровень lvl — 1, 2 или 3`);
  const n = normQ(q.q);
  if (qTexts.has(n)) errors.push(`${w}: вопрос повторяет ${qTexts.get(n)}`);
  else qTexts.set(n, w);
  [q.q, q.why].concat(q.opts || []).forEach((t) => badChars(t, w));
}
const byTopic = {};
const hardBy = {};
for (const q of D.testBank || []) {
  byTopic[q.topic] = (byTopic[q.topic] || 0) + 1;
  if (q.lvl === 3) hardBy[q.topic] = (hardBy[q.topic] || 0) + 1;
}
// Полный тест сложного уровня (80 вопросов) берёт по 8 сложных вопросов из каждой темы
if ((D.testBank || []).some((q) => q.lvl === 3)) for (const k of DOMAINS) if ((hardBy[k] || 0) < 8) errors.push(`testBank: в теме ${k} сложных вопросов ${hardBy[k] || 0} — нужно не меньше 8`);

/* ---------- Отделение: формуляр, КР, пациенты, тексты ---------- */
// Модуль фармакологии нужен для групп пациентов и меток (загружаем движок без интерфейса)
vm.runInContext(fs.readFileSync(path.join(root, 'js/game/pharma.js'), 'utf8'), ctx, { filename: 'pharma.js' });
const PH = ctx.A.pharma;
const drugs = D.drugs || [];
const ints = D.interventions || [];
if (drugs.length || (D.wardPatients || []).length) {
  const EFF = ['psychosis', 'mania', 'bipdep', 'depression', 'anxiety', 'ocd', 'ptsd', 'withdrawal', 'bpsd', 'impulsivity', 'sleep', 'eps', 'akathisia', 'craving', 'cognition', 'agitation'];
  const SEK = ['eps', 'akathisia', 'sedation', 'weight', 'metabolic', 'prolactin', 'qt', 'anticholinergic', 'orthostatic', 'serotonergic', 'seizure', 'hyponatremia', 'agranulocytosis', 'sexual', 'activation', 'hepatotox', 'rash', 'tremor', 'dependence', 'nms'];
  const GROUPS = PH.GROUP_TABS.map((t) => t[0]).filter((g) => g !== 'int');
  const drugIds = new Set(drugs.map((d) => d.id));
  const intIds = new Set(ints.map((x) => x.id));
  const tagOk = (t) => !!PH.TAG_NAMES[t] || drugIds.has(t);
  const classes = new Set(drugs.map((d) => d.cls));
  for (const d of drugs) {
    const w = `drugs.${d.id}`;
    seen('drug:' + d.id, w);
    if (!str(d.name)) errors.push(`${w}: нет name`);
    if (!GROUPS.includes(d.group)) errors.push(`${w}: неверная группа ${d.group}`);
    if (!Array.isArray(d.forms) || !d.forms.length) errors.push(`${w}: нет форм выпуска`);
    for (const f of d.forms || []) {
      if (!PH.ROUTES[f.route]) errors.push(`${w}: неизвестный путь ${f.route}`);
      if (!Array.isArray(f.steps) || !f.steps.length) errors.push(`${w}: форма ${f.route} без шагов дозы`);
      else if (f.steps.some((x, i) => i && x <= f.steps[i - 1])) errors.push(`${w}: шаги дозы ${f.route} не по возрастанию`);
      if (f.range) {
        if (!(f.range.start <= f.range.max && f.range.min <= f.range.max)) errors.push(`${w}: странный диапазон формы ${f.route}`);
        if (f.steps && f.range.start != null && f.steps.indexOf(f.range.start) < 0) warns.push(`${w}: стартовая доза ${f.range.start} не совпадает с шагом формы ${f.route}`);
      }
    }
    for (const k of Object.keys(d.doses || {})) {
      const r = d.doses[k];
      if (!EFF.includes(k)) errors.push(`${w}: неизвестный домен доз ${k}`);
      if (!(r.start <= r.max && r.min <= r.max && r.start > 0)) errors.push(`${w}: странные дозы для ${k}`);
      const po = (d.forms || []).find((f) => f.route === 'po' || f.route === 'sl');
      if (po && po.steps.indexOf(r.start) < 0) warns.push(`${w}: стартовая доза ${k}=${r.start} не совпадает с шагами таблеток`);
      if (po && r.max > po.steps[po.steps.length - 1] + 1e-9) warns.push(`${w}: максимум ${k}=${r.max} больше последнего шага таблеток`);
    }
    for (const k of Object.keys(d.eff || {})) if (!EFF.includes(k)) errors.push(`${w}: неизвестный домен эффекта ${k}`);
    for (const k of Object.keys(d.onset || {})) if (!EFF.includes(k)) errors.push(`${w}: неизвестный домен onset ${k}`);
    for (const k of Object.keys(d.se || {})) {
      if (!SEK.includes(k)) errors.push(`${w}: неизвестное НЯ ${k}`);
      if (!(d.se[k] >= 0 && d.se[k] <= 3)) errors.push(`${w}: НЯ ${k} вне 0–3`);
    }
    for (const c of (d.contra || []).concat(d.caution || [])) {
      if (!tagOk(c.t)) errors.push(`${w}: неизвестная метка противопоказания ${c.t}`);
      if (c.sev && !['major', 'moderate'].includes(c.sev)) errors.push(`${w}: неверная тяжесть ${c.sev}`);
      if (!str(c.note, 5)) errors.push(`${w}: нет пояснения к ${c.t}`);
    }
    for (const m of d.monitor || []) {
      if (!PH.TESTS[m.test]) errors.push(`${w}: неизвестный анализ ${m.test}`);
      if (!['start', 'week', 'level', 'sx', 'period'].includes(m.when)) errors.push(`${w}: неверный when ${m.when}`);
      if (m.only && !PH.TAG_NAMES[m.only]) errors.push(`${w}: неизвестное условие only ${m.only}`);
    }
    for (const k of d.kin || []) if (!drugIds.has(k)) errors.push(`${w}: родственный препарат ${k} не найден`);
    if (!str(d.notes, 40)) errors.push(`${w}: нет описания`);
    badChars(d.notes, w);
  }
  for (const it of ints) {
    const w = `interventions.${it.id}`;
    seen('int:' + it.id, w);
    if (!str(it.name) || !str(it.note, 10)) errors.push(`${w}: нет name или note`);
    for (const k of Object.keys(it.eff || {})) if (!EFF.includes(k)) errors.push(`${w}: неизвестный домен ${k}`);
    if (it.where && (!Array.isArray(it.where) || it.where.some((x) => !['ward', 'amb'].includes(x)))) errors.push(`${w}: неверное where`);
  }
  // КР: каждая запись ссылается на существующий препарат, класс, группу или вмешательство
  const GL = D.guidelines || {};
  for (const g of Object.keys(PH.GROUPS)) if (!GL[g]) errors.push(`guidelines: нет КР для группы ${g}`);
  for (const [g, x] of Object.entries(GL)) {
    const w = `guidelines.${g}`;
    if (!PH.GROUPS[g]) errors.push(`${w}: неизвестная группа`);
    if (!str(x.title)) errors.push(`${w}: нет названия КР`);
    if (x.year != null && !(x.year >= 2016 && x.year <= 2026)) errors.push(`${w}: странный год ${x.year}`);
    if (x.standard && !(str(x.standard.title) && /приказ/.test(x.standard.order || ''))) errors.push(`${w}: стандарт без приказа`);
    for (const [ph, lists] of Object.entries(x.phases || {})) {
      for (const k of ['first', 'second', 'adjunct', 'avoid']) {
        for (const e0 of lists[k] || []) {
          const e = typeof e0 === 'string' ? { id: e0 } : e0;
          const ok = e.id ? drugIds.has(e.id) || intIds.has(e.id) : e.cls ? classes.has(e.cls) : e.group ? GROUPS.includes(e.group) : false;
          if (!ok) errors.push(`${w}.${ph}.${k}: неизвестная ссылка ${JSON.stringify(e)}`);
          if ((e.uur && !/^[ABC]$/.test(e.uur)) || (e.udd && !/^[1-5]$/.test(e.udd))) errors.push(`${w}.${ph}.${k}: неверные УУР/УДД`);
          if (k === 'avoid' && !str(e.why, 20)) errors.push(`${w}.${ph}.avoid: нет пояснения why`);
        }
      }
    }
  }
  // Пациенты отделения
  const STAGES = ['severe', 'moderate', 'mild', 'remission'];
  const tplIds = new Set();
  for (const t of D.wardPatients || []) {
    const w = `wardPatients.${t.id}`;
    seen('ward:' + t.id, w);
    tplIds.add(t.id);
    if (!PH.GROUPS[t.group]) errors.push(`${w}: неизвестная группа ${t.group}`);
    if (!(t.where || []).length || t.where.some((x) => !['study', 'hospital'].includes(x))) errors.push(`${w}: неверное where`);
    if (!['m', 'f'].includes(t.sex)) errors.push(`${w}: нет пола`);
    if (!(Array.isArray(t.age) && t.age[0] <= t.age[1])) errors.push(`${w}: неверный возраст`);
    if (!(t.sev0 >= 20 && t.sev0 <= 98)) errors.push(`${w}: sev0 вне 20–98`);
    for (const k of ['dx', 'admit', 'history', 'complaints', 'status', 'pitfall', 'ideal']) if (!str(t[k], 30)) errors.push(`${w}: нет ${k}`);
    for (const k of ['admit', 'history', 'complaints', 'status', 'pitfall', 'ideal']) badChars(t[k], w + '.' + k);
    for (const x of t.traits || []) if (!tagOk(x)) errors.push(`${w}: неизвестная метка ${x}`);
    for (const m of t.meds_home || []) if (!PH.TAG_NAMES[m.tag] || !str(m.name)) errors.push(`${w}: неверный сопутствующий препарат ${JSON.stringify(m)}`);
    for (const id of (t.intolerant || []).concat(t.failed || [])) if (!drugIds.has(id)) errors.push(`${w}: неизвестный препарат ${id}`);
    for (const r of t.home_rx || []) {
      const d = drugs.find((x) => x.id === r.id);
      if (!d) errors.push(`${w}: home_rx — неизвестный препарат ${r.id}`);
      else {
        const f = d.forms.find((x) => x.route === (r.route || 'po'));
        if (!f) errors.push(`${w}: home_rx — у ${r.id} нет формы ${r.route}`);
        else if (f.steps.indexOf(r.dose) < 0) errors.push(`${w}: home_rx — доза ${r.dose} не из шагов ${r.id}`);
      }
    }
    if (!['voluntary', 'involuntary'].includes(t.legal || 'voluntary')) errors.push(`${w}: неверный legal`);
    if (t.phase && !(GL[t.group] && GL[t.group].phases && GL[t.group].phases[t.phase])) errors.push(`${w}: нет фазы КР ${t.phase}`);
    for (const st of STAGES) if (!((t.quotes || {})[st] || []).length) errors.push(`${w}: нет реплик для стадии ${st}`);
  }
  const AMB_ONLY = ['bipolar_maint', 'alcohol_dependence', 'insomnia', 'dementia_mild'];
  const groupsWithPts = new Set((D.wardPatients || []).map((t) => t.group));
  for (const g of Object.keys(PH.GROUPS)) if (!groupsWithPts.has(g) && !AMB_ONLY.includes(g)) warns.push(`wardPatients: нет пациентов группы ${g}`);
  if (!(D.wardPatients || []).some((t) => (t.where || []).includes('study'))) errors.push('wardPatients: нет учебных пациентов');
  // Тексты
  const T = D.wardTexts || {};
  const AT = D.ambTexts || {};
  for (const g of Object.keys(PH.GROUPS)) {
    for (const st of STAGES) {
      if (AMB_ONLY.includes(g)) {
        if (!(((AT.status || {})[g] || {})[st] || []).length) errors.push(`ambTexts.status.${g}.${st}: пусто`);
        continue;
      }
      if (!(((T.course || {})[g] || {})[st] || []).length) errors.push(`wardTexts.course.${g}.${st}: пусто`);
      if (!(((T.status || {})[g] || {})[st] || []).length) errors.push(`wardTexts.status.${g}.${st}: пусто`);
    }
  }
  // Амбулаторный приём: шаблоны пациентов
  const AMB_PLACES = ['pnd', 'private', 'uni'];
  const TRIG = ['quit_smoking', 'nsaid', 'pregnancy', 'wants_stop'];
  for (const t of D.ambPatients || []) {
    const w = `ambPatients.${t.id}`;
    seen('amb:' + t.id, w);
    if (!PH.GROUPS[t.group]) errors.push(`${w}: неизвестная группа ${t.group}`);
    if (!['new', 'inherited'].includes(t.kind)) errors.push(`${w}: неверный kind ${t.kind}`);
    if (!(t.where || []).length || t.where.some((x) => !AMB_PLACES.includes(x))) errors.push(`${w}: неверное where`);
    if (!['m', 'f'].includes(t.sex)) errors.push(`${w}: нет пола`);
    if (!(Array.isArray(t.age) && t.age[0] <= t.age[1])) errors.push(`${w}: неверный возраст`);
    if (!(t.sev0 >= 5 && t.sev0 <= 95)) errors.push(`${w}: sev0 вне 5–95`);
    for (const k of ['dx', 'referral', 'complaints', 'history', 'status', 'pitfall', 'ideal']) if (!str(t[k], 20)) errors.push(`${w}: нет ${k}`);
    for (const k of ['referral', 'complaints', 'history', 'somatic', 'status', 'pitfall', 'ideal']) badChars(t[k], w + '.' + k);
    for (const x of t.traits || []) if (!tagOk(x)) errors.push(`${w}: неизвестная метка ${x}`);
    for (const m of t.meds_home || []) if (!PH.TAG_NAMES[m.tag] || !str(m.name)) errors.push(`${w}: неверный сопутствующий препарат ${JSON.stringify(m)}`);
    for (const id of (t.intolerant || []).concat(t.failed || [])) if (!drugIds.has(id)) errors.push(`${w}: неизвестный препарат ${id}`);
    for (const r of (t.rx || []).concat(t.home_rx || [])) {
      const d = drugs.find((x) => x.id === r.id);
      if (!d) errors.push(`${w}: неизвестный препарат ${r.id}`);
      else {
        const f = d.forms.find((x) => x.route === (r.route || 'po'));
        if (!f) errors.push(`${w}: у ${r.id} нет формы ${r.route}`);
        else if (f.steps.indexOf(r.dose) < 0) errors.push(`${w}: доза ${r.dose} не из шагов ${r.id}`);
        if (r.time && !PH.TIMES[r.time]) errors.push(`${w}: неверное время приёма ${r.time}`);
      }
    }
    if (t.kind === 'new') {
      const opts = (t.dxq || {}).opts || [];
      if (opts.length < 3) errors.push(`${w}: мало вариантов диагноза`);
      if (opts.filter((o) => o.ok === true).length !== 1) errors.push(`${w}: нужен ровно один верный диагноз`);
      for (const o of opts) if (!str(o.t, 5) || !str(o.why, 20)) errors.push(`${w}: вариант диагноза без текста или пояснения`);
      if (!str(t.somatic, 10)) errors.push(`${w}: нет somatic`);
    } else {
      if (!(t.rx || []).length) errors.push(`${w}: у принятого пациента нет текущего лечения`);
      if (!(t.past || []).length) errors.push(`${w}: нет записей прежнего врача`);
      for (const x of t.past || []) if (!(x.ago >= 0) || !str(x.who) || !str(x.text, 10)) errors.push(`${w}: неверная запись прежнего врача`);
      for (const x of t.pastLabs || []) if (!PH.TESTS[x.test] || !(x.ago >= 0) || !x.v) errors.push(`${w}: неверный прежний анализ ${x.test}`);
    }
    for (const x of t.triggers || []) if (!TRIG.includes(x.k) || !(Array.isArray(x.at) && x.at[0] <= x.at[1])) errors.push(`${w}: неверный поворот ${JSON.stringify(x)}`);
    for (const x of t.issues || []) {
      if (!str(x.id) || !str(x.text) || !str(x.ok, 10) || !str(x.bad, 10) || typeof x.check !== 'function') errors.push(`${w}: неверная проверка ${x.id}`);
    }
    if (t.phase && !(GL[t.group] && GL[t.group].phases && GL[t.group].phases[t.phase])) errors.push(`${w}: нет фазы КР ${t.phase}`);
    if (t.rel && !str(t.rel)) errors.push(`${w}: неверный rel`);
  }
  for (const pl of AMB_PLACES) {
    if (!(D.ambPatients || []).some((t) => t.kind === 'new' && t.where.includes(pl))) errors.push(`ambPatients: нет новых пациентов для ${pl}`);
    if (!(D.ambPatients || []).some((t) => t.kind === 'inherited' && t.where.includes(pl))) errors.push(`ambPatients: нет принятых пациентов для ${pl}`);
  }
  const ambText = [];
  const walkA = (x) => (typeof x === 'string' ? ambText.push(x) : x && typeof x === 'object' && Object.values(x).forEach(walkA));
  walkA(AT);
  for (const x of ambText) {
    const rest = x.replace(/\{\{[^{}|]*\|[^{}|]*\}\}/g, '').replace(/\{(P|REL|N|KG)\}/g, '');
    if (/[{}]/.test(rest)) errors.push(`ambTexts: странные фигурные скобки в «${x.slice(0, 50)}»`);
  }
  const allText = [];
  const walk = (x) => (typeof x === 'string' ? allText.push(x) : x && typeof x === 'object' && Object.values(x).forEach(walk));
  walk(T);
  for (const x of allText) if (/\{(?!P\})(?!\{)[^{}]*\}/.test(x.replace(/\{\{[^{}|]*\|[^{}|]*\}\}/g, ''))) errors.push(`wardTexts: одинарные фигурные скобки (форма по полу игрока) в «${x.slice(0, 50)}»`);
}

/* ---------- МКБ-10: каталог и варианты диагнозов в задачах ---------- */
if ((D.icd || []).length) {
  vm.runInContext(fs.readFileSync(path.join(root, 'js/game/icd.js'), 'utf8'), ctx, { filename: 'icd.js' });
  const I = ctx.A.icd;
  const keys = new Set();
  const blocks = new Set((D.icdBlocks || []).map((b) => b.id));
  for (const e of D.icd) {
    if (keys.has(e.k)) errors.push(`icd: повтор ключа ${e.k}`);
    keys.add(e.k);
    if (!str(e.c) || !str(e.t, 3)) errors.push(`icd.${e.k}: нет кода или названия`);
    if (!blocks.has(e.b)) errors.push(`icd.${e.k}: неизвестный раздел ${e.b}`);
    if (e.b !== 'X' && !/^F\d\d(\.\d{1,2})?$/.test(e.c)) errors.push(`icd.${e.k}: код раздела F должен быть вида F32.1`);
  }
  const checkOpts = (opts, where, okOf) => {
    for (const t of I.unmatched(opts)) errors.push(`${where}: вариант диагноза «${t.slice(0, 60)}» не найден в каталоге МКБ-10`);
    const right = opts.filter((o) => okOf(o) === 1);
    for (const o of right) {
      const e = I.entryFor(o.t);
      if (e && I.judge(opts, e.k, okOf).score !== 1) errors.push(`${where}: верный вариант «${o.t.slice(0, 50)}» не засчитывается при выборе из списка`);
    }
    const seenK = new Map();
    for (const o of opts) {
      const e = I.entryFor(o.t);
      if (!e) continue;
      if (seenK.has(e.k)) errors.push(`${where}: варианты «${seenK.get(e.k).slice(0, 40)}» и «${o.t.slice(0, 40)}» ведут к одной записи каталога ${e.k}`);
      else seenK.set(e.k, o.t);
    }
  };
  for (const c of D.cases || []) checkOpts((c.dx || {}).opts || [], `случай ${c.id}.dx`, (o) => (o.ok ? 1 : 0));
  for (const t of D.ambPatients || []) if (t.kind === 'new') checkOpts((t.dxq || {}).opts || [], `ambPatients.${t.id}.dxq`, (o) => (o.ok === true ? 1 : o.ok === 'part' ? 0.5 : 0));
}

const counts = {
  лекций: (D.lectures || []).length,
  случаев: (D.cases || []).length,
  мини: (D.minis || []).length,
  комиссия: (D.commissionTemplates || []).length,
  терминов: Object.keys(gloss).length,
  доптест: (D.extraTest || []).length,
  препаратов: (D.drugs || []).length,
  'пациентов отделения': (D.wardPatients || []).length,
  'амбулаторных пациентов': (D.ambPatients || []).length,
  'вопросов банка': (D.testBank || []).length,
  'рубрик МКБ': (D.icd || []).length,
};
console.log('Загружено:', Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(', '));
if ((D.testBank || []).length) console.log('Банк вопросов по темам (из них сложных):', DOMAINS.map((k) => `${k} ${byTopic[k] || 0} (${hardBy[k] || 0})`).join(', '));
warns.forEach((w) => console.log('  ⚠ ' + w));
errors.forEach((e) => console.log('  ✗ ' + e));
console.log(errors.length ? `Ошибок: ${errors.length}` : 'Ошибок нет.');
process.exit(errors.length ? 1 : 0);
