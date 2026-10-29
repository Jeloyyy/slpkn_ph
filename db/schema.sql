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
  ready1 boolean NOT NULL DEFAULT false,
  ready2 boolean NOT NULL DEFAULT false,
  phase text NOT NULL DEFAULT 'setup' CHECK (phase IN ('setup', 'playing', 'finished')),
  turn smallint NOT NULL DEFAULT 1 CHECK (turn IN (1, 2)),
  winner smallint CHECK (winner IN (1, 2)),
  win_reason text CHECK (win_reason IN ('flag-captured', 'flagged', 'surrender')),
  move_count integer NOT NULL DEFAULT 0,
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

CREATE INDEX IF NOT EXISTS game_rooms_updated_at_idx ON game_rooms (updated_at);
CREATE INDEX IF NOT EXISTS game_rooms_lobby_idx ON game_rooms (visibility, phase, updated_at DESC);
