CREATE TABLE IF NOT EXISTS happy_users (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  recovery_hash TEXT NOT NULL UNIQUE,
  total_points INTEGER NOT NULL DEFAULT 0,
  lifetime_points INTEGER NOT NULL DEFAULT 0,
  games_played INTEGER NOT NULL DEFAULT 0,
  bingos INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS happy_devices (
  device_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES happy_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_happy_devices_user ON happy_devices(user_id);

CREATE TABLE IF NOT EXISTS happy_point_ledger (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  source_game TEXT NOT NULL,
  source_round TEXT NOT NULL,
  bingo INTEGER NOT NULL DEFAULT 0,
  details_json TEXT,
  applied INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES happy_users(id) ON DELETE CASCADE,
  UNIQUE(source_game, source_round, user_id, reason)
);

CREATE INDEX IF NOT EXISTS idx_happy_ledger_user_created ON happy_point_ledger(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_happy_ledger_round_pending ON happy_point_ledger(source_game, source_round, applied);
CREATE INDEX IF NOT EXISTS idx_happy_users_points ON happy_users(total_points DESC, lifetime_points DESC);
