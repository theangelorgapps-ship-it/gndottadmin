-- One-time capture of the public website's former fallback slides into editable banners.
-- Apply to the shared D1 database before deploying the new admin/public loaders.
-- Reruns preserve later edits, order, hidden/deleted banners, and the original selection.
-- Existing active legacy banners are retained after the formerly visible slides.
CREATE TABLE IF NOT EXISTS banner_order (
  banner_id INTEGER PRIMARY KEY REFERENCES banners(id),
  sort_order INTEGER NOT NULL CHECK(sort_order >= 0)
);
CREATE TABLE IF NOT EXISTS banner_backfill_runs (
  name TEXT PRIMARY KEY,
  completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS banner_backfill_20261109 (
  placement TEXT NOT NULL,
  type TEXT NOT NULL,
  type_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  PRIMARY KEY(placement,type,type_id)
);

-- Home formerly used the first three of top10 (total_views DESC); catalogue
-- pages used their first five artwork-bearing titles (name NOCASE, id).
-- Preserve placements that already had a valid authored hero instead of seeding.
WITH configured AS (
  SELECT DISTINCT b.banner_for FROM banners b JOIN banner_designs d ON d.banner_id=b.id
  LEFT JOIN entertainments e ON b.type!='video' AND e.id=b.type_id AND e.type=b.type AND e.status=1 AND e.deleted_at IS NULL
  LEFT JOIN videos v ON b.type='video' AND v.id=b.type_id AND v.status=1 AND v.deleted_at IS NULL
  WHERE b.status=1 AND b.deleted_at IS NULL AND (e.id IS NOT NULL OR v.id IS NOT NULL)
), ranked AS (
  SELECT 'home' AS placement, type, id AS type_id, name AS title,
    ROW_NUMBER() OVER (ORDER BY total_views DESC,id) AS sort_order, 3 AS max_slides
  FROM entertainments WHERE status=1 AND deleted_at IS NULL
  UNION ALL
  SELECT CASE WHEN type='tvshow' THEN 'tv_show' ELSE type END, type, id, name,
    ROW_NUMBER() OVER (PARTITION BY type ORDER BY name COLLATE NOCASE,id), 5
  FROM entertainments WHERE type IN ('movie','teaching','tvshow') AND status=1 AND deleted_at IS NULL
    AND TRIM(COALESCE(name,''))!='' AND (COALESCE(thumbnail_url,'')!='' OR COALESCE(poster_url,'')!='')
  UNION ALL
  SELECT 'video', 'video', id, name, ROW_NUMBER() OVER (ORDER BY name COLLATE NOCASE,id), 5
  FROM videos WHERE status=1 AND deleted_at IS NULL AND TRIM(COALESCE(name,''))!=''
    AND (COALESCE(thumbnail_url,'')!='' OR COALESCE(poster_url,'')!='')
)
INSERT OR IGNORE INTO banner_backfill_20261109 (placement,type,type_id,title,sort_order)
SELECT placement,type,type_id,COALESCE(title,'Featured title'),sort_order FROM ranked
WHERE sort_order<=max_slides AND type IN ('movie','teaching','tvshow','video')
  AND placement NOT IN (SELECT banner_for FROM configured)
  AND NOT EXISTS (SELECT 1 FROM banner_backfill_runs WHERE name='20261109_hero_connection');

-- Do not copy artwork: empty overrides deliberately follow the title's current images.
-- Reuse an already-active matching record; archived banners remain archived.
INSERT INTO banners (title,type,type_id,banner_for,status,file_url,poster_url,created_at,updated_at)
SELECT c.title,c.type,c.type_id,c.placement,1,'','',datetime('now'),datetime('now')
FROM banner_backfill_20261109 c
WHERE NOT EXISTS (SELECT 1 FROM banner_backfill_runs WHERE name='20261109_hero_connection')
  AND NOT EXISTS (SELECT 1 FROM banners b WHERE b.banner_for=c.placement AND b.type=c.type AND b.type_id=c.type_id AND b.status=1 AND b.deleted_at IS NULL)
ORDER BY c.placement,c.sort_order;

-- Populate missing names only. Never replace existing custom names or artwork.
UPDATE banners SET title=COALESCE(
  CASE WHEN type='video' THEN (SELECT name FROM videos WHERE id=banners.type_id)
    ELSE (SELECT name FROM entertainments WHERE id=banners.type_id AND type=banners.type) END,
  'Featured title'),updated_at=datetime('now')
WHERE deleted_at IS NULL AND TRIM(COALESCE(title,''))=''
  AND NOT EXISTS (SELECT 1 FROM banner_backfill_runs WHERE name='20261109_hero_connection');

-- Former fallback selections lead; other existing records retain their relative order.
INSERT OR IGNORE INTO banner_order (banner_id,sort_order)
SELECT b.id,COALESCE(c.sort_order,1000+b.id) FROM banners b
LEFT JOIN banner_backfill_20261109 c ON c.placement=b.banner_for AND c.type=b.type AND c.type_id=b.type_id
WHERE b.deleted_at IS NULL AND NOT EXISTS (SELECT 1 FROM banner_backfill_runs WHERE name='20261109_hero_connection');

INSERT OR IGNORE INTO banner_designs (banner_id,design_json)
SELECT id,'{"version":1,"devices":{}}' FROM banners
WHERE deleted_at IS NULL AND NOT EXISTS (SELECT 1 FROM banner_backfill_runs WHERE name='20261109_hero_connection');

INSERT OR IGNORE INTO banner_backfill_runs (name) VALUES ('20261109_hero_connection');
