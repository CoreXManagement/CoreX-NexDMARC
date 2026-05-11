import { requireAdmin } from "@/lib/auth-helpers";
import { getDb } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  await requireAdmin();
  const rows = getDb().prepare("SELECT id, email, role, created_at FROM users ORDER BY id").all() as any[];
  return (
    <div className="space-y-6">
      <PageHeader title="Benutzer" subtitle={`${rows.length} Konten`} />
      <Card>
        <CardContent className="p-0">
          <Table>
            <THead><TR><TH>Email</TH><TH>Rolle</TH><TH>Angelegt</TH></TR></THead>
            <TBody>
              {rows.map((u) => (
                <TR key={u.id}>
                  <TD>{u.email}</TD>
                  <TD><Badge variant={u.role === "admin" ? "ok" : "info"}>{u.role}</Badge></TD>
                  <TD className="text-xs">{new Date(u.created_at).toLocaleDateString("de-DE")}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
