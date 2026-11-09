CREATE TABLE IF NOT EXISTS banner_designs (
  banner_id INTEGER PRIMARY KEY REFERENCES banners(id),
  design_json TEXT NOT NULL CHECK(json_valid(design_json)),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
