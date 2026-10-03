-- PlanetScale Postgres schema for Dyad
-- Apply on port 5432 (direct), not PgBouncer (6432).

CREATE TABLE IF NOT EXISTS studies (
  id UUID PRIMARY KEY,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  declined_task_ids TEXT[] NOT NULL DEFAULT '{}',
  session_id UUID
);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY,
  study_id UUID NOT NULL REFERENCES studies (id) ON DELETE CASCADE,
  task_id TEXT NOT NULL,
  stimulus_mode TEXT NOT NULL CHECK (stimulus_mode IN ('text', 'image')),
  partner_type TEXT NOT NULL CHECK (partner_type IN ('human', 'ai')),
  join_code TEXT NOT NULL UNIQUE,
  phase TEXT NOT NULL,
  partner_name TEXT NOT NULL,
  participant_name TEXT NOT NULL,
  solo_original TEXT NOT NULL DEFAULT '',
  grammar_draft TEXT NOT NULL DEFAULT '',
  locked_solo TEXT NOT NULL DEFAULT '',
  document TEXT NOT NULL DEFAULT '',
  pending_suggestion TEXT,
  solo_quality SMALLINT,
  solo_experience SMALLINT,
  relative_quality SMALLINT,
  relative_experience SMALLINT,
  epiphany BOOLEAN,
  epiphany_trace DOUBLE PRECISION[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  connected_at TIMESTAMPTZ,
  participant_heartbeat TIMESTAMPTZ,
  partner_heartbeat TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS sessions_study_id_idx ON sessions (study_id);
CREATE INDEX IF NOT EXISTS sessions_phase_idx ON sessions (phase);
CREATE INDEX IF NOT EXISTS sessions_created_at_idx ON sessions (created_at DESC);
CREATE INDEX IF NOT EXISTS sessions_partner_type_idx ON sessions (partner_type);
CREATE INDEX IF NOT EXISTS sessions_stimulus_mode_idx ON sessions (stimulus_mode);

CREATE TABLE IF NOT EXISTS drafts (
  id UUID PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  at TIMESTAMPTZ NOT NULL,
  source TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS drafts_session_id_idx ON drafts (session_id, at);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
  sender TEXT NOT NULL,
  text TEXT NOT NULL,
  at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS messages_session_id_idx ON messages (session_id, at);

CREATE INDEX IF NOT EXISTS sessions_search_idx ON sessions
  USING gin (to_tsvector('simple', coalesce(participant_name, '') || ' ' || coalesce(locked_solo, '') || ' ' || coalesce(document, '')));
