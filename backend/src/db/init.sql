-- MotoRadar — PostgreSQL + PostGIS initialization script
-- Requires: PostgreSQL 15+, PostGIS 3.3+

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE sos_alert_type AS ENUM ('AUTO_CRASH', 'MANUAL');
CREATE TYPE sos_alert_status AS ENUM ('ACTIVE', 'FALSE_ALARM', 'RESOLVED', 'CANCELLED');
CREATE TYPE beacon_reason AS ENUM ('OUT_OF_FUEL', 'FLAT_TIRE', 'MECHANICAL', 'OTHER');
CREATE TYPE beacon_status AS ENUM ('ACTIVE', 'HELP_EN_ROUTE', 'RESOLVED', 'CANCELLED');
CREATE TYPE rendezvous_status AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED', 'COMPLETED');
CREATE TYPE chat_kind AS ENUM ('DIRECT', 'GROUP');

-- ============================================================
-- USERS
-- ============================================================

CREATE TABLE users (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username            CITEXT NOT NULL UNIQUE,
  email               CITEXT NOT NULL UNIQUE,
  password_hash       TEXT NOT NULL,
  bio                 VARCHAR(280),
  avatar_url          TEXT,
  spotify_id          TEXT,
  spotify_access_token TEXT,
  spotify_refresh_token TEXT,
  ghost_mode_active   BOOLEAN NOT NULL DEFAULT FALSE,
  is_verified         BOOLEAN NOT NULL DEFAULT FALSE,
  emergency_contact_name  TEXT,
  emergency_contact_phone TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ
);

CREATE INDEX idx_users_username ON users USING btree (username) WHERE deleted_at IS NULL;

-- ============================================================
-- MOTORCYCLES
-- ============================================================

CREATE TABLE motorcycles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  brand         TEXT NOT NULL,
  model         TEXT NOT NULL,
  model_year    SMALLINT CHECK (model_year BETWEEN 1900 AND 2100),
  displacement_cc SMALLINT,
  vin           TEXT UNIQUE,
  is_verified   BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at   TIMESTAMPTZ,
  photo_url     TEXT,
  photo_is_verified BOOLEAN NOT NULL DEFAULT TRUE,
  odometer_mi   INTEGER NOT NULL DEFAULT 0,
  odometer_km   INTEGER NOT NULL DEFAULT 0,
  ownership_start_date TEXT,
  ownership_end_date   TEXT,
  top_speed         DOUBLE PRECISION,
  top_speed_unit    TEXT NOT NULL DEFAULT 'mph' CHECK (top_speed_unit IN ('mph', 'km/h')),
  top_speed_context TEXT,
  top_speed_at      TIMESTAMPTZ,
  max_lean_deg      DOUBLE PRECISION CHECK (max_lean_deg BETWEEN 0 AND 90),
  max_lean_side     TEXT CHECK (max_lean_side IN ('LEFT', 'RIGHT')),
  max_lean_context  TEXT,
  max_lean_at       TIMESTAMPTZ,
  is_primary    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_motorcycles_user_id ON motorcycles (user_id);
-- Only one primary bike per user
CREATE UNIQUE INDEX idx_motorcycles_one_primary_per_user
  ON motorcycles (user_id) WHERE is_primary;

-- ============================================================
-- LIVE_LOCATIONS
-- High write volume (expect ~1 upsert / rider / 1-3s). Modeled as a single
-- row per user (UPSERT), not an append-only log — history belongs in a
-- separate cold-storage table (e.g. TimescaleDB hypertable) if trip
-- playback is needed later. UNLOGGED trades crash-durability for throughput,
-- which is acceptable since this table is pure ephemeral presence state.
-- ============================================================

CREATE UNLOGGED TABLE live_locations (
  user_id           UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  coordinates       GEOGRAPHY(POINT, 4326) NOT NULL,
  heading_deg       REAL CHECK (heading_deg IS NULL OR heading_deg BETWEEN 0 AND 360),
  current_speed     REAL NOT NULL DEFAULT 0 CHECK (current_speed >= 0),
  current_lean_angle REAL CHECK (current_lean_angle IS NULL OR current_lean_angle BETWEEN -90 AND 90),
  is_riding         BOOLEAN NOT NULL DEFAULT FALSE,
  ghost_mode_active BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- GIST index for spatial "riders near me" queries (ST_DWithin)
CREATE INDEX idx_live_locations_coordinates ON live_locations USING GIST (coordinates);
-- Partial index to cheaply exclude stale/ghosted riders from radar queries
CREATE INDEX idx_live_locations_visible ON live_locations (updated_at)
  WHERE ghost_mode_active = FALSE;

-- ============================================================
-- SOS_ALERTS
-- ============================================================

CREATE TABLE sos_alerts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  alert_type      sos_alert_type NOT NULL,
  status          sos_alert_status NOT NULL DEFAULT 'ACTIVE',
  origin_point    GEOGRAPHY(POINT, 4326) NOT NULL,
  location_label  TEXT,
  impact_g_force  REAL,
  seconds_of_no_movement INTEGER,
  notified_user_ids UUID[] NOT NULL DEFAULT '{}',
  resolved_by     UUID REFERENCES users(id),
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sos_alerts_user_id ON sos_alerts (user_id);
CREATE INDEX idx_sos_alerts_active ON sos_alerts (created_at DESC) WHERE status = 'ACTIVE';
CREATE INDEX idx_sos_alerts_origin ON sos_alerts USING GIST (origin_point);

-- ============================================================
-- BREAKDOWN_BEACONS
-- ============================================================

CREATE TABLE breakdown_beacons (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason          beacon_reason NOT NULL,
  note            VARCHAR(280),
  status          beacon_status NOT NULL DEFAULT 'ACTIVE',
  origin_point    GEOGRAPHY(POINT, 4326) NOT NULL,
  notified_rider_count INTEGER NOT NULL DEFAULT 0,
  helper_user_id  UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at     TIMESTAMPTZ
);

CREATE INDEX idx_beacons_user_id ON breakdown_beacons (user_id);
CREATE INDEX idx_beacons_active ON breakdown_beacons (created_at DESC) WHERE status IN ('ACTIVE', 'HELP_EN_ROUTE');
CREATE INDEX idx_beacons_origin ON breakdown_beacons USING GIST (origin_point);

-- ============================================================
-- CHATS
-- ============================================================

CREATE TABLE chats (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind        chat_kind NOT NULL DEFAULT 'DIRECT',
  name        TEXT, -- required for GROUP chats (e.g. "Sunday Canyon Crew")
  created_by  UUID NOT NULL REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_group_has_name CHECK (kind = 'DIRECT' OR name IS NOT NULL)
);

CREATE TABLE chat_participants (
  chat_id     UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_read_at TIMESTAMPTZ,
  PRIMARY KEY (chat_id, user_id)
);

CREATE INDEX idx_chat_participants_user_id ON chat_participants (user_id);

CREATE TABLE chat_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id     UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  sender_id   UUID NOT NULL REFERENCES users(id),
  body        TEXT NOT NULL,
  -- Rendezvous quick-action messages ("I'll come to you") render as system bubbles.
  rendezvous_request_id UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_messages_chat_id_created_at ON chat_messages (chat_id, created_at DESC);

-- ============================================================
-- RENDEZVOUS_REQUESTS
-- ============================================================

CREATE TABLE rendezvous_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id         UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  requester_id    UUID NOT NULL REFERENCES users(id),
  recipient_id    UUID NOT NULL REFERENCES users(id),
  status          rendezvous_status NOT NULL DEFAULT 'PENDING',
  meet_point      GEOGRAPHY(POINT, 4326),
  -- who is travelling to whom, drives the "COME TO ME" / "I'LL COME TO YOU" UI
  traveling_user_id UUID REFERENCES users(id),
  route_polyline  GEOGRAPHY(LINESTRING, 4326),
  eta_minutes     SMALLINT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at    TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  CONSTRAINT chk_requester_ne_recipient CHECK (requester_id <> recipient_id)
);

CREATE INDEX idx_rendezvous_chat_id ON rendezvous_requests (chat_id);
CREATE INDEX idx_rendezvous_active ON rendezvous_requests (recipient_id) WHERE status = 'PENDING';

-- ============================================================
-- FUEL_LOGS
-- ============================================================

CREATE TABLE fuel_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  motorcycle_id   UUID REFERENCES motorcycles(id) ON DELETE CASCADE,
  station_brand   VARCHAR(50),
  liters          NUMERIC(6,2) NOT NULL,
  cost            NUMERIC(8,2) NOT NULL,
  odometer_km     NUMERIC(9,1),
  currency        VARCHAR(10) DEFAULT 'TRY',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_fuel_logs_user_id ON fuel_logs (user_id, created_at DESC);

-- ============================================================
-- MOTO_ALBUM_POSTS (Ride Memories & Photo Log)
-- ============================================================

CREATE TABLE moto_album_posts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  motorcycle_id   UUID REFERENCES motorcycles(id) ON DELETE CASCADE,
  photo_url       TEXT NOT NULL,
  caption         TEXT,
  location_name   TEXT,
  latitude        DOUBLE PRECISION,
  longitude       DOUBLE PRECISION,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_moto_album_user_id ON moto_album_posts (user_id, created_at DESC);

-- ============================================================
-- VEHICLE_REMINDERS (TÜVTÜRK, Insurance, Kasko, Maintenance)
-- ============================================================

CREATE TABLE vehicle_reminders (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  motorcycle_id       UUID REFERENCES motorcycles(id) ON DELETE SET NULL,
  type                TEXT NOT NULL,
  title               TEXT NOT NULL,
  last_completed_date DATE NOT NULL,
  validity_months     INTEGER NOT NULL,
  expiry_date         DATE NOT NULL,
  notes               TEXT,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_vehicle_reminders_user ON vehicle_reminders (user_id, expiry_date ASC);

-- ============================================================
-- RIDE_SUMMARIES (Ride Telemetry, Lean Angle, G-Force & Routes)
-- ============================================================

CREATE TABLE ride_summaries (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  motorcycle_id       UUID REFERENCES motorcycles(id) ON DELETE SET NULL,
  title               TEXT NOT NULL DEFAULT 'Ride Session',
  distance_km         NUMERIC(7,2) NOT NULL DEFAULT 0,
  duration_sec        INTEGER NOT NULL DEFAULT 0,
  avg_speed_kmh       NUMERIC(5,1) NOT NULL DEFAULT 0,
  max_speed_kmh       NUMERIC(5,1) NOT NULL DEFAULT 0,
  max_lean_left_deg   NUMERIC(4,1) NOT NULL DEFAULT 0,
  max_lean_right_deg  NUMERIC(4,1) NOT NULL DEFAULT 0,
  max_g_force         NUMERIC(4,2) NOT NULL DEFAULT 1.0,
  elevation_gain_m    NUMERIC(6,1) NOT NULL DEFAULT 0,
  route_coordinates   JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ride_summaries_user ON ride_summaries (user_id, created_at DESC);

-- ============================================================
-- updated_at triggers
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_motorcycles_updated_at BEFORE UPDATE ON motorcycles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
