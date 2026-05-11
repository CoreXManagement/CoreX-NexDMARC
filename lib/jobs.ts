import { pullImap } from "./imap";
import { evaluateRules } from "./alarms";
import { runSecurityCheck } from "./security-check";
import { getDb, getSetting } from "./db";

let started = false;

export function startJobs() {
  if (started) return;
  started = true;
  const imapMs = Number(getSetting("imap_poll_minutes") || 5) * 60 * 1000;
  setInterval(safe(runImapPoll), imapMs);
  setInterval(safe(evaluateRules), 5 * 60 * 1000);
  setInterval(safe(runDailySecurityChecks), 60 * 60 * 1000);
  setTimeout(safe(runImapPoll), 30 * 1000);
}

function safe(fn: () => unknown | Promise<unknown>) {
  return async () => {
    try {
      await fn();
    } catch (e) {
      console.error("[job]", e);
    }
  };
}

async function runImapPoll() {
  if (!getSetting("imap_host")) return;
  await pullImap();
}

async function runDailySecurityChecks() {
  const db = getDb();
  const cutoff = Date.now() - 1000 * 60 * 60 * 24;
  const rows = db.prepare("SELECT id, domain FROM domains WHERE last_check_at IS NULL OR last_check_at < ?").all(cutoff) as { id: number; domain: string }[];
  for (const r of rows) {
    try {
      const res = await runSecurityCheck(r.domain);
      db.prepare("INSERT INTO security_checks (domain_id, ts, grade, result_json) VALUES (?, ?, ?, ?)").run(r.id, res.ts, res.grade, JSON.stringify(res));
      db.prepare("UPDATE domains SET last_check_at = ?, last_check_grade = ? WHERE id = ?").run(res.ts, res.grade, r.id);
    } catch (e) {
      console.error("[seccheck]", r.domain, e);
    }
  }
}
