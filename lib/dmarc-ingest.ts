import { getDb, logAudit } from "./db";
import { parseDmarcBuffer, type ParsedDmarcReport } from "./dmarc-parser";
import { enrichSource } from "./source-enrich";

export type IngestResult = {
  inserted: number;
  duplicates: number;
  errors: { file: string; error: string }[];
};

export async function ingestBuffer(buf: Buffer, filename: string, sourceFile: string | null = null): Promise<IngestResult> {
  const out: IngestResult = { inserted: 0, duplicates: 0, errors: [] };
  let reports: ParsedDmarcReport[];
  try {
    reports = await parseDmarcBuffer(buf, filename);
  } catch (e: any) {
    out.errors.push({ file: filename, error: String(e?.message ?? e) });
    return out;
  }
  for (const r of reports) {
    try {
      const ok = await ingestReport(r, sourceFile ?? filename);
      if (ok) out.inserted++;
      else out.duplicates++;
    } catch (e: any) {
      out.errors.push({ file: filename, error: String(e?.message ?? e) });
    }
  }
  return out;
}

export async function ingestReport(r: ParsedDmarcReport, sourceFile: string | null): Promise<boolean> {
  const db = getDb();
  const existing = db.prepare("SELECT id FROM reports WHERE report_id = ? AND org_name = ?").get(r.report_id, r.org_name) as { id: number } | undefined;
  if (existing) return false;

  const domainId = ensureDomain(r.domain);

  const tx = db.transaction(() => {
    const info = db.prepare(`
      INSERT INTO reports (
        report_id, org_name, org_email, org_extra_contact,
        domain, domain_id, date_begin, date_end,
        policy_p, policy_sp, policy_pct, policy_adkim, policy_aspf,
        received_at, source_file
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      r.report_id, r.org_name, r.org_email, r.org_extra_contact,
      r.domain, domainId, r.date_begin, r.date_end,
      r.policy_p, r.policy_sp, r.policy_pct, r.policy_adkim, r.policy_aspf,
      Date.now(), sourceFile
    );
    const rid = info.lastInsertRowid as number;
    const ins = db.prepare(`
      INSERT INTO records (
        report_id, source_ip, count, disposition,
        dkim_aligned, spf_aligned,
        header_from, envelope_from, envelope_to,
        dkim_domain, dkim_selector, dkim_result,
        spf_domain, spf_scope, spf_result,
        reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const rec of r.records) {
      const dkim = rec.dkim_auth[0] ?? { domain: null, selector: null, result: null };
      const spf = rec.spf_auth[0] ?? { domain: null, scope: null, result: null };
      ins.run(
        rid, rec.source_ip, rec.count, rec.disposition,
        rec.dkim_aligned ? 1 : 0, rec.spf_aligned ? 1 : 0,
        rec.header_from, rec.envelope_from, rec.envelope_to,
        dkim.domain, dkim.selector, dkim.result,
        spf.domain, spf.scope, spf.result,
        rec.reason
      );
    }
  });
  tx();
  logAudit({ action: "dmarc.report.ingest", target_type: "report", target_id: r.report_id, details: { org: r.org_name, domain: r.domain, records: r.records.length } });
  enrichRecordsAsync(r.records.map((x) => x.source_ip));
  return true;
}

function ensureDomain(domain: string): number | null {
  if (!domain) return null;
  const db = getDb();
  const row = db.prepare("SELECT id FROM domains WHERE domain = ?").get(domain) as { id: number } | undefined;
  if (row) return row.id;
  const info = db.prepare("INSERT INTO domains (domain, created_at) VALUES (?, ?)").run(domain, Date.now());
  return info.lastInsertRowid as number;
}

function enrichRecordsAsync(ips: string[]) {
  const unique = Array.from(new Set(ips.filter(Boolean)));
  setImmediate(async () => {
    const db = getDb();
    for (const ip of unique) {
      try {
        const enrich = await enrichSource(ip);
        db.prepare(`
          UPDATE records SET rdns = COALESCE(rdns, ?), country = COALESCE(country, ?), asn = COALESCE(asn, ?), asn_org = COALESCE(asn_org, ?)
          WHERE source_ip = ? AND (rdns IS NULL OR country IS NULL)
        `).run(enrich.rdns, enrich.country, enrich.asn, enrich.asn_org, ip);
      } catch {}
    }
  });
}
