-- Preserve current stream/chat settings while adding validated provider embeds.
CREATE TABLE live_channel_settings_next (
 channel_id INTEGER PRIMARY KEY REFERENCES live_tv_channel(id),
 source_kind TEXT NOT NULL DEFAULT 'hls' CHECK(source_kind IN ('hls','rtmp','embed')),
 hls_url TEXT, ingest_url TEXT, embed_url TEXT,
 comments_enabled INTEGER NOT NULL DEFAULT 1 CHECK(comments_enabled IN (0,1)),
 slow_mode INTEGER NOT NULL DEFAULT 5 CHECK(slow_mode BETWEEN 0 AND 120),
 updated_by INTEGER, updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO live_channel_settings_next(channel_id,source_kind,hls_url,ingest_url,comments_enabled,slow_mode,updated_by,updated_at)
 SELECT channel_id,source_kind,hls_url,ingest_url,comments_enabled,slow_mode,updated_by,updated_at FROM live_channel_settings;
DROP TABLE live_channel_settings;
ALTER TABLE live_channel_settings_next RENAME TO live_channel_settings;
