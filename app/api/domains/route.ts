import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb, logAudit } from "@/lib/db";
import { z } from "zod";

const schema = z.object({ domain: z.string().min(3).max(253) });

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const domain = parsed.data.domain.toLowerCase().trim();
  if (!/^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(domain)) {
    return NextResponse.json({ error: "Invalid domain" }, { status: 400 });
  }
  const db = getDb();
  try {
    db.prepare("INSERT INTO domains (domain, created_by, created_at) VALUES (?, ?, ?)").run(domain, session.user.id, Date.now());
  } catch (e: any) {
    if (String(e?.message).includes("UNIQUE")) return NextResponse.json({ error: "Domain already exists" }, { status: 409 });
    throw e;
  }
  logAudit({ user_id: session.user.id, user_email: session.user.email, action: "domain.add", target_type: "domain", target_id: domain });
  return NextResponse.json({ ok: true });
}
