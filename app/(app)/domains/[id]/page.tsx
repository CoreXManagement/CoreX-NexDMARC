import { getDb } from "@/lib/db";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HorizontalBar } from "@/components/charts/HorizontalBar";
import { SecurityCheckPanel } from "./SecurityCheckPanel";

export const dynamic = "force-dynamic";

export default async function DomainDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const d = db.prepare("SELECT * FROM domains WHERE id = ?").get(Number(id)) as any;
  if (!d) notFound();

  const cutoff = Math.floor((Date.now() - 30 * 24 * 3600 * 1000) / 1000);
  const totals = db.prepare(`
    SELECT COALESCE(SUM(rec.count),0) AS total,
      SUM(CASE WHEN rec.disposition='none' THEN rec.count ELSE 0 END) AS pass,
      SUM(CASE WHEN rec.disposition<>'none' THEN rec.count ELSE 0 END) AS fail
    FROM reports r JOIN records rec ON rec.report_id = r.id
    WHERE r.domain = ? AND r.date_begin >= ?
  `).get(d.domain, cutoff) as any;

  const sources = db.prepare(`
    SELECT COALESCE(rec.rdns, rec.source_ip) AS label, rec.source_ip AS sub, SUM(rec.count) AS v
    FROM reports r JOIN records rec ON rec.report_id = r.id
    WHERE r.domain = ? AND r.date_begin >= ?
    GROUP BY COALESCE(rec.rdns, rec.source_ip) ORDER BY v DESC LIMIT 10
  `).all(d.domain, cutoff) as any[];

  const lastCheck = db.prepare("SELECT * FROM security_checks WHERE domain_id = ? ORDER BY ts DESC LIMIT 1").get(d.id) as any;

  return (
    <div className="space-y-6">
      <PageHeader title={d.domain} subtitle={`${(totals.total || 0).toLocaleString("de-DE")} Messages in 30 Tagen`} action={
        d.last_check_grade ? <Badge variant={d.last_check_grade === "A" ? "ok" : d.last_check_grade === "F" ? "fail" : "warn"}>Security: {d.last_check_grade}</Badge> : null
      } />

      <div className="grid grid-cols-12 gap-4">
        <Card className="col-span-12 md:col-span-4">
          <CardHeader><CardTitle>DMARC pass</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-emerald-400">{(totals.pass || 0).toLocaleString("de-DE")}</div></CardContent>
        </Card>
        <Card className="col-span-12 md:col-span-4">
          <CardHeader><CardTitle>DMARC fail</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-red-400">{(totals.fail || 0).toLocaleString("de-DE")}</div></CardContent>
        </Card>
        <Card className="col-span-12 md:col-span-4">
          <CardHeader><CardTitle>Pass-Rate</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tabular-nums">{totals.total ? ((totals.pass / totals.total) * 100).toFixed(1) : "0"}%</div>
          </CardContent>
        </Card>

        <Card className="col-span-12 lg:col-span-7">
          <CardHeader><CardTitle>Top Sender (Sources)</CardTitle></CardHeader>
          <CardContent><HorizontalBar rows={sources.map((x) => ({ label: x.label, sub: x.sub, value: x.v }))} /></CardContent>
        </Card>

        <div className="col-span-12 lg:col-span-5">
          <SecurityCheckPanel domain={d.domain} initial={lastCheck ? JSON.parse(lastCheck.result_json) : null} />
        </div>
      </div>
    </div>
  );
}
