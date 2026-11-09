-- Public R2 catalog only. Private account images are never discovered or OCR indexed.
CREATE TABLE IF NOT EXISTS media_asset_index (
  key TEXT PRIMARY KEY, name TEXT NOT NULL, folder TEXT NOT NULL, size INTEGER NOT NULL,
  etag TEXT NOT NULL, uploaded TEXT, kind TEXT NOT NULL,
  ocr_status TEXT NOT NULL DEFAULT 'pending' CHECK(ocr_status IN ('pending','processing','ready','error','unsupported')),
  ocr_text TEXT NOT NULL DEFAULT '', confidence REAL, ocr_error TEXT,
  lease TEXT, lease_owner INTEGER, lease_until INTEGER, attempts INTEGER NOT NULL DEFAULT 0,
  seen_scan INTEGER NOT NULL DEFAULT 0, indexed_at TEXT, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS media_asset_folder_date ON media_asset_index(folder, uploaded);
CREATE INDEX IF NOT EXISTS media_asset_ocr_queue ON media_asset_index(ocr_status, lease_until);
CREATE TABLE IF NOT EXISTS media_scan_state (
  id INTEGER PRIMARY KEY CHECK(id=1), cursor TEXT, generation INTEGER NOT NULL DEFAULT 0,
  finished INTEGER NOT NULL DEFAULT 0, discovered INTEGER NOT NULL DEFAULT 0,
  lease TEXT, lease_until INTEGER, updated_at TEXT
);
INSERT OR IGNORE INTO media_scan_state(id) VALUES(1);
CREATE TABLE IF NOT EXISTS media_action_limits (
  bucket TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS media_audit_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, action TEXT NOT NULL,
  media_key TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
