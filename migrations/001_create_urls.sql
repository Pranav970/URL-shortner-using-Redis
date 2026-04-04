BEGIN;

-- ─── URLs table ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS urls (
  id            BIGSERIAL     PRIMARY KEY,
  short_code    VARCHAR(60)   NOT NULL,
  original_url  TEXT          NOT NULL,
  title         VARCHAR(255),
  click_count   BIGINT        NOT NULL DEFAULT 0,
  expires_at    TIMESTAMPTZ,
  is_active     BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Unique index on short_code — the primary lookup key
-- Using a partial index on is_active for hot-path query
CREATE UNIQUE INDEX IF NOT EXISTS idx_urls_short_code
  ON urls (short_code);

-- Index for the hot-path redirect query (active, non-expired lookups)
CREATE INDEX IF NOT EXISTS idx_urls_active_lookup
  ON urls (short_code)
  WHERE is_active = TRUE;

-- Index to support cleanup job (find expired URLs fast)
CREATE INDEX IF NOT EXISTS idx_urls_expires_at
  ON urls (expires_at)
  WHERE expires_at IS NOT NULL;

-- Index for sorting/pagination in admin list view
CREATE INDEX IF NOT EXISTS idx_urls_created_at
  ON urls (created_at DESC);

-- ─── Clicks (analytics) table ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clicks (
  id          BIGSERIAL   PRIMARY KEY,
  url_id      BIGINT      NOT NULL REFERENCES urls(id) ON DELETE CASCADE,
  ip_address  INET,
  user_agent  TEXT,
  referer     TEXT,
  country     VARCHAR(2),
  clicked_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for analytics queries grouping clicks by url
CREATE INDEX IF NOT EXISTS idx_clicks_url_id
  ON clicks (url_id);

-- Index for time-range analytics queries
CREATE INDEX IF NOT EXISTS idx_clicks_clicked_at
  ON clicks (clicked_at DESC);

-- Composite index for "per-url time series" queries
CREATE INDEX IF NOT EXISTS idx_clicks_url_time
  ON clicks (url_id, clicked_at DESC);

-- ─── Schema migrations tracking table ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS schema_migrations (
  version     VARCHAR(50) PRIMARY KEY,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO schema_migrations (version)
VALUES ('001_create_urls')
ON CONFLICT (version) DO NOTHING;

COMMIT;
