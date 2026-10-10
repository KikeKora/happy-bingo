// Private local GSI capture. No invented counters and no extra Cloudflare requests.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');

const SCHEMA_VERSION = 2;
const BLOCKS = ['provider','map','player','hero','abilities','items','events','buildings','league','draft','wearables','minimap','roshan','couriers','neutralitems'];
const METRICS = {
  kills:['kills'], deaths:['deaths'], assists:['assists'], lastHits:['last_hits'], denies:['denies'],
  killStreak:['kill_streak'], gold:['gold'], goldReliable:['gold_reliable'], goldUnreliable:['gold_unreliable'],
  gpm:['gpm','gold_per_min'], xpm:['xpm','xp_per_min'], netWorth:['net_worth','networth','netWorth'],
  wardsPurchased:['wards_purchased','wardsPurchased'], wardsPlaced:['wards_placed','wardsPlaced'],
  wardsDestroyed:['wards_destroyed','wardsDestroyed'], campsStacked:['camps_stacked','campsStacked','stack_count'],
  supportGoldSpent:['support_gold_spent','supportGoldSpent'], heroDamage:['hero_damage','heroDamage'],
  towerDamage:['tower_damage','towerDamage'], heroHealing:['hero_healing','heroHealing'],
  runesActivated:['runes_activated','runesActivated'], goldSpent:['gold_spent'],
  goldFromKills:['gold_from_hero_kills'], goldFromCreeps:['gold_from_creep_kills'],
  goldFromIncome:['gold_from_income'], goldFromShared:['gold_from_shared'],
  goldFromSummons:['gold_from_summon_kills'], commandsIssued:['commands_issued']
};
const own = (o,k) => o && Object.prototype.hasOwnProperty.call(o,k);
const finite = v => typeof v === 'number' && Number.isFinite(v);
const numberOrNull = v => finite(v) ? v : null;
const object = v => v && typeof v === 'object' && !Array.isArray(v);
const validId = v => v != null && /^\d+$/.test(String(v)) && BigInt(String(v)) > 0n ? String(v) : null;
const clockOf = d => numberOrNull(d?.map?.clock_time ?? d?.map?.game_time);

function sanitize(value, depth=0) {
  if (depth > 40) return '[depth-limit]';
  if (Array.isArray(value)) return value.map(v=>sanitize(v,depth+1));
  if (!object(value)) return value;
  const out=Object.create(null);
  for (const [k,v] of Object.entries(value)) {
    if (/auth|token|password|secret|credential/i.test(k)) continue;
    if(k==='data' && typeof v==='string') {
      try { const parsed=JSON.parse(v);out[k]=(object(parsed)||Array.isArray(parsed))?JSON.stringify(sanitize(parsed,depth+1)):v; }
      catch { out[k]=v; }
    } else out[k]=sanitize(v,depth+1);
  }
  return out;
}
function stable(value) {
  if(Array.isArray(value)) return '['+value.map(stable).join(',')+']';
  if(object(value)) return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}';
  return JSON.stringify(value) ?? 'null';
}
function atomic(file,value) {
  const temp=file+'.tmp';
  fs.writeFileSync(temp,JSON.stringify(value,null,2),'utf8');
  fs.renameSync(temp,file);
}
function read(file,fallback) { try { return JSON.parse(fs.readFileSync(file,'utf8')); } catch { return fallback; } }
function compactMinimapFields(fields) {
  const compact=Object.create(null);
  for(const [field,entry] of Object.entries(fields || {})) {
    const key=field.replace(/(^|\.)minimap\.o\d+(?=\.|\[\]|$)/g,'$1minimap.o*');
    const previous=compact[key];
    if(!previous) { compact[key]=entry;continue; }
    compact[key]={...previous,...entry,
      firstSeenAt:[previous.firstSeenAt,entry.firstSeenAt].filter(v=>v!=null).sort()[0] ?? null,
      lastSeenAt:[previous.lastSeenAt,entry.lastSeenAt].filter(v=>v!=null).sort().at(-1) ?? null,
      observations:(previous.observations ?? 0)+(entry.observations ?? 0),
      nonNullObservations:(previous.nonNullObservations ?? 0)+(entry.nonNullObservations ?? 0),
      types:[...new Set([...(previous.types || []),...(entry.types || [])])],
      modes:[...new Set([...(previous.modes || []),...(entry.modes || [])])]};
  }
  return compact;
}
function modeOf(d) {
  if (object(d?.player) && Object.keys(d.player).some(k=>/^team\d+$|^player\d+$/.test(k))) return 'spectator';
  if(d?.player?.activity === 'menu') return 'menu';
  if(d?.player?.activity === 'spectating') return 'perspective';
  if(d?.provider?.steamid && d?.player?.steamid && String(d.provider.steamid)!==String(d.player.steamid)) return 'perspective';
  if(object(d?.player) && (own(d.player,'kills') || d.player.activity==='playing')) return 'player';
  return 'unknown';
}
function metricsOf(player) {
  const out={};
  for(const [name,aliases] of Object.entries(METRICS)) {
    out[name]=null;
    for(const key of aliases) if(finite(player?.[key])) { out[name]=player[key]; break; }
  }
  return out;
}
function explicitPlayerId(p) {
  // player_slot is preserved separately; do not assume its encoding equals chat IDs.
  for(const k of ['playerid','player_id']) if(Number.isInteger(p?.[k]) && p[k]>=0 && p[k]<64) return p[k];
  return null;
}
function rowsOf(d) {
  const rows=[];
  const add=(p,h,id,scope)=>{
    if(!object(p)) return;
    rows.push({playerId:id,slot:p.player_slot ?? null,team:p.team_name ?? null,steamId:p.steamid ?? null,
      heroName:h?.name ?? null,scope,metrics:metricsOf(p),level:numberOrNull(h?.level),alive:h?.alive ?? null,
      position:{x:numberOrNull(h?.xpos),y:numberOrNull(h?.ypos)},rawPlayer:p,rawHero:h ?? null});
  };
  if(modeOf(d)==='spectator') {
    for(const [tk,team] of Object.entries(d.player)) {
      if(/^player\d+$/.test(tk)) { add(team,d.hero?.[tk],Number(tk.slice(6)),tk); continue; }
      if(!/^team\d+$/.test(tk) || !object(team)) continue;
      for(const [pk,p] of Object.entries(team)) if(/^player\d+$/.test(pk)) add(p,d.hero?.[tk]?.[pk],Number(pk.slice(6)),tk+'.'+pk);
    }
  } else if(object(d?.player) && Object.keys(d.player).length) add(d.player,d.hero,explicitPlayerId(d.player),'local');
  return rows;
}
function eventData(evt) {
  try { const p=typeof evt?.data==='string'?JSON.parse(evt.data):evt?.data; return object(p)?sanitize(p):null; } catch { return null; }
}
function sourceEventClock(evt,parsed,map) {
  if(finite(parsed?.time)) return {clock:parsed.time,clockSource:'event.data.time',sourceClock:parsed.time,sourceClockSource:'event.data.time'};
  if(finite(evt?.game_time)) {
    // Native events use engine game_time, not the match clock in CHAT_MESSAGE data.
    const calibrated=finite(map?.game_time) && finite(map?.clock_time);
    return {clock:calibrated?evt.game_time-(map.game_time-map.clock_time):null,
      clockSource:calibrated?'event.game_time-minus-map-offset':'unavailable-map-offset',
      sourceClock:evt.game_time,sourceClockSource:'event.game_time'};
  }
  return {clock:null,clockSource:'unavailable',sourceClock:null,sourceClockSource:'unavailable'};
}

const liveId=id=>Number.isInteger(id) && id>=0 && id<64 ? id : null;
const EVENT_COUNTERS=['observerWardsPurchased','sentryWardsPurchased','observerWardsDestroyed','sentryWardsDestroyed',
  'smokeActivations','buybacks','bountyRunesPickedUp','aegisPickups','roshanKillingBlows'];
function eventDetail(type,parsed,evt) {
  const raw=parsed ?? evt;
  const genericActor=liveId(parsed?.playerid1);
  if(type==='CHAT_MESSAGE_ITEM_PURCHASE' && genericActor!==null && [42,43].includes(raw.value))
    return {type:'WARD_PURCHASE_DETAIL',actorPlayerId:genericActor,itemId:raw.value,
      wardType:raw.value===42?'observer':'sentry',observedQuantity:1,
      counter:raw.value===42?'observerWardsPurchased':'sentryWardsPurchased',
      interpretation:'ward-item-ids-validated-against-captured-purchases-and-opendota'};
  if(['CHAT_MESSAGE_OBSERVER_WARD_KILLED','CHAT_MESSAGE_SENTRY_WARD_KILLED'].includes(type) && genericActor!==null)
    return {type:'WARD_DESTROYED_DETAIL',actorPlayerId:genericActor,
      wardType:type==='CHAT_MESSAGE_OBSERVER_WARD_KILLED'?'observer':'sentry',
      counter:type==='CHAT_MESSAGE_OBSERVER_WARD_KILLED'?'observerWardsDestroyed':'sentryWardsDestroyed',
      interpretation:'destroyer-playerid1-validated-against-opendota'};
  if(['CHAT_MESSAGE_SMOKE_ACTIVATED','CHAT_MESSAGE_BUYBACK'].includes(type) && genericActor!==null)
    return {type:type==='CHAT_MESSAGE_SMOKE_ACTIVATED'?'SMOKE_ACTIVATED_DETAIL':'BUYBACK_DETAIL',
      actorPlayerId:genericActor,counter:type==='CHAT_MESSAGE_SMOKE_ACTIVATED'?'smokeActivations':'buybacks',
      interpretation:'actor-playerid1-validated-against-opendota'};
  if(['bounty_rune_pickup','aegis_picked_up'].includes(type) && liveId(raw.player_id)!==null)
    return {type:type==='bounty_rune_pickup'?'BOUNTY_RUNE_DETAIL':'AEGIS_PICKUP_DETAIL',actorPlayerId:raw.player_id,
      counter:type==='bounty_rune_pickup'?'bountyRunesPickedUp':'aegisPickups',interpretation:'explicit-native-player-id'};
  if(type==='roshan_killed')return {type:'ROSHAN_KILLED_DETAIL',actorPlayerId:liveId(raw.killer_player_id),
    team:raw.killed_by_team ?? null,counter:'roshanKillingBlows',interpretation:'explicit-native-killer-and-team'};
  return null;
}

class GsiCollector {
  constructor({dir,roleProvider=()=>({role:'unknown',roleSource:'unconfirmed'}),now=()=>Date.now(),maxRawBytes=2*1024**3,maxChunkBytes=32*1024**2}={}) {
    if(!dir) throw new Error('dir is required');
    this.dir=dir;this.roleProvider=roleProvider;this.now=now;this.maxRawBytes=maxRawBytes;this.maxChunkBytes=maxChunkBytes;
    fs.mkdirSync(path.join(dir,'raw'),{recursive:true});
    this.fieldsFile=path.join(dir,'happy-games-gsi-fields.json');
    this.stateFile=path.join(dir,'happy-games-live-state.json');
    this.sessionFile=path.join(dir,'happy-games-gsi-session.json');
    this.eventsFile=path.join(dir,'happy-games-live-events.jsonl');
    this.fields=read(this.fieldsFile,{schemaVersion:SCHEMA_VERSION,blocks:{},fields:{}});
    this.fields.blocks=Object.assign(Object.create(null),this.fields.blocks);
    this.fields.fields=compactMinimapFields(this.fields.fields);
    this.session=read(this.sessionFile,{matchId:null,key:null,clock:null,seen:[],pairs:{}});
    this.seen=new Set(this.session.seen || []);
    this.previous=null;this.latest=null;this.lastFlush=0;this.received=0;this.directCount=0;
    this.recentLocalKills=[];
    this.errors=0;this.lastError=null;this.rawWritten=0;this.rawSkipped=0;
    this.rawTotal=fs.readdirSync(path.join(dir,'raw')).filter(n=>/^gsi-.*\.jsonl\.gz$/.test(n))
      .reduce((sum,n)=>sum+fs.statSync(path.join(dir,'raw',n)).size,0);
    this.rawFile=null;this.chunkSize=0;this.closed=false;
  }
  context(d,at) {
    const id=validId(d?.map?.matchid ?? d?.map?.match_id),clock=clockOf(d),mode=modeOf(d);
    const reset=(id && this.session.matchId && id!==this.session.matchId) ||
      (finite(clock) && finite(this.session.clock) && this.session.clock>180 && clock<30 && (!id || id!==this.session.matchId));
    if(reset || !this.session.key) {
      this.session={matchId:id,key:id || 'local-'+this.now(),clock,seen:[],pairs:{}};
      this.seen.clear();this.previous=null;this.recentLocalKills=[];
    } else if(id && !this.session.matchId) this.session.matchId=id;
    this.session.clock=clock;
    return {schemaVersion:SCHEMA_VERSION,source:'dota-gsi',receivedAt:at,matchId:this.session.matchId,
      sessionKey:this.session.key,mode,clock,...(mode==='player'?this.roleProvider(this.session.matchId):{role:'unknown',roleSource:'not-player'})};
  }
  resolveLocalIdentity(d,ctx,rows,records) {
    const row=rows.find(p=>p.scope==='local');
    if(ctx.mode!=='player' || !row)return null;
    const now=Date.parse(ctx.receivedAt);
    const samePacket=records.filter(e=>e.type==='HERO_KILL_DETAIL');
    this.recentLocalKills=this.recentLocalKills.filter(e=>now-e.at>=0 && now-e.at<=300);
    this.recentLocalKills.push(...samePacket.map(event=>({at:now,event})));
    const identity=this.session.localIdentity ||= {playerId:null,candidateId:null,evidence:0,conflicted:false,
      source:'consistent-own-kda-deltas-within-300ms',firstEvidenceAt:null,lastEvidenceAt:null};
    const before=this.previous?.mode==='player'?this.previous.players.find(p=>p.scope==='local'):null;
    if(!identity.conflicted && before && row.playerId===null)for(const metric of ['kills','deaths']) {
      const value=row.metrics[metric],old=before.metrics[metric];
      // Multiple simultaneous actions remain ambiguous. Never use player_slot as chat ID.
      if(value===null || old===null || value-old!==1)continue;
      const available=samePacket.length?samePacket:this.recentLocalKills.map(r=>r.event);
      const key=metric==='kills'?'killerPlayerId':'victimPlayerId';
      const ids=[...new Set(available.map(e=>liveId(e[key])).filter(id=>id!==null))];
      if(ids.length!==1)continue;
      if(identity.candidateId!==null && identity.candidateId!==ids[0]) {
        identity.conflicted=true;identity.playerId=null;identity.conflictAt=ctx.receivedAt;continue;
      }
      identity.candidateId=ids[0];identity.evidence++;identity.firstEvidenceAt??=ctx.receivedAt;
      identity.lastEvidenceAt=ctx.receivedAt;
    }
    if(row.playerId!==null) {
      if(identity.candidateId!==null && identity.candidateId!==row.playerId) {
        identity.conflicted=true;identity.conflictAt=ctx.receivedAt;
      } else {
        identity.playerId=row.playerId;identity.candidateId=row.playerId;identity.source='explicit-player-id';
      }
    }
    else if(!identity.conflicted && identity.evidence>=2)identity.playerId=identity.candidateId;
    if(identity.conflicted) {identity.playerId=null;row.playerId=null;row.identitySource='conflicted';}
    if(identity.playerId!==null) {
      row.playerId=identity.playerId;row.identitySource=identity.source;
      row.identityEvidence=identity.evidence;
    }
    return {...identity};
  }
  discover(d,ctx) {
    const at=ctx.receivedAt;
    for(const block of Object.keys(d)) {
      const entry=this.fields.blocks[block] ||= {firstSeenAt:at,lastSeenAt:at,observations:0,modes:[]};
      entry.lastSeenAt=at;entry.observations++;
      if(!entry.modes.includes(ctx.mode)) entry.modes.push(ctx.mode);
    }
    const walk=(v,p,depth,parentKey)=>{
      if(depth>40) return;
      const type=v===null?'null':Array.isArray(v)?'array':typeof v;
      const f=this.fields.fields[p] ||= {firstSeenAt:at,lastSeenAt:at,observations:0,nonNullObservations:0,types:[],modes:[]};
      f.lastSeenAt=at;f.observations++;if(v!==null) f.nonNullObservations++;
      if(!f.types.includes(type)) f.types.push(type);if(!f.modes.includes(ctx.mode)) f.modes.push(ctx.mode);
      if(Array.isArray(v)) { for(const x of v) walk(x,p+'[]',depth+1); }
      else if(object(v)) for(const [k,x] of Object.entries(v)) {
        const shapeKey=/^\d+$/.test(k)?'[id]':/^player\d+$/.test(k)?'player*':/^minimap\d+$/.test(k)?'minimap*':
          parentKey==='minimap' && /^o\d+$/.test(k)?'o*':k;
        walk(x,p?p+'.'+shapeKey:shapeKey,depth+1,k);
      }
      else if(typeof v==='string' && p==='events[].data') {
        try {const parsed=JSON.parse(v);if(object(parsed)||Array.isArray(parsed))walk(parsed,p+'(json)',depth+1);}catch{}
      }
    };
    for(const [key,v] of Object.entries(d)) walk(v,key,0,key);
  }
  raw(d,ctx) {
    const zipped=zlib.gzipSync(JSON.stringify({...ctx,payload:d})+'\n');
    if(this.rawTotal+zipped.length>this.maxRawBytes) { this.rawSkipped++;return; }
    if(!this.rawFile || this.chunkSize+zipped.length>this.maxChunkBytes) {
      this.rawFile=path.join(this.dir,'raw','gsi-'+new Date(this.now()).toISOString().replace(/[:.]/g,'-')+'-'+crypto.randomBytes(4).toString('hex')+'.jsonl.gz');
      this.chunkSize=0;
    }
    fs.appendFileSync(this.rawFile,zipped);this.chunkSize+=zipped.length;this.rawTotal+=zipped.length;this.rawWritten++;
  }
  record(event) { fs.appendFileSync(this.eventsFile,JSON.stringify(event)+'\n','utf8'); }
  process(input) {
    if(this.closed) throw new Error('collector is closed');
    const d=sanitize(input),at=new Date(this.now()).toISOString(),ctx=this.context(d,at);
    this.received++;this.discover(d,ctx);this.raw(d,ctx);
    const rows=rowsOf(d),lookup=new Map(rows.filter(p=>p.playerId!==null).map(p=>[p.playerId,p]));
    const direct=[],records=[];
    for(const evt of Array.isArray(d.events)?d.events:[]) {
      const parsed=eventData(evt);
      const time=sourceEventClock(evt,parsed,d.map);
      const hash=crypto.createHash('sha256').update(stable({session:this.session.key,
        eventType:evt.event_type ?? null,time:time.sourceClock,data:parsed ?? sanitize(evt)})).digest('hex');
      if(this.seen.has(hash)) continue;
      this.seen.add(hash);direct.push(evt);this.directCount++;
      const type=parsed?.type || evt.event_type || 'unknown';
      const event={...ctx,...time,receivedClock:ctx.clock,type:'GSI_DIRECT_EVENT',eventType:type,eventId:hash,
        eventTypeId:evt.event_type ?? null,raw:parsed ?? sanitize(evt),interpretation:'unmapped'};
      Object.assign(event,eventDetail(type,parsed,evt) ?? {});
      if(type==='CHAT_MESSAGE_HERO_KILL' && Number.isInteger(parsed?.playerid1) && Number.isInteger(parsed?.playerid2)) {
        const victim=parsed.playerid1,killer=parsed.playerid2;
        // This order was checked against our actual recorded kills/deaths.
        event.interpretation='validated-local-hero-kill-order';event.type='HERO_KILL_DETAIL';
        event.killerPlayerId=killer;event.victimPlayerId=victim;
        event.killerHero=lookup.get(killer)?.heroName ?? null;event.victimHero=lookup.get(victim)?.heroName ?? null;
        event.killerTeam=lookup.get(killer)?.team ?? null;event.victimTeam=lookup.get(victim)?.team ?? null;
        event.killerIdentityResolved=lookup.has(killer);
        event.victimIdentityResolved=lookup.has(victim);
        if(killer>=0 && killer<64 && victim>=0 && victim<64) {
          const key=killer+'>'+victim;
          const pair=this.session.pairs[key] ||= {killerPlayerId:killer,victimPlayerId:victim,count:0,times:[]};
          pair.count++;if(time.clock!==null) pair.times.push(time.clock);
          event.samePairCount=pair.count;
          event.samePairTimes=pair.times.slice(-20);
        }
        event.byAbility=null;event.byItem=null;
      }
      if(ctx.mode==='player' && event.counter && event.actorPlayerId!==null) {
        const counters=this.session.playerEventCounters ||= {};
        const actor=counters[event.actorPlayerId] ||= Object.fromEntries(EVENT_COUNTERS.map(k=>[k,0]));
        actor[event.counter]++;
      }
      if(ctx.mode==='player'&&['ROSHAN_KILLED_DETAIL','AEGIS_PICKUP_DETAIL'].includes(event.type)){
        const global=this.session.matchEventCounters ||= {roshanDeaths:0,aegisPickups:0};
        global[event.type==='ROSHAN_KILLED_DETAIL'?'roshanDeaths':'aegisPickups']++;
      }
      records.push(event);
    }
    const localIdentity=this.resolveLocalIdentity(d,ctx,rows,records);
    const local=rows.find(p=>p.scope==='local') ?? null;
    if(local?.playerId!=null)lookup.set(local.playerId,local);
    for(const event of records) {
      if(event.type==='HERO_KILL_DETAIL') {
        event.killerHero=lookup.get(event.killerPlayerId)?.heroName ?? null;
        event.victimHero=lookup.get(event.victimPlayerId)?.heroName ?? null;
        event.killerTeam=lookup.get(event.killerPlayerId)?.team ?? null;
        event.victimTeam=lookup.get(event.victimPlayerId)?.team ?? null;
        event.killerIdentityResolved=lookup.has(event.killerPlayerId);
        event.victimIdentityResolved=lookup.has(event.victimPlayerId);
      }
      if(event.counter)event.actorIsLocal=local?.playerId!=null?event.actorPlayerId===local.playerId:null;
      this.record(event);
    }
    if(this.seen.size>20000) this.seen=new Set([...this.seen].slice(-20000));
    if(this.previous && this.previous.mode===ctx.mode) {
      const oldByScope=new Map(this.previous.players.map(p=>[p.scope,p]));
      for(const row of rows) {
        const before=oldByScope.get(row.scope);if(!before) continue;
        for(const [metric,value] of Object.entries(row.metrics)) {
          const old=before.metrics[metric];if(value===null || old===null || old===value) continue;
          const event={...ctx,type:'PLAYER_METRIC_CHANGED',playerId:row.playerId,scope:row.scope,heroName:row.heroName,
            metric,previous:old,value,delta:value-old,sourceDetail:'gsi-counter'};
          records.push(event);this.record(event);
        }
      }
    }
    const inventory=ctx.mode==='player' && object(d.items)?Object.entries(d.items)
      .filter(([slot,item])=>/^(slot|stash|teleport|neutral)/.test(slot) && object(item))
      .map(([slot,item])=>({slot,name:item.name ?? null,charges:numberOrNull(item.charges),
        secondaryCharges:numberOrNull(item.secondary_charges),cooldown:numberOrNull(item.cooldown),
        inventoryObservation:true,purchasedQuantity:null,raw:item})):[];
    const liveEventMetrics=ctx.mode==='player' && local?.playerId!=null?{
      source:'deduplicated-gsi-direct-events',identitySource:localIdentity?.source ?? 'explicit-player-id',
      observedCounts:{...(this.session.playerEventCounters?.[local.playerId] ?? Object.fromEntries(EVENT_COUNTERS.map(k=>[k,0])))},
      coverage:'events-observed-by-this-collector',exactMatchTotals:false}:null;
    this.latest={...ctx,players:rows,localPlayer:local,localIdentity,liveEventMetrics,matchEventMetrics:ctx.mode==='player'?{
      source:'deduplicated-gsi-direct-events',observedCounts:{...(this.session.matchEventCounters||{roshanDeaths:0,aegisPickups:0})},
      coverage:'events-observed-by-this-collector',exactMatchTotals:false}:null,inventory,blocks:d,
      rivalries:Object.values(this.session.pairs),availableMetrics:local?Object.keys(local.metrics).filter(k=>local.metrics[k]!==null):[],
      missingMetrics:local?Object.keys(local.metrics).filter(k=>local.metrics[k]===null):Object.keys(METRICS)};
    this.previous={mode:ctx.mode,players:rows};
    // Persist direct-event dedup immediately; general snapshots at most once / 5s.
    if(direct.length || this.now()-this.lastFlush>=5000) this.flush();
    return {context:ctx,directEvents:direct,records,state:this.latest};
  }
  flush() {
    this.session.seen=[...this.seen];atomic(this.sessionFile,this.session);
    atomic(this.fieldsFile,this.fields);if(this.latest) atomic(this.stateFile,this.latest);
    this.lastFlush=this.now();
  }
  safeProcess(data) {
    try { return this.process(data); }
    catch(e) { this.errors++;this.lastError=String(e.message);return null; }
  }
  status() {
    return {schemaVersion:SCHEMA_VERSION,received:this.received,mode:this.latest?.mode ?? 'waiting',
      matchId:this.latest?.matchId ?? null,lastReceivedAt:this.latest?.receivedAt ?? null,
      capturedBlocks:Object.keys(this.fields.blocks),requestedBlocks:BLOCKS,
      blocksNotObserved:BLOCKS.filter(b=>!this.fields.blocks[b]),fieldPaths:Object.keys(this.fields.fields).length,
      availableMetrics:this.latest?.availableMetrics ?? [],missingMetrics:this.latest?.missingMetrics ?? Object.keys(METRICS),
      directEvents:this.directCount,rivalryPairs:Object.keys(this.session.pairs).length,
      localIdentity:this.latest?.localIdentity ?? null,liveEventMetrics:this.latest?.liveEventMetrics ?? null,
      rawCompressedBytes:this.rawTotal,rawLimitBytes:this.maxRawBytes,rawWritten:this.rawWritten,rawSkipped:this.rawSkipped,
      rawCapturePaused:this.rawSkipped>0 && this.rawTotal>=this.maxRawBytes-8*1024**2,
      errors:this.errors,lastError:this.lastError,externalRequestsAdded:0};
  }
  close() { if(!this.closed) {this.flush();this.closed=true;} }
}

module.exports={GsiCollector,BLOCKS,METRICS,sanitize,modeOf,metricsOf,rowsOf,clockOf,sourceEventClock};
