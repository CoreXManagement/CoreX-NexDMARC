import { getDb } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function SecurityOverview() {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM domains ORDER BY domain").all() as any[];
  return (
    <div className="space-y-6">
      <PageHeader title="Mail-Security" subtitle="Live-DNS-Audit pro Domain (SPF, DKIM, DMARC, MTA-STS, TLS-RPT, BIMI, DNSSEC, PTR, DNSBL)" />
      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>Domain</TH>
                <TH>Letzter Check</TH>
                <TH>Grade</TH>
                <TH></TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.id}>
                  <TD><Link className="text-cyan-400 hover:underline" href={`/domains/${r.id}`}>{r.domain}</Link></TD>
                  <TD className="text-xs">{r.last_check_at ? new Date(r.last_check_at).toLocaleString("de-DE") : "—"}</TD>
                  <TD>{r.last_check_grade ? <Badge variant={r.last_check_grade === "A" ? "ok" : r.last_check_grade === "F" ? "fail" : "warn"}>{r.last_check_grade}</Badge> : <span className="text-xs text-zinc-600">—</span>}</TD>
                  <TD className="text-right text-xs"><Link className="text-zinc-500 hover:text-cyan-400" href={`/domains/${r.id}`}>Details →</Link></TD>
                </TR>
              ))}
              {rows.length === 0 && (
                <TR><TD colSpan={4} className="py-6 text-center text-xs text-zinc-500">Keine Domains.</TD></TR>
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
