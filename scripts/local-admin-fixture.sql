PRAGMA foreign_keys = OFF;

CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, first_name TEXT, last_name TEXT,
  email TEXT UNIQUE, mobile TEXT, password TEXT, login_type TEXT, file_url TEXT,
  gender TEXT, date_of_birth TEXT, user_type TEXT, status INTEGER DEFAULT 1,
  is_banned INTEGER DEFAULT 0, is_subscribe INTEGER DEFAULT 0,
  created_at TEXT, updated_at TEXT, deleted_at TEXT
);
CREATE TABLE user_multi_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, name TEXT, avatar TEXT,
  is_child_profile INTEGER DEFAULT 0, created_at TEXT, updated_at TEXT, deleted_at TEXT
);
CREATE TABLE genres (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, slug TEXT, description TEXT,
  poster_url TEXT, thumbnail_url TEXT, status INTEGER DEFAULT 1,
  created_at TEXT, updated_at TEXT, deleted_at TEXT
);
CREATE TABLE entertainments (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, type TEXT, slug TEXT,
  description TEXT, short_description TEXT, release_date TEXT, language TEXT,
  movie_access TEXT DEFAULT 'free', content_rating TEXT, IMDb_rating TEXT,
  duration TEXT, status INTEGER DEFAULT 1, poster_url TEXT, thumbnail_url TEXT,
  trailer_url TEXT, trailer_url_type TEXT, video_upload_type TEXT, video_url_input TEXT,
  bunny_video_url TEXT, bunny_trailer_url TEXT, enable_quality INTEGER DEFAULT 0,
  enable_subtitle INTEGER DEFAULT 0, subtitle_file TEXT, subtitle_language TEXT,
  is_default_subtitle INTEGER DEFAULT 0, is_restricted INTEGER DEFAULT 0,
  price REAL, purchase_type TEXT, access_duration INTEGER, discount REAL,
  available_for TEXT, plan_id INTEGER, meta_title TEXT, meta_keywords TEXT,
  meta_description TEXT, seo_image TEXT, total_views INTEGER DEFAULT 0,
  created_by INTEGER, updated_by INTEGER, created_at TEXT, updated_at TEXT, deleted_at TEXT
);
CREATE TABLE entertainment_gener_mapping (
  id INTEGER PRIMARY KEY AUTOINCREMENT, entertainment_id INTEGER, genre_id INTEGER,
  created_at TEXT, updated_at TEXT
);
CREATE TABLE entertainment_talent_mapping (
  id INTEGER PRIMARY KEY AUTOINCREMENT, entertainment_id INTEGER, talent_id INTEGER,
  type TEXT, created_at TEXT, updated_at TEXT
);
CREATE TABLE entertainment_views (
  id INTEGER PRIMARY KEY AUTOINCREMENT, entertainment_id INTEGER, user_id INTEGER,
  created_at TEXT
);
CREATE TABLE cast_crew (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, type TEXT, designation TEXT,
  file_url TEXT, dob TEXT, place_of_birth TEXT, bio TEXT, status INTEGER DEFAULT 1,
  created_at TEXT, updated_at TEXT, deleted_at TEXT
);
CREATE TABLE seasons (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, entertainment_id INTEGER,
  season_number INTEGER, season_index TEXT, poster_url TEXT, access TEXT DEFAULT 'free',
  price REAL, short_desc TEXT, description TEXT, status INTEGER DEFAULT 1,
  created_at TEXT, updated_at TEXT, deleted_at TEXT
);
CREATE TABLE episodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, entertainment_id INTEGER,
  season_id INTEGER, episode_number INTEGER, duration TEXT, release_date TEXT,
  poster_url TEXT, video_url_input TEXT, video_upload_type TEXT, bunny_video_url TEXT,
  IMDb_rating TEXT, access TEXT DEFAULT 'free', price REAL, short_desc TEXT,
  description TEXT, enable_subtitle INTEGER DEFAULT 0, subtitle_file TEXT,
  subtitle_language TEXT, meta_title TEXT, meta_keywords TEXT, meta_description TEXT,
  status INTEGER DEFAULT 1, created_at TEXT, updated_at TEXT, deleted_at TEXT
);
CREATE TABLE videos (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, slug TEXT, description TEXT,
  duration TEXT, release_date TEXT, status INTEGER DEFAULT 1, poster_url TEXT,
  thumbnail_url TEXT, trailer_url TEXT, video_url_input TEXT, video_upload_type TEXT,
  bunny_video_url TEXT, access TEXT DEFAULT 'free', price REAL, IMDb_rating TEXT,
  enable_subtitle INTEGER DEFAULT 0, subtitle_file TEXT, subtitle_language TEXT,
  meta_title TEXT, meta_keywords TEXT, meta_description TEXT,
  created_by INTEGER, updated_by INTEGER, created_at TEXT, updated_at TEXT, deleted_at TEXT
);
CREATE TABLE live_tv_category (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, file_url TEXT, description TEXT,
  status INTEGER DEFAULT 1, created_at TEXT, updated_at TEXT, deleted_at TEXT
);
CREATE TABLE live_tv_channel (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, category_id INTEGER, access TEXT,
  description TEXT, poster_url TEXT, status INTEGER DEFAULT 1,
  created_at TEXT, updated_at TEXT, deleted_at TEXT
);
CREATE TABLE plan (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, identifier TEXT, price REAL,
  discount REAL, total_price REAL, duration TEXT, duration_value INTEGER, level INTEGER,
  status INTEGER DEFAULT 1, description TEXT, created_by INTEGER, updated_by INTEGER,
  created_at TEXT, updated_at TEXT, deleted_at TEXT
);
CREATE TABLE planlimitation (
  id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, slug TEXT, description TEXT,
  status INTEGER DEFAULT 1, created_at TEXT, updated_at TEXT, deleted_at TEXT
);
CREATE TABLE planlimitation_mapping (
  id INTEGER PRIMARY KEY AUTOINCREMENT, plan_id INTEGER, planlimitation_id INTEGER,
  created_at TEXT, updated_at TEXT
);
CREATE TABLE subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, plan_id INTEGER, name TEXT,
  amount REAL, total_amount REAL, start_date TEXT, end_date TEXT, duration TEXT,
  status TEXT, plan_type TEXT, created_at TEXT, updated_at TEXT, deleted_at TEXT
);
CREATE TABLE subscriptions_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, amount REAL, payment_type TEXT,
  payment_status TEXT, transaction_id TEXT, created_at TEXT, updated_at TEXT
);
CREATE TABLE pay_per_views (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, movie_id INTEGER, type TEXT,
  price REAL, view_expiry_date TEXT, created_at TEXT, updated_at TEXT
);
CREATE TABLE vast_ads_setting (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, type TEXT, url TEXT, duration INTEGER,
  target_type TEXT, target_selection TEXT, enable_skip INTEGER, skip_after INTEGER,
  frequency INTEGER, start_date TEXT, end_date TEXT, is_enable INTEGER,
  status INTEGER DEFAULT 1, created_at TEXT, updated_at TEXT, deleted_at TEXT
);
CREATE TABLE custom_ads_setting (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, type TEXT, url_type TEXT,
  placement TEXT, media TEXT, redirect_url TEXT, duration INTEGER, skip_enabled INTEGER,
  skip_after INTEGER, start_date TEXT, end_date TEXT, is_enable INTEGER,
  status INTEGER DEFAULT 1, created_at TEXT, updated_at TEXT, deleted_at TEXT
);
CREATE TABLE coupons (
  id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT, description TEXT, discount_type TEXT,
  discount REAL, start_date TEXT, expire_date TEXT, status INTEGER DEFAULT 1,
  created_at TEXT, updated_at TEXT, deleted_at TEXT
);
CREATE TABLE banners (
  id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, type TEXT, type_id INTEGER,
  banner_for TEXT, file_url TEXT, poster_url TEXT, status INTEGER DEFAULT 1,
  created_at TEXT, updated_at TEXT, deleted_at TEXT
);
CREATE TABLE constants (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, type TEXT, value TEXT,
  sequence INTEGER, status INTEGER DEFAULT 1, created_at TEXT, updated_at TEXT, deleted_at TEXT
);
CREATE TABLE notification_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, label TEXT, type TEXT,
  description TEXT, status INTEGER DEFAULT 1, created_at TEXT, updated_at TEXT, deleted_at TEXT
);
CREATE TABLE pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, slug TEXT, description TEXT,
  sequence INTEGER, status INTEGER DEFAULT 1, created_at TEXT, updated_at TEXT, deleted_at TEXT
);
CREATE TABLE onboardings (
  id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, description TEXT, file_url TEXT,
  status INTEGER DEFAULT 1, created_at TEXT, updated_at TEXT, deleted_at TEXT
);
CREATE TABLE taxes (
  id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, type TEXT, value REAL,
  status INTEGER DEFAULT 1, created_at TEXT, updated_at TEXT, deleted_at TEXT
);
CREATE TABLE languages (
  id INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT, value TEXT, language TEXT, file TEXT,
  created_at TEXT, updated_at TEXT, deleted_at TEXT
);
CREATE TABLE worlds (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, state_id INTEGER,
  status INTEGER DEFAULT 1, created_at TEXT, updated_at TEXT, deleted_at TEXT
);
CREATE TABLE currencies (
  id INTEGER PRIMARY KEY AUTOINCREMENT, currency_name TEXT, currency_symbol TEXT,
  currency_code TEXT, is_primary INTEGER DEFAULT 0, currency_position TEXT,
  no_of_decimal INTEGER, thousand_separator TEXT, decimal_separator TEXT,
  created_at TEXT, updated_at TEXT, deleted_at TEXT
);
CREATE TABLE countries (
  id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT, name TEXT, dial_code TEXT,
  currency_name TEXT, symbol TEXT, currency_code TEXT, status INTEGER DEFAULT 1,
  created_at TEXT, updated_at TEXT, deleted_at TEXT
);
CREATE TABLE faqs (
  id INTEGER PRIMARY KEY AUTOINCREMENT, question TEXT, answer TEXT,
  status INTEGER DEFAULT 1, created_at TEXT, updated_at TEXT, deleted_at TEXT
);
CREATE TABLE settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, val TEXT, type TEXT,
  created_by INTEGER, updated_by INTEGER, created_at TEXT, updated_at TEXT, deleted_at TEXT
);
CREATE TABLE watchlists (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, entertainment_id INTEGER,
  created_at TEXT, updated_at TEXT, deleted_at TEXT
);
CREATE TABLE reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, entertainment_id INTEGER,
  rating REAL, review TEXT, created_at TEXT, updated_at TEXT, deleted_at TEXT
);
CREATE TABLE roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, title TEXT, guard_name TEXT,
  is_fixed INTEGER DEFAULT 0, created_at TEXT, updated_at TEXT
);
CREATE TABLE permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, is_fixed INTEGER DEFAULT 0,
  created_at TEXT, updated_at TEXT
);
CREATE TABLE role_has_permissions (
  permission_id INTEGER, role_id INTEGER, PRIMARY KEY (permission_id, role_id)
);
CREATE TABLE model_has_roles (
  role_id INTEGER, model_type TEXT, model_id INTEGER
);
CREATE TABLE media (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, file_name TEXT, mime_type TEXT,
  size INTEGER, created_at TEXT
);

INSERT INTO users (id, username, first_name, last_name, email, password, user_type, status, is_banned, is_subscribe, created_at, updated_at)
VALUES
  (1, 'local-admin', 'Local', 'Admin', 'admin.local@halobox.test', '$2b$10$72KmahqbnoN0PmQST7gN2eoMDjjtFtMUtnm5cNp3r3GnemLg1TAQW', 'admin', 1, 0, 1, datetime('now'), datetime('now')),
  (2, 'local-viewer', 'Local', 'Viewer', 'viewer.local@halobox.test', '$2b$10$72KmahqbnoN0PmQST7gN2eoMDjjtFtMUtnm5cNp3r3GnemLg1TAQW', 'user', 1, 0, 1, datetime('now'), datetime('now'));
INSERT INTO user_multi_profiles (id, user_id, name, is_child_profile, created_at, updated_at)
VALUES (1, 2, 'Local Viewer Profile', 0, datetime('now'), datetime('now'));

INSERT INTO genres (id, name, slug, description, status, created_at, updated_at) VALUES
  (1, 'Faith', 'faith', 'Local faith collection', 1, datetime('now'), datetime('now')),
  (2, 'Hope', 'hope', 'Local hope collection', 1, datetime('now'), datetime('now'));
INSERT INTO entertainments (id, name, type, slug, description, short_description, release_date, language, movie_access, duration, status, created_at, updated_at) VALUES
  (10, 'Local Sermon', 'movie', 'local-sermon', 'Local sermon description', 'Local sermon', '2026-01-10', 'English', 'free', '42m', 1, datetime('now'), datetime('now')),
  (11, 'Local Show', 'tvshow', 'local-show', 'Local show description', 'Local show', '2026-01-11', 'English', 'free', '35m', 1, datetime('now'), datetime('now')),
  (12, 'Local Teaching', 'teaching', 'local-teaching', 'Local teaching description', 'Local teaching', '2026-01-12', 'English', 'free', '50m', 1, datetime('now'), datetime('now'));
INSERT INTO entertainment_gener_mapping (entertainment_id, genre_id, created_at, updated_at) VALUES
  (10, 1, datetime('now'), datetime('now')), (11, 2, datetime('now'), datetime('now')), (12, 1, datetime('now'), datetime('now'));
INSERT INTO cast_crew (id, name, type, designation, bio, status, created_at, updated_at) VALUES
  (20, 'Local Personality', 'actor', 'Speaker', 'Local biography', 1, datetime('now'), datetime('now')),
  (21, 'Local Location', 'director', 'London', 'Local location', 1, datetime('now'), datetime('now'));
INSERT INTO entertainment_talent_mapping (entertainment_id, talent_id, type, created_at, updated_at) VALUES
  (10, 20, 'actor', datetime('now'), datetime('now')), (10, 21, 'director', datetime('now'), datetime('now'));
INSERT INTO seasons (id, name, entertainment_id, season_number, season_index, short_desc, status, created_at, updated_at) VALUES
  (30, 'Local Series', 11, 1, '1', 'Local series', 1, datetime('now'), datetime('now')),
  (31, 'Local Volume', 12, 1, '1', 'Local volume', 1, datetime('now'), datetime('now'));
INSERT INTO episodes (id, name, entertainment_id, season_id, episode_number, duration, release_date, short_desc, status, created_at, updated_at) VALUES
  (40, 'Local Show Episode', 11, 30, 1, '30m', '2026-01-15', 'Local episode', 1, datetime('now'), datetime('now')),
  (41, 'Local Teaching Episode', 12, 31, 1, '45m', '2026-01-16', 'Local teaching episode', 1, datetime('now'), datetime('now'));
INSERT INTO videos (id, name, slug, description, duration, release_date, status, access, created_at, updated_at)
VALUES (50, 'Local Video', 'local-video', 'Local video description', '12m', '2026-01-17', 1, 'free', datetime('now'), datetime('now'));
INSERT INTO live_tv_category (id, name, description, status, created_at, updated_at)
VALUES (60, 'Local Channels', 'Local channel category', 1, datetime('now'), datetime('now'));
INSERT INTO live_tv_channel (id, name, category_id, access, description, status, created_at, updated_at)
VALUES (70, 'Local Live Channel', 60, 'free', 'Local live channel', 1, datetime('now'), datetime('now'));

INSERT INTO plan (id, name, identifier, price, total_price, duration, duration_value, level, status, description, created_at, updated_at)
VALUES (80, 'Local Plan', 'local_plan', 9, 9, 'month', 1, 1, 1, 'Local subscription plan', datetime('now'), datetime('now'));
INSERT INTO planlimitation (id, title, slug, description, status, created_at, updated_at)
VALUES (120, 'Local Access', 'local-access', 'Local plan access', 1, datetime('now'), datetime('now'));
INSERT INTO planlimitation_mapping (plan_id, planlimitation_id, created_at, updated_at)
VALUES (80, 120, datetime('now'), datetime('now'));
INSERT INTO subscriptions (id, user_id, plan_id, name, amount, total_amount, start_date, end_date, duration, status, plan_type, created_at, updated_at)
VALUES (90, 2, 80, 'Local Plan', 9, 9, date('now', '-10 days'), date('now', '+20 days'), 'month', 'active', 'monthly', datetime('now'), datetime('now'));
INSERT INTO subscriptions_transactions (id, user_id, amount, payment_type, payment_status, transaction_id, created_at)
VALUES (100, 2, 9, 'local', 'paid', 'LOCAL-TRANSACTION', datetime('now'));
INSERT INTO pay_per_views (id, user_id, movie_id, type, price, view_expiry_date, created_at)
VALUES (110, 2, 10, 'movie', 3, date('now', '+5 days'), datetime('now'));

INSERT INTO vast_ads_setting (id, name, type, url, duration, enable_skip, skip_after, frequency, status, created_at, updated_at)
VALUES (130, 'Local VAST', 'pre-roll', 'https://example.test/local-vast', 10, 1, 5, 1, 1, datetime('now'), datetime('now'));
INSERT INTO custom_ads_setting (id, name, type, url_type, placement, redirect_url, duration, skip_enabled, skip_after, status, created_at, updated_at)
VALUES (140, 'Local Custom Ad', 'image', 'local', 'home', 'https://example.test', 10, 1, 5, 1, datetime('now'), datetime('now'));
INSERT INTO coupons (id, code, description, discount_type, discount, start_date, expire_date, status, created_at, updated_at)
VALUES (150, 'LOCAL10', 'Local coupon', 'percent', 10, date('now'), date('now', '+30 days'), 1, datetime('now'), datetime('now'));
INSERT INTO banners (id, title, type, type_id, banner_for, status, created_at, updated_at)
VALUES (160, 'Local Banner', 'movie', 10, 'home', 1, datetime('now'), datetime('now'));
INSERT INTO constants (id, name, type, value, sequence, status, created_at, updated_at)
VALUES (170, 'local_brand', 'text', 'GoodNews Halobox', 1, 1, datetime('now'), datetime('now'));
INSERT INTO notification_templates (id, name, label, type, description, status, created_at, updated_at)
VALUES (180, 'local_welcome', 'Local Welcome', 'email', 'Local notification', 1, datetime('now'), datetime('now'));
INSERT INTO pages (id, name, slug, description, sequence, status, created_at, updated_at)
VALUES (190, 'About', 'about', 'Local about page', 1, 1, datetime('now'), datetime('now'));
INSERT INTO onboardings (id, title, description, status, created_at, updated_at)
VALUES (200, 'Welcome', 'Local onboarding', 1, datetime('now'), datetime('now'));
INSERT INTO taxes (id, title, type, value, status, created_at, updated_at)
VALUES (210, 'Local Tax', 'percentage', 0, 1, datetime('now'), datetime('now'));
INSERT INTO languages (id, key, value, language, file, created_at, updated_at)
VALUES (220, 'welcome', 'Welcome', 'English', 'local.json', datetime('now'), datetime('now'));
INSERT INTO worlds (id, name, state_id, status, created_at, updated_at)
VALUES (230, 'Local Region', 1, 1, datetime('now'), datetime('now'));
INSERT INTO currencies (id, currency_name, currency_symbol, currency_code, is_primary, currency_position, no_of_decimal, thousand_separator, decimal_separator, created_at, updated_at)
VALUES (240, 'British Pound', '£', 'GBP', 1, 'left', 2, ',', '.', datetime('now'), datetime('now'));
INSERT INTO countries (id, code, name, dial_code, currency_name, symbol, currency_code, status, created_at, updated_at)
VALUES (250, 'GB', 'United Kingdom', '+44', 'British Pound', '£', 'GBP', 1, datetime('now'), datetime('now'));
INSERT INTO faqs (id, question, answer, status, created_at, updated_at)
VALUES (260, 'Is this isolated?', 'Yes, this record exists only in the local test database.', 1, datetime('now'), datetime('now'));
INSERT INTO watchlists (id, user_id, entertainment_id, created_at, updated_at)
VALUES (270, 2, 10, datetime('now'), datetime('now'));
INSERT INTO reviews (id, user_id, entertainment_id, rating, review, created_at, updated_at)
VALUES (280, 2, 10, 5, 'Stored compatibility record that must not appear in admin UI.', datetime('now'), datetime('now'));
INSERT INTO roles (id, name, title, guard_name, is_fixed, created_at, updated_at)
VALUES (290, 'local_editor', 'Local Editor', 'admin', 0, datetime('now'), datetime('now'));
INSERT INTO permissions (id, name, is_fixed, created_at, updated_at)
VALUES (300, 'content_read', 0, datetime('now'), datetime('now'));
INSERT INTO role_has_permissions (permission_id, role_id) VALUES (300, 290);
INSERT INTO model_has_roles (role_id, model_type, model_id) VALUES (290, 'user', 1);

INSERT INTO settings (name, val, type, created_by, updated_by, created_at, updated_at) VALUES
  ('app_name', 'GoodNews Halobox', 'bussiness', 1, 1, datetime('now'), datetime('now')),
  ('helpline_number', '+44 0000 000000', 'bussiness', 1, 1, datetime('now'), datetime('now')),
  ('inquriy_email', 'local@halobox.test', 'bussiness', 1, 1, datetime('now'), datetime('now')),
  ('short_description', 'Local admin acceptance environment', 'bussiness', 1, 1, datetime('now'), datetime('now')),
  ('movie', '1', 'module_settings', 1, 1, datetime('now'), datetime('now')),
  ('tvshow', '1', 'module_settings', 1, 1, datetime('now'), datetime('now')),
  ('livetv', '1', 'module_settings', 1, 1, datetime('now'), datetime('now')),
  ('video', '1', 'module_settings', 1, 1, datetime('now'), datetime('now')),
  ('demo_login', '0', 'module_settings', 1, 1, datetime('now'), datetime('now')),
  ('default_language', 'English', 'misc', 1, 1, datetime('now'), datetime('now')),
  ('default_time_zone', 'Europe/London', 'misc', 1, 1, datetime('now'), datetime('now')),
  ('default_currency', 'GBP', 'misc', 1, 1, datetime('now'), datetime('now')),
  ('local', '1', 'storage_settings', 1, 1, datetime('now'), datetime('now')),
  ('s3', '0', 'storage_settings', 1, 1, datetime('now'), datetime('now'));
