import { requireAdmin } from "@/lib/auth-helpers";
import { getSetting } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsForm } from "./SettingsForm";
import { UploadForm } from "./UploadForm";
import { UpdateBox } from "./UpdateBox";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireAdmin();
  const cfg = {
    imap_host: getSetting("imap_host") || "",
    imap_port: getSetting("imap_port") || "993",
    imap_secure: getSetting("imap_secure") !== "false",
    imap_user: getSetting("imap_user") || "",
    imap_mailbox: getSetting("imap_mailbox") || "INBOX",
    imap_delete: getSetting("imap_delete") === "true",
    imap_poll_minutes: getSetting("imap_poll_minutes") || "5",
    smtp_host: getSetting("smtp_host") || "",
    smtp_port: getSetting("smtp_port") || "587",
    smtp_user: getSetting("smtp_user") || "",
    smtp_from: getSetting("smtp_from") || "",
    alert_email: getSetting("alert_email") || "",
    alert_webhook: getSetting("alert_webhook") || "",
    alert_fail_pct: getSetting("alert_fail_pct") || "5",
  };
  return (
    <div className="space-y-6">
      <PageHeader title="Einstellungen" subtitle="IMAP, SMTP, Alarme, Update" />
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-8 space-y-4">
          <Card>
            <CardHeader><CardTitle>IMAP / SMTP / Alarme</CardTitle></CardHeader>
            <CardContent><SettingsForm initial={cfg} /></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Manueller Upload (DMARC-XML / .gz / .zip)</CardTitle></CardHeader>
            <CardContent><UploadForm /></CardContent>
          </Card>
        </div>
        <div className="col-span-12 lg:col-span-4">
          <UpdateBox />
        </div>
      </div>
    </div>
  );
}
