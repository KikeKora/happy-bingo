CREATE TABLE IF NOT EXISTS happy_game_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  display_name_snapshot TEXT NOT NULL,
  source_game TEXT NOT NULL DEFAULT 'happy_bingo',
  round_id TEXT NOT NULL,
  round_started_at TEXT,
  joined_at TEXT,
  join_clock INTEGER,
  mode TEXT,
  card_kind TEXT,
  multiplier REAL NOT NULL DEFAULT 1,
  strategist_option INTEGER,
  selection_delay_seconds INTEGER,
  auto_selected INTEGER NOT NULL DEFAULT 0,
  swap_used INTEGER NOT NULL DEFAULT 0,
  completed_cells INTEGER NOT NULL DEFAULT 0,
  bingo INTEGER NOT NULL DEFAULT 0,
  round_points INTEGER NOT NULL DEFAULT 0,
  connection_count INTEGER NOT NULL DEFAULT 0,
  active_seconds_approx INTEGER,
  last_active_clock INTEGER,
  final_game_clock INTEGER,
  finalize_reason TEXT,
  card_json TEXT,
  completed_json TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, source_game, round_id)
);

CREATE INDEX IF NOT EXISTS idx_happy_game_sessions_created_at
  ON happy_game_sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_happy_game_sessions_user
  ON happy_game_sessions(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_happy_game_sessions_round
  ON happy_game_sessions(source_game, round_id);
CREATE INDEX IF NOT EXISTS idx_happy_game_sessions_mode
  ON happy_game_sessions(mode, created_at);
