ALTER TABLE happy_game_sessions ADD COLUMN swap_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE happy_game_sessions ADD COLUMN lines_completed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE happy_game_sessions ADD COLUMN prediction_choice TEXT;
ALTER TABLE happy_game_sessions ADD COLUMN prediction_correct INTEGER;
ALTER TABLE happy_game_sessions ADD COLUMN prediction_points INTEGER NOT NULL DEFAULT 0;
ALTER TABLE happy_game_sessions ADD COLUMN max_card_overlap INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_happy_game_sessions_prediction
  ON happy_game_sessions(prediction_choice, created_at);
