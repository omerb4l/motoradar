CREATE TYPE report_status AS ENUM ('PENDING', 'REVIEWED', 'RESOLVED');

CREATE TABLE IF NOT EXISTS user_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reported_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rendezvous_id   UUID REFERENCES rendezvous_requests(id) ON DELETE SET NULL,
  reason          TEXT NOT NULL,
  details         TEXT,
  status          report_status NOT NULL DEFAULT 'PENDING',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_user_reports_updated_at BEFORE UPDATE ON user_reports
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_user_reports_reported_id ON user_reports (reported_id);
