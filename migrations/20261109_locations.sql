-- Locations and their typed title associations. Referenced by the admin panel
-- (adminListLocations, sermon editors) and the media-ingest/bulk-upload mapping,
-- but never created by an earlier migration in this repo.
CREATE TABLE IF NOT EXISTS locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  file_url TEXT,
  description TEXT,
  address TEXT,
  source_cast_crew_id INTEGER,
  status INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS content_location_mapping (
  location_id INTEGER NOT NULL,
  content_type TEXT NOT NULL,
  content_id INTEGER NOT NULL,
  PRIMARY KEY (location_id, content_type, content_id)
);
