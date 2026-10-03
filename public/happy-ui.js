(()=>{
  const ITEM_BASE='https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/';
  const itemSlug={
    ITEM_AGHS:'ultimate_scepter',ITEM_AGHS_BY_35:'ultimate_scepter',ITEM_AGHS_BY_20:'ultimate_scepter',ITEM_BLINK:'blink',
    ITEM_VESSEL_BY_25:'spirit_vessel',ITEM_VESSEL_BY_20:'spirit_vessel',ITEM_URN_BY_10:'urn_of_shadows',ITEM_FORCE:'force_staff',
    ITEM_GLIMMER:'glimmer_cape',ITEM_EUL:'cyclone',ITEM_AETHER:'aether_lens',ITEM_DISTILLER:'essence_distiller',
    ITEM_SHEEPSTICK:'sheepstick',ITEM_ATOS:'rod_of_atos',ITEM_OCTARINE:'octarine_core',ITEM_MAGE_SLAYER:'mage_slayer',ITEM_LOTUS:'lotus_orb',
    BLINK:'blink',AGHS:'ultimate_scepter'
  };
  const eventGlyph={
    FIRST_BLOOD:['FB','red'],KIKE_WINS:['GG','gold'],GAME_END:['GG','gold'],RESPAWN:['↻','green'],LOW_HP_25:['HP','red'],LOW_HP_10:['HP!','red'],
    KILL_1:['K','red'],KILL_2:['K2','red'],KILL_3:['K3','red'],KILL_5:['K5','red'],DEATH_1:['D','red'],DEATH_2:['D2','red'],DEATH_3:['D3','red'],DEATH_5:['D5','red'],
    KILLS_5_BY_25:['K5','red'],KILLS_5_BY_15:['K5','red'],KILLS_6_BY_15:['K6','red'],KILLS_6_BY_10:['K6','red'],KILLS_3_IN_180:['K3','red'],KILLS_3_IN_90:['K3','red'],KILLS_3_IN_60:['K3','red'],KILL_STREAK_4_BY_20:['x4','red'],KILL_STREAK_5_BY_20:['x5','red'],KILL_STREAK_3:['x3','red'],KILL_STREAK_5:['x5','red'],
    KILLS_3_BEFORE_DEATHS_2:['K/D','red'],KILLS_5_BEFORE_DEATHS_3:['K/D','red'],ASSISTS_10_BEFORE_DEATHS_2:['A/D','green'],ASSISTS_15_BEFORE_DEATHS_3:['A/D','green'],ASSISTS_18_BEFORE_DEATHS_2:['A/D','green'],ASSISTS_20_BEFORE_DEATHS_2:['A/D','green'],
    ASSISTS_5:['A5','green'],ASSISTS_10:['A10','green'],ASSISTS_15:['A15','green'],ASSISTS_10_BY_25:['A10','green'],ASSISTS_10_BY_20:['A10','green'],ASSISTS_15_BY_35:['A15','green'],ASSISTS_15_BY_30:['A15','green'],ASSISTS_15_BY_25:['A15','green'],ASSISTS_15_BY_20:['A15','green'],ASSISTS_18_BY_35:['A18','green'],ASSISTS_20_BY_35:['A20','green'],
    LH_20_BY_15:['LH','gold'],LH_30_BY_15:['LH','gold'],LH_50_BY_15:['LH','gold'],LH_50_BY_20:['LH','gold'],LH_100_BY_30:['LH','gold'],LH_25:['LH','gold'],LH_50:['LH','gold'],LH_100:['LH','gold'],
    DENIES_2_BY_10:['DN','purple'],DENIES_3_BY_15:['DN','purple'],DENIES_4_BY_15:['DN','purple'],DENIES_5_BY_20:['DN','purple'],DENIES_5_BY_15:['DN','purple'],
    COMBO_3K_10A_BY_25:['K+A','gold'],COMBO_4K_10A_BY_25:['K+A','gold'],COMBO_5K_15A_BY_30:['K+A','gold'],COMBO_10A_50LH_BY_25:['A+LH','gold'],COMBO_15A_50LH_BY_30:['A+LH','gold'],COMBO_15A_75LH_BY_30:['A+LH','gold'],COMBO_15A_MAX3D_BY_30:['A/D','green'],
    PART_10_MAX3D_BY_20:['KP','green'],PART_15_MAX3D_BY_25:['KP','green'],PART_18_MAX2D_BY_25:['KP','green'],PART_20_MAX3D_BY_25:['KP','green'],SURVIVE_MAX1D_AT_15:['S','green'],SURVIVE_MAX1D_AT_20:['S','green'],SURVIVE_MAX1D_AT_30:['S','green'],SURVIVE_MAX1D_AT_35:['S','green'],SURVIVE_0D_AT_20:['0D','green'],SURVIVE_0D_AT_25:['0D','green'],
    DEATHS_3_BY_15:['D3','red'],DEATHS_5_BY_20:['D5','red'],DEATHS_6_BY_15:['D6','red'],LEVEL_3:['LV','gold'],LEVEL_6:['LV','gold'],LEVEL_10:['LV','gold'],LEVEL_15:['LV','gold'],SHARD:['SH','purple'],ANY_ITEM:['IT','blue'],ABILITY_CAST:['SK','blue'],ULT_CAST:['ULT','purple'],MIN_5:['5m','blue'],MIN_10:['10m','blue'],MIN_20:['20m','blue'],MIN_30:['30m','blue'],MIN_40:['40m','blue'],FREE:['★','gold']
  };
  function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
  function iconHTML(id,size='normal'){
    if(itemSlug[id]){
      const slug=itemSlug[id];
      const fallbacks={ultimate_scepter:'AGH',blink:'BLK',spirit_vessel:'VES',urn_of_shadows:'URN',force_staff:'FS',glimmer_cape:'GC',cyclone:'EUL',aether_lens:'AL',essence_distiller:'ED',sheepstick:'HEX',rod_of_atos:'ATOS',octarine_core:'OCT',mage_slayer:'MS',lotus_orb:'LOT'};
      const fallback=fallbacks[slug]||'IT';
      return `<span class="hg-dota-icon item ${size}" title="${esc(id)}"><img alt="" loading="lazy" src="${ITEM_BASE}${slug}_lg.png" onerror="this.parentElement.classList.add('error')"><span class="fallback">${fallback}</span></span>`;
    }
    const g=eventGlyph[id]||['DOT','blue'];
    return `<span class="hg-dota-icon event ${g[1]} ${size}"><span class="fallback">${g[0]}</span></span>`;
  }
  window.HGIcons={iconHTML,itemSlug};

  let ctx=null,enabled=localStorage.getItem('happyGamesSound')!=='off';
  function audio(){if(!ctx)ctx=new (window.AudioContext||window.webkitAudioContext)();if(ctx.state==='suspended')ctx.resume();return ctx}
  function osc(freq,dur,type='sine',gain=.04,delay=0){if(!enabled)return;const c=audio(),o=c.createOscillator(),g=c.createGain(),t=c.currentTime+delay;o.type=type;o.frequency.setValueAtTime(freq,t);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(gain,t+.012);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(g).connect(c.destination);o.start(t);o.stop(t+dur+.02)}
  function noise(dur=.16,gain=.035,delay=0){if(!enabled)return;const c=audio(),len=Math.max(1,Math.floor(c.sampleRate*dur)),buf=c.createBuffer(1,len,c.sampleRate),d=buf.getChannelData(0);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*(1-i/len);const s=c.createBufferSource(),g=c.createGain(),f=c.createBiquadFilter(),t=c.currentTime+delay;s.buffer=buf;f.type='highpass';f.frequency.value=1200;g.gain.setValueAtTime(gain,t);g.gain.exponentialRampToValueAtTime(.0001,t+dur);s.connect(f).connect(g).connect(c.destination);s.start(t)}
  function play(kind){if(!enabled)return;try{
    if(kind==='complete'){osc(520,.12,'square',.035);osc(760,.15,'triangle',.045,.07);noise(.12,.022,.02)}
    else if(kind==='rare'){osc(440,.12,'triangle',.035);osc(660,.15,'triangle',.045,.08);osc(980,.23,'sine',.05,.17);noise(.18,.02,.04)}
    else if(kind==='bingo'){noise(.24,.05);[392,523,659,784,1046].forEach((f,i)=>osc(f,.28,'triangle',.055,i*.075));osc(130,.5,'sawtooth',.025,.05)}
    else if(kind==='swap'){osc(330,.12,'square',.025);osc(495,.15,'square',.03,.10);osc(660,.17,'triangle',.035,.20)}
    else if(kind==='select'){osc(520,.10,'triangle',.03);osc(780,.16,'sine',.035,.06)}
    else if(kind==='click'){osc(250,.05,'square',.015)}
  }catch{}}
  function toggle(){enabled=!enabled;localStorage.setItem('happyGamesSound',enabled?'on':'off');if(enabled)play('select');return enabled}
  function prime(){if(enabled)try{audio()}catch{}}
  document.addEventListener('pointerdown',prime,{once:true});
  document.addEventListener('click',e=>{if(e.target.closest('button,.hg-btn'))play('click')});
  window.HGSound={play,toggle,isEnabled:()=>enabled,prime};
})();
