import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { getDb, getSetting } from "./db";
import { ingestBuffer } from "./dmarc-ingest";

export type ImapConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  mailbox: string;
  delete_processed: boolean;
};

export function getImapConfig(): ImapConfig | null {
  const host = getSetting("imap_host");
  const user = getSetting("imap_user");
  const pass = getSetting("imap_pass");
  if (!host || !user || !pass) return null;
  return {
    host,
    port: Number(getSetting("imap_port") || 993),
    secure: getSetting("imap_secure") !== "false",
    user,
    pass,
    mailbox: getSetting("imap_mailbox") || "INBOX",
    delete_processed: getSetting("imap_delete") === "true",
  };
}

export async function pullImap(): Promise<{ fetched: number; ingested: number; skipped: number; errors: number }> {
  const cfg = getImapConfig();
  if (!cfg) return { fetched: 0, ingested: 0, skipped: 0, errors: 0 };
  const db = getDb();
  const log = db.prepare(
    "INSERT INTO imap_inbox_log (ts, uid, message_id, subject, filename, status, error) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );

  const client = new ImapFlow({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
    logger: false,
  });

  let fetched = 0;
  let ingested = 0;
  let skipped = 0;
  let errors = 0;

  await client.connect();
  const lock = await client.getMailboxLock(cfg.mailbox);
  try {
    for await (const msg of client.fetch({ seen: false }, { source: true, uid: true, envelope: true })) {
      fetched++;
      try {
        const parsed = await simpleParser(msg.source as Buffer);
        const attachments = parsed.attachments || [];
        let anyIngested = false;
        for (const att of attachments) {
          const filename = att.filename || "report.xml";
          if (!/\.(xml|gz|zip)$/i.test(filename) && !/dmarc/i.test(filename)) {
            skipped++;
            continue;
          }
          const res = await ingestBuffer(att.content as Buffer, filename, parsed.subject || filename);
          if (res.inserted > 0) {
            anyIngested = true;
            ingested += res.inserted;
          }
          if (res.errors.length) errors += res.errors.length;
        }
        log.run(Date.now(), msg.uid, parsed.messageId || null, parsed.subject || null, attachments.map((a) => a.filename).filter(Boolean).join(", "), anyIngested ? "ingested" : "skipped", null);
        if (anyIngested && cfg.delete_processed) {
          await client.messageFlagsAdd(msg.uid, ["\\Deleted"], { uid: true });
        } else {
          await client.messageFlagsAdd(msg.uid, ["\\Seen"], { uid: true });
        }
      } catch (e: any) {
        errors++;
        log.run(Date.now(), msg.uid, null, null, null, "error", String(e?.message ?? e));
      }
    }
    if (cfg.delete_processed) await client.messageDelete({ deleted: true });
  } finally {
    lock.release();
    await client.logout().catch(() => {});
  }

  return { fetched, ingested, skipped, errors };
}
