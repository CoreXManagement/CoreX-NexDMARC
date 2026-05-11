import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DATA_DIR = process.env.NEXDMARC_DATA_DIR || path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "nexdmarc.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  ensureSchema(db);
  _db = db;
  return db;
}

function ensureSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      username TEXT,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS domains (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      domain TEXT UNIQUE NOT NULL,
      label TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at INTEGER NOT NULL,
      last_check_at INTEGER,
      last_check_grade TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_domains_domain ON domains(domain);

    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id TEXT NOT NULL,
      org_name TEXT NOT NULL,
      org_email TEXT,
      org_extra_contact TEXT,
      domain TEXT NOT NULL,
      domain_id INTEGER REFERENCES domains(id) ON DELETE SET NULL,
      date_begin INTEGER NOT NULL,
      date_end INTEGER NOT NULL,
      policy_p TEXT,
      policy_sp TEXT,
      policy_pct INTEGER,
      policy_adkim TEXT,
      policy_aspf TEXT,
      received_at INTEGER NOT NULL,
      source_file TEXT,
      UNIQUE(report_id, org_name)
    );
    CREATE INDEX IF NOT EXISTS idx_reports_domain ON reports(domain);
    CREATE INDEX IF NOT EXISTS idx_reports_date_begin ON reports(date_begin);

    CREATE TABLE IF NOT EXISTS records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
      source_ip TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 1,
      disposition TEXT NOT NULL,
      dkim_aligned INTEGER NOT NULL DEFAULT 0,
      spf_aligned INTEGER NOT NULL DEFAULT 0,
      header_from TEXT,
      envelope_from TEXT,
      envelope_to TEXT,
      dkim_domain TEXT,
      dkim_selector TEXT,
      dkim_result TEXT,
      spf_domain TEXT,
      spf_scope TEXT,
      spf_result TEXT,
      reason TEXT,
      country TEXT,
      rdns TEXT,
      asn TEXT,
      asn_org TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_records_report ON records(report_id);
    CREATE INDEX IF NOT EXISTS idx_records_source_ip ON records(source_ip);
    CREATE INDEX IF NOT EXISTS idx_records_header_from ON records(header_from);

    CREATE TABLE IF NOT EXISTS source_cache (
      ip TEXT PRIMARY KEY,
      rdns TEXT,
      asn TEXT,
      asn_org TEXT,
      country TEXT,
      enriched_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS security_checks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      domain_id INTEGER NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
      ts INTEGER NOT NULL,
      grade TEXT NOT NULL,
      result_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_seccheck_domain_ts ON security_checks(domain_id, ts);

    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL,
      domain TEXT,
      kind TEXT NOT NULL,
      severity TEXT NOT NULL,
      title TEXT NOT NULL,
      details TEXT,
      acknowledged_at INTEGER,
      delivered_email INTEGER NOT NULL DEFAULT 0,
      delivered_webhook INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_alerts_ts ON alerts(ts);

    CREATE TABLE IF NOT EXISTS alert_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      kind TEXT NOT NULL,
      threshold REAL,
      window_min INTEGER,
      domain TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS api_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      token_hash TEXT UNIQUE NOT NULL,
      scopes TEXT NOT NULL,
      created_by INTEGER REFERENCES users(id),
      created_at INTEGER NOT NULL,
      last_used_at INTEGER,
      revoked_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL,
      user_id INTEGER,
      user_email TEXT,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id TEXT,
      details TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_log(ts);

    CREATE TABLE IF NOT EXISTS update_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_version TEXT,
      to_version TEXT,
      ts INTEGER NOT NULL,
      status TEXT NOT NULL,
      log TEXT
    );

    CREATE TABLE IF NOT EXISTS imap_inbox_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL,
      uid INTEGER,
      message_id TEXT,
      subject TEXT,
      filename TEXT,
      status TEXT NOT NULL,
      error TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_imap_ts ON imap_inbox_log(ts);
  `);
}

export function getSetting(key: string): string | null {
  const row = getDb().prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string) {
  getDb()
    .prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(key, value);
}

export function isSetupComplete(): boolean {
  return getSetting("setup_complete") === "true";
}

export function logAudit(entry: {
  user_id?: number | null;
  user_email?: string | null;
  action: string;
  target_type?: string;
  target_id?: string | number;
  details?: unknown;
}) {
  try {
    getDb().prepare(
      `INSERT INTO audit_log (ts, user_id, user_email, action, target_type, target_id, details) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      Date.now(),
      entry.user_id ?? null,
      entry.user_email ?? null,
      entry.action,
      entry.target_type ?? null,
      entry.target_id !== undefined ? String(entry.target_id) : null,
      entry.details === undefined ? null : JSON.stringify(entry.details)
    );
  } catch {}
}

export type DomainRow = {
  id: number;
  domain: string;
  label: string | null;
  created_at: number;
  last_check_at: number | null;
  last_check_grade: string | null;
};

export type ReportRow = {
  id: number;
  report_id: string;
  org_name: string;
  org_email: string | null;
  domain: string;
  domain_id: number | null;
  date_begin: number;
  date_end: number;
  policy_p: string | null;
  policy_sp: string | null;
  policy_pct: number | null;
  policy_adkim: string | null;
  policy_aspf: string | null;
  received_at: number;
  source_file: string | null;
};

export type RecordRow = {
  id: number;
  report_id: number;
  source_ip: string;
  count: number;
  disposition: string;
  dkim_aligned: number;
  spf_aligned: number;
  header_from: string | null;
  dkim_domain: string | null;
  dkim_result: string | null;
  spf_domain: string | null;
  spf_result: string | null;
  country: string | null;
  rdns: string | null;
  asn: string | null;
  asn_org: string | null;
};

export type UserRow = {
  id: number;
  email: string;
  username: string | null;
  password_hash: string;
  role: string;
  created_at: number;
};
