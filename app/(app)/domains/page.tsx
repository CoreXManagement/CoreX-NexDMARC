import { getDb } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AddDomainForm } from "./AddDomainForm";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function DomainsPage() {
  const db = getDb();
  const rows = db.prepare(`
    SELECT d.*,
      (SELECT COUNT(*) FROM reports r WHERE r.domain_id = d.id) AS report_count,
      (SELECT COALESCE(SUM(rec.count), 0) FROM reports r JOIN records rec ON rec.report_id = r.id WHERE r.domain_id = d.id) AS message_count
    FROM domains d
    ORDER BY d.domain
  `).all() as any[];

  return (
    <div className="space-y-6">
      <PageHeader title="Domains" subtitle={`${rows.length} überwacht`} />
      <AddDomainForm />
      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>Domain</TH>
                <TH>Reports</TH>
                <TH>Messages</TH>
                <TH>Security-Grade</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.id}>
                  <TD><Link className="text-cyan-400 hover:underline" href={`/domains/${r.id}`}>{r.domain}</Link></TD>
                  <TD className="tabular-nums">{r.report_count}</TD>
                  <TD className="tabular-nums">{(r.message_count || 0).toLocaleString("de-DE")}</TD>
                  <TD>
                    {r.last_check_grade ? <Badge variant={gradeVariant(r.last_check_grade)}>{r.last_check_grade}</Badge> : <span className="text-xs text-zinc-600">noch nicht geprüft</span>}
                  </TD>
                </TR>
              ))}
              {rows.length === 0 && (
                <TR>
                  <TD colSpan={4} className="py-6 text-center text-xs text-zinc-500">
                    Noch keine Domains. Domains werden automatisch beim Eingang von DMARC-Reports angelegt.
                  </TD>
                </TR>
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function gradeVariant(g: string): "ok" | "warn" | "fail" | "info" {
  if (g === "A") return "ok";
  if (g === "B" || g === "C") return "warn";
  if (g === "D" || g === "F") return "fail";
  return "info";
}
