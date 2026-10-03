const fs = require('fs');
const path = require('path');

const RESEARCH_DIR = path.join(__dirname, 'research');
const MATCHES_FILE = path.join(RESEARCH_DIR, 'happy-bingo-support-matches.jsonl');
const REPORT_FILE = path.join(RESEARCH_DIR, 'happy-bingo-support-report.md');

function fmtPct(v) { return `${(v * 100).toFixed(1)}%`; }
function fmtClock(sec) {
  if (!Number.isFinite(sec)) return '—';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
function median(values) {
  const a = values.filter(Number.isFinite).sort((x,y)=>x-y);
  if (!a.length) return null;
  const mid = Math.floor(a.length/2);
  return a.length % 2 ? a[mid] : (a[mid-1]+a[mid])/2;
}
function quantile(values, q) {
  const a = values.filter(Number.isFinite).sort((x,y)=>x-y);
  if (!a.length) return null;
  const pos = (a.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return a[base + 1] !== undefined ? a[base] + rest * (a[base + 1] - a[base]) : a[base];
}
function difficulty(p) {
  if (p >= 0.45 && p <= 0.65) return 'Común objetivo';
  if (p >= 0.25 && p < 0.45) return 'Media objetivo';
  if (p >= 0.10 && p < 0.25) return 'Difícil objetivo';
  if (p >= 0.03 && p < 0.10) return 'Rara objetivo';
  if (p > 0.65) return 'Demasiado fácil';
  if (p < 0.03) return 'Probablemente demasiado rara';
  return 'Fuera de rango';
}
function nearestSnapshot(match, minute) {
  const snaps = (match.snapshots || []).filter(s => Number.isFinite(s.minute));
  if (!snaps.length) return null;
  let best = snaps[0];
  for (const s of snaps) if (Math.abs(s.minute - minute) < Math.abs(best.minute - minute)) best = s;
  return Math.abs(best.minute - minute) <= 1 ? best : null;
}
function countByTime(times, seconds) {
  return (times || []).filter(t => Number.isFinite(t) && t <= seconds).length;
}
function rollingCount(times, windowSeconds) {
  const a = (times || []).filter(Number.isFinite).sort((x,y)=>x-y);
  let max = 0, left = 0;
  for (let right = 0; right < a.length; right++) {
    while (a[right] - a[left] > windowSeconds) left++;
    max = Math.max(max, right-left+1);
  }
  return max;
}
function firstItemClock(match, substrings) {
  const aliases = substrings.map(s=>s.toLowerCase());
  let best = null;
  for (const a of match.itemAcquisitions || []) {
    const n = String(a.item || '').toLowerCase();
    if (aliases.some(x => n.includes(x)) && Number.isFinite(a.clock)) {
      if (best === null || a.clock < best) best = a.clock;
    }
  }
  return best;
}

function researchIsoMs(value) {
  const ms = Date.parse(value || '');
  return Number.isFinite(ms) ? ms : null;
}
function researchRealId(id) {
  const s = String(id || '');
  return !!s && !s.startsWith('local-');
}
function researchStatSignature(m) {
  const f = m?.final || {};
  return [m?.team ?? '', m?.winner ?? '', f.kills ?? '', f.deaths ?? '', f.assists ?? '', f.lastHits ?? '', f.denies ?? '', f.radiantScore ?? '', f.direScore ?? ''].join('|');
}
function researchLikelySameGame(a, b) {
  const aid = String(a?.id || '');
  const bid = String(b?.id || '');
  if (researchRealId(aid) && researchRealId(bid) && aid === bid) return true;
  if (researchStatSignature(a) !== researchStatSignature(b)) return false;
  const ad = Number(a?.durationSeconds), bd = Number(b?.durationSeconds);
  if (!Number.isFinite(ad) || !Number.isFinite(bd) || Math.abs(ad - bd) > 5) return false;
  const ae = researchIsoMs(a?.endedAt), be = researchIsoMs(b?.endedAt);
  if (ae !== null && be !== null && Math.abs(ae - be) > 180000) return false;
  return true;
}
function researchQuality(m) {
  const snapshots = Array.isArray(m?.snapshots) ? m.snapshots.length : 0;
  const itemAcq = Array.isArray(m?.itemAcquisitions) ? m.itemAcquisitions.length : 0;
  const times = (m?.killTimes?.length || 0) + (m?.deathTimes?.length || 0) + (m?.assistTimes?.length || 0) + (m?.levelTimes?.length || 0);
  return snapshots * 1000 + itemAcq * 10 + times;
}
function dedupeResearchMatches(records) {
  const completed = records.filter(m => m?.endReason === 'game_finished' && m?.final);
  const groups = [];
  for (const match of completed) {
    let group = groups.find(g => g.some(existing => researchLikelySameGame(existing, match)));
    if (group) group.push(match);
    else groups.push([match]);
  }
  return groups.map(group => [...group].sort((a,b)=>researchQuality(b)-researchQuality(a))[0]);
}

if (!fs.existsSync(MATCHES_FILE)) {
  console.error('No hay datos todavía. Juega algunas partidas con el bridge de investigación primero.');
  process.exit(1);
}

const raw = fs.readFileSync(MATCHES_FILE, 'utf8').split(/\r?\n/).filter(Boolean);
const parsed = raw.map(line => { try { return JSON.parse(line); } catch { return null; } }).filter(Boolean);
const all = dedupeResearchMatches(parsed);
const matches = all.filter(m => m.validForBalance);

if (!matches.length) {
  console.error('Hay registros, pero todavía no hay partidas de al menos 15 minutos válidas para balance.');
  process.exit(1);
}

const lines = [];
lines.push('# Happy Bingo — reporte empírico de support');
lines.push('');
lines.push(`Partidas válidas: **${matches.length}** de ${all.length} registradas.`);
lines.push('');
if (matches.length < 10) {
  lines.push('> Muestra preliminar: menos de 10 partidas. Úsala para descubrir variables, no para fijar el balance definitivo.');
  lines.push('');
} else if (matches.length < 20) {
  lines.push('> Muestra útil para un primer balance, pero todavía conviene seguir acumulando partidas.');
  lines.push('');
} else {
  lines.push('> Muestra suficiente para calibrar una primera versión personalizada de Happy Bingo.');
  lines.push('');
}

const finals = matches.map(m => m.final || {}).filter(Boolean);
const durations = matches.map(m => m.durationSeconds).filter(Number.isFinite);
const finalKills = finals.map(x=>x.kills).filter(Number.isFinite);
const finalDeaths = finals.map(x=>x.deaths).filter(Number.isFinite);
const finalAssists = finals.map(x=>x.assists).filter(Number.isFinite);
const finalGpm = finals.map(x=>x.gpm).filter(Number.isFinite);
const finalXpm = finals.map(x=>x.xpm).filter(Number.isFinite);
const finalLh = finals.map(x=>x.lastHits).filter(Number.isFinite);
const finalDenies = finals.map(x=>x.denies).filter(Number.isFinite);

lines.push('## Perfil observado');
lines.push('');
lines.push('| Métrica | Mediana | P25 | P75 |');
lines.push('|---|---:|---:|---:|');
function statRow(label, values, formatter = x => Math.round(x)) {
  if (!values.length) return;
  lines.push(`| ${label} | ${formatter(median(values))} | ${formatter(quantile(values,.25))} | ${formatter(quantile(values,.75))} |`);
}
statRow('Duración', durations, fmtClock);
statRow('Kills finales', finalKills);
statRow('Muertes finales', finalDeaths);
statRow('Assists finales', finalAssists);
statRow('GPM final', finalGpm);
statRow('XPM final', finalXpm);
statRow('Last hits', finalLh);
statRow('Denies', finalDenies);
lines.push('');

const conditions = [];
function addCondition(name, family, fn) {
  let success = 0, eligible = 0;
  for (const m of matches) {
    const r = fn(m);
    if (r === null || r === undefined) continue;
    eligible++;
    if (r) success++;
  }
  if (!eligible) return;
  const p = success / eligible;
  conditions.push({name, family, success, eligible, p, tier: difficulty(p)});
}

// Kills + tiempo
for (const [k,min] of [[3,15],[3,20],[3,25],[5,20],[5,25],[5,30],[7,30],[7,35],[10,40]]) {
  addCondition(`${k} kills antes del min ${min}`, 'Kills + tiempo', m => countByTime(m.killTimes, min*60) >= k);
}
for (const [k,sec] of [[3,90],[3,180],[3,300],[4,300],[5,600]]) {
  addCondition(`${k} kills en una ventana de ${sec<120?sec+' s':(sec/60)+' min'}`, 'Kills por ventana', m => rollingCount(m.killTimes, sec) >= k);
}

// Assists + tiempo
for (const [a,min] of [[5,15],[8,20],[10,20],[10,25],[15,25],[15,30],[20,35],[25,40]]) {
  addCondition(`${a} assists antes del min ${min}`, 'Assists + tiempo', m => countByTime(m.assistTimes, min*60) >= a);
}

// Muertes / supervivencia
for (const [d,min] of [[0,15],[1,20],[2,25],[3,30]]) {
  addCondition(`${d === 0 ? '0 muertes' : `Máximo ${d} muertes`} al min ${min}`, 'Supervivencia', m => countByTime(m.deathTimes, min*60) <= d);
}
addCondition('Bajar a 10% HP o menos en algún momento', 'Supervivencia', m => Number.isFinite(m.minHpPercent) ? m.minHpPercent <= 10 : null);
addCondition('Bajar a 25% HP o menos en algún momento', 'Supervivencia', m => Number.isFinite(m.minHpPercent) ? m.minHpPercent <= 25 : null);

// Economía por snapshots
for (const min of [10,15,20,25,30]) {
  const nws = matches.map(m => nearestSnapshot(m,min)?.netWorth).filter(Number.isFinite);
  if (nws.length >= Math.max(3, Math.ceil(matches.length*0.5))) {
    const p75 = Math.round(quantile(nws,.75)/100)*100;
    const p90 = Math.round(quantile(nws,.90)/100)*100;
    addCondition(`Net worth ≥ ${p75} al min ${min}`, 'Economía support', m => { const s=nearestSnapshot(m,min); return Number.isFinite(s?.netWorth) ? s.netWorth >= p75 : null; });
    addCondition(`Net worth ≥ ${p90} al min ${min}`, 'Economía support', m => { const s=nearestSnapshot(m,min); return Number.isFinite(s?.netWorth) ? s.netWorth >= p90 : null; });
  }
}
for (const min of [15,20,25,30]) {
  const gpms = matches.map(m => nearestSnapshot(m,min)?.gpm).filter(Number.isFinite);
  if (gpms.length >= Math.max(3, Math.ceil(matches.length*0.5))) {
    const p75 = Math.round(quantile(gpms,.75)/10)*10;
    addCondition(`GPM ≥ ${p75} al min ${min}`, 'Economía support', m => { const s=nearestSnapshot(m,min); return Number.isFinite(s?.gpm) ? s.gpm >= p75 : null; });
  }
}

// Items y timings
const itemDefs = [
  ['Force Staff', ['force_staff']],
  ['Glimmer Cape', ['glimmer_cape']],
  ['Mekansm', ['mekansm']],
  ["Eul's Scepter", ['cyclone','euls']],
  ['Lotus Orb', ['lotus_orb']],
  ["Aghanim's Scepter", ['ultimate_scepter','aghanim']],
  ['Spirit Vessel', ['spirit_vessel']],
  ['Essence Distiller', ['essence_distiller']],
  ['Urn of Shadows', ['urn_of_shadows']]
];
for (const [label, aliases] of itemDefs) {
  for (const min of [20,25,30,35,40]) {
    addCondition(`${label} antes del min ${min}`, 'Items + timing', m => {
      const t = firstItemClock(m, aliases);
      return t === null ? false : t <= min*60;
    });
  }
}
addCondition('Mejorar la Urna antes del min 25', 'Items + timing', m => {
  const a = firstItemClock(m,['spirit_vessel']);
  const b = firstItemClock(m,['essence_distiller']);
  const t = [a,b].filter(Number.isFinite).sort((x,y)=>x-y)[0];
  return Number.isFinite(t) ? t <= 25*60 : false;
});

// Dos / tres items de utilidad antes de cierto tiempo
const utilityGroups = [
  ['force_staff'], ['glimmer_cape'], ['mekansm'], ['cyclone','euls'], ['lotus_orb'], ['ultimate_scepter','aghanim'], ['spirit_vessel'], ['essence_distiller']
];
function utilityCountBy(m, sec) {
  let count = 0;
  for (const aliases of utilityGroups) {
    const t = firstItemClock(m,aliases);
    if (Number.isFinite(t) && t <= sec) count++;
  }
  return count;
}
for (const [n,min] of [[2,25],[2,30],[3,30],[3,35],[4,40]]) {
  addCondition(`${n} items de utilidad antes del min ${min}`, 'Build support', m => utilityCountBy(m,min*60) >= n);
}

lines.push('## Candidatas medidas');
lines.push('');
lines.push('| Familia | Condición | Ocurrió | Probabilidad | Lectura |');
lines.push('|---|---|---:|---:|---|');
for (const c of conditions.sort((a,b)=> b.p-a.p || a.name.localeCompare(b.name))) {
  lines.push(`| ${c.family} | ${c.name} | ${c.success}/${c.eligible} | ${fmtPct(c.p)} | ${c.tier} |`);
}
lines.push('');

lines.push('## Mejores candidatas por rango objetivo');
lines.push('');
for (const target of ['Común objetivo','Media objetivo','Difícil objetivo','Rara objetivo']) {
  lines.push(`### ${target}`);
  lines.push('');
  const subset = conditions.filter(c=>c.tier===target).sort((a,b)=>a.p-b.p);
  if (!subset.length) lines.push('_Todavía no hay candidatas en este rango._');
  else for (const c of subset.slice(0,12)) lines.push(`- ${c.name} — **${fmtPct(c.p)}** (${c.success}/${c.eligible})`);
  lines.push('');
}

lines.push('## Items observados');
lines.push('');
const itemMap = new Map();
for (const m of matches) {
  for (const a of m.itemAcquisitions || []) {
    if (!a.item || !Number.isFinite(a.clock)) continue;
    if (!itemMap.has(a.item)) itemMap.set(a.item, []);
    itemMap.get(a.item).push(a.clock);
  }
}
lines.push('| Item técnico | Partidas | Mediana de primera aparición |');
lines.push('|---|---:|---:|');
for (const [item,times] of [...itemMap.entries()].sort((a,b)=>b[1].length-a[1].length).slice(0,40)) {
  lines.push(`| ${item} | ${times.length}/${matches.length} | ${fmtClock(median(times))} |`);
}
lines.push('');

lines.push('## Variables avanzadas disponibles');
lines.push('');
for (const field of ['netWorth','supportGoldSpent','wardsPlaced','wardsDestroyed','campsStacked']) {
  const count = matches.filter(m => (m.snapshots||[]).some(s => Number.isFinite(s[field]))).length;
  lines.push(`- **${field}**: disponible en ${count}/${matches.length} partidas.`);
}
lines.push('');
lines.push('La idea es convertir únicamente condiciones con frecuencia razonable en casillas. Una condición muy frecuente se siente gratis; una extremadamente rara se siente imposible.');

fs.mkdirSync(RESEARCH_DIR,{recursive:true});
fs.writeFileSync(REPORT_FILE, lines.join('\n'), 'utf8');
console.log(`Reporte creado: ${REPORT_FILE}`);
