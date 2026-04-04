-- Migration: 002_seed_data
-- Sample seed data for development / demo

BEGIN;

INSERT INTO urls (short_code, original_url, title, expires_at)
VALUES
  ('gh-repo',  'https://github.com',             'GitHub Homepage',        NOW() + INTERVAL '365 days'),
  ('yt-main',  'https://www.youtube.com',         'YouTube',                NOW() + INTERVAL '365 days'),
  ('ggl',      'https://www.google.com',          'Google Search',          NOW() + INTERVAL '365 days'),
  ('wiki-en',  'https://en.wikipedia.org',        'Wikipedia English',      NOW() + INTERVAL '365 days'),
  ('npm-docs', 'https://docs.npmjs.com',          'NPM Documentation',      NOW() + INTERVAL '365 days')
ON CONFLICT (short_code) DO NOTHING;

INSERT INTO schema_migrations (version)
VALUES ('002_seed_data')
ON CONFLICT (version) DO NOTHING;

COMMIT;
