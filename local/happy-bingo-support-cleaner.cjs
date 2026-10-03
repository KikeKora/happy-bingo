const fs = require('fs');
const path = require('path');

const RESEARCH_DIR = path.join(__dirname, 'research');
const MATCHES_FILE = path.join(RESEARCH_DIR, 'happy-bingo-support-matches.jsonl');
const DISCARDED_FILE = path.join(RESEARCH_DIR, 'happy-bingo-support-discarded.jsonl');

function isoMs(value) {
  const ms = Date.parse(value || '');
  return Number.isFinite(ms) ? ms : null;
}

function isRealId(id) {
  const s = String(id || '');
  return !!s && !s.startsWith('local-');
}

function finalOf(m) {
  return m?.final && typeof m.final === 'object' ? m.final : {};
}

function statSignature(m) {
  const f = finalOf(m);
  return [
    m?.team ?? '',
    m?.winner ?? '',
    f.kills ?? '',
    f.deaths ?? '',
    f.assists ?? '',
    f.lastHits ?? '',
    f.denies ?? '',
    f.radiantScore ?? '',
    f.direScore ?? ''
  ].join('|');
}

function likelySameFinishedGame(a, b) {
  const aid = String(a?.id || '');
  const bid = String(b?.id || '');
  if (isRealId(aid) && isRealId(bid) && aid === bid) return true;

  if (statSignature(a) !== statSignature(b)) return false;

  const ad = Number(a?.durationSeconds);
  const bd = Number(b?.durationSeconds);
  if (!Number.isFinite(ad) || !Number.isFinite(bd) || Math.abs(ad - bd) > 5) return false;

  const ae = isoMs(a?.endedAt);
  const be = isoMs(b?.endedAt);
  if (ae !== null && be !== null && Math.abs(ae - be) > 180000) return false;

  return true;
}

function qualityScore(m) {
  const snapshots = Array.isArray(m?.snapshots) ? m.snapshots.length : 0;
  const itemAcq = Array.isArray(m?.itemAcquisitions) ? m.itemAcquisitions.length : 0;
  const times = (Array.isArray(m?.killTimes) ? m.killTimes.length : 0)
    + (Array.isArray(m?.deathTimes) ? m.deathTimes.length : 0)
    + (Array.isArray(m?.assistTimes) ? m.assistTimes.length : 0)
    + (Array.isArray(m?.levelTimes) ? m.levelTimes.length : 0);
  const completeBonus = m?.endReason === 'game_finished' ? 100000 : 0;
  return completeBonus + snapshots * 1000 + itemAcq * 10 + times;
}

function chooseBest(group) {
  const best = [...group].sort((a, b) => qualityScore(b) - qualityScore(a))[0];
  const out = JSON.parse(JSON.stringify(best));

  const realId = group.map(x => x?.id).find(isRealId);
  if (realId) out.id = String(realId);

  return out;
}

if (!fs.existsSync(MATCHES_FILE)) {
  console.error('No encontre research\\happy-bingo-support-matches.jsonl');
  process.exit(1);
}

const rawText = fs.readFileSync(MATCHES_FILE, 'utf8');
const lines = rawText.split(/\r?\n/).filter(Boolean);
const parsed = [];
const malformed = [];

for (const line of lines) {
  try { parsed.push(JSON.parse(line)); }
  catch { malformed.push(line); }
}

const completed = parsed.filter(m => m?.endReason === 'game_finished' && m?.final);
const incomplete = parsed.filter(m => !(m?.endReason === 'game_finished' && m?.final));

const groups = [];
for (const match of completed) {
  let group = null;
  for (const candidate of groups) {
    if (candidate.some(existing => likelySameFinishedGame(existing, match))) {
      group = candidate;
      break;
    }
  }
  if (group) group.push(match);
  else groups.push([match]);
}

const cleaned = groups.map(chooseBest).sort((a, b) => {
  const at = isoMs(a?.endedAt) ?? 0;
  const bt = isoMs(b?.endedAt) ?? 0;
  return at - bt;
});

const duplicateCount = completed.length - cleaned.length;
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backup = path.join(RESEARCH_DIR, `happy-bingo-support-matches.backup-${stamp}.jsonl`);
fs.copyFileSync(MATCHES_FILE, backup);

fs.writeFileSync(
  MATCHES_FILE,
  cleaned.map(x => JSON.stringify(x)).join('\n') + (cleaned.length ? '\n' : ''),
  'utf8'
);

const discarded = [...incomplete.map(x => JSON.stringify(x)), ...malformed];
if (discarded.length) {
  fs.writeFileSync(DISCARDED_FILE, discarded.join('\n') + '\n', 'utf8');
}

console.log('======================================');
console.log(' HAPPY BINGO - RESEARCH CLEANER');
console.log('======================================');
console.log(`Registros originales: ${parsed.length}`);
console.log(`Partidas completas detectadas: ${completed.length}`);
console.log(`Partidas completas unicas: ${cleaned.length}`);
console.log(`Duplicados eliminados: ${duplicateCount}`);
console.log(`Registros incompletos apartados: ${incomplete.length}`);
if (malformed.length) console.log(`Lineas invalidas apartadas: ${malformed.length}`);
console.log(`Backup: ${path.basename(backup)}`);
console.log(`Archivo limpio: ${path.basename(MATCHES_FILE)}`);
if (discarded.length) console.log(`Apartados: ${path.basename(DISCARDED_FILE)}`);
