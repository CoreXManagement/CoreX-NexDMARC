import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logAudit, setSetting } from "@/lib/db";

const SAFE_KEYS = new Set([
  "imap_host", "imap_port", "imap_secure", "imap_user", "imap_pass", "imap_mailbox", "imap_delete", "imap_poll_minutes",
  "smtp_host", "smtp_port", "smtp_user", "smtp_pass", "smtp_from",
  "alert_email", "alert_webhook", "alert_fail_pct",
]);

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const updates: Record<string, string> = {};
  for (const [k, v] of Object.entries(body)) {
    if (SAFE_KEYS.has(k) && typeof v === "string") {
      setSetting(k, v);
      updates[k] = k.endsWith("_pass") ? "***" : v;
    }
  }
  logAudit({ user_id: session.user.id, user_email: session.user.email, action: "settings.update", details: updates });
  return NextResponse.json({ ok: true });
}
