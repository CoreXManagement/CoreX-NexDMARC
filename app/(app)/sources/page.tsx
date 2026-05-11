import { getDb } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default function SourcesPage() {
  const db = getDb();
  const cutoff = Math.floor((Date.now() - 30 * 24 * 3600 * 1000) / 1000);
  const rows = db.prepare(`
    SELECT rec.source_ip, rec.rdns, rec.country, rec.asn_org,
      SUM(rec.count) AS total,
      SUM(CASE WHEN rec.spf_aligned=1 THEN rec.count ELSE 0 END) AS spf_pass,
      SUM(CASE WHEN rec.dkim_aligned=1 THEN rec.count ELSE 0 END) AS dkim_pass,
      SUM(CASE WHEN rec.disposition='none' THEN rec.count ELSE 0 END) AS dmarc_pass
    FROM reports r JOIN records rec ON rec.report_id = r.id
    WHERE r.date_begin >= ?
    GROUP BY rec.source_ip
    ORDER BY total DESC
    LIMIT 500
  `).all(cutoff) as any[];

  return (
    <div className="space-y-6">
      <PageHeader title="Sender-Quellen" subtitle={`${rows.length} (letzte 30 Tage, Top 500)`} />
      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>IP</TH>
                <TH>rDNS</TH>
                <TH>ASN-Org</TH>
                <TH>Country</TH>
                <TH className="text-right">Messages</TH>
                <TH className="text-right">SPF-Pass</TH>
                <TH className="text-right">DKIM-Pass</TH>
                <TH className="text-right">DMARC-Pass</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((r, i) => (
                <TR key={i}>
                  <TD className="font-mono text-xs">{r.source_ip}</TD>
                  <TD className="text-xs text-zinc-400">{r.rdns ?? "—"}</TD>
                  <TD className="text-xs text-zinc-400">{r.asn_org ?? "—"}</TD>
                  <TD className="text-xs">{r.country ?? "—"}</TD>
                  <TD className="text-right tabular-nums">{r.total.toLocaleString("de-DE")}</TD>
                  <TD className="text-right tabular-nums">{((r.spf_pass / r.total) * 100).toFixed(0)}%</TD>
                  <TD className="text-right tabular-nums">{((r.dkim_pass / r.total) * 100).toFixed(0)}%</TD>
                  <TD className="text-right tabular-nums">{((r.dmarc_pass / r.total) * 100).toFixed(0)}%</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
