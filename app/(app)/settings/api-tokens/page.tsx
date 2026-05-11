import { requireAdmin } from "@/lib/auth-helpers";
import { getDb } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function ApiTokensPage() {
  await requireAdmin();
  const rows = getDb().prepare("SELECT id, name, scopes, created_at, last_used_at, revoked_at FROM api_tokens ORDER BY id DESC").all() as any[];
  return (
    <div className="space-y-6">
      <PageHeader title="API-Tokens" subtitle="Token-basierte Auth für /api/v1/* (TODO: UI zum Anlegen)" />
      <Card>
        <CardContent className="p-0">
          <Table>
            <THead><TR><TH>Name</TH><TH>Scopes</TH><TH>Angelegt</TH><TH>Last used</TH><TH>Status</TH></TR></THead>
            <TBody>
              {rows.map((t) => (
                <TR key={t.id}>
                  <TD>{t.name}</TD>
                  <TD className="text-xs font-mono">{t.scopes}</TD>
                  <TD className="text-xs">{new Date(t.created_at).toLocaleDateString("de-DE")}</TD>
                  <TD className="text-xs">{t.last_used_at ? new Date(t.last_used_at).toLocaleDateString("de-DE") : "—"}</TD>
                  <TD className="text-xs">{t.revoked_at ? "revoked" : "aktiv"}</TD>
                </TR>
              ))}
              {rows.length === 0 && <TR><TD colSpan={5} className="py-6 text-center text-xs text-zinc-500">Keine Tokens.</TD></TR>}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
