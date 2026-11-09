-- Media ingestion pipeline: Dropbox link → Bunny Stream fetch jobs.
-- One row per ingest request; the widget and section badges read from it.
CREATE TABLE IF NOT EXISTS media_ingest_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dropbox_url TEXT NOT NULL,
  fetch_url TEXT NOT NULL,
  title TEXT NOT NULL,
  destination TEXT NOT NULL CHECK(destination IN ('sermon','teaching','show','video')),
  series_id INTEGER,
  season_id INTEGER,
  content_table TEXT,
  content_id INTEGER,
  bunny_video_id TEXT,
  phase TEXT NOT NULL DEFAULT 'fetching' CHECK(phase IN ('fetching','transcoding','complete','failed','cancelled')),
  progress INTEGER NOT NULL DEFAULT 0 CHECK(progress BETWEEN 0 AND 100),
  bunny_status INTEGER,
  thumbnail_url TEXT,
  duration INTEGER,
  resolutions TEXT,
  error TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS media_ingest_jobs_guid ON media_ingest_jobs(bunny_video_id);
CREATE INDEX IF NOT EXISTS media_ingest_jobs_active ON media_ingest_jobs(phase) WHERE phase IN ('fetching','transcoding');
