-- Extension infrastructure (M7): config key-value store + error log sink

CREATE TABLE IF NOT EXISTS extension_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed defaults
INSERT OR IGNORE INTO extension_config (key, value) VALUES ('baseUrl', '"http://localhost:3000"');
INSERT OR IGNORE INTO extension_config (key, value) VALUES ('devMode', 'false');
INSERT OR IGNORE INTO extension_config (key, value) VALUES ('enabledPlugins', '["linkedin"]');
INSERT OR IGNORE INTO extension_config (key, value) VALUES ('enableServerLogging', 'true');

CREATE TABLE IF NOT EXISTS extension_logs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))),
  error_code TEXT NOT NULL,
  message TEXT NOT NULL,
  layer TEXT NOT NULL,
  plugin TEXT,
  url TEXT,
  context TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_extension_logs_created_at ON extension_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_extension_logs_error_code ON extension_logs(error_code);
