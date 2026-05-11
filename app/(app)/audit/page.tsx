import { requireAdmin } from "@/lib/auth-helpers";
import { getDb } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  await requireAdmin();
  const rows = getDb().prepare("SELECT * FROM audit_log ORDER BY ts DESC LIMIT 300").all() as any[];
  return (
    <div className="space-y-6">
      <PageHeader title="Audit-Log" subtitle={`${rows.length} (neueste 300)`} />
      <Card>
        <CardContent className="p-0">
          <Table>
            <THead><TR><TH>Zeit</TH><TH>User</TH><TH>Action</TH><TH>Target</TH><TH>Details</TH></TR></THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.id}>
                  <TD className="text-xs">{new Date(r.ts).toLocaleString("de-DE")}</TD>
                  <TD className="text-xs">{r.user_email ?? "system"}</TD>
                  <TD className="font-mono text-xs">{r.action}</TD>
                  <TD className="text-xs">{r.target_type ? `${r.target_type}#${r.target_id}` : "—"}</TD>
                  <TD className="max-w-md truncate text-xs text-zinc-500">{r.details}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
