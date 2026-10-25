#!/usr/bin/env node
/* Симуляция курации: один шаблон пациента, сценарий назначений, ход болезни по дням и итоговая оценка.
   node tools/ward-sim.mjs <шаблон> [сценарий=ideal] [--mode work|study] [--seed 1] [--runs 1] [--days 40] [--quiet]
   Сценарии описаны в tools/ward-plans.mjs. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { PLANS } from './ward-plans.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const flag = (n, d) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : d);
const pos = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--') && !['--quiet', '--verbose'].includes(argv[i - 1])));
const tplId = pos[0];
const planId = pos[1] || 'ideal';
const mode = flag('--mode', 'work');
const runs = +flag('--runs', 1);
const maxDays = +flag('--days', 40);
const quiet = argv.includes('--quiet');
const verbose = argv.includes('--verbose');

function load(seed) {
  let x = seed >>> 0;
  const rand = () => {
    x = (x + 0x6d2b79f5) >>> 0;
    let r = Math.imul(x ^ (x >>> 15), 1 | x);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
  const MathR = Object.create(Math);
  MathR.random = rand;
  const ctx = { console, Math: MathR, JSON, Object, Array, String, Number, Date, setTimeout: () => 0, clearTimeout: () => 0 };
  ctx.window = ctx;
  vm.createContext(ctx);
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]).filter((s) => !/\/(ui|art)\/|main\.js/.test(s));
  for (const s of scripts) vm.runInContext(fs.readFileSync(path.join(root, s), 'utf8'), ctx, { filename: s });
  ctx.A.data.index();
  ctx.A.store = { save() {}, checkpoint() {} };
  return ctx.A;
}

function run(seed) {
  const A = load(seed);
  const G = A.game;
  const W = A.ward;
  const P = A.pharma;
  const D = A.data;
  if (!D.wardById[tplId]) throw new Error('нет шаблона ' + tplId + '. Есть: ' + Object.keys(D.wardById).join(', '));
  const s = (A.state = G.newState({ name: 'Тест', gender: 'f', background: 'excellent', dream: 'flat' }));
  if (mode === 'work') {
    s.day = 40;
    G.startCareer(s, 'hospital');
  } else s.day = 8;
  W.ensure(s);
  const pt = W.admit(s, tplId, mode === 'work' ? 'work' : 'study');
  const plan = (PLANS[tplId] || {})[planId] || PLANS._default[planId];
  if (!plan) throw new Error('нет сценария ' + planId);
  const msgs = [];
  const say = (day, list) => list.forEach((m) => msgs.push(day + ': [' + m.lvl + '] ' + m.text + (m.cite ? ' — ' + m.cite : '')));
  let how = 'handover';
  for (let d = 0; d < maxDays; d++) {
    const hd = s.day - pt.admitDay;
    // срочное событие — решаем
    if (pt.pending) {
      const ev = W.EVENTS[pt.pending.k];
      let i = 0;
      if (plan.decide === 'worst') i = ev.opts.findIndex((o) => (typeof o.ok === 'function' ? o.ok(s, pt) : o.ok) === false);
      else if (plan.decide !== 'skip') i = ev.opts.findIndex((o) => (typeof o.ok === 'function' ? o.ok(s, pt) : o.ok) === true);
      if (plan.decide !== 'skip' && i >= 0) {
        const r = W.decide(s, pt, i);
        msgs.push(hd + ': СОБЫТИЕ ' + ev.title + ' → ' + (r.ok === true ? 'верно' : r.ok === 'part' ? 'частично' : 'ошибка'));
      }
    }
    // сценарий назначений
    const acts = typeof plan.days === 'function' ? plan.days(hd, pt, s, A) : (plan.days || {})[hd] || [];
    for (const a of acts) {
      if (a[0] === 'rx') say(hd, W.prescribe(s, pt, { id: a[1], kind: 'drug', route: a[2], dose: a[3] }));
      else if (a[0] === 'int') say(hd, W.prescribe(s, pt, { id: a[1], kind: 'int' }));
      else if (a[0] === 'dose') {
        const i = pt.rx.findIndex((r) => r.id === a[1] && (!a[3] || r.route === a[3]));
        if (i >= 0) say(hd, W.setDose(s, pt, i, a[2]));
      } else if (a[0] === 'stop') {
        const i = pt.rx.findIndex((r) => r.id === a[1]);
        if (i >= 0) say(hd, W.stop(s, pt, i));
      } else if (a[0] === 'order') W.order(s, pt, a[1]);
    }
    if (plan.monitor !== false) P.dueTests(s, pt).forEach((x) => W.order(s, pt, x.test));
    // выписка
    const g = P.group(pt);
    if (plan.discharge !== false && hd >= (plan.minDays || 3) && pt.sev <= g.discharge && W.canDischarge(s, pt).ok) {
      how = 'discharge';
      break;
    }
    if (mode === 'study' && s.day >= W.PRACTICE_TO) break;
    // новый день
    s.day++;
    W.tick(s, []);
  }
  const sc = W.score(s, pt, how);
  return { pt, sc, how, msgs, W, P, s };
}

const totals = [];
for (let k = 0; k < runs; k++) {
  const seed = +flag('--seed', 1) + k;
  const r = run(seed);
  totals.push(r);
  if (runs === 1 || verbose) {
    const pt = r.pt;
    if (!quiet) {
      console.log('== ' + tplId + ' / ' + planId + ' / ' + mode + ' / seed ' + seed);
      console.log('Курс тяжести: ' + pt.hist.map((h) => h.sev).join(' '));
      r.msgs.forEach((m) => console.log('  ' + m));
      console.log('События: ' + pt.events.map((e) => e.k + '@' + (e.day - pt.admitDay) + (e.preventable ? '!' : '')).join(', '));
      console.log('ПЭ: ' + Object.entries(pt.sx).filter(([k, v]) => v > 0.3).map(([k, v]) => k + '=' + v).join(' '));
      console.log('Пропущенный контроль: ' + Object.keys(pt.monMissed).join('; '));
      console.log('Лаб: QTc ' + pt.lab.qtc + ', Na ' + Math.round(pt.lab.na) + ', Li ' + Math.round(pt.lab.li * 100) / 100 + ', вес +' + Math.round((pt.lab.weight - pt.base.weight) * 10) / 10 + ', PRL ' + Math.round(pt.lab.prl));
      console.log('Записи (последние): ');
      pt.notes.slice(-8).forEach((n) => console.log('   ' + (n.day - pt.admitDay) + ' ' + n.kind + ': ' + n.text));
    }
    console.log('Итог (' + r.how + ', ' + r.sc.days + ' дн.): ' + JSON.stringify({ total: r.sc.total, outcome: r.sc.outcome, kr: r.sc.kr, safety: r.sc.safety, mon: r.sc.mon, los: r.sc.los }));
    r.sc.maint.forEach((m) => console.log('   выписка [' + m.lvl + '] ' + m.text));
  }
}
if (runs > 1) {
  const avg = (f) => Math.round(totals.reduce((a, r) => a + f(r), 0) / runs);
  console.log(tplId + ' / ' + planId + ' / ' + mode + ' × ' + runs + ': итог ' + avg((r) => r.sc.total) + ', исход ' + avg((r) => r.sc.outcome) + ', дней ' + avg((r) => r.sc.days) + ', выписаны ' + totals.filter((r) => r.how === 'discharge').length + ', событий ' + avg((r) => r.pt.events.length * 100) / 100 + ', предотвратимых ' + avg((r) => r.pt.events.filter((e) => e.preventable).length * 100) / 100 + ', безопасность ' + avg((r) => r.sc.safety) + ', КР ' + avg((r) => r.sc.kr));
}
