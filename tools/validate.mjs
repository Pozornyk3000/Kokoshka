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
  if (/[a-z]{4,}/i.test(v.replace(/(F|G|T|E|X|H|K|O)\d{1,2}(\.\d{1,2})?/g, ''))) warns.push(`${where}: латиница в тексте: «${v.slice(0, 60)}…»`);
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
});

const counts = {
  лекций: (D.lectures || []).length,
  случаев: (D.cases || []).length,
  мини: (D.minis || []).length,
  комиссия: (D.commissionTemplates || []).length,
  терминов: Object.keys(gloss).length,
  доптест: (D.extraTest || []).length,
};
console.log('Загружено:', Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(', '));
warns.forEach((w) => console.log('  ⚠ ' + w));
errors.forEach((e) => console.log('  ✗ ' + e));
console.log(errors.length ? `Ошибок: ${errors.length}` : 'Ошибок нет.');
process.exit(errors.length ? 1 : 0);
