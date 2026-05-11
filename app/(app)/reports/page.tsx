import { getDb } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default function ReportsPage() {
  const db = getDb();
  const rows = db.prepare(`
    SELECT r.*,
      (SELECT COALESCE(SUM(rec.count),0) FROM records rec WHERE rec.report_id = r.id) AS total,
      (SELECT COALESCE(SUM(rec.count),0) FROM records rec WHERE rec.report_id = r.id AND rec.disposition='none') AS pass,
      (SELECT COALESCE(SUM(rec.count),0) FROM records rec WHERE rec.report_id = r.id AND rec.disposition<>'none') AS fail
    FROM reports r
    ORDER BY r.date_begin DESC
    LIMIT 200
  `).all() as any[];

  return (
    <div className="space-y-6">
      <PageHeader title="DMARC-Reports" subtitle={`${rows.length} (neueste 200)`} />
      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>Zeitraum</TH>
                <TH>Domain</TH>
                <TH>Reporting Org</TH>
                <TH>Policy</TH>
                <TH className="text-right">Messages</TH>
                <TH className="text-right">Pass</TH>
                <TH className="text-right">Fail</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.id}>
                  <TD className="text-xs">{new Date(r.date_begin * 1000).toLocaleDateString("de-DE")} – {new Date(r.date_end * 1000).toLocaleDateString("de-DE")}</TD>
                  <TD>{r.domain}</TD>
                  <TD className="text-xs text-zinc-400">{r.org_name}</TD>
                  <TD><Badge variant={r.policy_p === "reject" ? "ok" : r.policy_p === "quarantine" ? "warn" : "info"}>p={r.policy_p ?? "?"}</Badge></TD>
                  <TD className="text-right tabular-nums">{r.total.toLocaleString("de-DE")}</TD>
                  <TD className="text-right tabular-nums text-emerald-400">{r.pass.toLocaleString("de-DE")}</TD>
                  <TD className="text-right tabular-nums text-red-400">{r.fail.toLocaleString("de-DE")}</TD>
                </TR>
              ))}
              {rows.length === 0 && (
                <TR><TD colSpan={7} className="py-6 text-center text-xs text-zinc-500">Noch keine Reports. IMAP-Pull oder manueller Upload (Settings → Upload).</TD></TR>
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
