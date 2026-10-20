#!/usr/bin/env node
/* Быстрая симуляция игры без интерфейса: проверка движка и баланса экономики.
   node tools/sim.mjs [дней=160] [--skill 0.75] [--seed 1] [--job hospital] [--bg orderly] [--stub stub-data.js] [--quiet] */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const flag = (n, d) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : d);
const days = +(argv[0] && !argv[0].startsWith('--') ? argv[0] : 160);
const skill = +flag('--skill', 0.75);
const seed = +flag('--seed', 1);
const jobPref = flag('--job', 'hospital');
const bgPref = flag('--bg', 'orderly');
const dream = flag('--dream', 'flat');
const stub = flag('--stub', null);
const quiet = argv.includes('--quiet');

let x = seed >>> 0;
const rand = () => {
  x = (x + 0x6d2b79f5) >>> 0;
  let r = Math.imul(x ^ (x >>> 15), 1 | x);
  r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
  return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
};
const MathR = Object.create(Math);
MathR.random = rand;
const ctx = { console, Math: MathR, JSON, Object, Array, String, Number, Date, Buffer, setTimeout: () => 0, clearTimeout: () => 0 };
ctx.window = ctx;
vm.createContext(ctx);
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]).filter((s) => !/\/(ui|art)\/|main\.js/.test(s));
for (const s of scripts) {
  if (s.endsWith('game/engine.js') && stub) vm.runInContext(fs.readFileSync(path.resolve(stub), 'utf8'), ctx, { filename: 'stub' });
  const f = path.join(root, s);
  if (!fs.existsSync(f)) continue;
  vm.runInContext(fs.readFileSync(f, 'utf8'), ctx, { filename: s });
}
const A = ctx.A;
const G = A.game;
const D = A.data;
const CS = A.cases;
D.index();
A.migrate = (s) => s;

const s = (A.state = G.newState({ name: 'Тест', gender: 'f', background: bgPref, dream }));
G.queue(s, [{ type: 'story', story: 'prologue_home' }], 'prologue');

const chance = (p) => rand() < p;
function solveCase(c, mode, exam) {
  const p = CS.init(s, { id: c.id, mode, exam });
  if (p.parts.includes('talk')) {
    const order = c.q.map((q, i) => ({ i, v: q.v + (q.crit ? 3 : 0) + (chance(skill) ? 0 : rand() * 6 - 3) })).sort((a, b) => b.v - a.v);
    for (const o of order.slice(0, p.maxQ)) CS.ask(c, p, o.i);
  }
  c.status.opts.forEach((o, i) => {
    if (o.ok ? chance(skill) : chance((1 - skill) / 3)) p.sel.status.push(i);
  });
  if (!p.sel.status.length) p.sel.status.push(0);
  const pickOne = (opts) => {
    const ok = opts.findIndex((o) => o.ok);
    return chance(skill) ? ok : Math.floor(rand() * opts.length);
  };
  p.sel.syn = pickOne(c.syndrome.opts);
  p.sel.dx = pickOne(c.dx.opts);
  c.tx.opts.forEach((o, i) => {
    if (o.ok ? chance(skill) : chance((1 - skill) / (o.bad ? 4 : 2))) p.sel.tx.push(i);
  });
  if (!p.sel.tx.length) p.sel.tx.push(0);
  const res = CS.score(s, c, p, mode);
  res.patientName = c.patient.name;
  CS.reward(s, c, res);
  return res;
}

function resolveStep() {
  const act = s.activity;
  const st = act.steps[act.i];
  switch (st.type) {
    case 'story':
    case 'payslip':
      return G.stepDone(null);
    case 'shop':
      return G.stepDone(null);
    case 'event': {
      const e = A.events.byId[st.id];
      const ch = e.choices.length > 1 && chance(0.3) ? 1 : 0;
      e.choices[ch].run(s);
      return G.stepDone(null);
    }
    case 'lecture': {
      const L = D.lectureById[st.id];
      const total = L ? L.quiz.length : 4;
      let right = 0;
      for (let i = 0; i < total; i++) if (chance(skill)) right++;
      return G.stepDone({ id: st.id, right, total, focus: G.focus(s) });
    }
    case 'case': {
      const c = D.caseById[st.id];
      return G.stepDone(solveCase(c, st.mode));
    }
    case 'exam': {
      const scores = st.tasks.cases.map((id) => solveCase(D.caseById[id], 'exam', st.exam).score);
      let test = null;
      if (st.tasks.test) {
        let right = 0;
        st.tasks.test.forEach(() => chance(skill + 0.05) && right++);
        test = { right, total: st.tasks.test.length };
      }
      return G.stepDone({ exam: st.exam, scores, cases: st.tasks.cases, test });
    }
    case 'mini': {
      const n = A.minis.count(st);
      let right = 0;
      for (let i = 0; i < n; i++) {
        const m = A.minis.get(st, i);
        const ok = chance(skill);
        if (ok) right++;
        A.minis.reward(s, m, ok);
      }
      return G.stepDone({ kind: 'mini', right, total: n });
    }
    case 'jobs': {
      const job = D.jobs[jobPref] && !D.jobs[jobPref].req(s) ? jobPref : 'pnd';
      G.startCareer(s, job);
      return G.stepDone({ job });
    }
    case 'ending': {
      const e = (D.endings || {})[st.id] || {};
      log(`ФИНАЛ: ${st.id} на день ${s.day}`);
      if (e.kind === 'bad') {
        s.ended = st.id;
        return;
      }
      return G.stepDone(null);
    }
    default:
      throw new Error('unknown step ' + st.type);
  }
}

const avail = () =>
  A.actions.list.filter((a) => {
    const st = G.status(s, a);
    return !st.hidden && !st.disabled;
  });
const can = (id) => avail().some((a) => a.id === id);
const pickArg = (id) => {
  const a = A.actions.byId[id];
  if (!a.pick) return undefined;
  const opts = a.pick(s);
  if (id === 'study' || id === 'library' || id === 'cram' || id === 'library_city') return opts.sort((p, q) => s.know[p.value] - s.know[q.value])[0].value;
  if (id === 'autoweek') return flag('--auto', 'gigs');
  return opts[0] && opts[0].value;
};
function choose() {
  const ok = avail();
  if (argv.includes('--auto') && ok.some((a) => a.id === 'autoweek') && s.stress < 60) return 'autoweek';
  const prim = ok.filter((a) => G.status(s, a).primary && a.id !== 'sleep');
  if (prim.length) return prim[0].id;
  if (can('pet') && s.daily.pets < 1) return 'pet';
  // покупки
  const wish = ['earplugs', 'textbook', 'pharmguide', 'mattress', 'coffee', 'gym'];
  for (const w of wish) {
    const it = D.shopById[w];
    if (!s.items[w] && s.money > it.price + 40000) {
      s.money -= it.price;
      s.items[w] = true;
      s.week.expense.push(['Покупка', it.price]);
    }
  }
  if (s.phase === 'career' && s.housing === 'room' && s.money > 250000 && dream !== 'flat') return can('move') ? 'move' : null;
  if (s.slot === 3) {
    const nightOk = s.energy > 45 && s.stress < 62 && !s.burnout.active;
    if (s.phase === 'career' && nightOk && chance(0.35)) return can('night_duty') ? 'night_duty' : can('gig_night') ? 'gig_night' : 'sleep';
    if (s.phase !== 'career' && nightOk && chance(0.25) && can('gig_nurse')) return 'gig_nurse';
    if (can('swap_night')) return 'swap_night';
    return 'sleep';
  }
  if (s.stress > 65) {
    for (const id of ['therapy', 'balint', 'walk', 'gym', 'cafe']) if (can(id)) return id;
  }
  if (s.energy < 30 && can('nap')) return 'nap';
  if (s.phase === 'career') {
    for (const id of ['gig_commission', 'gig_online', 'gig_teach']) if (can(id) && chance(0.55)) return id;
    if (dream === 'science' && can('article') && chance(0.5)) return 'article';
  } else {
    if (G.inDebt(s) && can('otrabotka')) return 'otrabotka';
    for (const id of ['gig_courier', 'gig_tutor', 'gig_callcenter']) if (can(id) && chance(0.45)) return id;
  }
  if (can('study') && chance(0.5)) return 'study';
  for (const id of ['walk', 'series', 'nap', 'sleep_early']) if (can(id)) return id;
  return ok.filter((a) => !a.free)[0]?.id || 'sleep';
}

const lines = [];
function log(t) {
  lines.push(t);
  if (!quiet) console.log(t);
}
let guard = 0;
let lastWeek = 0;
while (s.day <= days && !s.ended && guard++ < 20000) {
  if (s.activity) {
    resolveStep();
    continue;
  }
  const id = choose();
  if (!id) break;
  G.perform(id, pickArg(id));
  for (const k of ['money', 'energy', 'stress', 'health', 'rep', 'xp']) if (!Number.isFinite(s[k])) throw new Error(`${k} не число на дне ${s.day} после ${id}`);
  const w = Math.floor((s.day - 1) / 7);
  if (w !== lastWeek) {
    lastWeek = w;
    log(
      `нед ${String(w + 1).padStart(2)} день ${String(s.day).padStart(3)} ${s.phase.padEnd(8)} ₽${String(Math.round(s.money)).padStart(8)} энерг ${String(Math.round(s.energy)).padStart(3)} стресс ${String(Math.round(s.stress)).padStart(3)} здор ${String(Math.round(s.health)).padStart(3)} реп ${String(Math.round(s.rep)).padStart(3)} xp ${String(s.xp).padStart(5)} знания ${G.knowAvg(s).toFixed(0)}${s.burnout.active ? ' ВЫГОРАНИЕ' : ''}${s.career ? ' ' + s.career.job : ''}`
    );
  }
}
console.log('---');
console.log(`Итог: день ${s.day}, фаза ${s.phase}, деньги ${Math.round(s.money)}, реп ${Math.round(s.rep)}, ранг «${G.rank(s).name}», случаев ${s.stats.cases}, верных дз ${s.stats.dxRight}, ночей ${s.stats.nights}, выгораний ${s.burnout.episodes}, экзамены ${JSON.stringify(Object.fromEntries(Object.entries(s.study.exams).map(([k, v]) => [k, v.grade])))}, достижений ${Object.keys(s.ach).length}, сохранение ${(JSON.stringify(s).length / 1024).toFixed(0)} КБ`);
if (guard >= 20000) console.log('ВНИМАНИЕ: превышен лимит шагов (зацикливание?)');
