const MAX_PARTICIPANTS = 200;
const FULL_CHOICE_CUTOFF_SECONDS = 120;
const BLIND_MULTIPLIER = 1.5;
const STRATEGIST_MULTIPLIER = 1.0;
const SPRINT_BINGO_BONUS = 60;
const FULL_BINGO_BONUS = 250;
const LINE_BONUS_BASE = 50;
const PREDICTION_BONUS = 100;
const PREDICTION_PENALTY = 100;
const MAX_SWAPS_PER_ROUND = 2;
const SWAP_WINDOW_SECONDS = 90;
const SWAP_WARNING_SECONDS = 300;
const SWAP_MINUTE_CHOICES = [12,14,16,18];
const OVERLAY_MIN_GAP_MS = 18000;
const OVERLAY_IDLE_REMINDER_MS = 180000;
const OVERLAY_GROUP_WINDOW_MS = 2200;
const OVERLAY_NAME_LIMIT = 2;

// Happy Bingo v5 — balance calibrado con 57 partidas completas de Kike jugando support.
// v4.2 evita tarjetas narrativamente contradictorias (muchas muertes vs supervivencia)
// y balancea la dificultad de las 12 lineas posibles, no solo la tarjeta completa.
// La telemetria sigue acumulandose para poder recalibrar estas probabilidades despues.
// Heart of Tarrasque SI cuenta para analizar aquella partida, pero NUNCA es una regla del Bingo.
const RULE_POOL = [
  // COMBATE: siempre con tiempo, ventana o racha. Nada de "consigue X kills" a secas.
  { id:"KILLS_5_BY_25", label:"5 kills antes del min 25", points:10, difficulty:"common", category:"combat", series:"kills_timed", observedRate:0.50 },
  { id:"KILLS_5_BY_15", label:"5 kills antes del min 15", points:20, difficulty:"medium", category:"combat", series:"kills_timed", observedRate:0.42 },
  { id:"KILLS_6_BY_15", label:"6 kills antes del min 15", points:35, difficulty:"hard", category:"combat", series:"kills_early", observedRate:0.25 },
  { id:"KILLS_6_BY_10", label:"6 kills antes del min 10", points:50, difficulty:"rare", category:"combat", series:"kills_early", observedRate:0.08 },
  { id:"KILLS_3_IN_180", label:"3 kills en 3 minutos", points:10, difficulty:"common", category:"combat", series:"kill_window", observedRate:0.50 },
  { id:"KILLS_3_IN_90", label:"3 kills en 90 segundos", points:35, difficulty:"hard", category:"combat", series:"kill_window", observedRate:0.25 },
  { id:"KILLS_3_IN_60", label:"3 kills en 60 segundos", points:50, difficulty:"rare", category:"combat", series:"kill_window", observedRate:0.08 },
  { id:"KILL_STREAK_4_BY_20", label:"Racha de 4 kills antes del min 20", points:20, difficulty:"medium", category:"combat", series:"kill_streak_timed", observedRate:0.33 },
  { id:"KILL_STREAK_5_BY_20", label:"Racha de 5 kills antes del min 20", points:35, difficulty:"hard", category:"combat", series:"kill_streak_timed", observedRate:0.25 },
  // Beta 2: reglas adicionales sobre variables ya verificadas. Sus tasas son provisionales
  // y se recalibraran con las siguientes exportaciones de research/analytics.
  { id:"KILLS_4_BY_20", label:"4 kills antes del min 20", points:10, difficulty:"common", category:"combat", series:"kills_timed_beta2", observedRate:0.58, provisional:true },
  { id:"KILLS_4_BY_15", label:"4 kills antes del min 15", points:20, difficulty:"medium", category:"combat", series:"kills_timed_beta2", observedRate:0.42, provisional:true },
  { id:"KILLS_7_BY_25", label:"7 kills antes del min 25", points:35, difficulty:"hard", category:"combat", series:"kills_timed_beta2", observedRate:0.25, provisional:true },
  { id:"KILL_STREAK_3_BY_15", label:"Racha de 3 kills antes del min 15", points:10, difficulty:"common", category:"combat", series:"kill_streak_timed", observedRate:0.50, provisional:true },

  // KDA: mezcla kills/assists con supervivencia. Los porcentajes salen del orden real de los eventos.
  { id:"KILLS_3_BEFORE_DEATHS_2", label:"3 kills antes de morir 2 veces", points:10, difficulty:"common", category:"kda", series:"kda_kills", observedRate:0.58 },
  { id:"KILLS_5_BEFORE_DEATHS_3", label:"5 kills antes de morir 3 veces", points:20, difficulty:"medium", category:"kda", series:"kda_kills", observedRate:0.42 },
  { id:"ASSISTS_10_BEFORE_DEATHS_2", label:"10 assists antes de 2 muertes", points:10, difficulty:"common", category:"kda", series:"kda_assists", observedRate:0.50 },
  { id:"ASSISTS_15_BEFORE_DEATHS_3", label:"15 assists antes de 3 muertes", points:20, difficulty:"medium", category:"kda", series:"kda_assists", observedRate:0.33 },
  { id:"ASSISTS_18_BEFORE_DEATHS_2", label:"18 assists antes de 2 muertes", points:35, difficulty:"hard", category:"kda", series:"kda_assists", observedRate:0.17 },
  { id:"ASSISTS_20_BEFORE_DEATHS_2", label:"20 assists antes de 2 muertes", points:50, difficulty:"rare", category:"kda", series:"kda_assists", observedRate:0.08 },

  // SUPPORT: assists ligados a tiempo.
  { id:"ASSISTS_10_BY_25", label:"10 assists antes del min 25", points:10, difficulty:"common", category:"support", series:"assists_10", observedRate:0.58 },
  { id:"ASSISTS_10_BY_20", label:"10 assists antes del min 20", points:20, difficulty:"medium", category:"support", series:"assists_10", observedRate:0.33 },
  { id:"ASSISTS_15_BY_35", label:"15 assists antes del min 35", points:10, difficulty:"common", category:"support", series:"assists_15", observedRate:0.50 },
  { id:"ASSISTS_15_BY_30", label:"15 assists antes del min 30", points:20, difficulty:"medium", category:"support", series:"assists_15", observedRate:0.42 },
  { id:"ASSISTS_15_BY_25", label:"15 assists antes del min 25", points:35, difficulty:"hard", category:"support", series:"assists_15", observedRate:0.17 },
  { id:"ASSISTS_15_BY_20", label:"15 assists antes del min 20", points:50, difficulty:"rare", category:"support", series:"assists_15", observedRate:0.08 },
  { id:"ASSISTS_18_BY_35", label:"18 assists antes del min 35", points:20, difficulty:"medium", category:"support", series:"assists_high", observedRate:0.33 },
  { id:"ASSISTS_20_BY_35", label:"20 assists antes del min 35", points:35, difficulty:"hard", category:"support", series:"assists_high", observedRate:0.25 },
  { id:"ASSISTS_8_BY_20", label:"8 assists antes del min 20", points:10, difficulty:"common", category:"support", series:"assists_beta2_low", observedRate:0.58, provisional:true },
  { id:"ASSISTS_12_BY_25", label:"12 assists antes del min 25", points:20, difficulty:"medium", category:"support", series:"assists_beta2_mid", observedRate:0.42, provisional:true },
  { id:"ASSISTS_18_BY_30", label:"18 assists antes del min 30", points:35, difficulty:"hard", category:"support", series:"assists_beta2_high", observedRate:0.25, provisional:true },

  // FARM: last hits y denies con limite de tiempo para que la duracion no los regale.
  { id:"LH_20_BY_15", label:"20 last hits antes del min 15", points:10, difficulty:"common", category:"farm", series:"lh_early", observedRate:0.58 },
  { id:"LH_50_BY_20", label:"50 last hits antes del min 20", points:20, difficulty:"medium", category:"farm", series:"lh_mid", observedRate:0.33 },
  { id:"LH_100_BY_30", label:"100 last hits antes del min 30", points:20, difficulty:"medium", category:"farm", series:"lh_late", observedRate:0.33 },
  { id:"LH_30_BY_15", label:"30 last hits antes del min 15", points:35, difficulty:"hard", category:"farm", series:"lh_early", observedRate:0.17 },
  { id:"LH_50_BY_15", label:"50 last hits antes del min 15", points:50, difficulty:"rare", category:"farm", series:"lh_early", observedRate:0.08 },
  { id:"DENIES_2_BY_10", label:"2 denies antes del min 10", points:20, difficulty:"medium", category:"farm", series:"denies_low", observedRate:0.42 },
  { id:"DENIES_3_BY_15", label:"3 denies antes del min 15", points:20, difficulty:"medium", category:"farm", series:"denies_low", observedRate:0.33 },
  { id:"DENIES_4_BY_15", label:"4 denies antes del min 15", points:35, difficulty:"hard", category:"farm", series:"denies_high", observedRate:0.25 },
  { id:"DENIES_5_BY_20", label:"5 denies antes del min 20", points:35, difficulty:"hard", category:"farm", series:"denies_high", observedRate:0.17 },
  { id:"DENIES_5_BY_15", label:"5 denies antes del min 15", points:50, difficulty:"rare", category:"farm", series:"denies_high", observedRate:0.08 },
  { id:"LH_35_BY_20", label:"35 last hits antes del min 20", points:10, difficulty:"common", category:"farm", series:"lh_beta2", observedRate:0.50, provisional:true },
  { id:"LH_60_BY_25", label:"60 last hits antes del min 25", points:20, difficulty:"medium", category:"farm", series:"lh_beta2", observedRate:0.33, provisional:true },
  { id:"LH_75_BY_30", label:"75 last hits antes del min 30", points:35, difficulty:"hard", category:"farm", series:"lh_beta2", observedRate:0.25, provisional:true },
  { id:"DENIES_2_BY_15", label:"2 denies antes del min 15", points:10, difficulty:"common", category:"farm", series:"denies_beta2", observedRate:0.50, provisional:true },

  // COMBOS: variedad sin introducir variables nuevas.
  { id:"COMBO_3K_10A_BY_25", label:"3 kills + 10 assists antes del min 25", points:10, difficulty:"common", category:"combo", series:"combo_ka", observedRate:0.50 },
  { id:"COMBO_4K_10A_BY_25", label:"4 kills + 10 assists antes del min 25", points:35, difficulty:"hard", category:"combo", series:"combo_ka", observedRate:0.25 },
  { id:"COMBO_5K_15A_BY_30", label:"5 kills + 15 assists antes del min 30", points:50, difficulty:"rare", category:"combo", series:"combo_ka", observedRate:0.08 },
  { id:"COMBO_10A_50LH_BY_25", label:"10 assists + 50 LH antes del min 25", points:20, difficulty:"medium", category:"combo", series:"combo_afarm", observedRate:0.33 },
  { id:"COMBO_15A_50LH_BY_30", label:"15 assists + 50 LH antes del min 30", points:20, difficulty:"medium", category:"combo", series:"combo_afarm", observedRate:0.33 },
  { id:"COMBO_15A_75LH_BY_30", label:"15 assists + 75 LH antes del min 30", points:35, difficulty:"hard", category:"combo", series:"combo_afarm", observedRate:0.25 },
  { id:"COMBO_15A_MAX3D_BY_30", label:"15 assists y max. 3 muertes antes del min 30", points:20, difficulty:"medium", category:"combo", series:"combo_survival", observedRate:0.33 },
  { id:"COMBO_2K_8A_BY_20", label:"2 kills + 8 assists antes del min 20", points:10, difficulty:"common", category:"combo", series:"combo_ka_beta2", observedRate:0.50, provisional:true },
  { id:"COMBO_3K_12A_BY_25", label:"3 kills + 12 assists antes del min 25", points:20, difficulty:"medium", category:"combo", series:"combo_ka_beta2", observedRate:0.33, provisional:true },

  // PARTICIPACION: Kills + assists con limite de muertes. Usa solo variables ya registradas.
  { id:"PART_10_MAX3D_BY_20", label:"10 participaciones y max. 3 muertes antes del min 20", points:10, difficulty:"common", category:"participation", series:"participation", observedRate:0.50 },
  { id:"PART_15_MAX3D_BY_25", label:"15 participaciones y max. 3 muertes antes del min 25", points:20, difficulty:"medium", category:"participation", series:"participation", observedRate:0.42 },
  { id:"PART_18_MAX2D_BY_25", label:"18 participaciones y max. 2 muertes antes del min 25", points:35, difficulty:"hard", category:"participation", series:"participation", observedRate:0.25 },
  { id:"PART_20_MAX3D_BY_25", label:"20 participaciones y max. 3 muertes antes del min 25", points:35, difficulty:"hard", category:"participation", series:"participation", observedRate:0.25 },
  { id:"PART_12_MAX4D_BY_20", label:"12 participaciones y max. 4 muertes antes del min 20", points:10, difficulty:"common", category:"participation", series:"participation_beta2", observedRate:0.50, provisional:true },

  // SUPERVIVENCIA: llegar a un minuto concreto con pocas muertes.
  { id:"SURVIVE_MAX1D_AT_15", label:"Max. 1 muerte al min 15", points:10, difficulty:"common", category:"survival", series:"survival", observedRate:0.58 },
  { id:"SURVIVE_MAX1D_AT_20", label:"Max. 1 muerte al min 20", points:10, difficulty:"common", category:"survival", series:"survival", observedRate:0.50 },
  { id:"SURVIVE_MAX1D_AT_30", label:"Max. 1 muerte al min 30", points:20, difficulty:"medium", category:"survival", series:"survival", observedRate:0.42 },
  { id:"SURVIVE_MAX1D_AT_35", label:"Max. 1 muerte al min 35", points:20, difficulty:"medium", category:"survival", series:"survival", observedRate:0.33 },
  { id:"SURVIVE_0D_AT_20", label:"Sin morir hasta el min 20", points:35, difficulty:"hard", category:"survival", series:"survival", observedRate:0.17 },
  { id:"SURVIVE_0D_AT_25", label:"Sin morir hasta el min 25", points:50, difficulty:"rare", category:"survival", series:"survival", observedRate:0.08 },
  { id:"SURVIVE_MAX2D_AT_20", label:"Max. 2 muertes al min 20", points:10, difficulty:"common", category:"survival", series:"survival_beta2", observedRate:0.58, provisional:true },
  { id:"SURVIVE_MAX2D_AT_25", label:"Max. 2 muertes al min 25", points:20, difficulty:"medium", category:"survival", series:"survival_beta2", observedRate:0.42, provisional:true },

  // ITEMS: solo objetos que SI aparecieron en tus 12 partidas completas. Heart se excluye a proposito.
  { id:"ITEM_AGHS", label:"Kike compra Aghanim's Scepter", points:20, difficulty:"medium", category:"items", series:"item_aghs", observedRate:0.423 },
  { id:"ITEM_AGHS_BY_35", label:"Aghanim antes del min 35", points:20, difficulty:"medium", category:"items", series:"item_aghs", observedRate:0.269 },
  { id:"ITEM_AGHS_BY_20", label:"Aghanim antes del min 20", points:50, difficulty:"rare", category:"items", series:"item_aghs", observedRate:0.038 },
  { id:"ITEM_BLINK", label:"Kike compra Blink Dagger", points:20, difficulty:"medium", category:"items", series:"item_blink", observedRate:0.385 },
  { id:"ITEM_VESSEL_BY_25", label:"Spirit Vessel antes del min 25", points:35, difficulty:"hard", category:"items", series:"item_vessel", observedRate:0.154 },
  { id:"ITEM_URN_BY_10", label:"Urn antes del min 10", points:20, difficulty:"medium", category:"items", series:"item_urn", observedRate:0.385 },
  { id:"ITEM_FORCE", label:"Kike compra Force Staff", points:35, difficulty:"hard", category:"items", series:"item_force", observedRate:0.115 },
  { id:"ITEM_GLIMMER", label:"Kike compra Glimmer Cape", points:35, difficulty:"hard", category:"items", series:"item_glimmer", observedRate:0.154 },
  { id:"ITEM_EUL", label:"Kike compra Eul's Scepter", points:35, difficulty:"hard", category:"items", series:"item_eul", observedRate:0.154 },
  { id:"ITEM_AETHER", label:"Kike compra Aether Lens", points:35, difficulty:"hard", category:"items", series:"item_aether", observedRate:0.192 },
  { id:"ITEM_DISTILLER", label:"Kike compra Essence Distiller", points:35, difficulty:"hard", category:"items", series:"item_distiller", observedRate:0.154 },
  { id:"ITEM_SHEEPSTICK", label:"Kike compra Scythe of Vyse", points:50, difficulty:"rare", category:"items", series:"item_sheepstick", observedRate:0.077 },
  { id:"ITEM_ATOS", label:"Kike compra Rod of Atos", points:35, difficulty:"hard", category:"items", series:"item_atos", observedRate:0.231 },
  { id:"ITEM_OCTARINE", label:"Kike compra Octarine Core", points:50, difficulty:"rare", category:"items", series:"item_octarine", observedRate:0.077 },
  { id:"ITEM_MAGE_SLAYER", label:"Kike compra Mage Slayer", points:35, difficulty:"hard", category:"items", series:"item_mage_slayer", observedRate:0.192 },
  { id:"ITEM_LOTUS", label:"Kike compra Lotus Orb", points:35, difficulty:"hard", category:"items", series:"item_lotus", observedRate:0.115 },
  { id:"ITEM_VESSEL_BY_20", label:"Spirit Vessel antes del min 20", points:50, difficulty:"rare", category:"items", series:"item_vessel", observedRate:0.038 },
  { id:"ITEM_SHIVAS", label:"Kike compra Shiva's Guard", points:50, difficulty:"rare", category:"items", series:"item_shivas", observedRate:0.038, provisional:true },
  { id:"ITEM_ARCANE_BLINK", label:"Kike compra Arcane Blink", points:50, difficulty:"rare", category:"items", series:"item_arcane_blink", observedRate:0.038, provisional:true },

  // MUERTES: maximo una por tarjeta; son eventos graciosos, no el centro del Bingo.
  { id:"DEATHS_3_BY_15", label:"3 muertes antes del min 15", points:35, difficulty:"hard", category:"deaths", series:"deaths", observedRate:0.25 },
  { id:"DEATHS_4_BY_20", label:"4 muertes antes del min 20", points:20, difficulty:"medium", category:"deaths", series:"deaths", observedRate:0.33, provisional:true },
  { id:"DEATHS_5_BY_20", label:"5 muertes antes del min 20", points:35, difficulty:"hard", category:"deaths", series:"deaths", observedRate:0.25 },
  { id:"DEATHS_6_BY_15", label:"6 muertes antes del min 15", points:50, difficulty:"rare", category:"deaths", series:"deaths", observedRate:0.08 }
  ,

  // v5: variedad medible fuera del bloque de combate/KDA. Las tasas salen de
  // 57 partidas validas; las reglas de HP se seguiran recalibrando con GSI.
  { id:"LEVEL_20_TOTAL", label:"Kike alcanza el nivel 20 durante la partida", points:10, difficulty:"common", category:"progress", series:"level_total", observedRate:0.649 },
  { id:"KILLS_5_TOTAL", label:"Kike consigue 5 kills durante la partida", points:10, difficulty:"common", category:"combat", series:"kills_total", observedRate:0.649 },
  { id:"ASSISTS_15_TOTAL", label:"Kike consigue 15 assists durante la partida", points:10, difficulty:"common", category:"support", series:"assists_total", observedRate:0.754 },
  { id:"PART_20_TOTAL", label:"Kike participa en 20 kills durante la partida", points:20, difficulty:"medium", category:"participation", series:"participation_total", observedRate:0.842 },
  { id:"COMBO_3K_12A_TOTAL", label:"Kike termina con al menos 3 kills y 12 assists", points:20, difficulty:"medium", category:"combo", series:"combo_total", observedRate:0.825 },
  { id:"FINISH_MAX5D", label:"Kike termina con máximo 5 muertes", points:20, difficulty:"medium", category:"survival", series:"survival_final", observedRate:0.491 },
  { id:"LH_75_TOTAL", label:"Kike consigue 75 last hits durante la partida", points:10, difficulty:"common", category:"farm", series:"last_hits_total", observedRate:0.737 },
  { id:"DENIES_5_TOTAL", label:"Kike consigue 5 denies durante la partida", points:20, difficulty:"medium", category:"farm", series:"denies_total", observedRate:0.105 },

  { id:"MATCH_ENDS_BEFORE_35", label:"La partida termina antes del minuto 35", points:35, difficulty:"hard", category:"tempo", series:"match_duration", observedRate:0.158 },
  { id:"MATCH_ENDS_BEFORE_40", label:"La partida termina antes del minuto 40", points:10, difficulty:"common", category:"tempo", series:"match_duration", observedRate:0.491 },
  { id:"MATCH_LASTS_40", label:"La partida dura al menos 40 minutos", points:20, difficulty:"medium", category:"tempo", series:"match_duration", observedRate:0.509 },
  { id:"MATCH_LASTS_45", label:"La partida dura al menos 45 minutos", points:35, difficulty:"hard", category:"tempo", series:"match_duration", observedRate:0.263 },
  { id:"MATCH_80_KILLS_TOTAL", label:"La partida termina con 80 kills totales", points:20, difficulty:"medium", category:"pace", series:"match_kills", observedRate:0.333 },

  { id:"LEVEL_6_BY_10", label:"Kike llega a nivel 6 antes del min 10", points:20, difficulty:"medium", category:"progress", series:"level_timing", observedRate:0.561 },
  { id:"LEVEL_12_BY_20", label:"Kike llega a nivel 12 antes del min 20", points:35, difficulty:"hard", category:"progress", series:"level_timing", observedRate:0.316 },
  { id:"GPM_250_AT_15", label:"Kike tiene al menos 250 GPM al minuto 15", points:10, difficulty:"common", category:"economy", series:"gpm_timing", observedRate:0.526 },
  { id:"GPM_300_AT_20", label:"Kike tiene al menos 300 GPM al minuto 20", points:20, difficulty:"medium", category:"economy", series:"gpm_timing", observedRate:0.439 },
  { id:"GPM_350_AT_25", label:"Kike tiene al menos 350 GPM al minuto 25", points:35, difficulty:"hard", category:"economy", series:"gpm_timing", observedRate:0.263 },
  { id:"XPM_300_AT_15", label:"Kike tiene al menos 300 XPM al minuto 15", points:10, difficulty:"common", category:"experience", series:"xpm_timing", observedRate:0.649 },
  { id:"XPM_400_AT_20", label:"Kike tiene al menos 400 XPM al minuto 20", points:20, difficulty:"medium", category:"experience", series:"xpm_timing", observedRate:0.351 },
  { id:"XPM_500_AT_25", label:"Kike tiene al menos 500 XPM al minuto 25", points:35, difficulty:"hard", category:"experience", series:"xpm_timing", observedRate:0.211 },
  { id:"GOLD_1500_BY_20", label:"Kike junta 1,500 de oro antes del min 20", points:20, difficulty:"medium", category:"liquidity", series:"gold_timing", observedRate:0.351 },
  { id:"GOLD_2000_BY_25", label:"Kike junta 2,000 de oro antes del min 25", points:20, difficulty:"medium", category:"liquidity", series:"gold_timing", observedRate:0.439 },
  { id:"GOLD_3000_TOTAL", label:"Kike llega a tener 3,000 de oro", points:10, difficulty:"common", category:"liquidity", series:"gold_total", observedRate:0.456 },

  { id:"DOUBLE_KILL_15S", label:"Kike consigue 2 kills en 15 segundos", points:10, difficulty:"common", category:"multikill", series:"multikill_window", observedRate:0.421 },
  { id:"TRIPLE_KILL_30S", label:"Kike consigue 3 kills en 30 segundos", points:50, difficulty:"rare", category:"multikill", series:"multikill_window", observedRate:0.088 },
  { id:"RAMPAGE_WINDOW_30S", label:"Kike consigue 5 kills en 30 segundos", points:50, difficulty:"rare", category:"multikill", series:"multikill_window", observedRate:0.035 },
  { id:"FIRST_BLOOD_BY_3", label:"Hay First Blood antes del minuto 3", points:10, difficulty:"common", category:"events", series:"first_blood", observedRate:0.30, provisional:true },
  { id:"DUST_BY_15", label:"Kike compra Dust antes del minuto 15", points:50, difficulty:"rare", category:"vision", series:"support_purchase", observedRate:0.088 },
  { id:"SMOKE_BY_20", label:"Kike compra Smoke antes del minuto 20", points:10, difficulty:"common", category:"utility", series:"support_purchase", observedRate:0.509 },
  { id:"LOW_HP_15_FOR_15S", label:"Kike permanece bajo 15% de HP durante 15 segundos", points:35, difficulty:"hard", category:"risk", series:"low_hp_duration", observedRate:0.30, provisional:true },
  { id:"RECOVER_HP_IN_2M", label:"Kike se recupera de 25% a 75% de HP en 2 minutos", points:20, difficulty:"medium", category:"recovery", series:"hp_recovery", observedRate:0.825 },
  { id:"TEAM_40_KILLS_TOTAL", label:"El equipo de Kike termina con 40 kills", points:10, difficulty:"common", category:"team", series:"team_kills", observedRate:0.596 },
  { id:"TEAM_50_KILLS_TOTAL", label:"El equipo de Kike termina con 50 kills", points:35, difficulty:"hard", category:"team", series:"team_kills", observedRate:0.140 },
  { id:"ALIVE_AT_END", label:"Kike está vivo cuando termina la partida", points:10, difficulty:"common", category:"ending", series:"ending_state", observedRate:0.825 }
];

// Compatibilidad con tarjetas viejas hasta que el host inicie una nueva ronda.
const LEGACY_RULES = [
  ["FIRST_BLOOD","Hay First Blood",30],["KILL_1","Kike consigue 1 kill",10],["KILL_2","Kike consigue 2 kills",20],["KILL_3","Kike consigue 3 kills",30],["KILL_5","Kike consigue 5 kills",50],
  ["DEATH_1","Kike muere",10],["DEATH_2","Kike muere 2 veces",20],["DEATH_3","Kike muere 3 veces",30],["DEATH_5","Kike muere 5 veces",50],["RESPAWN","Kike revive",10],
  ["LOW_HP_25","Kike baja de 25% HP",25],["LOW_HP_10","Kike baja de 10% HP",50],["LEVEL_3","Kike llega a nivel 3",10],["LEVEL_6","Kike llega a nivel 6",15],["LEVEL_10","Kike llega a nivel 10",20],["LEVEL_15","Kike llega a nivel 15",30],
  ["BLINK","Kike consigue Blink",35],["AGHS","Kike consigue Aghanim",35],["SHARD","Kike consigue Shard",30],["ANY_ITEM","Kike compra un item",10],["ABILITY_CAST","Kike usa una habilidad",10],["ULT_CAST","Kike usa la ulti",20],
  ["KILL_STREAK_3","Racha de 3 kills",60],["KILL_STREAK_5","Racha de 5 kills",100],["ASSISTS_5","Kike llega a 5 assists",20],["ASSISTS_10","Kike llega a 10 assists",30],["ASSISTS_15","Kike llega a 15 assists",40],
  ["LH_25","Kike llega a 25 LH",15],["LH_50","Kike llega a 50 LH",20],["LH_100","Kike llega a 100 LH",35],["MIN_5","La partida llega a 5 min",10],["MIN_10","La partida llega a 10 min",10],["MIN_20","La partida llega a 20 min",15],["MIN_30","La partida llega a 30 min",20],["MIN_40","La partida llega a 40 min",30],["GAME_END","Termina la partida",15],["KIKE_WINS","Kike gana la partida",60]
].map(([id,label,points])=>({id,label,points,difficulty:"legacy",category:"legacy",series:id}));

RULE_POOL.push(...[
  {
    "id": "OBS_WARDS_8",
    "label": "Kike compra 8 Observer Wards",
    "category": "vision",
    "series": "live_vision",
    "counter": "observerWardsPurchased",
    "threshold": 8,
    "points": 10,
    "difficulty": "common",
    "observedRate": 0.8,
    "provisional": true,
    "evidenceMatches": 5,
    "liveCounterScope": "local"
  },
  {
    "id": "OBS_WARDS_12",
    "label": "Kike compra 12 Observer Wards",
    "category": "vision",
    "series": "live_vision",
    "counter": "observerWardsPurchased",
    "threshold": 12,
    "points": 20,
    "difficulty": "medium",
    "observedRate": 0.4,
    "provisional": true,
    "evidenceMatches": 5,
    "liveCounterScope": "local"
  },
  {
    "id": "SENTRY_WARDS_15",
    "label": "Kike compra 15 Sentry Wards",
    "category": "vision",
    "series": "live_vision",
    "counter": "sentryWardsPurchased",
    "threshold": 15,
    "points": 10,
    "difficulty": "common",
    "observedRate": 0.8,
    "provisional": true,
    "evidenceMatches": 5,
    "liveCounterScope": "local"
  },
  {
    "id": "SENTRY_WARDS_18",
    "label": "Kike compra 18 Sentry Wards",
    "category": "vision",
    "series": "live_vision",
    "counter": "sentryWardsPurchased",
    "threshold": 18,
    "points": 20,
    "difficulty": "medium",
    "observedRate": 0.4,
    "provisional": true,
    "evidenceMatches": 5,
    "liveCounterScope": "local"
  },
  {
    "id": "DEWARD_OBS_3",
    "label": "Kike destruye 3 Observer Wards enemigas",
    "category": "deward",
    "series": "live_deward",
    "counter": "observerWardsDestroyed",
    "threshold": 3,
    "points": 20,
    "difficulty": "medium",
    "observedRate": 0.4,
    "provisional": true,
    "evidenceMatches": 5,
    "liveCounterScope": "local"
  },
  {
    "id": "DEWARD_SENTRY_4",
    "label": "Kike destruye 4 Sentry Wards enemigas",
    "category": "deward",
    "series": "live_deward",
    "counter": "sentryWardsDestroyed",
    "threshold": 4,
    "points": 10,
    "difficulty": "common",
    "observedRate": 0.8,
    "provisional": true,
    "evidenceMatches": 5,
    "liveCounterScope": "local"
  },
  {
    "id": "DEWARD_TOTAL_6",
    "label": "Kike destruye 6 wards enemigas en total",
    "category": "deward",
    "series": "live_deward",
    "counter": "wardsDestroyedTotal",
    "threshold": 6,
    "points": 20,
    "difficulty": "medium",
    "observedRate": 0.6,
    "provisional": true,
    "evidenceMatches": 5,
    "liveCounterScope": "local"
  },
  {
    "id": "SMOKE_USE_2",
    "label": "Kike activa Smoke 2 veces",
    "category": "utility",
    "series": "live_utility",
    "counter": "smokeActivations",
    "threshold": 2,
    "points": 10,
    "difficulty": "common",
    "observedRate": 0.8,
    "provisional": true,
    "evidenceMatches": 5,
    "liveCounterScope": "local"
  },
  {
    "id": "SMOKE_USE_3",
    "label": "Kike activa Smoke 3 veces",
    "category": "utility",
    "series": "live_utility",
    "counter": "smokeActivations",
    "threshold": 3,
    "points": 20,
    "difficulty": "medium",
    "observedRate": 0.6,
    "provisional": true,
    "evidenceMatches": 5,
    "liveCounterScope": "local"
  },
  {
    "id": "BOUNTY_2",
    "label": "Kike recoge 2 runas bounty",
    "category": "exploration",
    "series": "live_exploration",
    "counter": "bountyRunesPickedUp",
    "threshold": 2,
    "points": 10,
    "difficulty": "common",
    "observedRate": 0.6,
    "provisional": true,
    "evidenceMatches": 5,
    "liveCounterScope": "local"
  },
  {
    "id": "BOUNTY_4",
    "label": "Kike recoge 4 runas bounty",
    "category": "exploration",
    "series": "live_exploration",
    "counter": "bountyRunesPickedUp",
    "threshold": 4,
    "points": 20,
    "difficulty": "medium",
    "observedRate": 0.4,
    "provisional": true,
    "evidenceMatches": 5,
    "liveCounterScope": "local"
  },
  {
    "id": "ROSHAN_1",
    "label": "Roshan cae una vez, a manos de cualquier equipo",
    "category": "objectives",
    "series": "live_objectives",
    "counter": "roshanDeaths",
    "threshold": 1,
    "points": 10,
    "difficulty": "common",
    "observedRate": 0.8,
    "provisional": true,
    "evidenceMatches": 5,
    "liveCounterScope": "match"
  },
  {
    "id": "ROSHAN_2",
    "label": "Roshan cae 2 veces, a manos de cualquier equipo",
    "category": "objectives",
    "series": "live_objectives",
    "counter": "roshanDeaths",
    "threshold": 2,
    "points": 20,
    "difficulty": "medium",
    "observedRate": 0.6,
    "provisional": true,
    "evidenceMatches": 5,
    "liveCounterScope": "match"
  },
  {
    "id": "AEGIS_2",
    "label": "Se recogen 2 Aegis durante la partida",
    "category": "objectives",
    "series": "live_objectives",
    "counter": "aegisPickups",
    "threshold": 2,
    "points": 20,
    "difficulty": "medium",
    "observedRate": 0.6,
    "provisional": true,
    "evidenceMatches": 5,
    "liveCounterScope": "match"
  },
  {
    "id": "BUYBACK_1",
    "label": "Kike usa buyback durante la partida",
    "category": "ending",
    "series": "live_ending",
    "counter": "buybacks",
    "threshold": 1,
    "points": 35,
    "difficulty": "hard",
    "observedRate": 0.2,
    "provisional": true,
    "evidenceMatches": 5,
    "liveCounterScope": "local"
  }
]);

const RULE_MAP = Object.fromEntries([...LEGACY_RULES, ...RULE_POOL].map(r => [r.id, r]));
RULE_MAP.FREE = { id:"FREE", label:"HAPPY BINGO", points:0, difficulty:"free" };

const BINGO_LINES = [
  [0,1,2,3,4],[5,6,7,8,9],[10,11,12,13,14],[15,16,17,18,19],[20,21,22,23,24],
  [0,5,10,15,20],[1,6,11,16,21],[2,7,12,17,22],[3,8,13,18,23],[4,9,14,19,24],
  [0,6,12,18,24],[4,8,12,16,20]
];
const SPRINT_LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
function chooseSwapMinute(){ return SWAP_MINUTE_CHOICES[Math.floor(Math.random()*SWAP_MINUTE_CHOICES.length)]; }
function phaseForMeta(meta){
  if(meta.gameStatus==='finished') return 'finished';
  const c=Number(meta.gameClock);
  if(!Number.isFinite(c)) return 'pregame';
  return c<=FULL_CHOICE_CUTOFF_SECONDS?'full':'sprint';
}
function sprintMultiplier(clock){
  clock=Number(clock)||0;
  if(clock<=600) return 0.70;
  if(clock<=1500) return 0.45;
  if(clock<=2400) return 0.25;
  return 0.10;
}
function awardPoints(base,multiplier){ return Math.max(1,Math.round(Number(base||0)*Number(multiplier||1))); }
function ruleDeadlineSeconds(rule){
  const m=String(rule?.id||'').match(/_(?:BY|AT)_(\d+)$/); return m?Number(m[1])*60:null;
}
function ruleFeasibleForLate(rule,meta){
  if(['DUST_BY_15','SMOKE_BY_20'].includes(rule.id))return false;
  if(rule.counter){
    const st=meta.currentStats||{};
    const m=rule.liveCounterScope==='match'?st.matchEventMetrics:st.liveEventMetrics;
    if(m?.source!=='deduplicated-gsi-direct-events')return false;
    if(matchesRule(rule.id,{telemetrySource:'dota-gsi',telemetryMode:'player',liveEventMetrics:st.liveEventMetrics,matchEventMetrics:st.matchEventMetrics}))return false;
  }
  const occurred=new Set(meta.completedRuleIds||[]); if(occurred.has(rule.id)) return false;
  const clock=Number(meta.gameClock)||0; const deadline=ruleDeadlineSeconds(rule); if(deadline!=null&&clock>=deadline) return false;
  const st=meta.currentStats||{}; const d=Number(st.deaths||0);
  if(rule.id.includes('BEFORE_DEATHS_2')&&d>=2) return false;
  if(rule.id.includes('BEFORE_DEATHS_3')&&d>=3) return false;
  if(rule.id.includes('MAX4D')&&d>4) return false;
  if(rule.id.includes('MAX3D')&&d>3) return false;
  if(rule.id.includes('MAX2D')&&d>2) return false;
  if(rule.id.startsWith('SURVIVE_MAX1D')&&d>1) return false;
  if(rule.id.startsWith('SURVIVE_0D')&&d>0) return false;
  return true;
}
function generateSprintCard(meta){
  const candidates=shuffle(RULE_POOL.filter(r=>ruleFeasibleForLate(r,meta)));
  const picked=[]; const cats=new Map(); const series=new Set();
  for(const r of candidates){
    if(picked.length>=8) break;
    if(series.has(r.series)) continue;
    if((cats.get(r.category)||0)>=2) continue;
    if(!compatibleRule(r,picked)) continue;
    picked.push(r); series.add(r.series); cats.set(r.category,(cats.get(r.category)||0)+1);
  }
  if(picked.length<8){
    for(const r of candidates){ if(picked.length>=8) break; if(picked.some(x=>x.id===r.id)||!compatibleRule(r,picked)) continue; picked.push(r); }
  }
  if(picked.length<8) throw new Error('No hay suficientes reglas futuras para Happy Sprint.');
  const ids=shuffle(picked.map(r=>r.id)); ids.splice(4,0,'FREE'); return ids;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"} });
}
function unauthorized(){ return json({error:"No autorizado."},401); }
function bearer(request){ const value=request.headers.get("authorization")||""; return value.startsWith("Bearer ")?value.slice(7):""; }
function shuffle(a){ a=[...a]; for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; }


// -----------------------------------------------------------------------------
// Happy Games Core v1: identidad persistente + Happy Points (beta) en Cloudflare D1.
// El nombre visible NO es la identidad. El dispositivo se vincula a un userId unico,
// y un codigo de recuperacion permite recuperar el mismo Happy ID en otro navegador.
// Los puntos de una ronda se mantienen en el Durable Object durante la partida y se
// consolidan a D1 al recibir GAME_FINISHED o al crear una nueva ronda. Esto reduce
// drasticamente las escrituras sin sacrificar el estado en vivo.
// -----------------------------------------------------------------------------
function cleanDeviceId(value){ return String(value||"").trim().slice(0,80); }
function cleanDisplayName(value){ return (String(value||"Jugador").trim().slice(0,32)||"Jugador"); }
function normalizeRecoveryCode(value){ return String(value||"").toUpperCase().replace(/[^A-Z0-9]/g,""); }
function nowIso(){ return new Date().toISOString(); }

async function sha256Hex(value){
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,"0")).join("");
}

function makeRecoveryCode(){
  const alphabet="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes=new Uint8Array(12); crypto.getRandomValues(bytes);
  let raw=""; for(const b of bytes) raw+=alphabet[b%alphabet.length];
  return "HAPPY-"+raw.slice(0,4)+"-"+raw.slice(4,8)+"-"+raw.slice(8,12);
}

function publicUser(row){
  if(!row) return null;
  return {
    userId: row.id,
    displayName: row.display_name,
    totalPoints: Number(row.total_points||0),
    lifetimePoints: Number(row.lifetime_points||0),
    gamesPlayed: Number(row.games_played||0),
    bingos: Number(row.bingos||0),
    currentStreak: Number(row.current_streak||0),
    bestStreak: Number(row.best_streak||0),
    lastStreakRound: row.last_streak_round==null?null:Number(row.last_streak_round),
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at
  };
}

async function userByDevice(db, deviceId){
  if(!db || !deviceId) return null;
  return db.prepare(`
    SELECT u.* FROM happy_devices d
    JOIN happy_users u ON u.id=d.user_id
    WHERE d.device_id=? LIMIT 1
  `).bind(deviceId).first();
}

async function ensureHappyIdentity(db, deviceId, displayName, legacyPoints=0){
  if(!db) throw new Error("HAPPY_DB no esta configurada.");
  deviceId=cleanDeviceId(deviceId); displayName=cleanDisplayName(displayName);
  if(!deviceId) throw new Error("Falta clientId.");

  let existing=await userByDevice(db,deviceId);
  if(existing){
    const ts=nowIso();
    await db.batch([
      db.prepare("UPDATE happy_users SET display_name=?, updated_at=?, last_seen_at=? WHERE id=?")
        .bind(displayName,ts,ts,existing.id),
      db.prepare("UPDATE happy_devices SET last_seen_at=? WHERE device_id=?").bind(ts,deviceId)
    ]);
    existing.display_name=displayName; existing.updated_at=ts; existing.last_seen_at=ts;
    return { user:existing, created:false, recoveryCode:null };
  }

  const userId=crypto.randomUUID();
  const recoveryCode=makeRecoveryCode();
  const recoveryHash=await sha256Hex(normalizeRecoveryCode(recoveryCode));
  const ts=nowIso();
  const imported=Math.max(0,Number(legacyPoints||0));
  const statements=[
    db.prepare(`INSERT INTO happy_users
      (id,display_name,recovery_hash,total_points,lifetime_points,games_played,bingos,created_at,updated_at,last_seen_at)
      VALUES (?,?,?,?,?,0,0,?,?,?)`)
      .bind(userId,displayName,recoveryHash,imported,imported,ts,ts,ts),
    db.prepare(`INSERT INTO happy_devices (device_id,user_id,created_at,last_seen_at)
      VALUES (?,?,?,?)`).bind(deviceId,userId,ts,ts)
  ];
  if(imported>0){
    statements.push(db.prepare(`INSERT INTO happy_point_ledger
      (id,user_id,delta,reason,source_game,source_round,bingo,details_json,applied,created_at)
      VALUES (?,?,?,?,?,?,?,?,1,?)`)
      .bind(crypto.randomUUID(),userId,imported,"legacy_import","happy_bingo","legacy",0,
        JSON.stringify({note:"Importado del perfil local/DO anterior a Happy ID"}),ts));
  }
  await db.batch(statements);
  return {
    user:{id:userId,display_name:displayName,total_points:imported,lifetime_points:imported,games_played:0,bingos:0,current_streak:0,best_streak:0,last_streak_round:null,last_streak_serial:null,created_at:ts,last_seen_at:ts},
    created:true,
    recoveryCode
  };
}

async function recoverHappyIdentity(db, deviceId, code){
  if(!db) throw new Error("HAPPY_DB no esta configurada.");
  deviceId=cleanDeviceId(deviceId);
  const normalized=normalizeRecoveryCode(code);
  if(!deviceId || normalized.length<8) return null;
  const hash=await sha256Hex(normalized);
  const user=await db.prepare("SELECT * FROM happy_users WHERE recovery_hash=? LIMIT 1").bind(hash).first();
  if(!user) return null;
  const ts=nowIso();
  await db.batch([
    db.prepare(`INSERT INTO happy_devices (device_id,user_id,created_at,last_seen_at)
      VALUES (?,?,?,?) ON CONFLICT(device_id) DO UPDATE SET user_id=excluded.user_id,last_seen_at=excluded.last_seen_at`)
      .bind(deviceId,user.id,ts,ts),
    db.prepare("UPDATE happy_users SET last_seen_at=?,updated_at=? WHERE id=?").bind(ts,ts,user.id)
  ]);
  user.last_seen_at=ts;
  return user;
}

async function rotateRecoveryCode(db, userId){
  const code=makeRecoveryCode();
  const hash=await sha256Hex(normalizeRecoveryCode(code));
  const ts=nowIso();
  await db.prepare("UPDATE happy_users SET recovery_hash=?,updated_at=? WHERE id=?").bind(hash,ts,userId).run();
  return code;
}

async function profileBundle(db, userId){
  const user=await db.prepare("SELECT * FROM happy_users WHERE id=? LIMIT 1").bind(userId).first();
  if(!user) return null;
  const recent=await db.prepare(`SELECT delta,reason,source_game,source_round,bingo,created_at
    FROM happy_point_ledger WHERE user_id=? AND applied=1
    ORDER BY created_at DESC LIMIT 20`).bind(userId).all();
  const rank=await db.prepare("SELECT 1 + COUNT(*) AS rank FROM happy_users WHERE total_points > ?")
    .bind(Number(user.total_points||0)).first();
  return { user:publicUser(user), rank:Number(rank?.rank||1), recent:recent.results||[] };
}

async function leaderboard(db, limit=20){
  limit=Math.max(1,Math.min(100,Number(limit||20)));
  const r=await db.prepare(`SELECT id,display_name,total_points,lifetime_points,games_played,bingos
    FROM happy_users ORDER BY total_points DESC,lifetime_points DESC,created_at ASC LIMIT ?`).bind(limit).all();
  return (r.results||[]).map((x,i)=>({
    rank:i+1,userId:x.id,displayName:x.display_name,totalPoints:Number(x.total_points||0),
    lifetimePoints:Number(x.lifetime_points||0),gamesPlayed:Number(x.games_played||0),bingos:Number(x.bingos||0)
  }));
}

function streakMilestone(n){
  n=Number(n||0);
  if([2,3,5,10].includes(n)) return n;
  if(n>10 && n%10===0) return n;
  return null;
}

async function streakRowsForUsers(db,userIds){
  const ids=[...new Set((userIds||[]).filter(Boolean))];
  const out=new Map();
  for(let i=0;i<ids.length;i+=80){
    const chunk=ids.slice(i,i+80);
    const placeholders=chunk.map(()=>'?').join(',');
    const r=await db.prepare(`SELECT id,current_streak,best_streak,last_streak_round,last_streak_serial
      FROM happy_users WHERE id IN (${placeholders})`).bind(...chunk).all();
    for(const row of (r.results||[])){
      const current=Number(row.current_streak||0),best=Number(row.best_streak||0);
      out.set(row.id,{current,best,lastRound:row.last_streak_round==null?null:Number(row.last_streak_round),lastSerial:row.last_streak_serial==null?null:Number(row.last_streak_serial),milestone:streakMilestone(current)});
    }
  }
  return out;
}

async function flushRoundToD1(db, participants, meta, finalizeReason="round_flush"){
  if(!db || !participants?.size) return {ok:true,players:0,analyticsPlayers:0};
  const ts=nowIso();
  const sourceRound=String(meta?.round ?? "unknown");
  const gameClock=Number.isFinite(Number(meta?.gameClock))?Number(meta.gameClock):null;
  const rows=[...participants.values()].filter(p=>p?.userId).map(p=>({
    id:crypto.randomUUID(),userId:p.userId,delta:Number(p.roundPoints||0),bingo:p.bingo?1:0,
    details:JSON.stringify({card:p.card,completed:p.completed,bingo:!!p.bingo,joinedAt:p.joinedAt,mode:p.mode,cardKind:p.cardKind,multiplier:p.multiplier,swapUsed:!!p.swapUsed,swapCount:Number(p.swapCount||0),completedLines:p.completedLines||[],prediction:p.prediction,predictionCorrect:p.predictionCorrect,predictionPoints:Number(p.predictionPoints||0),cardMaxOverlapAtJoin:Number(p.cardMaxOverlapAtJoin||0),roundAwards:Array.isArray(p.roundAwards)?p.roundAwards:[]})
  }));
  if(!rows.length) return {ok:true,players:0,analyticsPlayers:0};

  const statements=[];
  // 10 jugadores por INSERT = 90 parametros, por debajo del limite de 100 de D1.
  for(let i=0;i<rows.length;i+=10){
    const chunk=rows.slice(i,i+10);
    const placeholders=chunk.map(()=>"(?,?,?,?,?,?,?,?,0,?)").join(",");
    const params=[];
    for(const r of chunk){
      params.push(r.id,r.userId,r.delta,"round_result","happy_bingo",sourceRound,r.bingo,r.details,ts);
    }
    statements.push(db.prepare(`INSERT OR IGNORE INTO happy_point_ledger
      (id,user_id,delta,reason,source_game,source_round,bingo,details_json,applied,created_at)
      VALUES ${placeholders}`).bind(...params));
  }

  statements.push(db.prepare(`UPDATE happy_users SET
    total_points = total_points + COALESCE((SELECT SUM(l.delta) FROM happy_point_ledger l WHERE l.user_id=happy_users.id AND l.source_game='happy_bingo' AND l.source_round=? AND l.applied=0),0),
    lifetime_points = lifetime_points + COALESCE((SELECT SUM(CASE WHEN l.delta>0 THEN l.delta ELSE 0 END) FROM happy_point_ledger l WHERE l.user_id=happy_users.id AND l.source_game='happy_bingo' AND l.source_round=? AND l.applied=0),0),
    games_played = games_played + COALESCE((SELECT COUNT(*) FROM happy_point_ledger l WHERE l.user_id=happy_users.id AND l.source_game='happy_bingo' AND l.source_round=? AND l.applied=0),0),
    bingos = bingos + COALESCE((SELECT SUM(l.bingo) FROM happy_point_ledger l WHERE l.user_id=happy_users.id AND l.source_game='happy_bingo' AND l.source_round=? AND l.applied=0),0),
    updated_at=?
    WHERE id IN (SELECT user_id FROM happy_point_ledger WHERE source_game='happy_bingo' AND source_round=? AND applied=0)`)
    .bind(sourceRound,sourceRound,sourceRound,sourceRound,ts,sourceRound));

  // Rachas: solo cuentan rondas realmente terminadas y jugadores que ya tenian tarjeta activa.
  // El serial avanza por GAME_FINISHED, no por numero administrativo de ronda; una ronda vacia/abortada no rompe rachas.
  if(finalizeReason==='game_finished'){
    const serial=Number(meta?.completedRoundSerial||0), roundNo=Number(meta?.round||0);
    const eligible=[...participants.values()].filter(p=>p?.userId&&p.status==='active'&&Array.isArray(p.card)).map(p=>p.userId);
    if(serial>0&&eligible.length){
      for(let i=0;i<eligible.length;i+=50){
        const chunk=eligible.slice(i,i+50), placeholders=chunk.map(()=>'?').join(',');
        const prev=serial-1;
        const streakExpr=`CASE WHEN last_streak_serial=? THEN COALESCE(current_streak,0)+1 ELSE 1 END`;
        statements.push(db.prepare(`UPDATE happy_users SET
          best_streak=MAX(COALESCE(best_streak,0),${streakExpr}),
          current_streak=${streakExpr},
          last_streak_round=?,last_streak_serial=?,streak_updated_at=?,updated_at=?
          WHERE id IN (${placeholders}) AND (last_streak_serial IS NULL OR last_streak_serial<>?)`)
          .bind(prev,prev,roundNo,serial,ts,ts,...chunk,serial));
      }
    }
  }

  statements.push(db.prepare("UPDATE happy_point_ledger SET applied=1 WHERE source_game='happy_bingo' AND source_round=? AND applied=0").bind(sourceRound));

  await db.batch(statements);

  // Analytics es intencionalmente fail-soft: nunca bloquea Happy Points ni una nueva ronda.
  let analyticsPlayers=0, analyticsError=null;
  try{
    analyticsPlayers=await writeAnalyticsSessions(db,participants,meta,finalizeReason,ts,gameClock);
  }catch(err){ analyticsError=String(err?.message||err); }
  return {ok:true,players:rows.length,analyticsPlayers,analyticsError};
}

function approxActiveSeconds(p, gameClock){
  const first=Number.isFinite(Number(p.joinClock))?Number(p.joinClock):null;
  const last=Number.isFinite(Number(p.lastActiveClock))?Number(p.lastActiveClock):gameClock;
  if(first==null || last==null) return null;
  return Math.max(0,Math.round(last-first));
}

async function writeAnalyticsSessions(db, participants, meta, finalizeReason, finalizedAt, gameClock){
  const sourceRound=String(meta?.round ?? "unknown");
  const all=[...participants.values()].filter(p=>p?.userId);
  if(!all.length) return 0;
  const rows=all.map(p=>({
    id:crypto.randomUUID(), userId:p.userId, displayName:cleanDisplayName(p.name),
    sourceGame:'happy_bingo', roundId:sourceRound,
    roundStartedAt:meta?.startedAt||null, joinedAt:p.joinedAt||null,
    joinClock:Number.isFinite(Number(p.joinClock))?Number(p.joinClock):null,
    mode:p.mode||'unknown', cardKind:p.cardKind||'unknown', multiplier:Number(p.multiplier||1),
    strategistOption:Number.isInteger(p.selectedOption)?p.selectedOption:null,
    selectionDelay:Number.isFinite(Number(p.selectionDelaySeconds))?Number(p.selectionDelaySeconds):null,
    autoSelected:p.autoSelected?1:0, swapUsed:p.swapUsed?1:0, swapCount:Number(p.swapCount||(p.swapUsed?1:0)),
    completedCells:(p.completed||[]).filter(x=>x!=='FREE').length, completedLines:(p.completedLines||[]).length,
    bingo:p.bingo?1:0, roundPoints:Number(p.roundPoints||0), predictionChoice:p.prediction||null, predictionCorrect:p.predictionCorrect==null?null:(p.predictionCorrect?1:0), predictionPoints:Number(p.predictionPoints||0), cardMaxOverlap:Number(p.cardMaxOverlapAtJoin||0),
    connectionCount:Number(p.connectionCount||0),
    activeSecondsApprox:approxActiveSeconds(p,gameClock),
    lastActiveClock:Number.isFinite(Number(p.lastActiveClock))?Number(p.lastActiveClock):gameClock,
    finalGameClock:gameClock, finalizeReason:String(finalizeReason||'round_flush'),
    createdAt:finalizedAt
  }));
  let stored=0;
  // 3 filas x 30 columnas = 90 parametros, por debajo del limite de 100 de D1.
  for(let i=0;i<rows.length;i+=3){
    const chunk=rows.slice(i,i+3);
    const placeholders=chunk.map(()=>`(${Array(30).fill('?').join(',')})`).join(',');
    const params=[];
    for(const r of chunk){
      params.push(r.id,r.userId,r.displayName,r.sourceGame,r.roundId,r.roundStartedAt,r.joinedAt,r.joinClock,r.mode,r.cardKind,r.multiplier,r.strategistOption,r.selectionDelay,r.autoSelected,r.swapUsed,r.swapCount,r.completedCells,r.completedLines,r.bingo,r.roundPoints,r.predictionChoice,r.predictionCorrect,r.predictionPoints,r.cardMaxOverlap,r.connectionCount,r.activeSecondsApprox,r.lastActiveClock,r.finalGameClock,r.finalizeReason,r.createdAt);
    }
    await db.prepare(`INSERT OR IGNORE INTO happy_game_sessions
      (id,user_id,display_name_snapshot,source_game,round_id,round_started_at,joined_at,join_clock,mode,card_kind,multiplier,strategist_option,selection_delay_seconds,auto_selected,swap_used,swap_count,completed_cells,lines_completed,bingo,round_points,prediction_choice,prediction_correct,prediction_points,max_card_overlap,connection_count,active_seconds_approx,last_active_clock,final_game_clock,finalize_reason,created_at)
      VALUES ${placeholders}`).bind(...params).run();
    stored+=chunk.length;
  }
  return stored;
}

function analyticsDays(value){
  const n=Number(value); return Number.isFinite(n)&&n>0?Math.min(3650,Math.round(n)):30;
}
function sinceIso(days){ return new Date(Date.now()-days*86400000).toISOString(); }

async function analyticsSummary(db, days=30){
  days=analyticsDays(days); const since=sinceIso(days);
  const [totals,modes,joins,daily,strategist] = await Promise.all([
    db.prepare(`SELECT COUNT(*) sessions, COUNT(DISTINCT user_id) unique_players, COUNT(DISTINCT round_id) rounds,
      COALESCE(AVG(round_points),0) avg_points, COALESCE(AVG(completed_cells),0) avg_completed,
      COALESCE(AVG(CASE WHEN bingo=1 THEN 1.0 ELSE 0 END),0) bingo_rate,
      COALESCE(AVG(CASE WHEN swap_used=1 THEN 1.0 ELSE 0 END),0) swap_rate,
      COALESCE(AVG(swap_count),0) avg_swap_count, COALESCE(AVG(lines_completed),0) avg_lines,
      COALESCE(AVG(CASE WHEN prediction_choice IS NOT NULL THEN 1.0 ELSE 0 END),0) prediction_rate,
      COALESCE(AVG(CASE WHEN prediction_choice IS NOT NULL THEN prediction_correct*1.0 END),0) prediction_accuracy,
      COALESCE(AVG(max_card_overlap),0) avg_max_overlap,
      COALESCE(AVG(active_seconds_approx),0) avg_active_seconds
      FROM happy_game_sessions WHERE created_at>=?`).bind(since).first(),
    db.prepare(`SELECT mode,COUNT(*) sessions,COUNT(DISTINCT user_id) players,ROUND(AVG(round_points),1) avg_points,
      SUM(bingo) bingos,ROUND(AVG(completed_cells),1) avg_completed
      FROM happy_game_sessions WHERE created_at>=? GROUP BY mode ORDER BY sessions DESC`).bind(since).all(),
    db.prepare(`SELECT CASE
        WHEN join_clock IS NULL OR join_clock<=120 THEN 'inicio'
        WHEN join_clock<=600 THEN '2-10'
        WHEN join_clock<=1500 THEN '10-25'
        WHEN join_clock<=2400 THEN '25-40'
        ELSE '40+'
      END bucket,COUNT(*) sessions,ROUND(AVG(round_points),1) avg_points,SUM(bingo) bingos
      FROM happy_game_sessions WHERE created_at>=? GROUP BY bucket`).bind(since).all(),
    db.prepare(`SELECT substr(created_at,1,10) day,COUNT(*) sessions,COUNT(DISTINCT user_id) players,
      SUM(round_points) points,SUM(bingo) bingos
      FROM happy_game_sessions WHERE created_at>=? GROUP BY day ORDER BY day DESC LIMIT 30`).bind(since).all(),
    db.prepare(`SELECT COUNT(*) sessions,ROUND(AVG(selection_delay_seconds),1) avg_selection_seconds,
      COALESCE(AVG(CASE WHEN auto_selected=1 THEN 1.0 ELSE 0 END),0) auto_select_rate,
      SUM(CASE WHEN strategist_option=0 THEN 1 ELSE 0 END) option_1,
      SUM(CASE WHEN strategist_option=1 THEN 1 ELSE 0 END) option_2,
      SUM(CASE WHEN strategist_option=2 THEN 1 ELSE 0 END) option_3,
      SUM(CASE WHEN strategist_option=3 THEN 1 ELSE 0 END) option_4
      FROM happy_game_sessions WHERE created_at>=? AND mode='strategist'`).bind(since).first()
  ]);
  const repeat=await db.prepare(`SELECT COUNT(*) repeat_players FROM (
      SELECT user_id FROM happy_game_sessions WHERE created_at>=? GROUP BY user_id HAVING COUNT(*)>=2
    )`).bind(since).first();
  const unique=Number(totals?.unique_players||0);
  return {
    days,since,
    totals:{
      sessions:Number(totals?.sessions||0),uniquePlayers:unique,rounds:Number(totals?.rounds||0),
      avgPoints:Number(totals?.avg_points||0),avgCompleted:Number(totals?.avg_completed||0),
      bingoRate:Number(totals?.bingo_rate||0),swapRate:Number(totals?.swap_rate||0),
      avgSwapCount:Number(totals?.avg_swap_count||0),avgLines:Number(totals?.avg_lines||0),predictionRate:Number(totals?.prediction_rate||0),predictionAccuracy:Number(totals?.prediction_accuracy||0),avgMaxOverlap:Number(totals?.avg_max_overlap||0),
      avgActiveSeconds:Number(totals?.avg_active_seconds||0),repeatPlayers:Number(repeat?.repeat_players||0),
      repeatRate:unique?Number(repeat?.repeat_players||0)/unique:0
    },
    modes:(modes.results||[]).map(x=>({mode:x.mode,sessions:Number(x.sessions||0),players:Number(x.players||0),avgPoints:Number(x.avg_points||0),bingos:Number(x.bingos||0),avgCompleted:Number(x.avg_completed||0)})),
    joinBuckets:(joins.results||[]).map(x=>({bucket:x.bucket,sessions:Number(x.sessions||0),avgPoints:Number(x.avg_points||0),bingos:Number(x.bingos||0)})),
    strategist:{sessions:Number(strategist?.sessions||0),avgSelectionSeconds:Number(strategist?.avg_selection_seconds||0),autoSelectRate:Number(strategist?.auto_select_rate||0),option1:Number(strategist?.option_1||0),option2:Number(strategist?.option_2||0),option3:Number(strategist?.option_3||0),option4:Number(strategist?.option_4||0)},
    daily:(daily.results||[]).map(x=>({day:x.day,sessions:Number(x.sessions||0),players:Number(x.players||0),points:Number(x.points||0),bingos:Number(x.bingos||0)}))
  };
}


function analyticsJoinBucket(clock){
  const c=Number(clock);
  if(!Number.isFinite(c)||c<=120) return 'inicio';
  if(c<=600) return '2-10';
  if(c<=1500) return '10-25';
  if(c<=2400) return '25-40';
  return '40+';
}
function analyticsMedian(values){
  const a=values.map(Number).filter(Number.isFinite).sort((x,y)=>x-y);
  if(!a.length) return 0;
  const m=Math.floor(a.length/2);
  return a.length%2?a[m]:(a[m-1]+a[m])/2;
}
function analyticsRoundNumber(value){
  const n=Number(value); return Number.isFinite(n)?n:null;
}
function normalizeRoundSummary(x){
  const predictions=Number(x.predictions||0),correct=Number(x.prediction_correct||0);
  return {
    roundId:String(x.round_id??''),sourceGame:x.source_game||'happy_bingo',closedAt:x.closed_at||null,roundStartedAt:x.round_started_at||null,
    players:Number(x.players||0),sessions:Number(x.sessions||0),
    modes:{blind:Number(x.blind||0),strategist:Number(x.strategist||0),sprint:Number(x.sprint||0)},
    bingos:Number(x.bingos||0),lines:Number(x.lines||0),swaps:Number(x.swaps||0),
    avgPoints:Number(x.avg_points||0),maxPoints:Number(x.max_points||0),avgCompleted:Number(x.avg_completed||0),
    predictions, predictionCorrect:correct,predictionAccuracy:predictions?correct/predictions:0,
    avgOverlap:Number(x.avg_overlap||0),maxOverlap:Number(x.max_overlap||0),
    durationSeconds:Number(x.final_game_clock||0),autoSelected:Number(x.auto_selected||0)
  };
}
async function analyticsRounds(db, days=30, limit=30, sourceGame='happy_bingo'){
  days=analyticsDays(days);const since=sinceIso(days);limit=Math.max(1,Math.min(100,Math.round(Number(limit)||30)));sourceGame=String(sourceGame||'happy_bingo');
  const r=await db.prepare(`SELECT source_game,round_id,MIN(round_started_at) round_started_at,MAX(created_at) closed_at,
      COUNT(*) sessions,COUNT(DISTINCT user_id) players,
      SUM(CASE WHEN mode='blind' THEN 1 ELSE 0 END) blind,
      SUM(CASE WHEN mode='strategist' THEN 1 ELSE 0 END) strategist,
      SUM(CASE WHEN mode='sprint' THEN 1 ELSE 0 END) sprint,
      COALESCE(SUM(bingo),0) bingos,COALESCE(SUM(lines_completed),0) lines,COALESCE(SUM(swap_count),0) swaps,
      ROUND(COALESCE(AVG(round_points),0),1) avg_points,COALESCE(MAX(round_points),0) max_points,
      ROUND(COALESCE(AVG(completed_cells),0),1) avg_completed,
      SUM(CASE WHEN prediction_choice IS NOT NULL THEN 1 ELSE 0 END) predictions,
      SUM(CASE WHEN prediction_correct=1 THEN 1 ELSE 0 END) prediction_correct,
      ROUND(COALESCE(AVG(max_card_overlap),0),1) avg_overlap,COALESCE(MAX(max_card_overlap),0) max_overlap,
      COALESCE(MAX(final_game_clock),0) final_game_clock,
      SUM(CASE WHEN auto_selected=1 THEN 1 ELSE 0 END) auto_selected
    FROM happy_game_sessions
    WHERE created_at>=? AND source_game=?
    GROUP BY source_game,round_id
    ORDER BY MAX(created_at) DESC
    LIMIT ?`).bind(since,sourceGame,limit).all();
  return {days,since,sourceGame,rounds:(r.results||[]).map(normalizeRoundSummary)};
}
async function analyticsRoundDetail(db, roundId, sourceGame='happy_bingo'){
  roundId=String(roundId??'').trim();sourceGame=String(sourceGame||'happy_bingo');
  if(!roundId) return null;
  const r=await db.prepare(`SELECT id,user_id,display_name_snapshot,source_game,round_id,round_started_at,joined_at,join_clock,
      mode,card_kind,multiplier,strategist_option,selection_delay_seconds,auto_selected,swap_used,swap_count,
      completed_cells,lines_completed,bingo,round_points,prediction_choice,prediction_correct,prediction_points,max_card_overlap,
      connection_count,active_seconds_approx,last_active_clock,final_game_clock,finalize_reason,created_at
    FROM happy_game_sessions
    WHERE source_game=? AND round_id=?
    ORDER BY round_points DESC,bingo DESC,lines_completed DESC,completed_cells DESC,display_name_snapshot ASC`).bind(sourceGame,roundId).all();
  const rows=r.results||[]; if(!rows.length) return null;
  const ranking=rows.map((x,i)=>({
    rank:i+1,userId:x.user_id,name:x.display_name_snapshot||'Jugador',mode:x.mode||'unknown',cardKind:x.card_kind||'unknown',multiplier:Number(x.multiplier||1),
    joinClock:x.join_clock==null?null:Number(x.join_clock),points:Number(x.round_points||0),completedCells:Number(x.completed_cells||0),lines:Number(x.lines_completed||0),bingo:!!Number(x.bingo||0),
    swaps:Number(x.swap_count||0),predictionChoice:x.prediction_choice||null,predictionCorrect:x.prediction_correct==null?null:!!Number(x.prediction_correct),predictionPoints:Number(x.prediction_points||0),
    maxOverlap:Number(x.max_card_overlap||0),strategistOption:x.strategist_option==null?null:Number(x.strategist_option),autoSelected:!!Number(x.auto_selected||0),selectionDelaySeconds:x.selection_delay_seconds==null?null:Number(x.selection_delay_seconds),
    activeSeconds:x.active_seconds_approx==null?null:Number(x.active_seconds_approx),connections:Number(x.connection_count||0)
  }));
  const points=ranking.map(x=>x.points),players=ranking.length,totalPoints=points.reduce((a,b)=>a+b,0);
  const modeMap={};const joinMap={};const lineDist={'0':0,'1':0,'2':0,'3+':0};const swapDist={'0':0,'1':0,'2':0,'3+':0};
  const pointDist={'<0':0,'0-99':0,'100-199':0,'200-299':0,'300-499':0,'500+':0};
  let bingos=0,totalLines=0,totalSwaps=0,predUsed=0,predCorrect=0,overlapSum=0,overlapMax=0;
  for(const x of ranking){
    const m=x.mode||'unknown';if(!modeMap[m])modeMap[m]={mode:m,players:0,points:0,bingos:0,lines:0};modeMap[m].players++;modeMap[m].points+=x.points;modeMap[m].bingos+=x.bingo?1:0;modeMap[m].lines+=x.lines;
    const jb=analyticsJoinBucket(x.joinClock);if(!joinMap[jb])joinMap[jb]={bucket:jb,players:0,points:0,bingos:0};joinMap[jb].players++;joinMap[jb].points+=x.points;joinMap[jb].bingos+=x.bingo?1:0;
    lineDist[x.lines>=3?'3+':String(Math.max(0,x.lines))]++;
    swapDist[x.swaps>=3?'3+':String(Math.max(0,x.swaps))]++;
    if(x.points<0)pointDist['<0']++;else if(x.points<100)pointDist['0-99']++;else if(x.points<200)pointDist['100-199']++;else if(x.points<300)pointDist['200-299']++;else if(x.points<500)pointDist['300-499']++;else pointDist['500+']++;
    bingos+=x.bingo?1:0;totalLines+=x.lines;totalSwaps+=x.swaps;
    if(x.predictionChoice){predUsed++;if(x.predictionCorrect===true)predCorrect++;}
    overlapSum+=x.maxOverlap;overlapMax=Math.max(overlapMax,x.maxOverlap);
  }
  const modes=Object.values(modeMap).map(x=>({...x,avgPoints:x.players?x.points/x.players:0,bingoRate:x.players?x.bingos/x.players:0,avgLines:x.players?x.lines/x.players:0})).sort((a,b)=>b.players-a.players);
  const joinOrder=['inicio','2-10','10-25','25-40','40+'];
  const joins=joinOrder.filter(k=>joinMap[k]).map(k=>{const x=joinMap[k];return {...x,avgPoints:x.players?x.points/x.players:0,bingoRate:x.players?x.bingos/x.players:0};});
  const row0=rows[0]||{};
  const roundSummary={
    roundId,sourceGame,roundStartedAt:row0.round_started_at||null,closedAt:row0.created_at||null,players,
    totalPoints,avgPoints:players?totalPoints/players:0,medianPoints:analyticsMedian(points),minPoints:points.length?Math.min(...points):0,maxPoints:points.length?Math.max(...points):0,
    bingos,bingoRate:players?bingos/players:0,totalLines,avgLines:players?totalLines/players:0,totalSwaps,avgSwaps:players?totalSwaps/players:0,
    predictions:predUsed,predictionCorrect:predCorrect,predictionWrong:Math.max(0,predUsed-predCorrect),predictionAccuracy:predUsed?predCorrect/predUsed:0,
    avgOverlap:players?overlapSum/players:0,maxOverlap:overlapMax,durationSeconds:Math.max(...rows.map(x=>Number(x.final_game_clock||0)),0),
    modes,joins,lineDistribution:lineDist,swapDistribution:swapDist,pointDistribution:pointDist
  };
  return {summary:roundSummary,ranking};
}

function csvCell(value){
  const s=String(value??''); return /[",\n\r]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;
}
async function analyticsExport(db, format='csv', days=3650){
  const since=sinceIso(analyticsDays(days));
  const r=await db.prepare(`SELECT s.created_at,s.round_id,s.display_name_snapshot,s.user_id,s.mode,s.card_kind,s.multiplier,
      s.join_clock,s.round_points,s.completed_cells,s.lines_completed,s.bingo,s.swap_used,s.swap_count,s.prediction_choice,s.prediction_correct,s.prediction_points,s.max_card_overlap,s.strategist_option,s.selection_delay_seconds,
      s.auto_selected,s.connection_count,s.active_seconds_approx,s.last_active_clock,s.final_game_clock,s.finalize_reason
      FROM happy_game_sessions s WHERE s.created_at>=? ORDER BY s.created_at DESC`).bind(since).all();
  const rows=r.results||[];
  if(String(format).toLowerCase()==='json') return new Response(JSON.stringify({exportedAt:nowIso(),since,rows},null,2),{headers:{'content-type':'application/json; charset=utf-8','content-disposition':'attachment; filename="happy-games-beta.json"'}});
  const headers=['created_at','round_id','display_name','user_id','mode','card_kind','multiplier','join_clock','round_points','completed_cells','lines_completed','bingo','swap_used','swap_count','prediction_choice','prediction_correct','prediction_points','max_card_overlap','strategist_option','selection_delay_seconds','auto_selected','connection_count','active_seconds_approx','last_active_clock','final_game_clock','finalize_reason'];
  const lines=[headers.join(',')];
  for(const x of rows) lines.push(headers.map(h=>csvCell(h==='display_name'?x.display_name_snapshot:x[h])).join(','));
  return new Response(lines.join('\n'),{headers:{'content-type':'text/csv; charset=utf-8','content-disposition':'attachment; filename="happy-games-beta.csv"'}});
}

const CONFLICT_GROUPS = [
  // Una sola version de cada reto claramente anidado / redundante.
  ["KILLS_4_BY_20","KILLS_4_BY_15","KILLS_5_BY_25","KILLS_5_BY_15","KILLS_6_BY_15","KILLS_6_BY_10","KILLS_7_BY_25"],
  ["KILLS_3_IN_180","KILLS_3_IN_90","KILLS_3_IN_60"],
  ["KILL_STREAK_3_BY_15","KILL_STREAK_4_BY_20","KILL_STREAK_5_BY_20"],
  ["KILLS_3_BEFORE_DEATHS_2","KILLS_5_BEFORE_DEATHS_3"],
  ["ASSISTS_10_BEFORE_DEATHS_2","ASSISTS_15_BEFORE_DEATHS_3","ASSISTS_18_BEFORE_DEATHS_2","ASSISTS_20_BEFORE_DEATHS_2"],
  ["ASSISTS_8_BY_20","ASSISTS_10_BY_25","ASSISTS_10_BY_20"],
  ["ASSISTS_12_BY_25","ASSISTS_15_BY_35","ASSISTS_15_BY_30","ASSISTS_15_BY_25","ASSISTS_15_BY_20"],
  ["ASSISTS_18_BY_30","ASSISTS_18_BY_35","ASSISTS_20_BY_35"],
  ["LH_20_BY_15","LH_30_BY_15","LH_50_BY_15"],
  ["LH_35_BY_20","LH_60_BY_25","LH_75_BY_30"],
  ["DENIES_2_BY_10","DENIES_2_BY_15"],
  ["ITEM_AGHS","ITEM_AGHS_BY_35","ITEM_AGHS_BY_20"],
  ["ITEM_VESSEL_BY_25","ITEM_VESSEL_BY_20"],
  ["DEATHS_3_BY_15","DEATHS_4_BY_20","DEATHS_5_BY_20","DEATHS_6_BY_15"],
  ["COMBO_2K_8A_BY_20","COMBO_3K_12A_BY_25","COMBO_3K_10A_BY_25","COMBO_4K_10A_BY_25","COMBO_5K_15A_BY_30"],
  ["COMBO_10A_50LH_BY_25","COMBO_15A_50LH_BY_30","COMBO_15A_75LH_BY_30"],
  ["SURVIVE_MAX1D_AT_15","SURVIVE_MAX1D_AT_20","SURVIVE_MAX1D_AT_30","SURVIVE_MAX1D_AT_35","SURVIVE_0D_AT_20","SURVIVE_0D_AT_25","SURVIVE_MAX2D_AT_20","SURVIVE_MAX2D_AT_25","FINISH_MAX5D"],
  ["MATCH_ENDS_BEFORE_35","MATCH_ENDS_BEFORE_40","MATCH_LASTS_40","MATCH_LASTS_45"],
  ["LEVEL_6_BY_10","LEVEL_12_BY_20","LEVEL_20_TOTAL"],
  ["GPM_250_AT_15","GPM_300_AT_20","GPM_350_AT_25"],
  ["XPM_300_AT_15","XPM_400_AT_20","XPM_500_AT_25"],
  ["GOLD_1500_BY_20","GOLD_2000_BY_25","GOLD_3000_TOTAL"],
  ["DOUBLE_KILL_15S","TRIPLE_KILL_30S","RAMPAGE_WINDOW_30S"],
  ["TEAM_40_KILLS_TOTAL","TEAM_50_KILLS_TOTAL"]
];

// Pares que no son la misma serie, pero se pisan demasiado o una condicion
// convierte a la otra en casi automatica. Evitamos que aparezcan juntas.
const INCOMPATIBLE_PAIRS = [
  // Kills por tiempo: todas estan fuertemente anidadas entre si.
  ["KILLS_5_BY_25","KILLS_6_BY_15"],
  ["KILLS_5_BY_25","KILLS_6_BY_10"],
  ["KILLS_5_BY_15","KILLS_6_BY_15"],
  ["KILLS_5_BY_15","KILLS_6_BY_10"],

  // Denies: evitar dos casillas que se completen practicamente juntas.
  ["DENIES_3_BY_15","DENIES_4_BY_15"],
  ["DENIES_3_BY_15","DENIES_5_BY_15"],
  ["DENIES_4_BY_15","DENIES_5_BY_15"],
  ["DENIES_5_BY_20","DENIES_5_BY_15"],

  // Last hits: mismo umbral con un limite mas estricto.
  ["LH_50_BY_20","LH_50_BY_15"],

  // Combos que harian saltar otra casilla de assists en el mismo momento.
  ["COMBO_3K_10A_BY_25","ASSISTS_10_BY_25"],
  ["COMBO_4K_10A_BY_25","ASSISTS_10_BY_25"],
  ["COMBO_10A_50LH_BY_25","ASSISTS_10_BY_25"],
  ["COMBO_5K_15A_BY_30","ASSISTS_15_BY_30"],
  ["COMBO_5K_15A_BY_30","ASSISTS_15_BY_35"],
  ["COMBO_15A_50LH_BY_30","ASSISTS_15_BY_30"],
  ["COMBO_15A_50LH_BY_30","ASSISTS_15_BY_35"],
  ["COMBO_15A_75LH_BY_30","ASSISTS_15_BY_30"],
  ["COMBO_15A_75LH_BY_30","ASSISTS_15_BY_35"],
  ["COMBO_15A_MAX3D_BY_30","ASSISTS_15_BY_30"],
  ["COMBO_15A_MAX3D_BY_30","ASSISTS_15_BY_35"],

  // Participacion: 20/max3 al 25 contiene a 15/max3 al 25.
  ["PART_15_MAX3D_BY_25","PART_20_MAX3D_BY_25"],

  // Items: solo bloqueamos progresiones redundantes / ramas demasiado cercanas.
  // Urn es componente de Essence Distiller y tambien de Spirit Vessel; si dos
  // casillas de esa misma cadena aparecen juntas, una prediccion se vuelve casi
  // automatica al completar la otra.
  ["ITEM_URN_BY_10","ITEM_DISTILLER"],
  ["ITEM_URN_BY_10","ITEM_VESSEL_BY_25"],
  ["ITEM_URN_BY_10","ITEM_VESSEL_BY_20"],
  ["ITEM_DISTILLER","ITEM_VESSEL_BY_25"],
  ["ITEM_DISTILLER","ITEM_VESSEL_BY_20"],
  // Arcane Blink parte de Blink Dagger: evitamos dos casillas de una misma
  // progresion de item en la misma tarjeta.
  ["ITEM_BLINK","ITEM_ARCANE_BLINK"]
];

const CONFLICT_INDEX = new Map();
CONFLICT_GROUPS.forEach((group, index) => {
  for (const id of group) {
    if (!CONFLICT_INDEX.has(id)) CONFLICT_INDEX.set(id, new Set());
    CONFLICT_INDEX.get(id).add(index);
  }
});

const PAIR_CONFLICTS = new Map();
for (const [a,b] of INCOMPATIBLE_PAIRS) {
  if (!PAIR_CONFLICTS.has(a)) PAIR_CONFLICTS.set(a, new Set());
  if (!PAIR_CONFLICTS.has(b)) PAIR_CONFLICTS.set(b, new Set());
  PAIR_CONFLICTS.get(a).add(b);
  PAIR_CONFLICTS.get(b).add(a);
}

// v5: 24 casillas no-FREE, con solo tres items y una categoria por eje. Esto
// evita que combate/KDA/participacion dominen la tarjeta.
const CATEGORY_SLOTS = [
  "combat","support",{name:"fate",categories:["deaths","survival"]},
  "farm","farm","items","items","items","tempo","economy",
  "liquidity","experience","progress","events","risk","recovery","vision",
  "utility","team","pace","ending","deward","exploration","objectives"
];

// Item Compatibility v2 — familias y evidencia combinadas.
// Base principal: 26 partidas completas deduplicadas de Kike jugando support
// (15–19 sep 2026). Dota Pro Tracker se usa solo como validacion externa para
// no marcar como "incompatibles" combinaciones normales del meta actual.
const ITEM_BUILD_FAMILIES = {
  ITEM_AGHS:["caster","scaling"], ITEM_AGHS_BY_35:["caster","scaling"], ITEM_AGHS_BY_20:["caster","scaling"],
  ITEM_BLINK:["mobility","initiation"], ITEM_ARCANE_BLINK:["mobility","initiation","late","specialized"],
  ITEM_VESSEL_BY_25:["tempo","utility"], ITEM_VESSEL_BY_20:["tempo","utility"], ITEM_URN_BY_10:["tempo","utility"], ITEM_DISTILLER:["tempo","utility"],
  ITEM_FORCE:["save","mobility","utility"], ITEM_GLIMMER:["save","defensive","utility"], ITEM_EUL:["save","disable","utility"],
  ITEM_AETHER:["caster","utility"], ITEM_SHEEPSTICK:["disable","late","luxury"], ITEM_ATOS:["disable","utility","tempo"],
  ITEM_OCTARINE:["caster","scaling","late","specialized"], ITEM_MAGE_SLAYER:["offensive","utility","tempo"],
  ITEM_LOTUS:["save","defensive","late","luxury"], ITEM_SHIVAS:["defensive","scaling","late","specialized","luxury"]
};

// Clave canonica del item real. Las variantes por tiempo cuentan como el mismo
// item al evaluar coherencia, aunque sigan siendo reglas diferentes del Bingo.
const ITEM_RULE_KEY = {
  ITEM_AGHS:"aghs", ITEM_AGHS_BY_35:"aghs", ITEM_AGHS_BY_20:"aghs",
  ITEM_BLINK:"blink", ITEM_ARCANE_BLINK:"arcane_blink",
  ITEM_VESSEL_BY_25:"vessel", ITEM_VESSEL_BY_20:"vessel", ITEM_URN_BY_10:"urn", ITEM_DISTILLER:"distiller",
  ITEM_FORCE:"force", ITEM_GLIMMER:"glimmer", ITEM_EUL:"eul", ITEM_AETHER:"aether",
  ITEM_SHEEPSTICK:"sheep", ITEM_ATOS:"atos", ITEM_OCTARINE:"octarine", ITEM_MAGE_SLAYER:"mage_slayer",
  ITEM_LOTUS:"lotus", ITEM_SHIVAS:"shivas"
};

const ITEM_RULE_DOTA_NAME = {
  ITEM_AGHS:"item_ultimate_scepter",ITEM_AGHS_BY_35:"item_ultimate_scepter",ITEM_AGHS_BY_20:"item_ultimate_scepter",
  ITEM_BLINK:"item_blink",ITEM_ARCANE_BLINK:"item_arcane_blink",ITEM_VESSEL_BY_25:"item_spirit_vessel",ITEM_VESSEL_BY_20:"item_spirit_vessel",
  ITEM_URN_BY_10:"item_urn_of_shadows",ITEM_FORCE:"item_force_staff",ITEM_GLIMMER:"item_glimmer_cape",ITEM_EUL:"item_cyclone",
  ITEM_AETHER:"item_aether_lens",ITEM_DISTILLER:"item_essence_distiller",ITEM_SHEEPSTICK:"item_sheepstick",ITEM_ATOS:"item_rod_of_atos",
  ITEM_OCTARINE:"item_octarine_core",ITEM_MAGE_SLAYER:"item_mage_slayer",ITEM_LOTUS:"item_lotus_orb",ITEM_SHIVAS:"item_shivas_guard"
};
const GLOBAL_ITEM_HISTORY={item_ultimate_scepter:18,item_blink:18,item_spirit_vessel:9,item_urn_of_shadows:26,item_force_staff:7,item_glimmer_cape:8,item_cyclone:5,item_aether_lens:8,item_essence_distiller:12,item_sheepstick:11,item_rod_of_atos:9,item_octarine_core:7,item_mage_slayer:13,item_lotus_orb:6,item_shivas_guard:1,item_arcane_blink:1};
const HERO_ITEM_HISTORY={
  ancient_apparition:{games:4,items:{item_blink:4,item_urn_of_shadows:1,item_aether_lens:1,item_essence_distiller:1,item_sheepstick:1,item_rod_of_atos:1,item_octarine_core:2,item_mage_slayer:1,item_arcane_blink:1}},
  venomancer:{games:13,items:{item_ultimate_scepter:11,item_blink:6,item_spirit_vessel:6,item_urn_of_shadows:10,item_force_staff:3,item_glimmer_cape:1,item_cyclone:2,item_essence_distiller:1,item_rod_of_atos:2,item_octarine_core:2,item_lotus_orb:1}},
  hoodwink:{games:21,items:{item_ultimate_scepter:3,item_blink:1,item_spirit_vessel:2,item_urn_of_shadows:12,item_force_staff:2,item_glimmer_cape:3,item_cyclone:1,item_aether_lens:3,item_essence_distiller:10,item_sheepstick:9,item_rod_of_atos:6,item_octarine_core:3,item_mage_slayer:12,item_lotus_orb:1}}
};
function normalizeHeroName(value){return String(value||"").replace(/^npc_dota_hero_/,"").toLowerCase();}
function itemAllowedForContext(rule,context={}){
  if(rule.category!=="items"||context.mode!=="strategist") return true;
  const item=ITEM_RULE_DOTA_NAME[rule.id]; if(!item) return true;
  const hero=HERO_ITEM_HISTORY[normalizeHeroName(context.heroName)];
  if(!hero||hero.games<4) return Number(GLOBAL_ITEM_HISTORY[item]||0)>=3;
  const count=Number(hero.items[item]||0); return count>=2||count/hero.games>=0.18;
}

function broadFamily(rule){
  if(rule.category==="combat")return "kills";
  if(rule.category==="support")return "assists";
  if(rule.category==="participation"||rule.category==="kda")return "teamfight";
  if(rule.category==="deaths"||rule.category==="survival")return "fate";
  if(rule.category==="farm")return rule.id.startsWith("DENIES")?"denies":"last_hits";
  return rule.category;
}
function hasDeadline(rule){return /\bantes del\b|\bal minuto\b|\bal min\b/i.test(rule.label);}

function itemPairKey(a,b){ return [a,b].sort().join("|"); }

// Co-ocurrencias observadas en las 26 partidas completas deduplicadas.
// Solo damos peso fuerte a pares repetidos; una ausencia NO se interpreta como
// incompatibilidad porque la muestra mezcla heroes y situaciones distintas.
const USER_ITEM_PAIR_EVIDENCE = new Map([
  [itemPairKey("aghs","urn"),7],
  [itemPairKey("aghs","blink"),6],
  [itemPairKey("aghs","vessel"),4],
  [itemPairKey("urn","atos"),4],
  [itemPairKey("blink","urn"),4],
  [itemPairKey("blink","lotus"),3],
  [itemPairKey("urn","eul"),3],
  [itemPairKey("glimmer","atos"),2],
  [itemPairKey("atos","mage_slayer"),2],
  [itemPairKey("blink","octarine"),2],
  [itemPairKey("blink","force"),2],
  [itemPairKey("aghs","lotus"),2],
  [itemPairKey("aghs","force"),2],
  [itemPairKey("blink","distiller"),2],
  [itemPairKey("urn","sheep"),2],
  [itemPairKey("aghs","eul"),2],
  [itemPairKey("blink","aether"),2],
  [itemPairKey("urn","glimmer"),2],
  [itemPairKey("aghs","atos"),2],
  [itemPairKey("urn","mage_slayer"),2]
]);

// Confirmaciones externas de builds support actuales. Sirven como desempate
// suave; nunca sustituyen el historial de Kike.
const META_SUPPORTED_ITEM_PAIRS = new Set([
  itemPairKey("force","glimmer"),
  itemPairKey("force","blink")
]);

const LUXURY_ITEM_IDS = new Set(Object.entries(ITEM_BUILD_FAMILIES).filter(([,tags])=>tags.includes("luxury")).map(([id])=>id));
const SPECIALIZED_ITEM_IDS = new Set(Object.entries(ITEM_BUILD_FAMILIES).filter(([,tags])=>tags.includes("specialized")).map(([id])=>id));

function compatibleRule(rule, selected) {
  if (selected.some(r => r.id === rule.id)) return false;

  const family=broadFamily(rule);
  if(rule.category!=="items"&&selected.some(r=>broadFamily(r)===family)) return false;
  if(hasDeadline(rule)&&selected.filter(hasDeadline).length>=10) return false;
  const combatCategories=new Set(["combat","kda","support","combo","participation","deaths","survival","multikill"]);
  if(combatCategories.has(rule.category)&&selected.filter(r=>combatCategories.has(r.category)).length>=3) return false;

  // Evitar una tarjeta con demasiadas apuestas tardias/especializadas. Mage
  // Slayer deja de contarse aqui: en la nueva muestra aparece 5/26 y 4/8 en
  // Hoodwink, por lo que para Kike ya no es una compra "off-route" rara.
  if(rule.category === "items" && LUXURY_ITEM_IDS.has(rule.id)){
    const luxuryCount=selected.filter(r=>r.category==="items"&&LUXURY_ITEM_IDS.has(r.id)).length;
    if(luxuryCount>=2) return false;
  }
  if(rule.category === "items" && SPECIALIZED_ITEM_IDS.has(rule.id)){
    const specializedCount=selected.filter(r=>r.category==="items"&&SPECIALIZED_ITEM_IDS.has(r.id)).length;
    if(specializedCount>=2) return false;
  }

  const groups = CONFLICT_INDEX.get(rule.id);
  if (groups && groups.size) {
    for (const picked of selected) {
      const pickedGroups = CONFLICT_INDEX.get(picked.id);
      if (!pickedGroups) continue;
      for (const g of groups) if (pickedGroups.has(g)) return false;
    }
  }

  const pairSet = PAIR_CONFLICTS.get(rule.id);
  if (pairSet && selected.some(r => pairSet.has(r.id))) return false;
  return true;
}

function itemCoherenceScore(rules){
  const items=rules.filter(r=>r.category==="items");
  let supportedPairs=0;
  for(let i=0;i<items.length;i++){
    for(let j=i+1;j<items.length;j++){
      const a=ITEM_RULE_KEY[items[i].id], b=ITEM_RULE_KEY[items[j].id];
      if(!a||!b||a===b) continue;
      const key=itemPairKey(a,b);
      const seen=Number(USER_ITEM_PAIR_EVIDENCE.get(key)||0);
      if(seen>=2 || META_SUPPORTED_ITEM_PAIRS.has(key)) supportedPairs++;
    }
  }
  // La evidencia se usa como "red de seguridad", no como premio acumulativo.
  // Asi evitamos tarjetas con cinco items totalmente desconectados sin hacer
  // que Blink/Urn/Aghanim aparezcan demasiado solo por tener mas historial.
  if(supportedPairs===0) return -14;
  if(supportedPairs===1) return -4;
  return 0;
}

function candidatesForSlot(slot, selected, context={}) {
  if (typeof slot === "string") {
    return RULE_POOL.filter(r => r.category === slot && !["DUST_BY_15","SMOKE_BY_20"].includes(r.id) && itemAllowedForContext(r,context) && compatibleRule(r, selected));
  }

  // Elegimos primero la familia, para que "fate" no favorezca supervivencia
  // solo porque tiene mas reglas en el pool.
  const categories = shuffle(slot.categories);
  for (const category of categories) {
    const candidates = RULE_POOL.filter(r => r.category === category && itemAllowedForContext(r,context) && compatibleRule(r, selected));
    if (candidates.length) return candidates;
  }
  return [];
}

// Greedy con reintentos. Los slots mas restrictivos se resuelven primero.
function buildCandidateCard(context={}) {
  const priority = {
    items:0, fate:1, teamfight:2, farm:3, combat:4, support:5
  };
  const slots = [...CATEGORY_SLOTS].sort((a,b) => {
    const an = typeof a === "string" ? a : a.name;
    const bn = typeof b === "string" ? b : b.name;
    return (priority[an] ?? 99) - (priority[bn] ?? 99);
  });

  for (let attempt = 0; attempt < 100; attempt++) {
    const selected = [];
    let failed = false;
    for (const slot of slots) {
      let candidates = candidatesForSlot(slot, selected, context);
      if (!candidates.length) { failed = true; break; }
      if(selected.filter(hasDeadline).length>=4){const untimed=candidates.filter(r=>!hasDeadline(r));if(untimed.length)candidates=untimed;}
      selected.push(candidates[Math.floor(Math.random() * candidates.length)]);
    }
    if (!failed && selected.length === 24) return selected;
  }
  return null;
}

function candidateScore(rules) {
  const tiers = { common:0, medium:0, hard:0, rare:0 };
  let expected = 0;
  for (const r of rules) {
    tiers[r.difficulty] = (tiers[r.difficulty] || 0) + 1;
    expected += Number(r.observedRate || 0);
  }

  // Con la muestra actual buscamos unas 7-8 casillas no-FREE esperadas por jugador.
  let score = 1000 - Math.abs(expected - 7.6) * 140;

  // Evitar tarjetas globalmente demasiado faciles o demasiado imposibles.
  if (tiers.rare < 2) score -= (2 - tiers.rare) * 90;
  if (tiers.rare > 5) score -= (tiers.rare - 5) * 45;
  if (tiers.common < 4) score -= (4 - tiers.common) * 35;
  if (tiers.hard > 9) score -= (tiers.hard - 9) * 25;

  // La coherencia de items pesa lo suficiente para desempatar tarjetas, pero no
  // domina el balance global ni obliga a repetir siempre los mismos cinco items.
  score += itemCoherenceScore(rules);
  return score;
}

function lineLayoutScore(card) {
  const weight = { common:1, medium:2, hard:3, rare:4, free:0 };
  let score = 0;

  for (const line of BINGO_LINES) {
    const rules = line.map(i => RULE_MAP[card[i]]).filter(r => r && r.id !== "FREE");
    if (!rules.length) continue;

    const avgWeight = rules.reduce((s,r) => s + (weight[r.difficulty] || 2), 0) / rules.length;
    const avgRate = rules.reduce((s,r) => s + Number(r.observedRate || 0.30), 0) / rules.length;
    const rareCount = rules.filter(r => r.difficulty === "rare").length;
    const hardRareCount = rules.filter(r => r.difficulty === "hard" || r.difficulty === "rare").length;
    const commonMediumCount = rules.filter(r => r.difficulty === "common" || r.difficulty === "medium").length;

    // Centro/FREE tiene 4 requisitos; las demas lineas tienen 5. Usamos promedio
    // para compararlas con la misma escala.
    score -= Math.abs(avgWeight - 2.25) * 32;
    score -= Math.abs(avgRate - 0.33) * 95;

    // Una linea sin ninguna casilla comun/media se siente bloqueada.
    if (commonMediumCount === 0) score -= 180;
    // Evitar lineas cargadas de rarezas o de 4-5 hard/rare.
    if (rareCount > 1) score -= (rareCount - 1) * 95;
    const maxHardRare = rules.length === 4 ? 2 : 3;
    if (hardRareCount > maxHardRare) score -= (hardRareCount - maxHardRare) * 110;
  }
  return score;
}

function validLineBalance(card) {
  for (const line of BINGO_LINES) {
    const rules = line.map(i => RULE_MAP[card[i]]).filter(r => r && r.id !== "FREE");
    const rareCount = rules.filter(r => r.difficulty === "rare").length;
    const hardRareCount = rules.filter(r => r.difficulty === "hard" || r.difficulty === "rare").length;
    const commonMediumCount = rules.filter(r => r.difficulty === "common" || r.difficulty === "medium").length;
    const maxHardRare = rules.length === 4 ? 2 : 3;
    if (rareCount > 1 || hardRareCount > maxHardRare || commonMediumCount === 0) return false;
  }
  return true;
}

function placeBalancedCard(bestRules) {
  const itemIds = shuffle(bestRules.filter(r => r.category === "items").map(r => r.id));
  const otherIds = bestRules.filter(r => r.category !== "items").map(r => r.id);

  if (itemIds.length !== 3 || otherIds.length !== 21) {
    throw new Error("La mezcla v5 debe contener exactamente 3 items y 21 casillas no-item.");
  }

  let bestCard = null;
  let bestScore = -Infinity;

  // 120 layouts es barato para una tarjeta y reduce mucho las lineas extremas.
  for (let attempt = 0; attempt < 120; attempt++) {
    const itemRows=shuffle([0,1,2,3,4]).slice(0,3);
    const itemCols=shuffle([0,1,2,3,4]).slice(0,3);
    const positions=itemRows.map((row,i)=>row*5+itemCols[i]);
    if(positions.includes(12))continue;
    const mainDiagItems=positions.filter(pos=>Math.floor(pos/5)===pos%5).length;
    const antiDiagItems=positions.filter(pos=>Math.floor(pos/5)+pos%5===4).length;
    if(mainDiagItems>1||antiDiagItems>1)continue;

    const card = Array(25).fill(null);
    card[12] = "FREE";
    const shuffledItems = shuffle(itemIds);
    positions.forEach((pos,i)=>{card[pos]=shuffledItems[i]});

    const shuffledOthers = shuffle(otherIds);
    let j = 0;
    for (let i = 0; i < 25; i++) if (card[i] === null) card[i] = shuffledOthers[j++];

    if (!validLineBalance(card)) continue;
    const score = lineLayoutScore(card);
    if (score > bestScore) { bestCard = card; bestScore = score; }
  }

  if (!bestCard) return null;
  return { card:bestCard, layoutScore:bestScore };
}

function randomCard(existingCards=[],context={}) {
  let bestCard = null;
  let bestScore = -Infinity;
  const freq=new Map(); for(const c of (existingCards||[]))for(const id of c||[])if(id&&id!=="FREE")freq.set(id,(freq.get(id)||0)+1);

  // Seguimos usando el mismo presupuesto de generacion que v4.2, pero ahora
  // premiamos candidatos con menos solapamiento y menor frecuencia en el lobby.
  for (let attempt = 0; attempt < 36; attempt++) {
    const candidate = buildCandidateCard(context);
    if (!candidate) continue;
    const placed = placeBalancedCard(candidate);
    if (!placed) continue;
    const overlaps=(existingCards||[]).map(x=>cardOverlap(placed.card,x));
    const maxOverlap=overlaps.length?Math.max(...overlaps):0;
    const avgOverlap=overlaps.length?overlaps.reduce((a,b)=>a+b,0)/overlaps.length:0;
    const usage=candidate.reduce((sum,r)=>sum+(freq.get(r.id)||0),0);
    const diversityPenalty=maxOverlap*17+avgOverlap*4+usage*1.4;
    const score = candidateScore(candidate) + placed.layoutScore * 0.20 - diversityPenalty;
    if (score > bestScore) { bestCard = placed.card; bestScore = score; }
  }

  if (!bestCard || bestCard.length !== 25) {
    throw new Error("No se pudo generar una tarjeta balanceada de Happy Bingo v5.");
  }

  return bestCard;
}

function cardOverlap(a,b){
  const sa=new Set((a||[]).filter(x=>x&&x!=="FREE"));
  let n=0; for(const id of (b||[])) if(id!=="FREE"&&sa.has(id)) n++;
  return n;
}
function maxOverlapAgainst(card, existingCards){
  if(!existingCards?.length) return 0;
  return Math.max(...existingCards.map(x=>cardOverlap(card,x)));
}
function diverseCard(existingCards=[],context={}){ return randomCard(existingCards,context); }
function diverseSprintCard(meta,existingCards=[]){
  let best=null,bestScore=Infinity;
  for(let i=0;i<20;i++){
    let card; try{card=generateSprintCard(meta)}catch{continue}
    const overlaps=(existingCards||[]).map(x=>cardOverlap(card,x));
    const max=overlaps.length?Math.max(...overlaps):0;
    const avg=overlaps.length?overlaps.reduce((a,b)=>a+b,0)/overlaps.length:0;
    const score=max*12+avg*3+Math.random();
    if(score<bestScore){best=card;bestScore=score;}
  }
  return best||generateSprintCard(meta);
}
function lineIndexes(participant){
  const done=new Set(participant.completed||[]);
  const lines=participant.cardKind==='sprint'?SPRINT_LINES:BINGO_LINES;
  const out=[]; lines.forEach((line,i)=>{if(line.every(pos=>done.has(participant.card[pos])))out.push(i)});
  return out;
}

function hasStatSnapshot(e){
  return ["kills","deaths","assists","lastHits","denies","killStreak"].every(k => Number.isFinite(Number(e?.[k])));
}
function isStats(e){ return e.type === "PLAYER_STATS" || e.type === "MATCH_TICK" || hasStatSnapshot(e); }
function byClock(e, seconds){ return typeof e.clock === "number" && e.clock >= 0 && e.clock <= seconds; }
function checkpoint(e,seconds){return isStats(e)&&Number(e.clock)>=seconds&&Number(e.clock)<seconds+90;}
function itemEvent(e, item){ return e.type === "ITEM_ACQUIRED" && e.item === item; }
function teamKills(e){const team=String(e.kikeTeam||"").toLowerCase();return team.includes("radiant")||team==="team2"?Number(e.radiantScore||0):Number(e.direScore||0);}

function matchesRule(ruleId,e){
  const rule=RULE_MAP[ruleId];
  if(rule?.counter){
    if(e?.telemetrySource!=="dota-gsi"||e.telemetryMode!=="player")return false;
    const metrics=rule.liveCounterScope==='match'?e.matchEventMetrics:e.liveEventMetrics;
    if(metrics?.source!=="deduplicated-gsi-direct-events")return false;
    const counts=metrics.observedCounts;
    const value=rule.counter==='wardsDestroyedTotal'
      ?(typeof counts?.observerWardsDestroyed==='number'&&typeof counts?.sentryWardsDestroyed==='number'?counts.observerWardsDestroyed+counts.sentryWardsDestroyed:null)
      :counts?.[rule.counter];
    return typeof value==='number'&&Number.isFinite(value)&&value>=rule.threshold;
  }
  switch(ruleId){
    // COMBATE
    case "KILLS_5_BY_25": return isStats(e)&&e.kills>=5&&byClock(e,1500);
    case "KILLS_5_BY_15": return isStats(e)&&e.kills>=5&&byClock(e,900);
    case "KILLS_6_BY_15": return isStats(e)&&e.kills>=6&&byClock(e,900);
    case "KILLS_6_BY_10": return isStats(e)&&e.kills>=6&&byClock(e,600);
    case "KILLS_3_IN_180": return e.type==="KILLS_3_IN_WINDOW"&&e.windowSeconds<=180;
    case "KILLS_3_IN_90": return e.type==="KILLS_3_IN_WINDOW"&&e.windowSeconds<=90;
    case "KILLS_3_IN_60": return e.type==="KILLS_3_IN_WINDOW"&&e.windowSeconds<=60;
    case "KILL_STREAK_4_BY_20": return isStats(e)&&e.killStreak>=4&&byClock(e,1200);
    case "KILL_STREAK_5_BY_20": return isStats(e)&&e.killStreak>=5&&byClock(e,1200);
    case "KILLS_4_BY_20": return isStats(e)&&e.kills>=4&&byClock(e,1200);
    case "KILLS_4_BY_15": return isStats(e)&&e.kills>=4&&byClock(e,900);
    case "KILLS_7_BY_25": return isStats(e)&&e.kills>=7&&byClock(e,1500);
    case "KILL_STREAK_3_BY_15": return isStats(e)&&e.killStreak>=3&&byClock(e,900);

    // KDA
    case "KILLS_3_BEFORE_DEATHS_2": return isStats(e)&&e.kills>=3&&e.deaths<2;
    case "KILLS_5_BEFORE_DEATHS_3": return isStats(e)&&e.kills>=5&&e.deaths<3;
    case "ASSISTS_10_BEFORE_DEATHS_2": return isStats(e)&&e.assists>=10&&e.deaths<2;
    case "ASSISTS_15_BEFORE_DEATHS_3": return isStats(e)&&e.assists>=15&&e.deaths<3;
    case "ASSISTS_18_BEFORE_DEATHS_2": return isStats(e)&&e.assists>=18&&e.deaths<2;
    case "ASSISTS_20_BEFORE_DEATHS_2": return isStats(e)&&e.assists>=20&&e.deaths<2;

    // SUPPORT
    case "ASSISTS_10_BY_25": return isStats(e)&&e.assists>=10&&byClock(e,1500);
    case "ASSISTS_10_BY_20": return isStats(e)&&e.assists>=10&&byClock(e,1200);
    case "ASSISTS_15_BY_35": return isStats(e)&&e.assists>=15&&byClock(e,2100);
    case "ASSISTS_15_BY_30": return isStats(e)&&e.assists>=15&&byClock(e,1800);
    case "ASSISTS_15_BY_25": return isStats(e)&&e.assists>=15&&byClock(e,1500);
    case "ASSISTS_15_BY_20": return isStats(e)&&e.assists>=15&&byClock(e,1200);
    case "ASSISTS_18_BY_35": return isStats(e)&&e.assists>=18&&byClock(e,2100);
    case "ASSISTS_20_BY_35": return isStats(e)&&e.assists>=20&&byClock(e,2100);
    case "ASSISTS_8_BY_20": return isStats(e)&&e.assists>=8&&byClock(e,1200);
    case "ASSISTS_12_BY_25": return isStats(e)&&e.assists>=12&&byClock(e,1500);
    case "ASSISTS_18_BY_30": return isStats(e)&&e.assists>=18&&byClock(e,1800);

    // FARM
    case "LH_20_BY_15": return isStats(e)&&e.lastHits>=20&&byClock(e,900);
    case "LH_50_BY_20": return isStats(e)&&e.lastHits>=50&&byClock(e,1200);
    case "LH_100_BY_30": return isStats(e)&&e.lastHits>=100&&byClock(e,1800);
    case "LH_30_BY_15": return isStats(e)&&e.lastHits>=30&&byClock(e,900);
    case "LH_50_BY_15": return isStats(e)&&e.lastHits>=50&&byClock(e,900);
    case "DENIES_2_BY_10": return isStats(e)&&e.denies>=2&&byClock(e,600);
    case "DENIES_3_BY_15": return isStats(e)&&e.denies>=3&&byClock(e,900);
    case "DENIES_4_BY_15": return isStats(e)&&e.denies>=4&&byClock(e,900);
    case "DENIES_5_BY_20": return isStats(e)&&e.denies>=5&&byClock(e,1200);
    case "DENIES_5_BY_15": return isStats(e)&&e.denies>=5&&byClock(e,900);
    case "LH_35_BY_20": return isStats(e)&&e.lastHits>=35&&byClock(e,1200);
    case "LH_60_BY_25": return isStats(e)&&e.lastHits>=60&&byClock(e,1500);
    case "LH_75_BY_30": return isStats(e)&&e.lastHits>=75&&byClock(e,1800);
    case "DENIES_2_BY_15": return isStats(e)&&e.denies>=2&&byClock(e,900);

    // COMBOS
    case "COMBO_3K_10A_BY_25": return isStats(e)&&e.kills>=3&&e.assists>=10&&byClock(e,1500);
    case "COMBO_4K_10A_BY_25": return isStats(e)&&e.kills>=4&&e.assists>=10&&byClock(e,1500);
    case "COMBO_5K_15A_BY_30": return isStats(e)&&e.kills>=5&&e.assists>=15&&byClock(e,1800);
    case "COMBO_10A_50LH_BY_25": return isStats(e)&&e.assists>=10&&e.lastHits>=50&&byClock(e,1500);
    case "COMBO_15A_50LH_BY_30": return isStats(e)&&e.assists>=15&&e.lastHits>=50&&byClock(e,1800);
    case "COMBO_15A_75LH_BY_30": return isStats(e)&&e.assists>=15&&e.lastHits>=75&&byClock(e,1800);
    case "COMBO_15A_MAX3D_BY_30": return isStats(e)&&e.assists>=15&&e.deaths<=3&&byClock(e,1800);
    case "COMBO_2K_8A_BY_20": return isStats(e)&&e.kills>=2&&e.assists>=8&&byClock(e,1200);
    case "COMBO_3K_12A_BY_25": return isStats(e)&&e.kills>=3&&e.assists>=12&&byClock(e,1500);

    // PARTICIPACION
    case "PART_10_MAX3D_BY_20": return isStats(e)&&(e.kills+e.assists)>=10&&e.deaths<=3&&byClock(e,1200);
    case "PART_15_MAX3D_BY_25": return isStats(e)&&(e.kills+e.assists)>=15&&e.deaths<=3&&byClock(e,1500);
    case "PART_18_MAX2D_BY_25": return isStats(e)&&(e.kills+e.assists)>=18&&e.deaths<=2&&byClock(e,1500);
    case "PART_20_MAX3D_BY_25": return isStats(e)&&(e.kills+e.assists)>=20&&e.deaths<=3&&byClock(e,1500);
    case "PART_12_MAX4D_BY_20": return isStats(e)&&(e.kills+e.assists)>=12&&e.deaths<=4&&byClock(e,1200);

    // SUPERVIVENCIA: se completa al alcanzar el minuto objetivo, no antes.
    case "SURVIVE_MAX1D_AT_15": return isStats(e)&&e.clock>=900&&e.deaths<=1;
    case "SURVIVE_MAX1D_AT_20": return isStats(e)&&e.clock>=1200&&e.deaths<=1;
    case "SURVIVE_MAX1D_AT_30": return isStats(e)&&e.clock>=1800&&e.deaths<=1;
    case "SURVIVE_MAX1D_AT_35": return isStats(e)&&e.clock>=2100&&e.deaths<=1;
    case "SURVIVE_0D_AT_20": return isStats(e)&&e.clock>=1200&&e.deaths===0;
    case "SURVIVE_0D_AT_25": return isStats(e)&&e.clock>=1500&&e.deaths===0;
    case "SURVIVE_MAX2D_AT_20": return isStats(e)&&e.clock>=1200&&e.deaths<=2;
    case "SURVIVE_MAX2D_AT_25": return isStats(e)&&e.clock>=1500&&e.deaths<=2;

    // ITEMS
    case "ITEM_AGHS": return itemEvent(e,"item_ultimate_scepter")||e.type==="AGHANIMS_SCEPTER_ACQUIRED";
    case "ITEM_AGHS_BY_35": return (itemEvent(e,"item_ultimate_scepter")||e.type==="AGHANIMS_SCEPTER_ACQUIRED")&&byClock(e,2100);
    case "ITEM_AGHS_BY_20": return (itemEvent(e,"item_ultimate_scepter")||e.type==="AGHANIMS_SCEPTER_ACQUIRED")&&byClock(e,1200);
    case "ITEM_BLINK": return itemEvent(e,"item_blink");
    case "ITEM_VESSEL_BY_25": return itemEvent(e,"item_spirit_vessel")&&byClock(e,1500);
    case "ITEM_VESSEL_BY_20": return itemEvent(e,"item_spirit_vessel")&&byClock(e,1200);
    case "ITEM_URN_BY_10": return itemEvent(e,"item_urn_of_shadows")&&byClock(e,600);
    case "ITEM_FORCE": return itemEvent(e,"item_force_staff");
    case "ITEM_GLIMMER": return itemEvent(e,"item_glimmer_cape");
    case "ITEM_EUL": return itemEvent(e,"item_cyclone");
    case "ITEM_AETHER": return itemEvent(e,"item_aether_lens");
    case "ITEM_DISTILLER": return itemEvent(e,"item_essence_distiller");
    case "ITEM_SHEEPSTICK": return itemEvent(e,"item_sheepstick");
    case "ITEM_ATOS": return itemEvent(e,"item_rod_of_atos");
    case "ITEM_OCTARINE": return itemEvent(e,"item_octarine_core");
    case "ITEM_MAGE_SLAYER": return itemEvent(e,"item_mage_slayer");
    case "ITEM_LOTUS": return itemEvent(e,"item_lotus_orb");
    case "ITEM_SHIVAS": return itemEvent(e,"item_shivas_guard");
    case "ITEM_ARCANE_BLINK": return itemEvent(e,"item_arcane_blink");

    // MUERTES
    case "DEATHS_3_BY_15": return isStats(e)&&e.deaths>=3&&byClock(e,900);
    case "DEATHS_4_BY_20": return isStats(e)&&e.deaths>=4&&byClock(e,1200);
    case "DEATHS_5_BY_20": return isStats(e)&&e.deaths>=5&&byClock(e,1200);
    case "DEATHS_6_BY_15": return isStats(e)&&e.deaths>=6&&byClock(e,900);

    // v5: nuevas categorias, todas alimentadas por GSI/bridge.
    case "LEVEL_20_TOTAL": return isStats(e)&&Number(e.level)>=20;
    case "KILLS_5_TOTAL": return isStats(e)&&e.kills>=5;
    case "ASSISTS_15_TOTAL": return isStats(e)&&e.assists>=15;
    case "PART_20_TOTAL": return isStats(e)&&(e.kills+e.assists)>=20;
    case "COMBO_3K_12A_TOTAL": return isStats(e)&&e.kills>=3&&e.assists>=12;
    case "FINISH_MAX5D": return e.type==="GAME_FINISHED"&&e.deaths<=5;
    case "LH_75_TOTAL": return isStats(e)&&e.lastHits>=75;
    case "DENIES_5_TOTAL": return isStats(e)&&e.denies>=5;
    case "MATCH_ENDS_BEFORE_35": return e.type==="GAME_FINISHED"&&Number(e.clock)<2100;
    case "MATCH_ENDS_BEFORE_40": return e.type==="GAME_FINISHED"&&Number(e.clock)<2400;
    case "MATCH_LASTS_40": return e.type==="GAME_FINISHED"&&Number(e.clock)>=2400;
    case "MATCH_LASTS_45": return e.type==="GAME_FINISHED"&&Number(e.clock)>=2700;
    case "MATCH_80_KILLS_TOTAL": return e.type==="GAME_FINISHED"&&(Number(e.radiantScore||0)+Number(e.direScore||0))>=80;
    case "LEVEL_6_BY_10": return isStats(e)&&Number(e.level)>=6&&byClock(e,600);
    case "LEVEL_12_BY_20": return isStats(e)&&Number(e.level)>=12&&byClock(e,1200);
    case "GPM_250_AT_15": return checkpoint(e,900)&&Number(e.gpm)>=250;
    case "GPM_300_AT_20": return checkpoint(e,1200)&&Number(e.gpm)>=300;
    case "GPM_350_AT_25": return checkpoint(e,1500)&&Number(e.gpm)>=350;
    case "XPM_300_AT_15": return checkpoint(e,900)&&Number(e.xpm)>=300;
    case "XPM_400_AT_20": return checkpoint(e,1200)&&Number(e.xpm)>=400;
    case "XPM_500_AT_25": return checkpoint(e,1500)&&Number(e.xpm)>=500;
    case "GOLD_1500_BY_20": return isStats(e)&&Number(e.gold)>=1500&&byClock(e,1200);
    case "GOLD_2000_BY_25": return isStats(e)&&Number(e.gold)>=2000&&byClock(e,1500);
    case "GOLD_3000_TOTAL": return isStats(e)&&Number(e.gold)>=3000;
    case "DOUBLE_KILL_15S": return e.type==="MULTIKILL_WINDOW"&&Number(e.twoWindowSeconds)<=15;
    case "TRIPLE_KILL_30S": return e.type==="MULTIKILL_WINDOW"&&Number(e.threeWindowSeconds)<=30;
    case "RAMPAGE_WINDOW_30S": return e.type==="MULTIKILL_WINDOW"&&Number(e.fiveWindowSeconds)<=30;
    case "FIRST_BLOOD_BY_3": return e.type==="FIRST_BLOOD"&&byClock(e,180);
    case "DUST_BY_15": return itemEvent(e,"item_dust")&&byClock(e,900);
    case "SMOKE_BY_20": return itemEvent(e,"item_smoke_of_deceit")&&byClock(e,1200);
    case "LOW_HP_15_FOR_15S": return e.type==="LOW_HP_15_FOR_15S";
    case "RECOVER_HP_IN_2M": return e.type==="HP_RECOVERED_FROM_25"&&Number(e.recoverySeconds)<=120;
    case "TEAM_40_KILLS_TOTAL": return e.type==="GAME_FINISHED"&&teamKills(e)>=40;
    case "TEAM_50_KILLS_TOTAL": return e.type==="GAME_FINISHED"&&teamKills(e)>=50;
    case "ALIVE_AT_END": return e.type==="GAME_FINISHED"&&e.alive===true;

    // Reglas legacy solo para no romper una ronda vieja.
    case "FIRST_BLOOD": return e.type==="FIRST_BLOOD";
    case "KILL_1": return e.type==="KIKE_KILL"&&e.kills>=1; case "KILL_2": return e.type==="KIKE_KILL"&&e.kills>=2; case "KILL_3": return e.type==="KIKE_KILL"&&e.kills>=3; case "KILL_5": return e.type==="KIKE_KILL"&&e.kills>=5;
    case "DEATH_1": return e.type==="KIKE_DEATH"&&e.deaths>=1; case "DEATH_2": return e.type==="KIKE_DEATH"&&e.deaths>=2; case "DEATH_3": return e.type==="KIKE_DEATH"&&e.deaths>=3; case "DEATH_5": return e.type==="KIKE_DEATH"&&e.deaths>=5;
    case "RESPAWN": return e.type==="KIKE_RESPAWN"; case "LOW_HP_25": return e.type==="LOW_HP_25"; case "LOW_HP_10": return e.type==="LOW_HP_10";
    case "LEVEL_3": return e.type==="LEVEL_UP"&&e.level>=3; case "LEVEL_6": return e.type==="LEVEL_UP"&&e.level>=6; case "LEVEL_10": return e.type==="LEVEL_UP"&&e.level>=10; case "LEVEL_15": return e.type==="LEVEL_UP"&&e.level>=15;
    case "BLINK": return itemEvent(e,"item_blink"); case "AGHS": return e.type==="AGHANIMS_SCEPTER_ACQUIRED"||itemEvent(e,"item_ultimate_scepter"); case "SHARD": return e.type==="AGHANIMS_SHARD_ACQUIRED"; case "ANY_ITEM": return e.type==="ITEM_ACQUIRED";
    case "ABILITY_CAST": return e.type==="ABILITY_CAST"&&!e.ultimate; case "ULT_CAST": return e.type==="ABILITY_CAST"&&!!e.ultimate; case "KILL_STREAK_3": return e.type==="KILL_STREAK_3"; case "KILL_STREAK_5": return e.type==="KILL_STREAK_5";
    case "ASSISTS_5": return e.type==="ASSISTS_5"; case "ASSISTS_10": return e.type==="ASSISTS_10"; case "ASSISTS_15": return e.type==="ASSISTS_15"; case "LH_25": return e.type==="LAST_HITS_25"; case "LH_50": return e.type==="LAST_HITS_50"; case "LH_100": return e.type==="LAST_HITS_100";
    case "MIN_5": return e.type==="GAME_TIME_MILESTONE"&&e.minute===5; case "MIN_10": return e.type==="GAME_TIME_MILESTONE"&&e.minute===10; case "MIN_20": return e.type==="GAME_TIME_MILESTONE"&&e.minute===20; case "MIN_30": return e.type==="GAME_TIME_MILESTONE"&&e.minute===30; case "MIN_40": return e.type==="GAME_TIME_MILESTONE"&&e.minute===40;
    case "GAME_END": return e.type==="GAME_FINISHED"; case "KIKE_WINS": return e.type==="GAME_FINISHED"&&e.kikeWon===true;
    default: return false;
  }
}

function hasBingo(participant) {
  const done = new Set(participant.completed||[]);
  const lines=participant.cardKind==='sprint'?SPRINT_LINES:BINGO_LINES;
  return lines.some(line => line.every(i => done.has(participant.card[i])));
}

export class BingoRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.profiles = new Map();      // keyed by Happy userId
    this.participants = new Map();  // keyed by Happy userId (prevents duplicate cards across devices)
    this.sockets = new Map();       // keyed by Happy userId
    this.overlaySockets = new Set();
    this.publicSockets = new Set();
    this.overlayQueue = [];
    this.overlayPendingGroup = null;
    this.overlayGroupTimer = null;
    this.overlayDrainTimer = null;
    this.overlayLastSentAt = 0;
    this.overlayNextAllowedAt = 0;
    this.overlayRoundFirstCellAnnounced = false;
    this.meta = {
      round: 1,
      registrationOpen: true,
      eventCount: 0,
      startedAt: new Date().toISOString(),
      happyGamesCore: 3, roundAwardsVersion:1, obsRoundFinalVersion:1, participationStreaksVersion:1, cellEngineVersion:3,
      gameStatus: 'waiting', gameClock: null, currentStats: {}, currentHero:null, completedRuleIds: [],
      swapMinute: chooseSwapMinute(), swapOpen:false, swapClosed:false, lastRoundAwards:[], completedRoundSerial:0, lastStreakProcessedRound:null
    };

    this.ready = this.ctx.blockConcurrencyWhile(async () => {
      const storedMeta = await this.ctx.storage.get("meta");
      if (storedMeta) this.meta = {...this.meta,...storedMeta,happyGamesCore:3,roundAwardsVersion:1,obsRoundFinalVersion:1,participationStreaksVersion:1,cellEngineVersion:3};

      const profileEntries = await this.ctx.storage.list({ prefix: "profile5:" });
      for (const [key, value] of profileEntries) this.profiles.set(key.slice("profile5:".length), value);

      const participantEntries = await this.ctx.storage.list({ prefix: "participant5:" });
      for (const [key, value] of participantEntries) this.participants.set(key.slice("participant5:".length), value);
    });
  }

  async persistMeta() { await this.ctx.storage.put("meta", this.meta); }
  async persistProfile(userId) {
    const p=this.profiles.get(userId); if(p) await this.ctx.storage.put("profile5:"+userId,p);
  }
  async persistParticipant(userId) {
    const p=this.participants.get(userId); if(p) await this.ctx.storage.put("participant5:"+userId,p);
  }

  send(userId, payload) {
    const sockets=this.sockets.get(userId); if(!sockets) return;
    for(const ws of sockets){ try{ if(ws.readyState===1) ws.send(JSON.stringify(payload)); }catch{} }
  }

  addSocket(userId, ws) {
    if(!this.sockets.has(userId)) this.sockets.set(userId,new Set());
    this.sockets.get(userId).add(ws);
    const p=this.participants.get(userId);
    if(p){p.connectionCount=Number(p.connectionCount||0)+1;p.lastActiveAt=nowIso();p.lastActiveClock=Number.isFinite(Number(this.meta.gameClock))?Number(this.meta.gameClock):p.lastActiveClock;this.persistParticipant(userId).catch(()=>{});}
    const cleanup=()=>{
      const set=this.sockets.get(userId);if(set){set.delete(ws);if(!set.size)this.sockets.delete(userId);}
      const pp=this.participants.get(userId);if(pp){pp.lastActiveAt=nowIso();pp.lastActiveClock=Number.isFinite(Number(this.meta.gameClock))?Number(this.meta.gameClock):pp.lastActiveClock;this.persistParticipant(userId).catch(()=>{});}
      this.broadcastPublicState(false);
    };
    ws.addEventListener("close",cleanup); ws.addEventListener("error",cleanup);
    this.broadcastPublicState(false);
  }

  resetOverlayRoundState(){
    this.overlayQueue=[];
    this.overlayPendingGroup=null;
    if(this.overlayGroupTimer){clearTimeout(this.overlayGroupTimer);this.overlayGroupTimer=null;}
    if(this.overlayDrainTimer){clearTimeout(this.overlayDrainTimer);this.overlayDrainTimer=null;}
    this.overlayLastSentAt=0;
    this.overlayNextAllowedAt=0;
    this.overlayRoundFirstCellAnnounced=false;
  }

  sendOverlay(payload){
    for(const ws of this.overlaySockets){ try{ if(ws.readyState===1) ws.send(JSON.stringify(payload)); }catch{} }
  }

  addOverlaySocket(ws){
    this.overlaySockets.add(ws);
    const cleanup=()=>{ this.overlaySockets.delete(ws); this.broadcastPublicState(false); };
    ws.addEventListener("close",cleanup);
    ws.addEventListener("error",cleanup);
    this.broadcastPublicState(false);
  }

  addPublicSocket(ws){
    this.publicSockets.add(ws);
    const cleanup=()=>{ this.publicSockets.delete(ws); };
    ws.addEventListener("close",cleanup);
    ws.addEventListener("error",cleanup);
  }

  publicStateData(){
    const active=[...this.participants.values()];
    let connections=0; for(const set of this.sockets.values()) connections+=set.size;
    return {
      registrationOpen:!!this.meta.registrationOpen,
      participants:active.length,
      maxParticipants:MAX_PARTICIPANTS,
      round:this.meta.round,
      phase:phaseForMeta(this.meta),
      gameClock:this.meta.gameClock,
      gameStatus:this.meta.gameStatus,
      matchStartAnnouncement:this.meta.matchStartAnnouncement||null,
      swap:this.swapStatus(),
      top:this.roundRanking().slice(0,10),
      connections,
      overlayConnections:this.overlaySockets.size,
      publicConnections:this.publicSockets.size,
      bingos:active.filter(p=>p.bingo).length,
      selecting:active.filter(p=>p.status==='selecting').length,
      sprints:active.filter(p=>p.cardKind==='sprint').length,
      blind:active.filter(p=>p.mode==='blind').length,
      strategist:active.filter(p=>p.mode==='strategist').length,
      eventCount:Number(this.meta.eventCount||0),
      serverTs:Date.now()
    };
  }

  sendSocketSet(set,payload){
    const text=JSON.stringify(payload);
    for(const ws of set){ try{ if(ws.readyState===1) ws.send(text); }catch{} }
  }

  broadcastPublicState(includePlayers=true){
    const state=this.publicStateData();
    const payload={kind:'public_state',state};
    this.sendSocketSet(this.publicSockets,payload);
    this.sendSocketSet(this.overlaySockets,payload);
    if(includePlayers){
      const text=JSON.stringify(payload);
      for(const set of this.sockets.values()) for(const ws of set){ try{ if(ws.readyState===1) ws.send(text); }catch{} }
    }
    return state;
  }

  overlayDisplayMs(type){ return type==='bingo'?9800:type==='line'?8200:7200; }

  overlayCellEligible(rule, points){
    if(!this.overlayRoundFirstCellAnnounced) return true;
    const idleFor=Date.now()-Number(this.overlayLastSentAt||0);
    const difficulty=String(rule?.difficulty||'');
    return idleFor>=OVERLAY_IDLE_REMINDER_MS && (difficulty==='hard' || difficulty==='rare' || Number(points||0)>=35);
  }

  overlayPriority(type){
    if(type==='bingo') return 4;
    if(type==='line') return 3;
    return (Date.now()-Number(this.overlayLastSentAt||0)>=OVERLAY_IDLE_REMINDER_MS)?2:1;
  }

  mergeOverlayGroup(target,item){
    target.count=Number(target.count||0)+Number(item.count||1);
    for(const name of item.names||[]){
      if(name && !(target.names||[]).includes(name) && target.names.length<12) target.names.push(name);
    }
    if(Number(item.points||0)>Number(target.points||0)) target.points=Number(item.points||0);
    if((item.type==='line'||item.type==='bingo') && String(item.label||'').length>String(target.label||'').length) target.label=item.label;
  }

  queueOverlayItem(item){
    if(this.overlayPendingGroup && this.overlayPendingGroup.groupKey===item.groupKey){
      this.mergeOverlayGroup(this.overlayPendingGroup,item);
      return;
    }
    this.flushOverlayPendingGroup();
    this.overlayPendingGroup={...item,createdAt:Date.now()};
    this.overlayGroupTimer=setTimeout(()=>{ this.flushOverlayPendingGroup(); }, OVERLAY_GROUP_WINDOW_MS);
  }

  flushOverlayPendingGroup(){
    if(this.overlayGroupTimer){ clearTimeout(this.overlayGroupTimer); this.overlayGroupTimer=null; }
    const item=this.overlayPendingGroup;
    if(!item) return;
    this.overlayPendingGroup=null;
    const insertAt=this.overlayQueue.findIndex(x=>Number(x.priority||0)<Number(item.priority||0));
    if(insertAt<0) this.overlayQueue.push(item);
    else this.overlayQueue.splice(insertAt,0,item);
    this.scheduleOverlayDrain();
  }

  scheduleOverlayDrain(delay=null){
    if(this.overlayDrainTimer) return;
    const now=Date.now();
    const wait=delay==null?Math.max(0,Number(this.overlayNextAllowedAt||0)-now):Math.max(0,delay);
    this.overlayDrainTimer=setTimeout(()=>{ this.overlayDrainTimer=null; this.drainOverlayQueue(); }, wait);
  }

  drainOverlayQueue(){
    const now=Date.now();
    if(this.overlayPendingGroup && !this.overlayGroupTimer) this.flushOverlayPendingGroup();
    const wait=Math.max(0,Number(this.overlayNextAllowedAt||0)-now);
    if(wait>0){ this.scheduleOverlayDrain(wait); return; }
    const item=this.overlayQueue.shift();
    if(!item) return;
    const names=(item.names||[]).filter(Boolean);
    const shownNames=names.slice(0,OVERLAY_NAME_LIMIT);
    const totalCount=Math.max(Number(item.count||shownNames.length||1),shownNames.length||1);
    this.sendOverlay({
      kind:'overlay_announcement',
      type:item.type,
      title:item.type==='bingo'?'¡BINGO!':item.type==='line'?'¡Línea completada!':'¡Casilla completada!',
      label:item.label,
      points:Number(item.points||0),
      names:shownNames,
      extraCount:Math.max(0,totalCount-shownNames.length),
      totalCount,
      difficulty:item.difficulty||null,
      displayMs:Number(item.displayMs||this.overlayDisplayMs(item.type)),
      round:this.meta.round,
      participants:this.participants.size,
      gameClock:this.meta.gameClock,
      sentAt:Date.now()
    });
    this.overlayLastSentAt=now;
    this.overlayNextAllowedAt=now+OVERLAY_MIN_GAP_MS;
    if(this.overlayQueue.length) this.scheduleOverlayDrain(OVERLAY_MIN_GAP_MS);
  }

  trackOverlayAnnouncement(data){
    const type=String(data?.type||'');
    const rule=data.ruleId?RULE_MAP[data.ruleId]:null;
    const points=Number(data?.points||0);
    if(type==='cell'){
      if(!this.overlayCellEligible(rule,points)) return;
      if(!this.overlayRoundFirstCellAnnounced) this.overlayRoundFirstCellAnnounced=true;
    }
    const names=[]; if(data?.name) names.push(cleanDisplayName(data.name));
    this.queueOverlayItem({
      type,
      label:String(data?.label||''),
      points,
      difficulty:data?.difficulty||rule?.difficulty||null,
      names,
      count:1,
      groupKey:type==='cell' ? ('cell:' + String(data.ruleId||data.label||'generic')) : type,
      priority:this.overlayPriority(type),
      displayMs:this.overlayDisplayMs(type)
    });
  }

  activeCards(excludeUserId=null){
    return [...this.participants.entries()]
      .filter(([uid,p])=>uid!==excludeUserId&&p?.status==='active'&&Array.isArray(p.card))
      .map(([,p])=>p.card);
  }
  roundRanking(){
    return [...this.participants.values()].filter(p=>p?.status==='active').map(p=>({
      id:p.userId,name:p.name,roundPoints:Number(p.roundPoints||0),
      totalPoints:Number(this.profiles.get(p.userId)?.totalPoints||0),bingo:!!p.bingo,
      linesCompleted:(p.completedLines||[]).length
    })).sort((a,b)=>b.roundPoints-a.roundPoints||b.linesCompleted-a.linesCompleted||a.name.localeCompare(b.name));
  }
  roundRankFor(userId){const list=this.roundRanking();const i=list.findIndex(x=>x.id===userId);return i<0?null:i+1;}
  roundAwards(){
    const ranking=this.roundRanking();
    if(!ranking.length) return [];
    const rankIndex=new Map(ranking.map((x,i)=>[x.id,i]));
    const active=[...this.participants.values()].filter(p=>p?.status==='active');
    const byRank=(a,b)=>(rankIndex.get(a.userId)??9999)-(rankIndex.get(b.userId)??9999)||String(a.name||'').localeCompare(String(b.name||''));
    const best=(list,compare=null)=>{
      const arr=[...list];
      if(!arr.length) return null;
      arr.sort(compare||byRank);
      return arr[0]||null;
    };
    const awards=[];
    const add=(id,title,icon,p,detail)=>{if(!p)return;awards.push({id,title,icon,userId:p.userId,name:p.name,detail:String(detail||'')});};

    const champ=this.participants.get(ranking[0].id);
    add('mvp','MVP de la ronda','🏆',champ,`${Number(champ?.roundPoints||0)} pts · #1`);

    const bingoPlayers=active.filter(p=>p.bingo&&p.bingoAt);
    const firstBingo=best(bingoPlayers,(a,b)=>{const ta=Date.parse(a.bingoAt||'')||Number.MAX_SAFE_INTEGER,tb=Date.parse(b.bingoAt||'')||Number.MAX_SAFE_INTEGER;return ta-tb||byRank(a,b)});
    add('first_bingo','Primer Bingo','⚡',firstBingo,'Primer jugador en completar Bingo');

    const strategists=active.filter(p=>p.mode==='strategist');
    const strategist=best(strategists);
    if(strategist&&strategists.length>=2) add('strategist','Mejor estratega','🧠',strategist,`${Number(strategist.roundPoints||0)} pts en modo Estratega`);

    const prophets=active.filter(p=>p.predictionCorrect===true);
    const prophet=best(prophets);
    add('prophet','Profeta de la ronda','🔮',prophet,`${Number(prophet?.roundPoints||0)} pts · pronóstico correcto`);

    const swappers=active.filter(p=>Number(p.swapCount||(p.swapUsed?1:0)||0)>0);
    const swapMaster=best(swappers,(a,b)=>Number(b.swapCount||(b.swapUsed?1:0)||0)-Number(a.swapCount||(a.swapUsed?1:0)||0)||byRank(a,b));
    if(swapMaster){const n=Number(swapMaster.swapCount||(swapMaster.swapUsed?1:0)||0);add('swap_master','Maestro del Happy Swap','🔄',swapMaster,`${n} swap${n===1?'':'s'} usado${n===1?'':'s'}`);}

    return awards;
  }
  applyRoundAwards(){
    const awards=this.roundAwards();
    for(const p of this.participants.values()) p.roundAwards=awards.filter(a=>a.userId===p.userId).map(a=>a.id);
    this.meta.lastRoundAwards=awards;
    return awards;
  }

  sendRoundFinalOverlay(awards, kikeWon=null){
    const round=Number(this.meta.round||0);
    if(Number(this.meta.lastOverlayFinalRound||0)===round) return false;
    const ranking=this.roundRanking();
    if(!ranking.length) return false;

    // El cierre de ronda debe salir inmediatamente y reemplazar alertas pendientes.
    this.overlayQueue=[];
    this.overlayPendingGroup=null;
    if(this.overlayGroupTimer){clearTimeout(this.overlayGroupTimer);this.overlayGroupTimer=null;}
    if(this.overlayDrainTimer){clearTimeout(this.overlayDrainTimer);this.overlayDrainTimer=null;}

    const publicAwards=(Array.isArray(awards)?awards:[]).map(a=>({
      id:a.id,title:a.title,icon:a.icon,name:a.name,detail:a.detail
    }));
    const top3=ranking.slice(0,3).map((x,i)=>({
      rank:i+1,name:x.name,roundPoints:Number(x.roundPoints||0),
      bingo:!!x.bingo,linesCompleted:Number(x.linesCompleted||0)
    }));
    const mvp=top3[0]||null;
    this.sendOverlay({
      kind:'overlay_round_final',
      round,
      participants:ranking.length,
      kikeWon:kikeWon==null?(this.meta.lastKikeWon==null?null:!!this.meta.lastKikeWon):!!kikeWon,
      mvp,
      top3,
      awards:publicAwards,
      displayMs:11500,
      sentAt:Date.now()
    });
    this.meta.lastOverlayFinalRound=round;
    this.overlayLastSentAt=Date.now();
    this.overlayNextAllowedAt=this.overlayLastSentAt+12000;
    return true;
  }
  roundFinalPayload(userId,kikeWon=null){
    const p=this.participants.get(userId);
    const profile=this.profiles.get(userId);
    if(!p) return null;
    const ranking=this.roundRanking();
    const idx=ranking.findIndex(x=>x.id===userId);
    return {
      round:Number(this.meta.round||0),
      rank:idx<0?null:idx+1,
      players:ranking.length,
      roundPoints:Number(p.roundPoints||0),
      totalPoints:Number(profile?.totalPoints||0),
      completedCells:Array.isArray(p.completed)?p.completed.length:0,
      totalCells:Array.isArray(p.card)?p.card.length:0,
      linesCompleted:Array.isArray(p.completedLines)?p.completedLines.length:0,
      bingo:!!p.bingo,
      prediction:p.prediction||null,
      predictionCorrect:p.predictionCorrect==null?null:!!p.predictionCorrect,
      predictionPoints:Number(p.predictionPoints||0),
      swapCount:Number(p.swapCount||(p.swapUsed?1:0)||0),
      mode:p.mode||null,
      cardKind:p.cardKind||null,
      multiplier:Number(p.multiplier||1),
      kikeWon:(kikeWon==null?(this.meta.lastKikeWon==null?null:!!this.meta.lastKikeWon):!!kikeWon),
      top:ranking.slice(0,5),
      awards:Array.isArray(this.meta.lastRoundAwards)?this.meta.lastRoundAwards:this.roundAwards(),
      myAwards:Array.isArray(p.roundAwards)?p.roundAwards:[],
      streak:{current:Number(p.currentStreak||profile?.currentStreak||0),best:Number(p.bestStreak||profile?.bestStreak||0),milestone:p.streakMilestone||null},
      finishedAt:this.meta.lastFinalizedAt||nowIso()
    };
  }

  async join(request) {
    const body=await request.json();
    const clientId=cleanDeviceId(body.clientId); const name=cleanDisplayName(body.name);
    if(!clientId) return json({error:"Falta clientId."},400);
    if(!this.env.HAPPY_DB) return json({error:"Happy ID aun no tiene base de datos configurada."},503);
    const legacyProfile=await this.ctx.storage.get("profile:"+clientId); const legacyPoints=Number(legacyProfile?.totalPoints||0);
    let identity; try{identity=await ensureHappyIdentity(this.env.HAPPY_DB,clientId,name,legacyPoints)}catch(err){return json({error:"No se pudo crear/leer Happy ID.",detail:String(err?.message||err)},500)}
    const userId=identity.user.id, dbTotal=Number(identity.user.total_points||0);
    if(this.meta.gameStatus==='finished'&&!this.participants.has(userId)) return json({error:"La partida ya termino. Espera la siguiente ronda."},403);
    if(!this.meta.registrationOpen&&!this.participants.has(userId)) return json({error:"El registro esta cerrado."},403);
    if(!this.participants.has(userId)&&this.participants.size>=MAX_PARTICIPANTS) return json({error:"Happy Bingo esta lleno: 200/200."},409);
    let profile=this.profiles.get(userId)||{userId,name,totalPoints:dbTotal,currentStreak:Number(identity.user.current_streak||0),bestStreak:Number(identity.user.best_streak||0),createdAt:identity.user.created_at||nowIso()};
    profile.name=name; profile.totalPoints=Math.max(Number(profile.totalPoints||0),dbTotal); profile.currentStreak=Math.max(Number(profile.currentStreak||0),Number(identity.user.current_streak||0)); profile.bestStreak=Math.max(Number(profile.bestStreak||0),Number(identity.user.best_streak||0)); this.profiles.set(userId,profile); await this.persistProfile(userId);
    let participant=this.participants.get(userId);
    if(!participant){
      const phase=phaseForMeta(this.meta); const requested=String(body.mode||'blind');
      const lobbyCards=this.activeCards();
      if(phase==='sprint'){
        const card=diverseSprintCard(this.meta,lobbyCards);
        participant={id:userId,userId,name,lastClientId:clientId,card,cardKind:'sprint',mode:'sprint',multiplier:sprintMultiplier(this.meta.gameClock),status:'active',completed:['FREE'],completedLines:[],roundPoints:0,bingo:false,bingoAt:null,joinedAt:nowIso(),joinClock:Number.isFinite(Number(this.meta.gameClock))?Number(this.meta.gameClock):null,lastActiveClock:Number.isFinite(Number(this.meta.gameClock))?Number(this.meta.gameClock):null,connectionCount:0,swapUsed:false,swapCount:0,prediction:null,predictionCorrect:null,predictionPoints:0,cardMaxOverlapAtJoin:maxOverlapAgainst(card,lobbyCards)};
      }else if(requested==='strategist'){
        if(!this.meta.currentHero)return json({error:'El modo estratega se habilita cuando el bridge detecta el héroe elegido. Puedes esperar al pick o entrar a ciegas.'},409);
        const heroName=this.meta.currentHero||null,context={mode:'strategist',heroName};
        const c1=diverseCard(lobbyCards,context),c2=diverseCard([...lobbyCards,c1],context),c3=diverseCard([...lobbyCards,c1,c2],context),c4=diverseCard([...lobbyCards,c1,c2,c3],context);
        participant={id:userId,userId,name,lastClientId:clientId,heroName,card:null,cardOptions:[c1,c2,c3,c4],cardOptionOverlaps:[maxOverlapAgainst(c1,lobbyCards),maxOverlapAgainst(c2,lobbyCards),maxOverlapAgainst(c3,lobbyCards),maxOverlapAgainst(c4,lobbyCards)],cardKind:'full',mode:'strategist',multiplier:STRATEGIST_MULTIPLIER,status:'selecting',completed:[],completedLines:[],roundPoints:0,bingo:false,bingoAt:null,joinedAt:nowIso(),joinClock:Number.isFinite(Number(this.meta.gameClock))?Number(this.meta.gameClock):null,lastActiveClock:Number.isFinite(Number(this.meta.gameClock))?Number(this.meta.gameClock):null,connectionCount:0,swapUsed:false,swapCount:0,prediction:null,predictionCorrect:null,predictionPoints:0};
      }else{
        const card=diverseCard(lobbyCards,{mode:'blind'});
        participant={id:userId,userId,name,lastClientId:clientId,card,cardKind:'full',mode:'blind',multiplier:BLIND_MULTIPLIER,status:'active',completed:['FREE'],completedLines:[],roundPoints:0,bingo:false,bingoAt:null,joinedAt:nowIso(),joinClock:Number.isFinite(Number(this.meta.gameClock))?Number(this.meta.gameClock):null,lastActiveClock:Number.isFinite(Number(this.meta.gameClock))?Number(this.meta.gameClock):null,connectionCount:0,swapUsed:false,swapCount:0,prediction:null,predictionCorrect:null,predictionPoints:0,cardMaxOverlapAtJoin:maxOverlapAgainst(card,lobbyCards)};
      }
      this.participants.set(userId,participant); await this.persistParticipant(userId);
    }else{participant.name=name;participant.lastClientId=clientId;await this.persistParticipant(userId)}
    this.broadcastPublicState();
    return json({ok:true,round:this.meta.round,participant,profile,rules:RULE_MAP,phase:phaseForMeta(this.meta),identity:{...publicUser(identity.user),userId,displayName:name},identityCreated:identity.created,recoveryCode:identity.recoveryCode});
  }

  async selectCard(request){
    const body=await request.json(); const clientId=cleanDeviceId(body.clientId); const user=await userByDevice(this.env.HAPPY_DB,clientId); if(!user)return json({error:'Happy ID no encontrado.'},404);
    const p=this.participants.get(user.id); if(!p||p.status!=='selecting')return json({error:'No tienes una seleccion pendiente.'},409);
    const idx=Number(body.optionIndex); if(!Number.isInteger(idx)||idx<0||idx>3)return json({error:'Opcion invalida.'},400);
    p.card=p.cardOptions[idx]; p.cardMaxOverlapAtJoin=Number(p.cardOptionOverlaps?.[idx]||0); p.cardOptions=null; p.cardOptionOverlaps=null; p.status='active'; p.completed=['FREE']; p.completedLines=[]; p.selectedAt=nowIso(); p.selectedOption=idx; p.autoSelected=false; p.selectionDelaySeconds=Math.max(0,Math.round((Date.parse(p.selectedAt)-Date.parse(p.joinedAt||p.selectedAt))/1000)); p.lastActiveClock=Number.isFinite(Number(this.meta.gameClock))?Number(this.meta.gameClock):p.lastActiveClock; await this.persistParticipant(user.id);
    this.broadcastPublicState();
    return json({ok:true,participant:p,rules:RULE_MAP});
  }

  autoFinalizeSelections(){
    if(!(Number(this.meta.gameClock)>FULL_CHOICE_CUTOFF_SECONDS)) return [];
    const changed=[]; for(const [uid,p] of this.participants){ if(p.status==='selecting'){const opts=p.cardOptions||[];const idx=Math.floor(Math.random()*Math.max(1,opts.length));p.card=opts[idx]||diverseCard(this.activeCards(uid));p.cardMaxOverlapAtJoin=Number(p.cardOptionOverlaps?.[idx]||maxOverlapAgainst(p.card,this.activeCards(uid)));p.cardOptions=null;p.cardOptionOverlaps=null;p.status='active';p.completed=['FREE'];p.completedLines=[];p.selectedAt=nowIso();p.selectedOption=idx;p.autoSelected=true;p.selectionDelaySeconds=Math.max(0,Math.round((Date.parse(p.selectedAt)-Date.parse(p.joinedAt||p.selectedAt))/1000));p.lastActiveClock=Number.isFinite(Number(this.meta.gameClock))?Number(this.meta.gameClock):p.lastActiveClock;changed.push(uid);this.send(uid,{kind:'card_auto_selected'});}}
    return changed;
  }

  swapStatus(){
    const c=Number(this.meta.gameClock),start=Number(this.meta.swapMinute||0)*60;
    const finite=Number.isFinite(c);
    const startsIn=finite?Math.max(0,start-c):null;
    return {open:!!this.meta.swapOpen,minute:this.meta.swapMinute,secondsLeft:this.meta.swapOpen&&finite?Math.max(0,start+SWAP_WINDOW_SECONDS-c):0,startsInSeconds:startsIn,upcoming:!this.meta.swapClosed&&!this.meta.swapOpen&&finite&&startsIn>0&&startsIn<=SWAP_WARNING_SECONDS,maxSwaps:MAX_SWAPS_PER_ROUND};
  }

  async swapOptions(request){
    if(!this.meta.swapOpen)return json({error:'Happy Swap no esta activo.'},409);
    const body=await request.json(); const user=await userByDevice(this.env.HAPPY_DB,cleanDeviceId(body.clientId)); if(!user)return json({error:'Happy ID no encontrado.'},404);
    const p=this.participants.get(user.id); const used=Number(p?.swapCount||(p?.swapUsed?1:0)); if(!p||p.status!=='active'||p.cardKind!=='full'||used>=MAX_SWAPS_PER_ROUND)return json({error:'Ya usaste tus cambios disponibles de Happy Swap.'},409);
    const oldId=String(body.ruleId||''); if(oldId==='FREE'||!p.card.includes(oldId)||(p.completed||[]).includes(oldId))return json({error:'Selecciona una casilla pendiente.'},400);
    const old=RULE_MAP[oldId]; const others=p.card.filter(id=>id!==oldId&&id!=='FREE').map(id=>RULE_MAP[id]).filter(Boolean);
    const itemContext={mode:p.mode,heroName:p.heroName||this.meta.currentHero};
    let candidates=RULE_POOL.filter(r=>r.id!==oldId&&r.category===old.category&&r.difficulty===old.difficulty&&!p.card.includes(r.id)&&itemAllowedForContext(r,itemContext)&&ruleFeasibleForLate(r,this.meta)&&compatibleRule(r,others));
    candidates=shuffle(candidates).filter(r=>{const test=[...p.card];test[test.indexOf(oldId)]=r.id;return validLineBalance(test)});
    if(candidates.length<3){let more=RULE_POOL.filter(r=>r.id!==oldId&&r.category===old.category&&!p.card.includes(r.id)&&itemAllowedForContext(r,itemContext)&&ruleFeasibleForLate(r,this.meta)&&compatibleRule(r,others)&&!candidates.some(x=>x.id===r.id));candidates.push(...shuffle(more));}
    const options=candidates.slice(0,3); if(!options.length)return json({error:'No encontre un reemplazo balanceado para esa casilla.'},409);
    p.pendingSwap={oldRuleId:oldId,options:options.map(r=>r.id)}; await this.persistParticipant(user.id); return json({ok:true,oldRuleId:oldId,options:options.map(r=>RULE_MAP[r.id])});
  }

  async swapCommit(request){
    if(!this.meta.swapOpen)return json({error:'Happy Swap ya cerro.'},409);
    const body=await request.json(); const user=await userByDevice(this.env.HAPPY_DB,cleanDeviceId(body.clientId)); if(!user)return json({error:'Happy ID no encontrado.'},404);
    const p=this.participants.get(user.id); const repl=String(body.replacementId||''); if(!p?.pendingSwap||!p.pendingSwap.options.includes(repl))return json({error:'Reemplazo invalido.'},400);
    const i=p.card.indexOf(p.pendingSwap.oldRuleId); if(i<0)return json({error:'La casilla original ya no existe.'},409); const old=p.card[i]; p.card[i]=repl;p.swapCount=Number(p.swapCount||(p.swapUsed?1:0))+1;p.swapUsed=p.swapCount>0;p.pendingSwap=null;p.lastActiveClock=Number.isFinite(Number(this.meta.gameClock))?Number(this.meta.gameClock):p.lastActiveClock;await this.persistParticipant(user.id);this.send(user.id,{kind:'card_replaced',oldRuleId:old,newRuleId:repl,swapCount:p.swapCount,swapsRemaining:Math.max(0,MAX_SWAPS_PER_ROUND-p.swapCount)});this.broadcastPublicState();return json({ok:true,participant:p,rules:RULE_MAP,swapsRemaining:Math.max(0,MAX_SWAPS_PER_ROUND-p.swapCount)});
  }

  async resolveUserIdFromUrl(url){
    const clientId=cleanDeviceId(url.searchParams.get("clientId")||"");
    if(!clientId||!this.env.HAPPY_DB) return null;
    const user=await userByDevice(this.env.HAPPY_DB,clientId);
    return user?.id||null;
  }

  async prediction(request){
    const body=await request.json(); const clientId=cleanDeviceId(body.clientId);
    const user=await userByDevice(this.env.HAPPY_DB,clientId); if(!user)return json({error:'Happy ID no encontrado.'},404);
    const p=this.participants.get(user.id); if(!p||p.status!=='active'||p.cardKind!=='full')return json({error:'El pronostico solo esta disponible para jugadores que entraron desde el inicio.'},409);
    const clock=Number(this.meta.gameClock); if(Number.isFinite(clock)&&clock>FULL_CHOICE_CUTOFF_SECONDS)return json({error:'El pronostico ya cerro.'},409);
    if(this.meta.gameStatus==='finished')return json({error:'La partida ya termino.'},409);
    const choice=String(body.choice||''); if(!['win','lose'].includes(choice))return json({error:'Pronostico invalido.'},400);
    p.prediction=choice;p.predictionSetAt=nowIso();p.lastActiveClock=Number.isFinite(clock)?clock:p.lastActiveClock;await this.persistParticipant(user.id);
    return json({ok:true,prediction:p.prediction,locksAt:FULL_CHOICE_CUTOFF_SECONDS});
  }

  async playerState(url) {
    const userId=await this.resolveUserIdFromUrl(url);
    if(!userId) return json({error:"Happy ID no encontrado."},404);
    const participant=this.participants.get(userId); const profile=this.profiles.get(userId);
    if(!participant) return json({error:"No estas inscrito en esta ronda."},404);
    const phase=phaseForMeta(this.meta);
    return json({round:this.meta.round,participant,profile,rules:RULE_MAP,activeParticipants:this.participants.size,maxParticipants:MAX_PARTICIPANTS,phase,gameClock:this.meta.gameClock,swap:this.swapStatus(),roundRank:this.roundRankFor(userId),roundTop:this.roundRanking().slice(0,10),predictionOpen:participant.cardKind==='full'&&this.meta.gameStatus!=='finished'&&(!Number.isFinite(Number(this.meta.gameClock))||Number(this.meta.gameClock)<=FULL_CHOICE_CUTOFF_SECONDS),finalResult:phase==='finished'?this.roundFinalPayload(userId,null):null});
  }

  async profileSummary(url){
    const userId=String(url.searchParams.get("userId")||"");
    const profile=this.profiles.get(userId); const participant=this.participants.get(userId);
    return json({
      activeRound:!!participant,
      round:this.meta.round,
      roundPoints:Number(participant?.roundPoints||0),
      bingo:!!participant?.bingo,
      liveTotalPoints:profile?Number(profile.totalPoints||0):null,
      currentStreak:profile?Number(profile.currentStreak||0):0,
      bestStreak:profile?Number(profile.bestStreak||0):0
    });
  }

  async websocket(request, url) {
    const userId=await this.resolveUserIdFromUrl(url);
    if(!userId||!this.participants.has(userId)) return new Response("Jugador no inscrito",{status:404});
    const upgrade=request.headers.get("Upgrade");
    if(!upgrade||upgrade.toLowerCase()!=="websocket") return new Response("Expected WebSocket",{status:426});
    const pair=new WebSocketPair(); const client=pair[0],server=pair[1]; server.accept(); this.addSocket(userId,server);
    server.send(JSON.stringify({kind:"hello",round:this.meta.round,userId}));
    server.send(JSON.stringify({kind:'public_state',state:this.publicStateData()}));
    return new Response(null,{status:101,webSocket:client});
  }

  async overlayWebsocket(request) {
    const upgrade=request.headers.get("Upgrade");
    if(!upgrade||upgrade.toLowerCase()!=="websocket") return new Response("Expected WebSocket",{status:426});
    const pair=new WebSocketPair(); const client=pair[0],server=pair[1]; server.accept();
    this.addOverlaySocket(server);
    server.send(JSON.stringify({kind:'overlay_hello',round:this.meta.round,participants:this.participants.size,gameClock:this.meta.gameClock,registrationOpen:this.meta.registrationOpen}));
    server.send(JSON.stringify({kind:'public_state',state:this.publicStateData()}));
    return new Response(null,{status:101,webSocket:client});
  }

  async publicWebsocket(request) {
    const upgrade=request.headers.get("Upgrade");
    if(!upgrade||upgrade.toLowerCase()!=="websocket") return new Response("Expected WebSocket",{status:426});
    const pair=new WebSocketPair(); const client=pair[0],server=pair[1]; server.accept();
    this.addPublicSocket(server);
    server.send(JSON.stringify({kind:'public_state',state:this.publicStateData()}));
    return new Response(null,{status:101,webSocket:client});
  }

  async flushCurrentRound(){
    if(!this.env.HAPPY_DB) return {ok:false,reason:"no_db"};
    return flushRoundToD1(this.env.HAPPY_DB,this.participants,this.meta,'round_flush');
  }

  async applyEvent(request) {
    const event=await request.json(); if(!event||!event.type)return json({error:'Evento invalido.'},400);
    if(event.type==='MATCH_DETECTED'){
      const id=String(event.matchId||'');
      if(!/^[1-9]\d+$/.test(id))return json({ok:true,ignored:'invalid_match'});
      if(this.meta.currentMatchId===id)return json({ok:true,duplicate:true});
      const early=typeof event.clock==='number'&&event.clock<=120;
      if(early&&(this.meta.gameStatus==='finished'||this.meta.currentMatchId)){
        const reset=await this.adminAction(new Request('https://local/room/admin',{method:'POST',body:JSON.stringify({action:'new-round'})}));
        if(!reset.ok)return reset;
      }
      this.meta.currentMatchId=id;
      this.meta.matchStartAnnouncement=early?{id,startedAt:Date.now(),expiresAt:Date.now()+15000}:null;
      if(early){this.meta.registrationOpen=true;this.meta.gameStatus='active';}
      this.meta.gameClock=event.clock;
      await this.persistMeta();this.broadcastPublicState();
      return json({ok:true,matchDetected:true,announcement:early});
    }
    if(event.matchId&&this.meta.currentMatchId&&String(event.matchId)!==this.meta.currentMatchId)return json({ok:true,ignored:'different_match'});
    this.meta.eventCount++;
    if(Number.isFinite(Number(event.clock))){this.meta.gameClock=Number(event.clock);if(event.clock>=0&&this.meta.gameStatus!=='finished')this.meta.gameStatus='active';}
    if(event.heroName)this.meta.currentHero=normalizeHeroName(event.heroName);
    if(isStats(event)) this.meta.currentStats={kills:Number(event.kills||0),deaths:Number(event.deaths||0),assists:Number(event.assists||0),lastHits:Number(event.lastHits||0),denies:Number(event.denies||0),killStreak:Number(event.killStreak||0),gold:Number(event.gold||0),gpm:Number(event.gpm||0),xpm:Number(event.xpm||0),level:Number(event.level||0),hpPercent:Number(event.hpPercent||0),alive:event.alive!==false,radiantScore:Number(event.radiantScore||0),direScore:Number(event.direScore||0),kikeTeam:event.kikeTeam||null,liveEventMetrics:event.liveEventMetrics||null,matchEventMetrics:event.matchEventMetrics||null};
    const globalDone=new Set(this.meta.completedRuleIds||[]); for(const r of RULE_POOL)if(matchesRule(r.id,event))globalDone.add(r.id);this.meta.completedRuleIds=[...globalDone];
    const auto=this.autoFinalizeSelections(); for(const uid of auto)await this.persistParticipant(uid);
    const c=Number(this.meta.gameClock), startSwap=Number(this.meta.swapMinute||0)*60;
    if(!this.meta.swapClosed&&Number.isFinite(c)&&c>=startSwap&&c<startSwap+SWAP_WINDOW_SECONDS&&!this.meta.swapOpen){this.meta.swapOpen=true;for(const uid of this.participants.keys())this.send(uid,{kind:'swap_open',...this.swapStatus()});}
    if(this.meta.swapOpen&&Number.isFinite(c)&&c>=startSwap+SWAP_WINDOW_SECONDS){this.meta.swapOpen=false;this.meta.swapClosed=true;for(const uid of this.participants.keys())this.send(uid,{kind:'swap_closed'});}
    await this.persistMeta(); const changed=[];
    for(const [userId,p] of this.participants){
      if(p.status!=='active'||!Array.isArray(p.card))continue; const profile=this.profiles.get(userId);if(!profile)continue;let dirty=false;
      const matchedCells=[];
      for(const ruleId of p.card){
        if(ruleId==='FREE'||p.completed.includes(ruleId)||!matchesRule(ruleId,event)) continue;
        p.completed.push(ruleId);
        const base=RULE_MAP[ruleId]?.points||0,pts=awardPoints(base,p.multiplier);
        p.roundPoints+=pts;profile.totalPoints+=pts;dirty=true;
        matchedCells.push({ruleId,label:RULE_MAP[ruleId]?.label||ruleId,points:pts,basePoints:base,difficulty:RULE_MAP[ruleId]?.difficulty||null});
        this.send(userId,{kind:'cell',ruleId,label:RULE_MAP[ruleId]?.label||ruleId,basePoints:base,points:pts,multiplier:p.multiplier,roundPoints:p.roundPoints,totalPoints:profile.totalPoints});
      }
      const already=new Set(p.completedLines||[]),nowLines=lineIndexes(p),newLines=nowLines.filter(i=>!already.has(i));
      let bingoTriggered=false;
      let bingoBonus=0;
      if(newLines.length){
        p.completedLines=[...new Set([...(p.completedLines||[]),...newLines])];
        for(const lineIndex of newLines){
          const lineBonus=awardPoints(LINE_BONUS_BASE,p.multiplier);p.roundPoints+=lineBonus;profile.totalPoints+=lineBonus;dirty=true;
          this.send(userId,{kind:'line',lineIndex,bonus:lineBonus,baseBonus:LINE_BONUS_BASE,linesCompleted:p.completedLines.length,roundPoints:p.roundPoints,totalPoints:profile.totalPoints});
        }
      }
      if(!p.bingo&&hasBingo(p)){
        p.bingo=true;p.bingoAt=nowIso();
        const base=p.cardKind==='sprint'?SPRINT_BINGO_BONUS:FULL_BINGO_BONUS,bonus=awardPoints(base,p.multiplier);
        bingoTriggered=true;bingoBonus=bonus;
        p.roundPoints+=bonus;profile.totalPoints+=bonus;dirty=true;
        this.send(userId,{kind:'bingo',bonus,baseBonus:base,multiplier:p.multiplier,roundPoints:p.roundPoints,totalPoints:profile.totalPoints});
      }
      if(bingoTriggered){
        this.trackOverlayAnnouncement({type:'bingo',name:p.name,label:'Bingo completo',points:bingoBonus});
      }else if(newLines.length){
        const linePoints=awardPoints(LINE_BONUS_BASE,p.multiplier)*newLines.length;
        const lineLabel=newLines.length>1 ? (String(newLines.length) + ' líneas completas') : 'Línea completa';
        this.trackOverlayAnnouncement({type:'line',name:p.name,label:lineLabel,points:linePoints});
      }else if(matchedCells.length){
        const best=matchedCells.sort((a,b)=>Number(b.points||0)-Number(a.points||0))[0];
        this.trackOverlayAnnouncement({type:'cell',name:p.name,label:best.label,points:best.points,ruleId:best.ruleId,difficulty:best.difficulty});
      }
      if(event.type==='GAME_FINISHED'&&p.prediction&&!p.predictionResolved){
        p.predictionResolved=true;p.predictionCorrect=p.prediction===(event.kikeWon===true?'win':'lose');p.predictionPoints=p.predictionCorrect?PREDICTION_BONUS:-PREDICTION_PENALTY;dirty=true;
        p.roundPoints+=p.predictionPoints;profile.totalPoints+=p.predictionPoints;
        this.send(userId,{kind:'prediction_result',choice:p.prediction,correct:p.predictionCorrect,points:p.predictionPoints,roundPoints:p.roundPoints,totalPoints:profile.totalPoints});
      }
      if(dirty)changed.push(userId);
    }
    for(const uid of changed){await this.persistParticipant(uid);await this.persistProfile(uid)}
    let finalized=null;if(event.type==='GAME_FINISHED'){
      this.meta.gameStatus='finished';this.meta.registrationOpen=false;this.meta.swapOpen=false;this.meta.lastKikeWon=event.kikeWon==null?null:!!event.kikeWon;
      const roundNo=Number(this.meta.round||0);
      if(Number(this.meta.lastStreakProcessedRound||0)!==roundNo){
        this.meta.completedRoundSerial=Number(this.meta.completedRoundSerial||0)+1;
        this.meta.lastStreakProcessedRound=roundNo;
      }
      const roundAwards=this.applyRoundAwards();
      this.sendRoundFinalOverlay(roundAwards,event.kikeWon);
      for(const uid of this.participants.keys()) await this.persistParticipant(uid);
      try{
        finalized=await flushRoundToD1(this.env.HAPPY_DB,this.participants,this.meta,'game_finished');
        const streaks=await streakRowsForUsers(this.env.HAPPY_DB,[...this.participants.keys()]);
        for(const [uid,streak] of streaks){
          const p=this.participants.get(uid),profile=this.profiles.get(uid);
          if(p){p.currentStreak=streak.current;p.bestStreak=streak.best;p.streakMilestone=streak.milestone;await this.persistParticipant(uid);}
          if(profile){profile.currentStreak=streak.current;profile.bestStreak=streak.best;await this.persistProfile(uid);}
        }
        this.meta.lastFinalizedRound=this.meta.round;this.meta.lastFinalizedAt=nowIso();
      }catch(err){finalized={ok:false,error:String(err?.message||err)}}
      await this.persistMeta();
      for(const userId of this.participants.keys()){
        const finalResult=this.roundFinalPayload(userId,event.kikeWon);
        if(finalResult) this.send(userId,{kind:'round_finished',result:finalResult});
      }
    }
    this.broadcastPublicState();
    return json({ok:true,eventType:event.type,activeParticipants:this.participants.size,changedPlayers:changed.length,phase:phaseForMeta(this.meta),finalized});
  }

  adminState() {
    return json({...this.meta,...this.publicStateData(),top:this.roundRanking().slice(0,20)});
  }

  async adminAction(request) {
    const body=await request.json(); const action=body.action;
    if(action==="toggle-registration"){
      this.meta.registrationOpen=!this.meta.registrationOpen; await this.persistMeta(); this.broadcastPublicState(); return this.adminState();
    }
    if(action==="overlay-test"){
      const testType=String(body.testType||'cell');
      if(testType==='final'){
        const sampleAwards=[
          {id:'mvp',title:'MVP de la ronda',icon:'🏆',name:'MapacheDota',detail:'420 pts · #1'},
          {id:'first_bingo',title:'Primer Bingo',icon:'⚡',name:'CrystalMai',detail:'Primer Bingo de la ronda'},
          {id:'prophet',title:'Profeta de la ronda',icon:'🔮',name:'MapacheDota',detail:'Pronóstico correcto'}
        ];
        this.sendOverlay({kind:'overlay_round_final',round:this.meta.round,participants:42,kikeWon:true,mvp:{rank:1,name:'MapacheDota',roundPoints:420,bingo:true,linesCompleted:3},top3:[{rank:1,name:'MapacheDota',roundPoints:420,bingo:true,linesCompleted:3},{rank:2,name:'CrystalMai',roundPoints:350,bingo:true,linesCompleted:2},{rank:3,name:'LuisitoGG',roundPoints:275,bingo:false,linesCompleted:2}],awards:sampleAwards,displayMs:11500,sentAt:Date.now(),test:true});
        return json({ok:true,testType,viewers:this.overlaySockets.size});
      }
      const variant=String(body.variant||'single');
      const namesByVariant={
        single:['MapacheDota'],
        double:['MapacheDota','CrystalMai'],
        crowd:['MapacheDota','CrystalMai']
      };
      const names=namesByVariant[variant]||namesByVariant.single;
      const extraCount=variant==='crowd'?8:0;
      const totalCount=names.length+extraCount;
      const presets={
        cell:{title:'¡Casilla completada!',label:'3 kills en 90 segundos',points:50,displayMs:7200,difficulty:'rare'},
        line:{title:'¡Línea completada!',label:'Línea completa',points:50,displayMs:8200,difficulty:'line'},
        bingo:{title:'¡BINGO!',label:'Bingo completo',points:250,displayMs:9800,difficulty:'bingo'},
        rare:{title:'¡Reto difícil!',label:'Aghanim antes del min 20',points:50,displayMs:7600,difficulty:'rare'}
      };
      const preset=presets[testType]||presets.cell;
      this.sendOverlay({kind:'overlay_announcement',type:testType==='rare'?'cell':testType,...preset,names,extraCount,totalCount,round:this.meta.round,participants:this.participants.size,gameClock:this.meta.gameClock,sentAt:Date.now(),test:true});
      return json({ok:true,testType,variant,viewers:this.overlaySockets.size});
    }
    if(action==="overlay-clear"){
      this.sendOverlay({kind:'overlay_clear',sentAt:Date.now(),test:true});
      return json({ok:true,viewers:this.overlaySockets.size});
    }
    if(action==="new-round"){
      // Primero consolidamos Happy Points. La operacion es idempotente por round/userId.
      try{ await flushRoundToD1(this.env.HAPPY_DB,this.participants,this.meta,'new_round'); }catch(err){ return json({error:"No se pudieron consolidar Happy Points. No se cerro la ronda.",detail:String(err?.message||err)},500); }
      for(const userId of this.participants.keys()) this.send(userId,{kind:"round_closed"});
      const keys=[...this.participants.keys()].map(id=>"participant5:"+id); if(keys.length) await this.ctx.storage.delete(keys);
      this.participants.clear(); this.resetOverlayRoundState(); this.meta.round++; this.meta.registrationOpen=true; this.meta.startedAt=nowIso(); this.meta.gameStatus='waiting'; this.meta.gameClock=null; this.meta.lastKikeWon=null; this.meta.lastRoundAwards=[]; this.meta.lastOverlayFinalRound=null; this.meta.currentStats={}; this.meta.currentHero=null; this.meta.completedRuleIds=[]; this.meta.swapMinute=chooseSwapMinute(); this.meta.swapOpen=false; this.meta.swapClosed=false; await this.persistMeta();
      this.broadcastPublicState();
      return this.adminState();
    }
    if(action==="reset-beta"){
      if(String(body.confirm||'')!=="RESET BETA") return json({error:"Confirmacion incorrecta."},400);
      // Reset total de la beta: perfiles, dispositivos, puntos, analytics y estado vivo.
      // No toca secretos, bindings, migraciones ni configuracion del proyecto.
      try{
        for(const [userId,sockets] of this.sockets.entries()){
          for(const ws of sockets){
            try{ if(ws.readyState===1) ws.send(JSON.stringify({kind:"beta_reset"})); }catch{}
            try{ ws.close(1012,"Beta reset"); }catch{}
          }
        }
        this.sockets.clear();
        this.participants.clear();
        this.profiles.clear();
        await this.ctx.storage.deleteAll();

        if(this.env.HAPPY_DB){
          await this.env.HAPPY_DB.batch([
            this.env.HAPPY_DB.prepare("DELETE FROM happy_game_sessions"),
            this.env.HAPPY_DB.prepare("DELETE FROM happy_point_ledger"),
            this.env.HAPPY_DB.prepare("DELETE FROM happy_devices"),
            this.env.HAPPY_DB.prepare("DELETE FROM happy_users")
          ]);
        }

        this.resetOverlayRoundState();
        this.meta={
          round:1,registrationOpen:true,eventCount:0,startedAt:nowIso(),happyGamesCore:3,roundAwardsVersion:1,obsRoundFinalVersion:1,participationStreaksVersion:1,cellEngineVersion:2,lastOverlayFinalRound:null,
          gameStatus:'waiting',gameClock:null,currentStats:{},currentHero:null,completedRuleIds:[],
          swapMinute:chooseSwapMinute(),swapOpen:false,swapClosed:false,lastRoundAwards:[],completedRoundSerial:0,lastStreakProcessedRound:null
        };
        await this.persistMeta();
        this.broadcastPublicState();
        return json({ok:true,reset:true,...(await this.adminState().json())});
      }catch(err){
        return json({error:"No se pudo completar el reset de beta.",detail:String(err?.message||err)},500);
      }
    }
    return json({error:"Accion desconocida."},400);
  }

  async fetch(request) {
    await this.ready; const url=new URL(request.url);
    if(request.method==="POST"&&url.pathname==="/room/join") return this.join(request);
    if(request.method==="POST"&&url.pathname==="/room/select-card") return this.selectCard(request);
    if(request.method==="POST"&&url.pathname==="/room/prediction") return this.prediction(request);
    if(request.method==="POST"&&url.pathname==="/room/swap-options") return this.swapOptions(request);
    if(request.method==="POST"&&url.pathname==="/room/swap-commit") return this.swapCommit(request);
    if(request.method==="GET"&&url.pathname==="/room/player") return this.playerState(url);
    if(request.method==="GET"&&url.pathname==="/room/profile-summary") return this.profileSummary(url);
    if(request.method==="GET"&&url.pathname==="/room/ws") return this.websocket(request,url);
    if(request.method==="GET"&&url.pathname==="/room/overlay-ws") return this.overlayWebsocket(request);
    if(request.method==="GET"&&url.pathname==="/room/public-ws") return this.publicWebsocket(request);
    if(request.method==="GET"&&url.pathname==="/room/public-state") return json(this.publicStateData());
    if(request.method==="POST"&&url.pathname==="/room/event") return this.applyEvent(request);
    if(request.method==="GET"&&url.pathname==="/room/admin") return this.adminState();
    if(request.method==="POST"&&url.pathname==="/room/admin-action") return this.adminAction(request);
    return new Response("Not found",{status:404});
  }
}

function forwardRequest(request, targetUrl) {
  const init = {
    method: request.method,
    headers: request.headers,
    redirect: "manual"
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
  }

  return new Request(targetUrl, init);
}

function room(env) {
  const id = env.BINGO_ROOM.idFromName("happy-bingo-main");
  return env.BINGO_ROOM.get(id);
}

export default {
  async fetch(request, env) {
    const url=new URL(request.url); const stub=room(env);

    if(request.method==="GET"&&url.pathname==="/api/health"){
      return json({ok:true,service:"Happy Games Cell Engine v3",eventProtocolVersion:2,timedRulesEngineVersion:2,balanceGeneratorVersion:6,supportTelemetryVersion:3,obsMatchStartVersion:1,matchTickRequired:true,happyId:!!env.HAPPY_DB,persistentPoints:!!env.HAPPY_DB,analytics:!!env.HAPPY_DB,analyticsVersion:2,roundAwardsVersion:1,obsRoundFinalVersion:1,participationStreaksVersion:1,cellEngineVersion:3});
    }
    if(request.method==="GET"&&url.pathname==="/api/public"){
      return stub.fetch(new Request(new URL("/room/public-state",request.url),{method:"GET"}));
    }
    if(request.method==="GET"&&url.pathname==="/api/public/ws"){
      return stub.fetch(forwardRequest(request,new URL("/room/public-ws",request.url)));
    }

    // Happy ID / Happy Points ---------------------------------------------------
    if(request.method==="GET"&&url.pathname==="/api/me"){
      if(!env.HAPPY_DB) return json({error:"Happy ID no configurado."},503);
      const clientId=cleanDeviceId(url.searchParams.get("clientId"));
      const user=await userByDevice(env.HAPPY_DB,clientId); if(!user) return json({error:"Happy ID no encontrado."},404);
      const bundle=await profileBundle(env.HAPPY_DB,user.id);
      const liveUrl=new URL("/room/profile-summary",request.url); liveUrl.searchParams.set("userId",user.id);
      let live={activeRound:false,roundPoints:0,liveTotalPoints:null};
      try{ live=await (await stub.fetch(new Request(liveUrl,{method:"GET"}))).json(); }catch{}
      const persisted=bundle.user.totalPoints;
      const liveTotal=live.liveTotalPoints==null?persisted:Number(live.liveTotalPoints);
      return json({...bundle,live:{...live,pendingPoints:Math.max(0,liveTotal-persisted),displayTotalPoints:Math.max(persisted,liveTotal)},beta:true});
    }

    if(request.method==="POST"&&url.pathname==="/api/identity/recover"){
      if(!env.HAPPY_DB) return json({error:"Happy ID no configurado."},503);
      const body=await request.json(); const user=await recoverHappyIdentity(env.HAPPY_DB,body.clientId,body.recoveryCode);
      if(!user) return json({error:"Codigo de recuperacion incorrecto."},404);
      return json({ok:true,user:publicUser(user)});
    }

    if(request.method==="POST"&&url.pathname==="/api/identity/rotate-code"){
      if(!env.HAPPY_DB) return json({error:"Happy ID no configurado."},503);
      const body=await request.json(); const clientId=cleanDeviceId(body.clientId);
      const user=await userByDevice(env.HAPPY_DB,clientId); if(!user) return json({error:"Happy ID no encontrado."},404);
      const recoveryCode=await rotateRecoveryCode(env.HAPPY_DB,user.id);
      return json({ok:true,recoveryCode});
    }

    if(request.method==="GET"&&url.pathname==="/api/leaderboard"){
      if(!env.HAPPY_DB) return json({error:"Happy ID no configurado."},503);
      return json({ok:true,players:await leaderboard(env.HAPPY_DB,url.searchParams.get("limit")||20),beta:true});
    }

    // Happy Analytics v2 ---------------------------------------------------------
    if(request.method==="GET"&&url.pathname==="/api/admin/analytics"){
      if(!env.ADMIN_TOKEN||bearer(request)!==env.ADMIN_TOKEN) return unauthorized();
      if(!env.HAPPY_DB) return json({error:"Happy Analytics no configurado."},503);
      try{return json({ok:true,...await analyticsSummary(env.HAPPY_DB,url.searchParams.get("days")||30)});}catch(err){return json({error:"No se pudieron leer analytics. ¿Aplicaste las migraciones 0002 y 0003?",detail:String(err?.message||err)},500);}
    }
    if(request.method==="GET"&&url.pathname==="/api/admin/analytics/rounds"){
      if(!env.ADMIN_TOKEN||bearer(request)!==env.ADMIN_TOKEN) return unauthorized();
      if(!env.HAPPY_DB) return json({error:"Happy Analytics no configurado."},503);
      try{return json({ok:true,...await analyticsRounds(env.HAPPY_DB,url.searchParams.get("days")||30,url.searchParams.get("limit")||30,url.searchParams.get("sourceGame")||"happy_bingo")});}
      catch(err){return json({error:"No se pudieron leer las rondas de Analytics.",detail:String(err?.message||err)},500);}
    }
    if(request.method==="GET"&&url.pathname==="/api/admin/analytics/round"){
      if(!env.ADMIN_TOKEN||bearer(request)!==env.ADMIN_TOKEN) return unauthorized();
      if(!env.HAPPY_DB) return json({error:"Happy Analytics no configurado."},503);
      try{const detail=await analyticsRoundDetail(env.HAPPY_DB,url.searchParams.get("roundId"),url.searchParams.get("sourceGame")||"happy_bingo");return detail?json({ok:true,...detail}):json({error:"Ronda no encontrada."},404);}
      catch(err){return json({error:"No se pudo leer el detalle de la ronda.",detail:String(err?.message||err)},500);}
    }
    if(request.method==="GET"&&url.pathname==="/api/admin/analytics/export"){
      if(!env.ADMIN_TOKEN||bearer(request)!==env.ADMIN_TOKEN) return unauthorized();
      if(!env.HAPPY_DB) return json({error:"Happy Analytics no configurado."},503);
      try{return await analyticsExport(env.HAPPY_DB,url.searchParams.get("format")||"csv",url.searchParams.get("days")||3650);}catch(err){return json({error:"No se pudo exportar analytics.",detail:String(err?.message||err)},500);}
    }

    // Happy Bingo ---------------------------------------------------------------
    if(request.method==="POST"&&url.pathname==="/api/join") return stub.fetch(forwardRequest(request,new URL("/room/join",request.url)));
    if(request.method==="POST"&&url.pathname==="/api/select-card") return stub.fetch(forwardRequest(request,new URL("/room/select-card",request.url)));
    if(request.method==="POST"&&url.pathname==="/api/prediction") return stub.fetch(forwardRequest(request,new URL("/room/prediction",request.url)));
    if(request.method==="POST"&&url.pathname==="/api/swap/options") return stub.fetch(forwardRequest(request,new URL("/room/swap-options",request.url)));
    if(request.method==="POST"&&url.pathname==="/api/swap/commit") return stub.fetch(forwardRequest(request,new URL("/room/swap-commit",request.url)));
    if(request.method==="GET"&&url.pathname==="/api/player"){
      const target=new URL("/room/player",request.url); target.search=url.search; return stub.fetch(forwardRequest(request,target));
    }
    if(request.method==="GET"&&url.pathname==="/ws"){
      const target=new URL("/room/ws",request.url); target.search=url.search; return stub.fetch(forwardRequest(request,target));
    }
    if(request.method==="GET"&&url.pathname==="/api/overlay/ws"){
      return stub.fetch(forwardRequest(request,new URL("/room/overlay-ws",request.url)));
    }
    if(request.method==="POST"&&url.pathname==="/api/event"){
      if(!env.EVENT_TOKEN||bearer(request)!==env.EVENT_TOKEN) return unauthorized();
      return stub.fetch(forwardRequest(request,new URL("/room/event",request.url)));
    }
    if(url.pathname==="/api/admin/state"){
      if(!env.ADMIN_TOKEN||bearer(request)!==env.ADMIN_TOKEN) return unauthorized();
      return stub.fetch(new Request(new URL("/room/admin",request.url),request));
    }
    if(request.method==="POST"&&url.pathname==="/api/admin/action"){
      if(!env.ADMIN_TOKEN||bearer(request)!==env.ADMIN_TOKEN) return unauthorized();
      return stub.fetch(forwardRequest(request,new URL("/room/admin-action",request.url)));
    }

    return env.ASSETS.fetch(request);
  }
};



// Named export used by the local, non-production self-test.
export { matchesRule, randomCard, itemAllowedForContext, RULE_MAP, ruleFeasibleForLate };
