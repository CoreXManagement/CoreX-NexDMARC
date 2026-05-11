"use client";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type Cfg = {
  imap_host: string; imap_port: string; imap_secure: boolean; imap_user: string; imap_mailbox: string; imap_delete: boolean; imap_poll_minutes: string;
  smtp_host: string; smtp_port: string; smtp_user: string; smtp_from: string;
  alert_email: string; alert_webhook: string; alert_fail_pct: string;
};

export function SettingsForm({ initial }: { initial: Cfg }) {
  const [c, setC] = useState(initial);
  const [imapPass, setImapPass] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  function field<K extends keyof Cfg>(k: K, v: Cfg[K]) {
    setC({ ...c, [k]: v });
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    const body: Record<string, string> = {
      imap_host: c.imap_host, imap_port: c.imap_port, imap_secure: c.imap_secure ? "true" : "false",
      imap_user: c.imap_user, imap_mailbox: c.imap_mailbox, imap_delete: c.imap_delete ? "true" : "false",
      imap_poll_minutes: c.imap_poll_minutes,
      smtp_host: c.smtp_host, smtp_port: c.smtp_port, smtp_user: c.smtp_user, smtp_from: c.smtp_from,
      alert_email: c.alert_email, alert_webhook: c.alert_webhook, alert_fail_pct: c.alert_fail_pct,
    };
    if (imapPass) body.imap_pass = imapPass;
    if (smtpPass) body.smtp_pass = smtpPass;
    const res = await fetch("/api/settings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    setSaving(false);
    setMsg(res.ok ? "Gespeichert." : "Fehler beim Speichern.");
  }

  async function testImap() {
    setTesting(true);
    setMsg(null);
    const res = await fetch("/api/imap/test", { method: "POST" });
    const data = await res.json();
    setTesting(false);
    setMsg(res.ok ? `IMAP-Pull OK: ${data.fetched} fetched, ${data.ingested} ingested.` : `IMAP-Pull-Fehler: ${data.error}`);
  }

  return (
    <div className="space-y-6">
      <Section title="IMAP (DMARC-Postfach)">
        <Row><F label="Host"><Input value={c.imap_host} onChange={(e) => field("imap_host", e.target.value)} placeholder="imap.example.com" /></F>
          <F label="Port"><Input value={c.imap_port} onChange={(e) => field("imap_port", e.target.value)} className="w-24" /></F>
          <F label="TLS"><label className="flex h-9 items-center gap-2 text-xs text-zinc-300"><input type="checkbox" checked={c.imap_secure} onChange={(e) => field("imap_secure", e.target.checked)} /> aktiv</label></F>
        </Row>
        <Row><F label="User"><Input value={c.imap_user} onChange={(e) => field("imap_user", e.target.value)} placeholder="dmarc@example.com" /></F>
          <F label="Passwort"><Input type="password" placeholder="(unverändert)" value={imapPass} onChange={(e) => setImapPass(e.target.value)} /></F>
          <F label="Mailbox"><Input value={c.imap_mailbox} onChange={(e) => field("imap_mailbox", e.target.value)} /></F>
        </Row>
        <Row><F label="Poll-Intervall (min)"><Input value={c.imap_poll_minutes} onChange={(e) => field("imap_poll_minutes", e.target.value)} className="w-32" /></F>
          <F label="Nach Verarbeitung löschen"><label className="flex h-9 items-center gap-2 text-xs text-zinc-300"><input type="checkbox" checked={c.imap_delete} onChange={(e) => field("imap_delete", e.target.checked)} /> aktiv</label></F>
          <div className="flex items-end"><Button size="sm" variant="outline" onClick={testImap} disabled={testing}>{testing ? "..." : "Test-Pull"}</Button></div>
        </Row>
      </Section>

      <Section title="SMTP (Alarm-Mails)">
        <Row><F label="Host"><Input value={c.smtp_host} onChange={(e) => field("smtp_host", e.target.value)} placeholder="smtp.example.com" /></F>
          <F label="Port"><Input value={c.smtp_port} onChange={(e) => field("smtp_port", e.target.value)} className="w-24" /></F>
          <F label="User"><Input value={c.smtp_user} onChange={(e) => field("smtp_user", e.target.value)} /></F>
        </Row>
        <Row><F label="Passwort"><Input type="password" placeholder="(unverändert)" value={smtpPass} onChange={(e) => setSmtpPass(e.target.value)} /></F>
          <F label="From"><Input value={c.smtp_from} onChange={(e) => field("smtp_from", e.target.value)} /></F>
        </Row>
      </Section>

      <Section title="Alarme">
        <Row><F label="Alarm-Mail-Empfänger"><Input value={c.alert_email} onChange={(e) => field("alert_email", e.target.value)} placeholder="alarm@example.com" /></F>
          <F label="Webhook-URL"><Input value={c.alert_webhook} onChange={(e) => field("alert_webhook", e.target.value)} placeholder="https://hooks.example.com/..." /></F>
          <F label="Fail-Schwelle (%)"><Input value={c.alert_fail_pct} onChange={(e) => field("alert_fail_pct", e.target.value)} className="w-24" /></F>
        </Row>
      </Section>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving}>{saving ? "..." : "Speichern"}</Button>
        {msg ? <span className="text-xs text-zinc-400">{msg}</span> : null}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[10px] uppercase tracking-wider text-zinc-500">{title}</p>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-end gap-3">{children}</div>;
}
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label>{label}</Label>{children}</div>;
}
