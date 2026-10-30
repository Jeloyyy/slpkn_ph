CREATE TABLE IF NOT EXISTS game_rooms (
  room_id text PRIMARY KEY,
  invite_token_hash text NOT NULL,
  visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('public', 'private')),
  player1_token_hash text NOT NULL,
  player2_token_hash text,
  player1_name varchar(24) NOT NULL,
  player2_name varchar(24),
  board jsonb NOT NULL,
  pool1 jsonb NOT NULL,
  pool2 jsonb NOT NULL,
  captured1 jsonb NOT NULL DEFAULT '[]'::jsonb,
  captured2 jsonb NOT NULL DEFAULT '[]'::jsonb,
  setup1 jsonb,
  setup2 jsonb,
  ready1 boolean NOT NULL DEFAULT false,
  ready2 boolean NOT NULL DEFAULT false,
  rematch1 boolean NOT NULL DEFAULT false,
  rematch2 boolean NOT NULL DEFAULT false,
  phase text NOT NULL DEFAULT 'setup' CHECK (phase IN ('setup', 'playing', 'finished')),
  turn smallint NOT NULL DEFAULT 1 CHECK (turn IN (1, 2)),
  winner smallint CHECK (winner IN (1, 2)),
  win_reason text CHECK (win_reason IN ('flag-captured', 'flagged', 'surrender', 'timeout')),
  move_count integer NOT NULL DEFAULT 0,
  last_move jsonb,
  time_control_seconds integer CHECK (time_control_seconds IS NULL OR time_control_seconds BETWEEN 60 AND 3600),
  clock1_ms integer,
  clock2_ms integer,
  clock_started_at timestamptz,
  version integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE game_rooms
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'private';
ALTER TABLE game_rooms
  ADD COLUMN IF NOT EXISTS captured1 jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE game_rooms
  ADD COLUMN IF NOT EXISTS captured2 jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE game_rooms
  ADD COLUMN IF NOT EXISTS win_reason text;
ALTER TABLE game_rooms
  ADD COLUMN IF NOT EXISTS setup1 jsonb;
ALTER TABLE game_rooms
  ADD COLUMN IF NOT EXISTS setup2 jsonb;
ALTER TABLE game_rooms
  ADD COLUMN IF NOT EXISTS rematch1 boolean NOT NULL DEFAULT false;
ALTER TABLE game_rooms
  ADD COLUMN IF NOT EXISTS rematch2 boolean NOT NULL DEFAULT false;
ALTER TABLE game_rooms
  ADD COLUMN IF NOT EXISTS last_move jsonb;
ALTER TABLE game_rooms
  ADD COLUMN IF NOT EXISTS time_control_seconds integer;
ALTER TABLE game_rooms
  ADD COLUMN IF NOT EXISTS clock1_ms integer;
ALTER TABLE game_rooms
  ADD COLUMN IF NOT EXISTS clock2_ms integer;
ALTER TABLE game_rooms
  ADD COLUMN IF NOT EXISTS clock_started_at timestamptz;

ALTER TABLE game_rooms DROP CONSTRAINT IF EXISTS game_rooms_win_reason_check;
ALTER TABLE game_rooms
  ADD CONSTRAINT game_rooms_win_reason_check
  CHECK (win_reason IS NULL OR win_reason IN ('flag-captured', 'flagged', 'surrender', 'timeout'));
ALTER TABLE game_rooms DROP CONSTRAINT IF EXISTS game_rooms_time_control_seconds_check;
ALTER TABLE game_rooms
  ADD CONSTRAINT game_rooms_time_control_seconds_check
  CHECK (time_control_seconds IS NULL OR time_control_seconds BETWEEN 60 AND 3600);

CREATE INDEX IF NOT EXISTS game_rooms_updated_at_idx ON game_rooms (updated_at);
CREATE INDEX IF NOT EXISTS game_rooms_lobby_idx ON game_rooms (visibility, phase, updated_at DESC);
