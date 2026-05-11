import { NextResponse } from "next/server";
import { verifyApiToken, unauthorized } from "@/lib/api-auth";
import { getDb } from "@/lib/db";

export async function GET(req: Request) {
  if (!verifyApiToken(req, "reports:read")) return unauthorized();
  const url = new URL(req.url);
  const days = Math.min(365, Math.max(1, Number(url.searchParams.get("days") || 30)));
  const cutoff = Math.floor((Date.now() - days * 86400000) / 1000);
  const db = getDb();
  const totals = db.prepare(`
    SELECT COALESCE(SUM(rec.count),0) AS total,
      SUM(CASE WHEN rec.disposition='none' THEN rec.count ELSE 0 END) AS dmarc_pass,
      SUM(CASE WHEN rec.disposition<>'none' THEN rec.count ELSE 0 END) AS dmarc_fail,
      SUM(CASE WHEN rec.spf_aligned=1 THEN rec.count ELSE 0 END) AS spf_pass,
      SUM(CASE WHEN rec.dkim_aligned=1 THEN rec.count ELSE 0 END) AS dkim_pass
    FROM reports r JOIN records rec ON rec.report_id = r.id
    WHERE r.date_begin >= ?
  `).get(cutoff);
  return NextResponse.json({ since_days: days, totals });
}
