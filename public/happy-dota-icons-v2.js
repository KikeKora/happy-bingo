(()=>{
  const CDN='https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/';
  const ITEM_MAP={
    ITEM_AGHS:'ultimate_scepter',ITEM_AGHS_BY_35:'ultimate_scepter',ITEM_AGHS_BY_20:'ultimate_scepter',
    ITEM_BLINK:'blink',ITEM_VESSEL_BY_25:'spirit_vessel',ITEM_VESSEL_BY_20:'spirit_vessel',ITEM_URN_BY_10:'urn_of_shadows',
    ITEM_FORCE:'force_staff',ITEM_GLIMMER:'glimmer_cape',ITEM_EUL:'cyclone',ITEM_AETHER:'aether_lens',
    ITEM_DISTILLER:'essence_ring',ITEM_SHEEPSTICK:'sheepstick',ITEM_ATOS:'rod_of_atos',ITEM_OCTARINE:'octarine_core',
    ITEM_MAGE_SLAYER:'mage_slayer',ITEM_LOTUS:'lotus_orb',DUST_BY_15:'dust',SMOKE_BY_20:'smoke_of_deceit',BLINK:'blink',AGHS:'ultimate_scepter',SHARD:'aghanims_shard'
  };
  const ITEM_LABEL={
    ITEM_AGHS:'Aghanim',ITEM_AGHS_BY_35:'Aghanim',ITEM_AGHS_BY_20:'Aghanim',ITEM_BLINK:'Blink',ITEM_VESSEL_BY_25:'Vessel',ITEM_VESSEL_BY_20:'Vessel',ITEM_URN_BY_10:'Urn',ITEM_FORCE:'Force',ITEM_GLIMMER:'Glimmer',ITEM_EUL:'Eul',ITEM_AETHER:'Aether',ITEM_DISTILLER:'Essence',ITEM_SHEEPSTICK:'Hex',ITEM_ATOS:'Atos',ITEM_OCTARINE:'Octarine',ITEM_MAGE_SLAYER:'Mage Slayer',ITEM_LOTUS:'Lotus',DUST_BY_15:'Dust',SMOKE_BY_20:'Smoke',BLINK:'Blink',AGHS:'Aghanim',SHARD:'Shard'
  };
  const svg=(body,accent='#55d8ff')=>`<svg viewBox="0 0 64 64" aria-hidden="true"><g fill="none" stroke="${accent}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`;
  const SVGS={
    kill:()=>svg('<path d="M15 49L48 16M21 14l29 29M11 53l12-3-9-9-3 12z"/><path d="M44 11l9 9-5 5-9-9 5-5z"/>','#ff5e61'),
    streak:()=>svg('<path d="M32 56c-11 0-19-8-19-19 0-10 7-15 13-22 1 7 5 10 8 13 4-7 7-11 8-18 7 8 10 15 10 23 0 13-8 23-20 23z"/><path d="M27 47c-5-4-4-10 1-16 0 5 4 7 5 11 2-4 4-6 5-10 4 6 3 12-1 15"/>','#ff4b3d'),
    assist:()=>svg('<path d="M10 32h12l5-7 8 14 5-7h14"/><circle cx="20" cy="18" r="6"/><circle cx="44" cy="18" r="6"/><path d="M11 52c2-10 16-12 20-2M33 50c4-10 18-8 20 2"/>','#45ef9b'),
    lh:()=>svg('<circle cx="34" cy="35" r="18"/><path d="M34 23v24M27 29c4-5 15-4 15 2 0 7-15 4-15 11 0 6 11 7 16 2"/><path d="M12 50l11-11"/>','#ffd84a'),
    deny:()=>svg('<circle cx="32" cy="32" r="21"/><path d="M18 46l28-28"/><path d="M27 24c2-4 8-4 10 0M24 38c5 4 11 4 16 0"/>','#ff5674'),
    death:()=>svg('<path d="M21 52h22M23 52V26c0-11 18-11 18 0v26"/><path d="M27 31h10M32 26v10"/>','#b6c0cf'),
    survive:()=>svg('<path d="M32 8l20 8v14c0 13-7 22-20 27C19 52 12 43 12 30V16l20-8z"/><path d="M22 33l7 7 14-16"/>','#54d9ff'),
    combo:()=>svg('<path d="M12 46l16-16M36 22l16-16M16 12l36 36M13 51l8-2-6-6-2 8z"/><circle cx="21" cy="20" r="5"/><path d="M44 30v18M35 39h18"/>','#d8e8ff'),
    participation:()=>svg('<circle cx="21" cy="20" r="6"/><circle cx="43" cy="20" r="6"/><path d="M10 52c1-10 19-12 22 0M32 52c3-12 20-10 22 0"/><path d="M26 34h12M32 28v12"/>','#9f77ff'),
    firstblood:()=>svg('<path d="M32 7c8 12 15 20 15 30a15 15 0 1 1-30 0c0-10 7-18 15-30z"/>','#e33b3b'),
    ward:()=>svg('<path d="M7 32s9-15 25-15 25 15 25 15-9 15-25 15S7 32 7 32z"/><circle cx="32" cy="32" r="8"/>','#7d8cff'),
    time:()=>svg('<circle cx="32" cy="34" r="19"/><path d="M32 34V22M32 34l10 6M24 7h16"/>','#70dfff'),
    default:()=>svg('<path d="M18 18h28v28H18z"/><path d="M18 30h28M30 18v28"/>','#55d8ff')
  };
  function typeFor(id=''){
    if(ITEM_MAP[id]) return 'item';
    if(id==='FIRST_BLOOD') return 'firstblood';
    if(id.includes('WARD')) return 'ward';
    if(id.includes('SURVIVE')||id.includes('LOW_HP')) return 'survive';
    if(id.startsWith('DEATH')||id.startsWith('DEATHS')) return 'death';
    if(id.startsWith('DENIES')) return 'deny';
    if(id.startsWith('LH_')||id==='LH_25'||id==='LH_50'||id==='LH_100') return 'lh';
    if(id.startsWith('ASSISTS')) return 'assist';
    if(id.startsWith('PART_')) return 'participation';
    if(id.startsWith('COMBO_')) return 'combo';
    if(id.includes('STREAK')) return 'streak';
    if(id.startsWith('KILL')||id.startsWith('KILLS_')) return 'kill';
    if(id.startsWith('MIN_')||id.startsWith('MATCH_')||id.includes('_AT_')) return 'time';
    return 'default';
  }
  function iconHTML(id,size='normal'){
    if(id==='FREE') return `<span class="dotaRuleIcon freeIcon ${size==='mini'?'mini':''}" aria-hidden="true"><span>★</span></span>`;
    const item=ITEM_MAP[id];
    if(item){
      const label=ITEM_LABEL[id]||'Item';
      return `<span class="dotaRuleIcon dotaItemIcon ${size==='mini'?'mini':''}" title="${label}"><img src="${CDN}${item}.png" alt="${label}" loading="lazy" onerror="if(!this.dataset.tried){this.dataset.tried='1';this.src='https://cdn.cloudflare.steamstatic.com/apps/dota2/images/items/${item}_lg.png'}else{this.parentElement.classList.add('broken')}"><span class="itemFallback">${label.slice(0,3).toUpperCase()}</span></span>`;
    }
    const type=typeFor(id); const markup=(SVGS[type]||SVGS.default)();
    return `<span class="dotaRuleIcon eventIcon ${type} ${size==='mini'?'mini':''}">${markup}</span>`;
  }
  window.HappyDotaIcons={iconHTML,typeFor,ITEM_MAP};
  if(window.HGIcons) window.HGIcons.iconHTML=iconHTML;
})();
