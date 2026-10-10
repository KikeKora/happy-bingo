const http = require("http");
const fs = require("fs");
const path = require("path");
const { GsiCollector, metricsOf, modeOf, sourceEventClock } = require('./happy-games-gsi.cjs');
const { createOpenDotaCollector } = require('./happy-games-opendota.cjs');

const {RoleTracker}=require('./happy-games-roles.cjs');
const BRIDGE_VERSION = "1.6.0";
const EVENT_PROTOCOL_VERSION = 2;
const TIMED_RULES_ENGINE_VERSION = 2;
const PORT = Number(process.env.HAPPY_BINGO_PORT || 4010);
const CONFIG_FILE = path.join(__dirname, "happy-bingo-online-config.json");
const EVENT_LOG = path.join(__dirname, "happy-bingo-online-events.jsonl");

if (!fs.existsSync(CONFIG_FILE)) {
  console.error("Falta happy-bingo-online-config.json");
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
const WORKER_URL = String(process.env.HAPPY_BINGO_WORKER_URL || config.workerUrl || "").replace(/\/+$/, "");
const EVENT_TOKEN = String(process.env.HAPPY_BINGO_EVENT_TOKEN || config.eventToken || "");

if (!WORKER_URL || !EVENT_TOKEN) {
  console.error("Config incompleta: workerUrl y eventToken son obligatorios.");
  process.exit(1);
}

let previous = null;
let detectedMatchId=null;
let previousLiveCounterSignature = null;
let lowHp25Active = false;
let lowHp10Active = false;
let eventCount = 0;
let sentCount = 0;
let failedCount = 0;
let sendQueue = Promise.resolve();
let liveKillTimes = [];
let lowHp15Since = null;
let lowHp15Awarded = false;
let recoveryFrom25Since = null;
const seenDirectEvents = new Set();
let workerHealth = null;
let gsiPayloadCount = 0;
let lastGsiAt = null;
let lastMatchTickAt = null;
let lastItemAt = null;
let lastEventAt = null;
let lastEventType = null;
let lastIgnoredGameplayReason = null;

function gameplaySourceAllowed(data,mode) {
  if(mode!=='player')return false;
  const custom=String(data?.map?.customgamename ?? data?.map?.custom_game_name ?? '');
  if(custom)return false;
  const id=String(data?.map?.matchid ?? data?.map?.match_id ?? '');
  if(/^\d+$/.test(id) && BigInt(id)>0n)return true;
  // The existing test harness uses a non-numeric match ID and a local mock.
  try{return ['localhost','127.0.0.1','::1'].includes(new URL(WORKER_URL).hostname);}catch{return false;}
}

function clockOf(data) {
  return data?.map?.clock_time ?? data?.map?.game_time ?? null;
}

function statSnapshot(data) {
  return {
    kills: Number(data?.player?.kills ?? 0),
    deaths: Number(data?.player?.deaths ?? 0),
    assists: Number(data?.player?.assists ?? 0),
    lastHits: Number(data?.player?.last_hits ?? 0),
    denies: Number(data?.player?.denies ?? 0),
    killStreak: Number(data?.player?.kill_streak ?? 0),
    gold:Number(data?.player?.gold ?? 0),
    gpm:Number(data?.player?.gpm ?? 0),
    xpm:Number(data?.player?.xpm ?? 0),
    level:Number(data?.hero?.level ?? 0),
    hpPercent:Number(data?.hero?.health_percent ?? 0),
    alive:data?.hero?.alive === true,
    radiantScore:Number(data?.map?.radiant_score ?? 0),
    direScore:Number(data?.map?.dire_score ?? 0),
    kikeTeam:data?.player?.team_name ?? null,
    heroName:data?.hero?.name ?? null,
    matchId:data?.map?.matchid ?? data?.map?.match_id ?? null,
    liveMetrics:metricsOf(data?.player),
    liveEventMetrics:liveTelemetry.latest?.mode==='player' && String(liveTelemetry.latest?.matchId)===String(data?.map?.matchid ?? data?.map?.match_id)
      ?liveTelemetry.latest.liveEventMetrics:null,
    matchEventMetrics:liveTelemetry.latest?.mode==='player'&&String(liveTelemetry.latest.matchId)===String(data?.map?.matchid ?? data?.map?.match_id)?liveTelemetry.latest.matchEventMetrics:null,
    telemetrySource:'dota-gsi',
    telemetryMode:modeOf(data),
    ...roleTracker.assignment(data?.map?.matchid ?? data?.map?.match_id)
  };
}
function coreStatSnapshot(data){const s=statSnapshot(data);return {kills:s.kills,deaths:s.deaths,assists:s.assists,lastHits:s.lastHits,denies:s.denies,killStreak:s.killStreak};}

function formatClock(seconds) {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) return "--:--";
  const sign = seconds < 0 ? "-" : "";
  const abs = Math.abs(Math.floor(seconds));
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

async function sendEvent(event) {
  eventCount++;
  fs.appendFileSync(EVENT_LOG, JSON.stringify(event) + "\n", "utf8");

  try {
    const r = await fetch(WORKER_URL + "/api/event", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": "Bearer " + EVENT_TOKEN
      },
      body: JSON.stringify(event)
    });

    if (!r.ok) {
      failedCount++;
      const body = await r.text();
      console.error(`\nError remoto ${r.status}: ${body}`);
      return;
    }

    sentCount++;
    lastEventAt = new Date().toISOString();
    lastEventType = event.type;
    if (event.type === "MATCH_TICK") lastMatchTickAt = lastEventAt;
    if (event.type === "ITEM_ACQUIRED") lastItemAt = lastEventAt;
    console.log(`\n[${formatClock(event.clock)}] ${event.type} -> ONLINE`);
  } catch (error) {
    failedCount++;
    console.error("\nNo se pudo enviar evento:", error.message);
  }
}

function emit(type, details = {}, data = null) {
  const event = {
    timestamp: new Date().toISOString(),
    clock: data ? clockOf(data) : null,
    type,
    ...(data ? statSnapshot(data) : {}),
    ...details
  };
  // Preserve the exact GSI order. This matters when several changes happen in
  // the same payload (kill + item + final state, for example).
  sendQueue = sendQueue.then(() => sendEvent(event)).catch(error => {
    failedCount++;
    console.error("\nNo se pudo encolar evento:", error.message);
  });
}

function inventoryNames(data) {
  const names = [];
  for (const [slot, value] of Object.entries(data?.items || {})) {
    // Count main inventory + backpack + stash. Timed purchase rules should not
    // fail just because the item was still waiting in stash/courier delivery.
    if (!(slot.startsWith("slot") || slot.startsWith("stash")) || !value || typeof value !== "object") continue;
    if (value.name && value.name !== "empty") names.push(value.name);
  }
  return names;
}

function processDirectEvents(data) {
  for (const evt of Array.isArray(data?.events) ? data.events : []) {
    let parsed = null;
    try { parsed = typeof evt.data === "string" ? JSON.parse(evt.data) : evt.data; } catch {}

    const fingerprint = JSON.stringify({
      game_time: evt.game_time,
      event_type: evt.event_type,
      data: evt.data
    });

    if (seenDirectEvents.has(fingerprint)) continue;
    seenDirectEvents.add(fingerprint);
    if (!parsed?.type) continue;

    const sourceTime = sourceEventClock(evt, parsed);
    const timing = { eventClock:sourceTime.clock, eventClockSource:sourceTime.clockSource, receivedClock:clockOf(data) };
    if (parsed.type === "CHAT_MESSAGE_FIRSTBLOOD") emit("FIRST_BLOOD", { ...timing, raw: parsed }, data);

    if (parsed.type === "CHAT_MESSAGE_HERO_KILL") {
      emit("HERO_KILL_EVENT", {
        killerPlayerId: parsed.playerid2,
        victimPlayerId: parsed.playerid1,
        ...timing,
        raw: parsed
      }, data);
    }
  }
}

function processStateChanges(data) {
  if (!previous) {
    previousLiveCounterSignature=JSON.stringify([liveTelemetry.latest?.liveEventMetrics?.observedCounts ?? null,liveTelemetry.latest?.matchEventMetrics?.observedCounts ?? null]);
    if(data?.hero?.name)emit("HERO_SELECTED",{heroName:data.hero.name},data);
    const firstClock = clockOf(data);
    // If the bridge was restarted mid-match, rebuild the observable state once
    // so cards do not stay stale until the next purchase/stat change.
    if (Number.isFinite(firstClock) && firstClock >= 0) {
      for (const item of new Set(inventoryNames(data))) emit("ITEM_ACQUIRED", { item, recovered: true }, data);
      if (data?.hero?.aghanims_scepter === true) emit("AGHANIMS_SCEPTER_ACQUIRED", { recovered: true }, data);
      if (data?.hero?.aghanims_shard === true) emit("AGHANIMS_SHARD_ACQUIRED", { recovered: true }, data);
      emit("MATCH_TICK", { reason: "initial" }, data);
    }
    previous = data;
    return;
  }

  const prevClockForReset = clockOf(previous);
  const clockForReset = clockOf(data);
  const prevMatchId = String(previous?.map?.matchid || "");
  const matchId = String(data?.map?.matchid || "");
  const newMatch = (prevMatchId && matchId && prevMatchId !== matchId) ||
    (Number.isFinite(prevClockForReset) && Number.isFinite(clockForReset) && prevClockForReset > 180 && clockForReset < 30) ||
    Number(data?.player?.kills ?? 0) < Number(previous?.player?.kills ?? 0);
  if (newMatch) {
    liveKillTimes = [];
    seenDirectEvents.clear();
    lowHp25Active = false;
    lowHp10Active = false;
    lowHp15Since = null;
    lowHp15Awarded = false;
    recoveryFrom25Since = null;
    if(data?.hero?.name)emit("HERO_SELECTED",{heroName:data.hero.name,newMatch:true},data);
  }
  if(!newMatch&&data?.hero?.name&&data.hero.name!==previous?.hero?.name)emit("HERO_SELECTED",{heroName:data.hero.name},data);

  const prevKills = previous?.player?.kills ?? 0;
  const kills = data?.player?.kills ?? 0;
  if (kills > prevKills) {
    const clock = Number(clockOf(data));
    const gained = kills - prevKills;
    if (Number.isFinite(clock)) {
      for (let i = 0; i < gained; i++) liveKillTimes.push(clock);
      liveKillTimes = liveKillTimes.slice(-12);
      const details={};
      if(liveKillTimes.length>=2){const last2=liveKillTimes.slice(-2);details.twoWindowSeconds=Math.max(0,last2[1]-last2[0]);}
      if(liveKillTimes.length>=3){const last3=liveKillTimes.slice(-3);details.threeWindowSeconds=Math.max(0,last3[2]-last3[0]);}
      if(liveKillTimes.length>=5){const last5=liveKillTimes.slice(-5);details.fiveWindowSeconds=Math.max(0,last5[4]-last5[0]);}
      if(Object.keys(details).length)emit("MULTIKILL_WINDOW",details,data);
      if (liveKillTimes.length >= 3) {
        const last3 = liveKillTimes.slice(-3);
        const windowSeconds = Math.max(0, last3[2] - last3[0]);
        emit("KILLS_3_IN_WINDOW", { windowSeconds, killTimes: last3 }, data);
      }
    }
    emit("KIKE_KILL", { previousKills: prevKills, kills, gained }, data);
  }

  const prevDeaths = previous?.player?.deaths ?? 0;
  const deaths = data?.player?.deaths ?? 0;
  if (deaths > prevDeaths) emit("KIKE_DEATH", { previousDeaths: prevDeaths, deaths, gained: deaths - prevDeaths }, data);

  if (previous?.hero?.alive === false && data?.hero?.alive === true) emit("KIKE_RESPAWN", {}, data);

  const alive = data?.hero?.alive;
  const hp = data?.hero?.health_percent;
  if (alive === true && typeof hp === "number") {
    if (hp <= 25 && !lowHp25Active) { lowHp25Active = true; emit("LOW_HP_25", { healthPercent: hp }, data); }
    if (hp <= 10 && !lowHp10Active) { lowHp10Active = true; emit("LOW_HP_10", { healthPercent: hp }, data); }
    if (hp > 30) lowHp25Active = false;
    if (hp > 15) lowHp10Active = false;
    const now=Number(clockOf(data));
    if(hp<15&&Number.isFinite(now)){
      if(lowHp15Since==null)lowHp15Since=now;
      if(!lowHp15Awarded&&now-lowHp15Since>=15){lowHp15Awarded=true;emit("LOW_HP_15_FOR_15S",{durationSeconds:now-lowHp15Since},data);}
    }else{lowHp15Since=null;lowHp15Awarded=false;}
    if(hp<=25&&Number.isFinite(now)&&recoveryFrom25Since==null)recoveryFrom25Since=now;
    if(hp>=75&&Number.isFinite(now)&&recoveryFrom25Since!=null){
      const recoverySeconds=now-recoveryFrom25Since;
      if(recoverySeconds>=0&&recoverySeconds<=120)emit("HP_RECOVERED_FROM_25",{recoverySeconds},data);
      recoveryFrom25Since=null;
    }else if(recoveryFrom25Since!=null&&Number.isFinite(now)&&now-recoveryFrom25Since>120)recoveryFrom25Since=null;
  }else if(alive===false){
    lowHp15Since=null;lowHp15Awarded=false;recoveryFrom25Since=null;
  }

  const prevLevel = previous?.hero?.level ?? 0;
  const level = data?.hero?.level ?? 0;
  if (prevLevel >= 1 && level > prevLevel) emit("LEVEL_UP", { previousLevel: prevLevel, level }, data);

  const prevItems = new Set(inventoryNames(previous));
  const currentItems = new Set(inventoryNames(data));
  for (const item of currentItems) if (!prevItems.has(item)) emit("ITEM_ACQUIRED", { item }, data);

  if (previous?.hero?.aghanims_scepter === false && data?.hero?.aghanims_scepter === true) {
    emit("AGHANIMS_SCEPTER_ACQUIRED", {}, data);
  }
  if (previous?.hero?.aghanims_shard === false && data?.hero?.aghanims_shard === true) {
    emit("AGHANIMS_SHARD_ACQUIRED", {}, data);
  }

  const prevAbilities = previous?.abilities || {};
  const abilities = data?.abilities || {};
  for (const [key, ability] of Object.entries(abilities)) {
    const prev = prevAbilities[key];
    if (!prev || !ability) continue;
    const prevCd = Number(prev.cooldown ?? 0);
    const cd = Number(ability.cooldown ?? 0);
    if (prevCd <= 0 && cd > 0) {
      emit("ABILITY_CAST", {
        ability: ability.name || key,
        cooldown: cd,
        ultimate: !!ability.ultimate,
        observation:'cooldown_started',castVerified:false
      }, data);
    }
  }

  const milestones = [
    ["KILL_STREAK_3", data?.player?.kill_streak, previous?.player?.kill_streak, 3],
    ["KILL_STREAK_5", data?.player?.kill_streak, previous?.player?.kill_streak, 5],
    ["ASSISTS_5", data?.player?.assists, previous?.player?.assists, 5],
    ["ASSISTS_10", data?.player?.assists, previous?.player?.assists, 10],
    ["ASSISTS_15", data?.player?.assists, previous?.player?.assists, 15],
    ["LAST_HITS_25", data?.player?.last_hits, previous?.player?.last_hits, 25],
    ["LAST_HITS_50", data?.player?.last_hits, previous?.player?.last_hits, 50],
    ["LAST_HITS_100", data?.player?.last_hits, previous?.player?.last_hits, 100]
  ];

  for (const [type, currentValue, previousValue, target] of milestones) {
    if ((previousValue ?? 0) < target && (currentValue ?? 0) >= target) {
      emit(type, { value: currentValue, target }, data);
    }
  }

  const prevClock = clockOf(previous);
  const clock = clockOf(data);
  if (typeof prevClock === "number" && typeof clock === "number") {
    for (const minute of [5, 10, 20, 30, 40, 60]) {
      const target = minute * 60;
      if (prevClock < target && clock >= target) emit("GAME_TIME_MILESTONE", { minute }, data);
    }
  }

  const prevStats = coreStatSnapshot(previous);
  const currentStats = coreStatSnapshot(data);
  const statsChanged = Object.keys(currentStats).some(key => currentStats[key] !== prevStats[key]);
  const liveCounterSignature=JSON.stringify(liveTelemetry.latest?.liveEventMetrics?.observedCounts ?? null);
  const liveCountersChanged=!newMatch && previousLiveCounterSignature!==null && liveCounterSignature!==previousLiveCounterSignature;
  previousLiveCounterSignature=liveCounterSignature;
  const ruleClockTargets = [180,600,900,1200,1500,1800,2100,2400,2700];
  const goldThresholdCrossed=[1500,2000,3000].some(target=>Number(previous?.player?.gold||0)<target&&Number(data?.player?.gold||0)>=target);
  const crossedRuleDeadline = Number.isFinite(prevClock) && Number.isFinite(clock) &&
    ruleClockTargets.some(target => prevClock < target && clock >= target);
  if (statsChanged || crossedRuleDeadline || goldThresholdCrossed || liveCountersChanged) {
    emit("MATCH_TICK", { reason: statsChanged ? "stats_change" : crossedRuleDeadline ? "rule_deadline" : goldThresholdCrossed ? "gold_threshold" : "live_event_counter" }, data);
  }

  const prevWinner = previous?.map?.win_team;
  const winner = data?.map?.win_team;
  if ((prevWinner === "none" || !prevWinner) && winner && winner !== "none") {
    emit("GAME_FINISHED", {
      winner,
      kikeTeam: data?.player?.team_name,
      kikeWon: winner === data?.player?.team_name
    }, data);
  }

  previous = data;
}

// ============================================================
// HAPPY BINGO SUPPORT RESEARCH COLLECTOR
// Adds local telemetry only. It does NOT change the Bingo rules
// or the events sent to Cloudflare.
// ============================================================
const RESEARCH_DIR = path.join(__dirname, "research");
const RESEARCH_MATCHES = path.join(RESEARCH_DIR, "happy-bingo-support-matches.jsonl");
const RESEARCH_DISCOVERED = path.join(RESEARCH_DIR, "happy-bingo-support-discovered-fields.json");

fs.mkdirSync(RESEARCH_DIR, { recursive: true });
const roleTracker=new RoleTracker(RESEARCH_DIR);
const liveTelemetry = new GsiCollector({dir:RESEARCH_DIR,roleProvider:id=>roleTracker.assignment(id),maxRawBytes:Number(config.telemetry?.maxRawBytes)||8*1024**3});
const openDota = createOpenDotaCollector({
  dir:RESEARCH_DIR,
  enabledLive:config.openDota?.live !== false,
  enabledPostMatch:config.openDota?.postMatch !== false,
  requestParsing:config.openDota?.requestParsing !== false
});

let researchPrevious = null;
let researchMatch = null;
let researchLastMinute = null;
let researchDiscovered = {};

try {
  if (fs.existsSync(RESEARCH_DISCOVERED)) {
    researchDiscovered = JSON.parse(fs.readFileSync(RESEARCH_DISCOVERED, "utf8"));
  }
} catch {}

function primitiveCandidateFields(root, prefix = "", depth = 0, out = {}) {
  if (depth > 5 || root === null || root === undefined) return out;
  if (typeof root !== "object") return out;

  for (const [key, value] of Object.entries(root)) {
    const p = prefix ? `${prefix}.${key}` : key;
    if (/net.?worth|worth|ward|stack|support|gold|gpm|xpm|camp/i.test(p)) {
      if (value === null || ["string", "number", "boolean"].includes(typeof value)) out[p] = value;
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      primitiveCandidateFields(value, p, depth + 1, out);
    }
  }
  return out;
}

function saveDiscoveredFields(data) {
  const candidates = primitiveCandidateFields({
    player: data?.player || {},
    hero: data?.hero || {},
    map: data?.map || {}
  });
  let changed = false;
  for (const [field, value] of Object.entries(candidates)) {
    if (!(field in researchDiscovered) || researchDiscovered[field]?.lastValue !== value) {
      researchDiscovered[field] = {
        firstSeenAt: researchDiscovered[field]?.firstSeenAt || new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
        lastValue: value
      };
      changed = true;
    }
  }
  if (changed) {
    try { fs.writeFileSync(RESEARCH_DISCOVERED, JSON.stringify(researchDiscovered, null, 2), "utf8"); } catch {}
  }
}

function getMetric(data, names) {
  for (const name of names) {
    const parts = name.split(".");
    let cur = data;
    let ok = true;
    for (const part of parts) {
      if (cur && Object.prototype.hasOwnProperty.call(cur, part)) cur = cur[part];
      else { ok = false; break; }
    }
    if (ok && cur !== null && cur !== undefined) return cur;
  }
  return null;
}

function researchSnapshot(data, minute) {
  return {
    minute,
    clock: clockOf(data),
    kills: data?.player?.kills ?? null,
    deaths: data?.player?.deaths ?? null,
    assists: data?.player?.assists ?? null,
    lastHits: data?.player?.last_hits ?? null,
    denies: data?.player?.denies ?? null,
    killStreak: data?.player?.kill_streak ?? null,
    gold: data?.player?.gold ?? null,
    goldReliable: data?.player?.gold_reliable ?? null,
    goldUnreliable: data?.player?.gold_unreliable ?? null,
    gpm: data?.player?.gpm ?? data?.player?.gold_per_min ?? null,
    xpm: data?.player?.xpm ?? data?.player?.xp_per_min ?? null,
    netWorth: getMetric(data, ["player.net_worth", "player.networth", "player.netWorth"]),
    supportGoldSpent: getMetric(data, ["player.support_gold_spent", "player.supportGoldSpent"]),
    wardsPlaced: getMetric(data, ["player.wards_placed", "player.wardsPlaced"]),
    wardsDestroyed: getMetric(data, ["player.wards_destroyed", "player.wardsDestroyed"]),
    campsStacked: getMetric(data, ["player.camps_stacked", "player.campsStacked", "player.stack_count"]),
    level: data?.hero?.level ?? null,
    hpPercent: data?.hero?.health_percent ?? null,
    alive: data?.hero?.alive ?? null,
    radiantScore: data?.map?.radiant_score ?? null,
    direScore: data?.map?.dire_score ?? null,
    items: inventoryNames(data),
    liveMetrics:metricsOf(data?.player),
    telemetryMode:modeOf(data)
  };
}

function beginResearchMatch(data, reason = "first_payload") {
  const clock = clockOf(data);
  researchMatch = {
    schemaVersion: 2,
    ...roleTracker.assignment(data?.map?.matchid ?? data?.map?.match_id),
    researchOnly: true,
    id: String(data?.map?.matchid || data?.map?.match_id || `local-${Date.now()}`),
    startedAt: new Date().toISOString(),
    startReason: reason,
    heroName: data?.hero?.name || null,
    team: data?.player?.team_name || null,
    mapName: data?.map?.name || null,
    customGameName: data?.map?.customgamename || data?.map?.custom_game_name || null,
    firstClock: clock,
    lastClock: clock,
    snapshots: [],
    killTimes: [],
    deathTimes: [],
    assistTimes: [],
    levelTimes: [],
    itemAcquisitions: [],
    firstSeenItems: {},
    minHpPercent: 100,
    minHpClock: null,
    final: null
  };
  researchLastMinute = null;
  researchPrevious = null;
}

function finalizeResearchMatch(data, reason = "game_finished") {
  if (!researchMatch) return;
  const clock = data ? clockOf(data) : researchMatch.lastClock;
  const durationSeconds = typeof clock === "number" ? Math.max(0, clock) : null;
  researchMatch.lastClock = clock;
  researchMatch.endedAt = new Date().toISOString();
  researchMatch.endReason = reason;
  researchMatch.durationSeconds = durationSeconds;
  researchMatch.validForBalance = typeof durationSeconds === "number" && durationSeconds >= 900;
  researchMatch.final = data ? researchSnapshot(data, Math.floor(Math.max(0, clock || 0) / 60)) : researchMatch.snapshots.at(-1) || null;
  if (data?.map?.win_team && data.map.win_team !== "none") {
    researchMatch.winner = data.map.win_team;
    researchMatch.kikeWon = data.map.win_team === data?.player?.team_name;
  }

  try {
    researchMatch=roleTracker.record(researchMatch);
    if(researchMatch.matchMode==='normal'&&['support4','support5'].includes(researchMatch.role))fs.appendFileSync(RESEARCH_MATCHES, JSON.stringify(researchMatch) + "\n", "utf8");
    console.log(`\n[RESEARCH] Partida guardada (${reason}) -> ${path.relative(__dirname, roleTracker.matchesFile)}`);
  } catch (e) {
    console.error("\n[RESEARCH] No pude guardar la partida:", e.message);
  }

  researchMatch = null;
  researchPrevious = null;
  researchLastMinute = null;
}

function recordDeltaTimes(targetArray, delta, clock) {
  if (!Number.isFinite(delta) || delta <= 0 || !Number.isFinite(clock)) return;
  for (let i = 0; i < delta; i++) targetArray.push(clock);
}

function processResearch(data) {
  const clock = clockOf(data);
  saveDiscoveredFields(data);

  const newMatchId = String(data?.map?.matchid || data?.map?.match_id || "");
  const winnerNow = data?.map?.win_team;
  const terminalPayload = !!winnerNow && winnerNow !== "none";
  const oldMatchId = researchMatch?.id && !researchMatch.id.startsWith("local-") ? researchMatch.id : "";
  const clockReset = researchMatch && Number.isFinite(researchMatch.lastClock) && Number.isFinite(clock) && researchMatch.lastClock > 180 && clock < 30;
  const idChanged = researchMatch && oldMatchId && newMatchId && oldMatchId !== newMatchId;

  if (researchMatch && (clockReset || idChanged)) {
    finalizeResearchMatch(researchPrevious || data, clockReset ? "clock_reset" : "match_id_changed");
  }

  // Dota sigue enviando varios payloads del resultado final durante unos segundos.
  // Antes, cada payload terminal iniciaba una partida nueva y se guardaba otra vez.
  // Si ya no hay una partida activa, un payload con ganador es solo eco postpartida.
  if (!researchMatch && terminalPayload) {
    researchPrevious = null;
    researchLastMinute = null;
    return;
  }

  if (!researchMatch) beginResearchMatch(data, "new_match");

  // A veces GSI no expone matchid al inicio. Si aparece durante la partida,
  // reemplazamos el id local por el id real sin cortar el registro.
  if (researchMatch.id.startsWith("local-") && newMatchId) {
    researchMatch.id = newMatchId;
  }

  researchMatch.lastClock = clock;
  if (!researchMatch.heroName && data?.hero?.name) researchMatch.heroName = data.hero.name;
  if (!researchMatch.team && data?.player?.team_name) researchMatch.team = data.player.team_name;

  if (Number.isFinite(data?.hero?.health_percent) && data.hero.alive !== false) {
    if (data.hero.health_percent < researchMatch.minHpPercent) {
      researchMatch.minHpPercent = data.hero.health_percent;
      researchMatch.minHpClock = clock;
    }
  }

  if (researchPrevious) {
    const prevKills = Number(researchPrevious?.player?.kills ?? 0);
    const kills = Number(data?.player?.kills ?? 0);
    recordDeltaTimes(researchMatch.killTimes, kills - prevKills, clock);

    const prevDeaths = Number(researchPrevious?.player?.deaths ?? 0);
    const deaths = Number(data?.player?.deaths ?? 0);
    recordDeltaTimes(researchMatch.deathTimes, deaths - prevDeaths, clock);

    const prevAssists = Number(researchPrevious?.player?.assists ?? 0);
    const assists = Number(data?.player?.assists ?? 0);
    recordDeltaTimes(researchMatch.assistTimes, assists - prevAssists, clock);

    const prevLevel = Number(researchPrevious?.hero?.level ?? 0);
    const level = Number(data?.hero?.level ?? 0);
    if (level > prevLevel && Number.isFinite(clock)) {
      researchMatch.levelTimes.push({ level, clock });
    }
  }

  const items = inventoryNames(data);
  for (const item of items) {
    if (!Object.prototype.hasOwnProperty.call(researchMatch.firstSeenItems, item)) {
      researchMatch.firstSeenItems[item] = clock;
      researchMatch.itemAcquisitions.push({ item, clock });
    }
  }

  if (Number.isFinite(clock) && clock >= 0) {
    const minute = Math.floor(clock / 60);
    if (researchLastMinute !== minute) {
      researchLastMinute = minute;
      researchMatch.snapshots.push(researchSnapshot(data, minute));
    }
  }

  const prevWinner = researchPrevious?.map?.win_team;
  const winner = data?.map?.win_team;
  researchPrevious = data;

  if ((prevWinner === "none" || !prevWinner) && winner && winner !== "none") {
    finalizeResearchMatch(data, "game_finished");
  }
}


async function healthCheck() {
  try {
    const r = await fetch(WORKER_URL + "/api/health");
    const j = await r.json();
    workerHealth = j;
    const remoteProtocol = Number(j?.eventProtocolVersion);
    const compatible = r.ok && j?.ok === true && remoteProtocol === EVENT_PROTOCOL_VERSION;
    console.log(`Worker: ${r.ok && j?.ok ? "ONLINE" : "ERROR"}`);
    console.log(`Protocolo bridge/worker: ${EVENT_PROTOCOL_VERSION}/${Number.isFinite(remoteProtocol) ? remoteProtocol : "?"} ${compatible ? "OK" : "NO COMPATIBLE"}`);
    console.log(`Reglas temporales: ${TIMED_RULES_ENGINE_VERSION > 0 ? "ACTIVE" : "OFF"}`);
    if (!compatible) {
      console.error("ADVERTENCIA: Worker y bridge no tienen el mismo protocolo. Ejecuta npm run deploy antes del stream.");
    }
    return compatible;
  } catch (e) {
    workerHealth = null;
    console.error("No pude contactar el servidor:", e.message);
    return false;
  }
}

function bridgeStatus() {
  return {
    ok: true,
    service: "Happy Bingo Online Bridge",
    bridgeVersion: BRIDGE_VERSION,
    eventProtocolVersion: EVENT_PROTOCOL_VERSION,
    timedRulesEngineVersion: TIMED_RULES_ENGINE_VERSION,
    port: PORT,
    workerUrl: WORKER_URL,
    workerOnline: !!workerHealth?.ok,
    workerProtocolVersion: workerHealth?.eventProtocolVersion ?? null,
    protocolCompatible: Number(workerHealth?.eventProtocolVersion) === EVENT_PROTOCOL_VERSION,
    gsiPayloadCount,
    lastGsiAt,
    lastMatchTickAt,
    lastItemAt,
    lastEventAt,
    lastEventType,
    lastIgnoredGameplayReason,
    eventCount,
    sentCount,
    failedCount,
    roleTracking:roleTracker.status(),
    telemetry:liveTelemetry.status(),
    openDota:openDota.status()
  };
}

const server = http.createServer((req, res) => {
  if(roleTracker.handle(req,res))return;
  if (req.method === 'GET' && req.url === '/telemetry') {
    res.writeHead(200, {'content-type':'application/json; charset=utf-8','cache-control':'no-store'});
    res.end(JSON.stringify(liveTelemetry.latest ?? {source:'dota-gsi',status:'waiting'}, null, 2));
    return;
  }
  if (req.method === "GET" && req.url === "/status") {
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(bridgeStatus(), null, 2));
    return;
  }
  if (req.method !== "POST") {
    res.writeHead(200);
    res.end(`Happy Bingo Online Bridge v${BRIDGE_VERSION} OK`);
    return;
  }

  let body = "";
  req.setEncoding('utf8');
  let bodyBytes = 0;
  let oversized = false;
  req.on("data", chunk => {
    bodyBytes += Buffer.byteLength(chunk,'utf8');
    if(bodyBytes > 8 * 1024 * 1024) {
      if(!oversized) { oversized=true;res.writeHead(413);res.end('GSI payload too large'); }
      return;
    }
    body += chunk;
  });
  req.on("end", () => {
    if(oversized) return;
    try {
      const data = JSON.parse(body);
      if(!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid GSI object');
      gsiPayloadCount++;
      lastGsiAt = new Date().toISOString();
      if(gameplaySourceAllowed(data,modeOf(data)))roleTracker.observe(data);
      const captured = liveTelemetry.safeProcess(data);
      const mode = captured?.context.mode ?? modeOf(data);
      // Observer/replay feeds are saved, but cannot award a player's live Bingo.
      if(gameplaySourceAllowed(data,mode)) {
        lastIgnoredGameplayReason=null;
        const freshData = captured ? {...data,events:captured.directEvents} : data;
        const matchId=String(data?.map?.matchid ?? data?.map?.match_id ?? '');
        if(/^[1-9]\d+$/.test(matchId)&&matchId!==detectedMatchId){
          detectedMatchId=matchId;
          emit('MATCH_DETECTED',{matchId},data);
        }
        processDirectEvents(freshData);
        processStateChanges(freshData);
        processResearch(data);
        openDota.observe({matchId:captured?.context.matchId ?? data?.map?.matchid,clock:clockOf(data),
          finished:!!data?.map?.win_team && data.map.win_team !== 'none',mode});
      } else lastIgnoredGameplayReason=mode!=='player'?mode:'demo_custom_or_missing_match_id';

      process.stdout.write(
        `\rHappy Bingo Online | ${formatClock(clockOf(data))} | Eventos ${eventCount} | Enviados ${sentCount} | Fallos ${failedCount}   `
      );

      res.writeHead(200);
      res.end("OK");
    } catch (error) {
      console.error("\nError GSI:", error.message);
      res.writeHead(400);
      res.end("Invalid JSON");
    }
  });
});

function shutdown() {
  if (researchMatch) finalizeResearchMatch(researchPrevious, "manual_stop");
  try { liveTelemetry.close();openDota.close(); } catch(e) { console.error('Error al guardar telemetria:',e.message); }
  console.log("\nHappy Bingo detenido.");
  process.exit(0);
}
process.on('SIGINT',shutdown);
process.on('SIGTERM',shutdown);

server.listen(PORT, "127.0.0.1", async () => {
  console.log("===============================================");
  console.log(` HAPPY BINGO BRIDGE v${BRIDGE_VERSION}`);
  console.log(` Event Protocol v${EVENT_PROTOCOL_VERSION} | Timed Rules v${TIMED_RULES_ENGINE_VERSION}`);
  console.log("===============================================");
  console.log(`Dota GSI: http://127.0.0.1:${PORT}/`);
  console.log(`Worker:   ${WORKER_URL}`);
  console.log("");
  const compatible = await healthCheck();
  console.log("");
  console.log(compatible ? "BRIDGE READY - esperando datos de Dota." : "BRIDGE NO READY - corrige compatibilidad antes del stream.");
  console.log("Estado local: http://127.0.0.1:" + PORT + "/status");
});
