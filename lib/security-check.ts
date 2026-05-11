import dns from "dns/promises";
import net from "net";

export type CheckSeverity = "ok" | "warn" | "fail" | "info";

export type CheckItem = {
  key: string;
  title: string;
  severity: CheckSeverity;
  summary: string;
  detail?: string;
  fix?: string;
  raw?: unknown;
};

export type SecurityCheckResult = {
  domain: string;
  ts: number;
  grade: "A" | "B" | "C" | "D" | "F";
  score: number;
  items: CheckItem[];
};

export async function runSecurityCheck(domain: string): Promise<SecurityCheckResult> {
  const d = domain.toLowerCase().trim();
  const items: CheckItem[] = [];

  const [mx, spf, dmarc, mtaSts, tlsRpt, bimi, dnssec] = await Promise.all([
    checkMx(d),
    checkSpf(d),
    checkDmarc(d),
    checkMtaSts(d),
    checkTlsRpt(d),
    checkBimi(d),
    checkDnssec(d),
  ]);
  items.push(mx, spf, dmarc, mtaSts, tlsRpt, bimi, dnssec);

  const dkim = await checkDkim(d);
  items.push(dkim);

  const ptrAndRelay = await checkMxPtrAndRelay(d);
  items.push(...ptrAndRelay);

  const dnsbl = await checkDnsbl(d);
  items.push(dnsbl);

  let score = 0;
  let max = 0;
  for (const it of items) {
    if (it.severity === "info") continue;
    max += 10;
    if (it.severity === "ok") score += 10;
    else if (it.severity === "warn") score += 5;
  }
  const pct = max ? (score / max) * 100 : 0;
  const grade: SecurityCheckResult["grade"] = pct >= 90 ? "A" : pct >= 75 ? "B" : pct >= 60 ? "C" : pct >= 40 ? "D" : "F";

  return { domain: d, ts: Date.now(), grade, score: Math.round(pct), items };
}

async function resolveTxt(name: string): Promise<string[][]> {
  try {
    return await dns.resolveTxt(name);
  } catch {
    return [];
  }
}

async function resolveMx(name: string) {
  try {
    return await dns.resolveMx(name);
  } catch {
    return [];
  }
}

async function checkMx(domain: string): Promise<CheckItem> {
  const mx = await resolveMx(domain);
  if (!mx.length) {
    return {
      key: "mx",
      title: "MX-Records",
      severity: "fail",
      summary: "Keine MX-Records gefunden — Domain kann keine Mails empfangen.",
      fix: `MX-Record im DNS setzen, z.B.\n${domain}. 3600 IN MX 10 mail.${domain}.`,
    };
  }
  if (mx.length === 1) {
    return {
      key: "mx",
      title: "MX-Records",
      severity: "warn",
      summary: `1 MX-Record (${mx[0].exchange}). Kein Backup-MX — bei Ausfall gehen Mails verloren oder bouncen.`,
      detail: mx.map((m) => `${m.priority} ${m.exchange}`).join("\n"),
      fix: `Zweiten MX-Record mit höherer Priorität anlegen.`,
    };
  }
  return {
    key: "mx",
    title: "MX-Records",
    severity: "ok",
    summary: `${mx.length} MX-Records gefunden.`,
    detail: mx.map((m) => `${m.priority} ${m.exchange}`).join("\n"),
    raw: mx,
  };
}

async function checkSpf(domain: string): Promise<CheckItem> {
  const txts = await resolveTxt(domain);
  const spf = txts.map((t) => t.join("")).filter((s) => s.toLowerCase().startsWith("v=spf1"));
  if (spf.length === 0) {
    return {
      key: "spf",
      title: "SPF",
      severity: "fail",
      summary: "Kein SPF-Record. Empfänger können den Versender nicht prüfen — hohe Spoofing-Gefahr.",
      fix: `TXT-Record für ${domain}:\n"v=spf1 mx -all"\n(passt für Mailversand über deinen MX. Anpassen je Mailprovider.)`,
    };
  }
  if (spf.length > 1) {
    return {
      key: "spf",
      title: "SPF",
      severity: "fail",
      summary: `${spf.length} SPF-Records gleichzeitig — RFC erlaubt nur einen. Empfänger werden auf permerror gehen.`,
      detail: spf.join("\n"),
      fix: "Auf einen einzigen SPF-TXT-Record konsolidieren.",
    };
  }
  const rec = spf[0];
  const lookups = countSpfLookups(rec);
  const endsAll = /[-~?+]all\s*$/i.test(rec.trim());
  const isPlusAll = /\+all\b/i.test(rec);
  if (isPlusAll) {
    return { key: "spf", title: "SPF", severity: "fail", summary: "SPF endet auf '+all' — jeder Server darf für deine Domain senden. Faktisch kein SPF-Schutz.", detail: rec, fix: "Auf '-all' oder '~all' wechseln." };
  }
  if (!endsAll) {
    return { key: "spf", title: "SPF", severity: "warn", summary: "SPF endet nicht auf 'all'. Default ist '?all' (neutral) — kaum Schutz.", detail: rec, fix: "Mit '-all' (hart) oder '~all' (soft) abschließen." };
  }
  if (lookups > 10) {
    return { key: "spf", title: "SPF", severity: "fail", summary: `${lookups} DNS-Lookups — RFC 7208 erlaubt maximal 10. Empfänger gehen auf permerror.`, detail: rec, fix: "Includes/Macros reduzieren, ggf. flatten." };
  }
  return { key: "spf", title: "SPF", severity: "ok", summary: `SPF vorhanden (${lookups}/10 Lookups).`, detail: rec };
}

function countSpfLookups(spf: string): number {
  const tokens = spf.toLowerCase().split(/\s+/);
  let n = 0;
  for (const t of tokens) {
    if (/^(include|a|mx|ptr|exists|redirect)[:=]?/.test(t)) n++;
  }
  return n;
}

async function checkDmarc(domain: string): Promise<CheckItem> {
  const txts = await resolveTxt(`_dmarc.${domain}`);
  const recs = txts.map((t) => t.join("")).filter((s) => /^v=DMARC1/i.test(s));
  if (recs.length === 0) {
    return {
      key: "dmarc",
      title: "DMARC",
      severity: "fail",
      summary: "Kein DMARC-Record. Du bekommst keine Reports und kein Empfänger erzwingt Policy.",
      fix: `TXT-Record _dmarc.${domain}:\n"v=DMARC1; p=none; rua=mailto:dmarc@${domain}"\nDann auf p=quarantine, später p=reject.`,
    };
  }
  if (recs.length > 1) {
    return { key: "dmarc", title: "DMARC", severity: "fail", summary: `${recs.length} DMARC-Records. Empfänger ignorieren mehrere.`, detail: recs.join("\n"), fix: "Auf einen einzigen Record reduzieren." };
  }
  const rec = recs[0];
  const tags = parseDmarcTags(rec);
  const policy = (tags.p ?? "none").toLowerCase();
  const pct = tags.pct ? Number(tags.pct) : 100;
  const hasRua = !!tags.rua;
  if (policy === "none") {
    return {
      key: "dmarc",
      title: "DMARC",
      severity: "warn",
      summary: `DMARC steht auf p=none — Monitoring only, kein Schutz.${hasRua ? "" : " Außerdem fehlt rua= für Reports."}`,
      detail: rec,
      fix: `Wenn Reports stabil aussehen → auf p=quarantine, später p=reject.\nBeispiel: "v=DMARC1; p=quarantine; pct=100; rua=mailto:dmarc@${domain}"`,
    };
  }
  if (policy === "quarantine" && pct < 100) {
    return { key: "dmarc", title: "DMARC", severity: "warn", summary: `DMARC=quarantine, aber nur pct=${pct}.`, detail: rec, fix: "Schrittweise pct hochsetzen, dann auf reject." };
  }
  if (policy === "quarantine") return { key: "dmarc", title: "DMARC", severity: "warn", summary: "DMARC=quarantine. Aktiv, aber nicht maximal.", detail: rec, fix: "Auf p=reject wechseln, sobald alle Sender SPF/DKIM-konform sind." };
  if (policy === "reject") return { key: "dmarc", title: "DMARC", severity: "ok", summary: `DMARC=reject${hasRua ? "" : " (kein rua= — keine Reports!)"}.`, detail: rec };
  return { key: "dmarc", title: "DMARC", severity: "info", summary: `DMARC unbekannte Policy: ${policy}`, detail: rec };
}

function parseDmarcTags(rec: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of rec.split(";")) {
    const [k, v] = part.split("=").map((s) => s?.trim());
    if (k && v) out[k.toLowerCase()] = v;
  }
  return out;
}

const COMMON_DKIM_SELECTORS = ["default", "google", "selector1", "selector2", "s1", "s2", "mail", "k1", "k2", "dkim", "smtp", "mandrill", "mailjet", "amazonses", "sm", "key1", "key2"];

async function checkDkim(domain: string): Promise<CheckItem> {
  const found: { selector: string; record: string }[] = [];
  await Promise.all(COMMON_DKIM_SELECTORS.map(async (sel) => {
    const txts = await resolveTxt(`${sel}._domainkey.${domain}`);
    const joined = txts.map((t) => t.join("")).find((s) => s.toLowerCase().includes("v=dkim1") || s.toLowerCase().includes("p="));
    if (joined) found.push({ selector: sel, record: joined });
  }));
  if (!found.length) {
    return {
      key: "dkim",
      title: "DKIM (Selectors)",
      severity: "warn",
      summary: "Kein DKIM-Selector aus der Standardliste gefunden. DKIM scheint nicht eingerichtet oder nutzt einen anderen Selector.",
      detail: `Probiert: ${COMMON_DKIM_SELECTORS.join(", ")}`,
      fix: "Bei deinem Mailprovider den DKIM-Selector ablesen und im DNS prüfen.",
    };
  }
  return {
    key: "dkim",
    title: "DKIM (Selectors)",
    severity: "ok",
    summary: `${found.length} DKIM-Selector gefunden: ${found.map((f) => f.selector).join(", ")}`,
    detail: found.map((f) => `${f.selector}: ${f.record.slice(0, 80)}...`).join("\n"),
  };
}

async function checkMtaSts(domain: string): Promise<CheckItem> {
  const txts = await resolveTxt(`_mta-sts.${domain}`);
  const rec = txts.map((t) => t.join("")).find((s) => /^v=STSv1/i.test(s));
  if (!rec) {
    return {
      key: "mta_sts",
      title: "MTA-STS",
      severity: "warn",
      summary: "Kein MTA-STS. SMTP-Verschlüsselung ist optional und kann downgrade-attackt werden.",
      fix: `TXT _mta-sts.${domain}:\n"v=STSv1; id=$(date +%Y%m%d%H%M%S)"\nPlus Policy unter https://mta-sts.${domain}/.well-known/mta-sts.txt`,
    };
  }
  try {
    const res = await fetch(`https://mta-sts.${domain}/.well-known/mta-sts.txt`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const policy = await res.text();
    if (!/mode:\s*(enforce|testing)/i.test(policy)) {
      return { key: "mta_sts", title: "MTA-STS", severity: "warn", summary: "MTA-STS-Policy gefunden, aber kein mode: enforce/testing.", detail: policy };
    }
    return { key: "mta_sts", title: "MTA-STS", severity: "ok", summary: "MTA-STS-Policy aktiv.", detail: rec + "\n---\n" + policy };
  } catch (e: any) {
    return { key: "mta_sts", title: "MTA-STS", severity: "warn", summary: `TXT vorhanden, aber Policy-URL nicht erreichbar (${e?.message ?? e}).`, detail: rec };
  }
}

async function checkTlsRpt(domain: string): Promise<CheckItem> {
  const txts = await resolveTxt(`_smtp._tls.${domain}`);
  const rec = txts.map((t) => t.join("")).find((s) => /^v=TLSRPTv1/i.test(s));
  if (!rec) {
    return {
      key: "tls_rpt",
      title: "TLS-RPT",
      severity: "info",
      summary: "Kein TLS-RPT. Du bekommst keine Berichte über TLS-Verbindungsprobleme.",
      fix: `TXT _smtp._tls.${domain}:\n"v=TLSRPTv1; rua=mailto:tlsrpt@${domain}"`,
    };
  }
  return { key: "tls_rpt", title: "TLS-RPT", severity: "ok", summary: "TLS-RPT vorhanden.", detail: rec };
}

async function checkBimi(domain: string): Promise<CheckItem> {
  const txts = await resolveTxt(`default._bimi.${domain}`);
  const rec = txts.map((t) => t.join("")).find((s) => /^v=BIMI1/i.test(s));
  if (!rec) {
    return { key: "bimi", title: "BIMI", severity: "info", summary: "Kein BIMI. (Optional — Logo im Mail-Client.)", fix: "Nur sinnvoll bei DMARC=reject + VMC-Zertifikat." };
  }
  return { key: "bimi", title: "BIMI", severity: "ok", summary: "BIMI-Record vorhanden.", detail: rec };
}

async function checkDnssec(domain: string): Promise<CheckItem> {
  try {
    const ds = await dns.resolve(domain, "DS" as any).catch(() => []);
    if (Array.isArray(ds) && ds.length > 0) return { key: "dnssec", title: "DNSSEC", severity: "ok", summary: "DNSSEC aktiv (DS-Record gefunden).", detail: JSON.stringify(ds) };
    return { key: "dnssec", title: "DNSSEC", severity: "warn", summary: "Kein DS-Record — Zone vermutlich nicht DNSSEC-signiert.", fix: "Bei deinem Registrar DNSSEC aktivieren." };
  } catch {
    return { key: "dnssec", title: "DNSSEC", severity: "warn", summary: "DNSSEC-Status konnte nicht ermittelt werden." };
  }
}

async function checkMxPtrAndRelay(domain: string): Promise<CheckItem[]> {
  const mx = await resolveMx(domain);
  if (!mx.length) return [];
  const items: CheckItem[] = [];
  const ptrResults: string[] = [];
  const relayProblems: string[] = [];
  for (const m of mx) {
    const ips = await dns.resolve4(m.exchange).catch(() => []);
    for (const ip of ips) {
      const ptr = await dns.reverse(ip).catch(() => [] as string[]);
      if (!ptr.length) ptrResults.push(`${m.exchange} (${ip}): kein PTR`);
      else ptrResults.push(`${m.exchange} (${ip}) → ${ptr[0]}`);
      try {
        const open = await isOpenRelay(ip, domain);
        if (open) relayProblems.push(`${m.exchange} (${ip}) — Open Relay verdächtig`);
      } catch {}
    }
  }
  items.push({
    key: "ptr",
    title: "PTR / rDNS der MX",
    severity: ptrResults.some((s) => /kein PTR/.test(s)) ? "warn" : "ok",
    summary: ptrResults.some((s) => /kein PTR/.test(s)) ? "Mindestens ein MX hat keinen PTR — Empfänger werten das als Spam-Signal." : "Alle MX haben PTR-Records.",
    detail: ptrResults.join("\n"),
    fix: "Beim Hoster reverse-DNS auf den MX-Hostnamen setzen.",
  });
  items.push({
    key: "open_relay",
    title: "Open Relay Test",
    severity: relayProblems.length ? "fail" : "ok",
    summary: relayProblems.length ? `Verdächtig: ${relayProblems.length} MX könnte offen relayen.` : "Kein Open-Relay-Indiz.",
    detail: relayProblems.join("\n") || "Test: EHLO + RCPT TO an fremde Domain abgelehnt.",
  });
  return items;
}

async function isOpenRelay(ip: string, ourDomain: string): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = net.createConnection({ host: ip, port: 25, timeout: 5000 });
    let stage = 0;
    let buf = "";
    const cleanup = (result: boolean) => {
      try { sock.end(); } catch {}
      resolve(result);
    };
    sock.on("connect", () => {});
    sock.on("data", (d) => {
      buf += d.toString("utf8");
      if (/\r\n/.test(buf)) {
        const line = buf.trim().split("\r\n").pop() || "";
        buf = "";
        if (stage === 0 && /^220 /.test(line)) {
          sock.write(`EHLO test.${ourDomain}\r\n`);
          stage++;
        } else if (stage === 1 && /^250[ -]/.test(line)) {
          sock.write(`MAIL FROM:<probe@${ourDomain}>\r\n`);
          stage++;
        } else if (stage === 2) {
          sock.write(`RCPT TO:<relay-test@example.org>\r\n`);
          stage++;
        } else if (stage === 3) {
          if (/^250 /.test(line)) cleanup(true);
          else cleanup(false);
        }
      }
    });
    sock.on("error", () => cleanup(false));
    sock.on("timeout", () => cleanup(false));
  });
}

const DNSBLS = ["zen.spamhaus.org", "bl.spamcop.net", "b.barracudacentral.org", "dnsbl.sorbs.net"];

async function checkDnsbl(domain: string): Promise<CheckItem> {
  const mx = await resolveMx(domain);
  if (!mx.length) return { key: "dnsbl", title: "DNSBL", severity: "info", summary: "Kein MX — DNSBL übersprungen." };
  const ips: string[] = [];
  for (const m of mx) {
    const a = await dns.resolve4(m.exchange).catch(() => []);
    ips.push(...a);
  }
  const listed: string[] = [];
  await Promise.all(ips.flatMap((ip) => DNSBLS.map(async (bl) => {
    const reversed = ip.split(".").reverse().join(".");
    try {
      await dns.resolve4(`${reversed}.${bl}`);
      listed.push(`${ip} bei ${bl}`);
    } catch {}
  })));
  if (listed.length) {
    return { key: "dnsbl", title: "DNSBL", severity: "fail", summary: `${listed.length} Listung gefunden.`, detail: listed.join("\n"), fix: "Listing-Status beim jeweiligen DNSBL-Anbieter prüfen und Delisting beantragen." };
  }
  return { key: "dnsbl", title: "DNSBL", severity: "ok", summary: `Keine Listung auf ${DNSBLS.length} bekannten Blocklists.`, detail: `Geprüft: ${DNSBLS.join(", ")}` };
}
