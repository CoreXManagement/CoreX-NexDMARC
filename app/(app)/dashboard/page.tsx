import { getDb } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkline } from "@/components/charts/Sparkline";
import { Donut } from "@/components/charts/Donut";
import { TimeSeries } from "@/components/charts/TimeSeries";
import { HorizontalBar } from "@/components/charts/HorizontalBar";
import { formatNumber, formatPercent } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Row = Record<string, any>;

function loadStats() {
  const db = getDb();
  const sinceDays = 30;
  const cutoff = Math.floor((Date.now() - sinceDays * 24 * 3600 * 1000) / 1000);

  const totalRow = db.prepare(`
    SELECT COALESCE(SUM(rec.count), 0) AS total
    FROM reports r JOIN records rec ON rec.report_id = r.id
    WHERE r.date_begin >= ?
  `).get(cutoff) as { total: number };

  const sparkRows = db.prepare(`
    SELECT (r.date_begin / 86400) * 86400 AS day, SUM(rec.count) AS v
    FROM reports r JOIN records rec ON rec.report_id = r.id
    WHERE r.date_begin >= ?
    GROUP BY day ORDER BY day
  `).all(cutoff) as { day: number; v: number }[];

  const topSources = db.prepare(`
    SELECT rec.rdns, rec.source_ip, SUM(rec.count) AS v
    FROM reports r JOIN records rec ON rec.report_id = r.id
    WHERE r.date_begin >= ?
    GROUP BY COALESCE(rec.rdns, rec.source_ip)
    ORDER BY v DESC LIMIT 12
  `).all(cutoff) as { rdns: string | null; source_ip: string; v: number }[];

  const topOrgs = db.prepare(`
    SELECT r.org_name AS label, r.org_email AS sub, SUM(rec.count) AS v
    FROM reports r JOIN records rec ON rec.report_id = r.id
    WHERE r.date_begin >= ?
    GROUP BY r.org_name ORDER BY v DESC LIMIT 10
  `).all(cutoff) as { label: string; sub: string | null; v: number }[];

  const topHeaderFrom = db.prepare(`
    SELECT rec.header_from AS label, SUM(rec.count) AS v
    FROM reports r JOIN records rec ON rec.report_id = r.id
    WHERE r.date_begin >= ? AND rec.header_from IS NOT NULL
    GROUP BY rec.header_from ORDER BY v DESC LIMIT 10
  `).all(cutoff) as { label: string; v: number }[];

  const topCountries = db.prepare(`
    SELECT COALESCE(rec.country, '??') AS label, SUM(rec.count) AS v
    FROM reports r JOIN records rec ON rec.report_id = r.id
    WHERE r.date_begin >= ?
    GROUP BY rec.country ORDER BY v DESC LIMIT 12
  `).all(cutoff) as { label: string; v: number }[];

  const align = db.prepare(`
    SELECT
      SUM(CASE WHEN rec.spf_aligned = 1 THEN rec.count ELSE 0 END) AS spf_pass,
      SUM(CASE WHEN rec.spf_aligned = 0 THEN rec.count ELSE 0 END) AS spf_fail,
      SUM(CASE WHEN rec.dkim_aligned = 1 THEN rec.count ELSE 0 END) AS dkim_pass,
      SUM(CASE WHEN rec.dkim_aligned = 0 THEN rec.count ELSE 0 END) AS dkim_fail,
      SUM(CASE WHEN rec.disposition = 'none' THEN rec.count ELSE 0 END) AS dmarc_pass,
      SUM(CASE WHEN rec.disposition <> 'none' THEN rec.count ELSE 0 END) AS dmarc_fail
    FROM reports r JOIN records rec ON rec.report_id = r.id
    WHERE r.date_begin >= ?
  `).get(cutoff) as Row;

  const series = db.prepare(`
    SELECT strftime('%Y-%m-%d', r.date_begin, 'unixepoch') AS day,
      SUM(CASE WHEN rec.spf_aligned = 1 THEN rec.count ELSE 0 END) AS spf_pass,
      SUM(CASE WHEN rec.spf_aligned = 0 THEN rec.count ELSE 0 END) AS spf_fail,
      SUM(CASE WHEN rec.dkim_aligned = 1 THEN rec.count ELSE 0 END) AS dkim_pass,
      SUM(CASE WHEN rec.dkim_aligned = 0 THEN rec.count ELSE 0 END) AS dkim_fail
    FROM reports r JOIN records rec ON rec.report_id = r.id
    WHERE r.date_begin >= ?
    GROUP BY day ORDER BY day
  `).all(cutoff) as Row[];

  return { total: totalRow.total, spark: sparkRows.map((s) => ({ t: s.day, v: s.v })), topSources, topOrgs, topHeaderFrom, topCountries, align, series };
}

export default async function DashboardPage() {
  const s = loadStats();
  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" subtitle="Letzte 30 Tage" />

      <div className="grid grid-cols-12 gap-4">
        <Card className="col-span-12 lg:col-span-7">
          <CardHeader>
            <CardTitle>Total Message Count</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between">
              <div className="text-5xl font-bold tabular-nums text-zinc-50">{formatNumber(s.total)}</div>
              <div className="w-2/3 max-w-md">
                <Sparkline data={s.spark.length ? s.spark : [{ t: 0, v: 0 }]} height={60} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-12 lg:col-span-5">
          <CardHeader><CardTitle>SPF / DKIM / DMARC Pass-Rate</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: "SPF", pass: s.align.spf_pass || 0, fail: s.align.spf_fail || 0 },
                { label: "DKIM", pass: s.align.dkim_pass || 0, fail: s.align.dkim_fail || 0 },
                { label: "DMARC", pass: s.align.dmarc_pass || 0, fail: s.align.dmarc_fail || 0 },
              ].map((x) => (
                <Donut key={x.label} data={[
                  { name: `${x.label} pass`, value: x.pass, color: "#10b981" },
                  { name: `${x.label} fail`, value: x.fail, color: "#ef4444" },
                ]} height={150} />
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-12 lg:col-span-6">
          <CardHeader><CardTitle>Top Sources by rDNS</CardTitle></CardHeader>
          <CardContent>
            <HorizontalBar rows={s.topSources.map((x) => ({ label: x.rdns || x.source_ip, sub: x.rdns ? x.source_ip : undefined, value: x.v }))} />
          </CardContent>
        </Card>

        <Card className="col-span-12 lg:col-span-6">
          <CardHeader><CardTitle>Reporting Orgs</CardTitle></CardHeader>
          <CardContent>
            <HorizontalBar rows={s.topOrgs.map((x) => ({ label: x.label, sub: x.sub || undefined, value: x.v }))} />
          </CardContent>
        </Card>

        <Card className="col-span-12 lg:col-span-6">
          <CardHeader><CardTitle>Header-From-Volume</CardTitle></CardHeader>
          <CardContent>
            <HorizontalBar rows={s.topHeaderFrom.map((x) => ({ label: x.label, value: x.v }))} />
          </CardContent>
        </Card>

        <Card className="col-span-12 lg:col-span-6">
          <CardHeader><CardTitle>Top Source Countries</CardTitle></CardHeader>
          <CardContent>
            <HorizontalBar rows={s.topCountries.map((x) => ({ label: x.label, value: x.v }))} />
          </CardContent>
        </Card>

        <Card className="col-span-12">
          <CardHeader><CardTitle>SPF / DKIM Pass vs. Fail über Zeit</CardTitle></CardHeader>
          <CardContent>
            <TimeSeries data={s.series} series={[
              { key: "spf_pass", label: "SPF pass", color: "#10b981" },
              { key: "spf_fail", label: "SPF fail", color: "#f59e0b" },
              { key: "dkim_pass", label: "DKIM pass", color: "#22d3ee" },
              { key: "dkim_fail", label: "DKIM fail", color: "#ef4444" },
            ]} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
