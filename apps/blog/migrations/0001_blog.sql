PRAGMA foreign_keys = ON;
CREATE TABLE administrators (subject TEXT PRIMARY KEY, created_at INTEGER NOT NULL);
CREATE TABLE revocations (kind TEXT NOT NULL CHECK(kind IN ('session','subject')), key TEXT NOT NULL, cutoff INTEGER NOT NULL, expires_at INTEGER NOT NULL, PRIMARY KEY(kind,key));
CREATE TABLE oauth_transactions (nonce TEXT PRIMARY KEY, browser_hash TEXT NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE deletion_jobs (id TEXT PRIMARY KEY, subject TEXT, status TEXT NOT NULL CHECK(status IN ('pending','complete','failed')), created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, cursor TEXT);
CREATE TABLE posts (
 id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, version INTEGER NOT NULL DEFAULT 0,
 draft_revision TEXT, public_revision TEXT, public_metadata TEXT,
 state TEXT NOT NULL DEFAULT 'draft' CHECK(state IN ('draft','published')),
 creator TEXT, attribution TEXT, consent_version TEXT, consent_at INTEGER, last_editor TEXT, created_at INTEGER NOT NULL,
 first_published_at INTEGER, updated_at INTEGER, deleted_at INTEGER,
 CHECK((state='published' AND public_revision IS NOT NULL AND public_metadata IS NOT NULL) OR (state='draft' AND public_revision IS NULL AND public_metadata IS NULL))
);
CREATE INDEX posts_creator ON posts(creator);
CREATE INDEX public_posts ON posts(state, first_published_at DESC, id);
CREATE TABLE slugs (slug TEXT PRIMARY KEY, post_id TEXT NOT NULL REFERENCES posts(id));
CREATE TABLE revisions (id TEXT PRIMARY KEY, post_id TEXT NOT NULL REFERENCES posts(id), source_key TEXT NOT NULL, source_hash TEXT NOT NULL, manifest_key TEXT, manifest_hash TEXT, assets TEXT NOT NULL, created_at INTEGER NOT NULL, editor TEXT);
CREATE INDEX revisions_post ON revisions(post_id,created_at);
CREATE TABLE media (id TEXT PRIMARY KEY, post_id TEXT NOT NULL REFERENCES posts(id), owner TEXT, policy_version INTEGER NOT NULL, sensitive INTEGER NOT NULL CHECK(sensitive IN (0,1)), ready INTEGER NOT NULL DEFAULT 0 CHECK(ready IN (0,1)), manifest TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE INDEX media_post ON media(post_id);
CREATE TABLE operations (key TEXT PRIMARY KEY, actor TEXT, target TEXT NOT NULL, action TEXT NOT NULL, digest TEXT NOT NULL, execution TEXT NOT NULL UNIQUE, result TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL);
CREATE INDEX operations_actor ON operations(actor);
CREATE TABLE comments (id TEXT PRIMARY KEY, post_id TEXT NOT NULL REFERENCES posts(id), created_at INTEGER NOT NULL, subject TEXT, attribution TEXT, consent_version TEXT, consent_at INTEGER, body TEXT, hidden INTEGER NOT NULL DEFAULT 0 CHECK(hidden IN (0,1)), deleted_at INTEGER, version INTEGER NOT NULL DEFAULT 1, reason TEXT, moderator TEXT, moderated_at INTEGER,
 CHECK(deleted_at IS NULL OR (body IS NULL AND subject IS NULL AND attribution IS NULL AND consent_version IS NULL AND consent_at IS NULL AND reason IS NULL AND moderator IS NULL)));
CREATE INDEX comments_order ON comments(post_id,created_at,id);
CREATE INDEX comments_subject ON comments(subject,created_at);
CREATE TABLE rate_attempts (tag TEXT NOT NULL, created_at INTEGER NOT NULL, id TEXT PRIMARY KEY);
CREATE INDEX rate_window ON rate_attempts(tag,created_at);
CREATE TABLE audit (id TEXT PRIMARY KEY, actor TEXT, target TEXT NOT NULL, action TEXT NOT NULL, reason TEXT, created_at INTEGER NOT NULL);
CREATE INDEX audit_actor ON audit(actor);
CREATE TABLE recovery_outbox (sequence INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE, action TEXT NOT NULL, target TEXT NOT NULL, payload TEXT NOT NULL, created_at INTEGER NOT NULL, delivered_at INTEGER);
CREATE INDEX outbox_pending ON recovery_outbox(delivered_at,created_at);
CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
INSERT INTO settings VALUES ('restricted','false'),('publish_paused','false');

CREATE TABLE staging (id TEXT PRIMARY KEY, actor TEXT NOT NULL, post_id TEXT NOT NULL, expires_at INTEGER NOT NULL);
CREATE INDEX staging_actor ON staging(actor,post_id);

CREATE INDEX deletion_subject ON deletion_jobs(subject,status);
CREATE TABLE deletion_requests (key TEXT PRIMARY KEY, job_id TEXT NOT NULL, expires_at INTEGER NOT NULL);
