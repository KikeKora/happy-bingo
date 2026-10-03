ALTER TABLE happy_users ADD COLUMN current_streak INTEGER NOT NULL DEFAULT 0;
ALTER TABLE happy_users ADD COLUMN best_streak INTEGER NOT NULL DEFAULT 0;
ALTER TABLE happy_users ADD COLUMN last_streak_round INTEGER;
ALTER TABLE happy_users ADD COLUMN last_streak_serial INTEGER;
ALTER TABLE happy_users ADD COLUMN streak_updated_at TEXT;
