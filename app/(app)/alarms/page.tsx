import { getDb } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default function AlarmsPage() {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM alerts ORDER BY ts DESC LIMIT 200").all() as any[];
  return (
    <div className="space-y-6">
      <PageHeader title="Alarme" subtitle={`${rows.length} (neueste 200)`} />
      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>Zeit</TH>
                <TH>Severity</TH>
                <TH>Domain</TH>
                <TH>Kind</TH>
                <TH>Titel</TH>
                <TH>Mail</TH>
                <TH>Webhook</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((a) => (
                <TR key={a.id}>
                  <TD className="text-xs">{new Date(a.ts).toLocaleString("de-DE")}</TD>
                  <TD><Badge variant={a.severity}>{a.severity}</Badge></TD>
                  <TD className="text-xs">{a.domain ?? "—"}</TD>
                  <TD className="text-xs font-mono text-zinc-400">{a.kind}</TD>
                  <TD>{a.title}</TD>
                  <TD className="text-xs">{a.delivered_email ? "✓" : "—"}</TD>
                  <TD className="text-xs">{a.delivered_webhook ? "✓" : "—"}</TD>
                </TR>
              ))}
              {rows.length === 0 && (
                <TR><TD colSpan={7} className="py-6 text-center text-xs text-zinc-500">Keine Alarme. Schwellen unter Einstellungen anpassen.</TD></TR>
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
