import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { runSecurityCheck } from "@/lib/security-check";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const domain = url.searchParams.get("domain") || "";
  if (!domain) return NextResponse.json({ error: "Missing domain" }, { status: 400 });
  const res = await runSecurityCheck(domain);
  const db = getDb();
  const row = db.prepare("SELECT id FROM domains WHERE domain = ?").get(res.domain) as { id: number } | undefined;
  if (row) {
    db.prepare("INSERT INTO security_checks (domain_id, ts, grade, result_json) VALUES (?, ?, ?, ?)").run(row.id, res.ts, res.grade, JSON.stringify(res));
    db.prepare("UPDATE domains SET last_check_at = ?, last_check_grade = ? WHERE id = ?").run(res.ts, res.grade, row.id);
  }
  return NextResponse.json(res);
}
