import { getDb, getSetting } from "./db";
import { sendMail } from "./mailer";
import { fireWebhook } from "./webhook";

export type Alert = {
  id?: number;
  ts: number;
  domain: string | null;
  kind: string;
  severity: "info" | "warn" | "fail";
  title: string;
  details?: unknown;
};

export async function raiseAlert(a: Omit<Alert, "ts"> & { ts?: number }) {
  const db = getDb();
  const ts = a.ts ?? Date.now();
  const info = db.prepare(
    "INSERT INTO alerts (ts, domain, kind, severity, title, details) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(ts, a.domain ?? null, a.kind, a.severity, a.title, a.details === undefined ? null : JSON.stringify(a.details));
  const id = info.lastInsertRowid as number;
  await deliverAlert({ ...a, ts, id });
}

async function deliverAlert(a: Alert) {
  const to = getSetting("alert_email");
  const webhook = getSetting("alert_webhook");
  let deliveredEmail = 0;
  let deliveredWebhook = 0;
  if (to) {
    try {
      await sendMail({
        to,
        subject: `[NexDMARC ${a.severity.toUpperCase()}] ${a.title}`,
        text: `${a.title}\n\nDomain: ${a.domain ?? "-"}\nKind: ${a.kind}\nTime: ${new Date(a.ts).toISOString()}\n\n${a.details ? JSON.stringify(a.details, null, 2) : ""}`,
      });
      deliveredEmail = 1;
    } catch {}
  }
  if (webhook) {
    try {
      await fireWebhook(webhook, {
        source: "nexdmarc",
        kind: a.kind,
        severity: a.severity,
        title: a.title,
        domain: a.domain,
        ts: a.ts,
        details: a.details,
      });
      deliveredWebhook = 1;
    } catch {}
  }
  if (a.id) {
    getDb().prepare("UPDATE alerts SET delivered_email = ?, delivered_webhook = ? WHERE id = ?").run(deliveredEmail, deliveredWebhook, a.id);
  }
}

export function evaluateRules(): void {
  const db = getDb();
  const since = Date.now() - 1000 * 60 * 60 * 24;
  const stats = db.prepare(`
    SELECT r.domain, SUM(rec.count) AS total,
      SUM(CASE WHEN rec.disposition <> 'none' THEN rec.count ELSE 0 END) AS failed
    FROM reports r JOIN records rec ON rec.report_id = r.id
    WHERE r.received_at >= ?
    GROUP BY r.domain
  `).all(since) as { domain: string; total: number; failed: number }[];
  const failThreshold = Number(getSetting("alert_fail_pct") || 5);
  for (const s of stats) {
    if (!s.total) continue;
    const pct = (s.failed / s.total) * 100;
    if (pct >= failThreshold) {
      raiseAlert({
        domain: s.domain,
        kind: "dmarc_fail_rate",
        severity: pct >= 25 ? "fail" : "warn",
        title: `DMARC-Fail ${pct.toFixed(1)}% bei ${s.domain} in 24h`,
        details: { total: s.total, failed: s.failed, pct },
      }).catch(() => {});
    }
  }
}
