CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  username VARCHAR(20) UNIQUE NOT NULL,
  username_normalized VARCHAR(20) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  plan_id TEXT,
  leg_focus TEXT NOT NULL DEFAULT 'quads' CHECK (leg_focus IN ('quads', 'glutes')),
  cycle_position INTEGER NOT NULL DEFAULT 0 CHECK (cycle_position >= 0),
  exercise_selections JSONB NOT NULL DEFAULT '{}'::jsonb,
  plan_customization JSONB NOT NULL DEFAULT '{}'::jsonb,
  display_name VARCHAR(24),
  avatar TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS exercise_selections JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_customization JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name VARCHAR(24);
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT;

CREATE TABLE IF NOT EXISTS sessions (
  token_hash CHAR(64) PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS workouts (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL,
  plan_day_id TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS workouts_user_completed_idx ON workouts(user_id, completed_at DESC);

CREATE TABLE IF NOT EXISTS workout_sets (
  id UUID PRIMARY KEY,
  workout_id UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  exercise_key TEXT NOT NULL,
  exercise_id TEXT NOT NULL,
  exercise_name TEXT NOT NULL,
  set_number INTEGER NOT NULL CHECK (set_number > 0),
  reps INTEGER NOT NULL CHECK (reps > 0 AND reps <= 100),
  weight_kg NUMERIC(7,2) NOT NULL CHECK (weight_kg >= 0 AND weight_kg <= 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workout_id, exercise_key, set_number)
);
CREATE INDEX IF NOT EXISTS workout_sets_workout_idx ON workout_sets(workout_id);
