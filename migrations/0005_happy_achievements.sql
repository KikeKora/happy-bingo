CREATE TABLE IF NOT EXISTS happy_user_achievements (
  user_id TEXT NOT NULL,
  achievement_id TEXT NOT NULL,
  unlocked_at TEXT NOT NULL,
  source_game TEXT NOT NULL DEFAULT 'happy_bingo',
  source_round TEXT,
  details_json TEXT,
  PRIMARY KEY (user_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_happy_user_achievements_user_unlocked
  ON happy_user_achievements(user_id, unlocked_at DESC);
