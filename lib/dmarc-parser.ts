import { XMLParser } from "fast-xml-parser";
import zlib from "zlib";
import { promisify } from "util";

const gunzip = promisify(zlib.gunzip);

export type ParsedDmarcRecord = {
  source_ip: string;
  count: number;
  disposition: string;
  dkim_aligned: boolean;
  spf_aligned: boolean;
  header_from: string | null;
  envelope_from: string | null;
  envelope_to: string | null;
  dkim_auth: { domain: string | null; selector: string | null; result: string | null }[];
  spf_auth: { domain: string | null; scope: string | null; result: string | null }[];
  reason: string | null;
};

export type ParsedDmarcReport = {
  report_id: string;
  org_name: string;
  org_email: string | null;
  org_extra_contact: string | null;
  domain: string;
  date_begin: number;
  date_end: number;
  policy_p: string | null;
  policy_sp: string | null;
  policy_pct: number | null;
  policy_adkim: string | null;
  policy_aspf: string | null;
  records: ParsedDmarcRecord[];
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: true,
  parseAttributeValue: true,
  trimValues: true,
});

function asArray<T>(x: T | T[] | undefined): T[] {
  if (x === undefined || x === null) return [];
  return Array.isArray(x) ? x : [x];
}

function toStr(x: unknown): string | null {
  if (x === null || x === undefined) return null;
  return String(x);
}

function toInt(x: unknown): number | null {
  if (x === null || x === undefined || x === "") return null;
  const n = Number(x);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

export function parseDmarcXml(xml: string): ParsedDmarcReport {
  const root = parser.parse(xml);
  const fb = root.feedback;
  if (!fb) throw new Error("Not a DMARC aggregate report (missing <feedback> root)");

  const md = fb.report_metadata || {};
  const pp = fb.policy_published || {};
  const records = asArray(fb.record);

  const report: ParsedDmarcReport = {
    report_id: String(md.report_id ?? ""),
    org_name: String(md.org_name ?? "unknown"),
    org_email: toStr(md.email),
    org_extra_contact: toStr(md.extra_contact_info),
    domain: String(pp.domain ?? "").toLowerCase(),
    date_begin: toInt(md.date_range?.begin) ?? 0,
    date_end: toInt(md.date_range?.end) ?? 0,
    policy_p: toStr(pp.p),
    policy_sp: toStr(pp.sp),
    policy_pct: toInt(pp.pct),
    policy_adkim: toStr(pp.adkim),
    policy_aspf: toStr(pp.aspf),
    records: records.map((r: any) => {
      const row = r.row || {};
      const pe = row.policy_evaluated || {};
      const id = r.identifiers || {};
      const ar = r.auth_results || {};
      const dkimArr = asArray(ar.dkim);
      const spfArr = asArray(ar.spf);
      const reasons = asArray(pe.reason).map((x: any) => x?.type ?? x?.comment).filter(Boolean).join(",");
      const dkimEval = String(pe.dkim ?? "").toLowerCase();
      const spfEval = String(pe.spf ?? "").toLowerCase();
      return {
        source_ip: String(row.source_ip ?? ""),
        count: toInt(row.count) ?? 1,
        disposition: String(pe.disposition ?? "none").toLowerCase(),
        dkim_aligned: dkimEval === "pass",
        spf_aligned: spfEval === "pass",
        header_from: toStr(id.header_from)?.toLowerCase() ?? null,
        envelope_from: toStr(id.envelope_from)?.toLowerCase() ?? null,
        envelope_to: toStr(id.envelope_to)?.toLowerCase() ?? null,
        dkim_auth: dkimArr.map((d: any) => ({
          domain: toStr(d.domain)?.toLowerCase() ?? null,
          selector: toStr(d.selector) ?? null,
          result: toStr(d.result)?.toLowerCase() ?? null,
        })),
        spf_auth: spfArr.map((s: any) => ({
          domain: toStr(s.domain)?.toLowerCase() ?? null,
          scope: toStr(s.scope)?.toLowerCase() ?? null,
          result: toStr(s.result)?.toLowerCase() ?? null,
        })),
        reason: reasons || null,
      };
    }),
  };
  return report;
}

export async function parseDmarcBuffer(buf: Buffer, filename = ""): Promise<ParsedDmarcReport[]> {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".gz") || isGzip(buf)) {
    const out = await gunzip(buf);
    return [parseDmarcXml(out.toString("utf8"))];
  }
  if (lower.endsWith(".zip") || isZip(buf)) {
    return parseZipBuffer(buf);
  }
  return [parseDmarcXml(buf.toString("utf8"))];
}

function isGzip(buf: Buffer): boolean {
  return buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b;
}

function isZip(buf: Buffer): boolean {
  return buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && (buf[2] === 0x03 || buf[2] === 0x05) && (buf[3] === 0x04 || buf[3] === 0x06);
}

async function parseZipBuffer(buf: Buffer): Promise<ParsedDmarcReport[]> {
  const files = readZipEntries(buf);
  const reports: ParsedDmarcReport[] = [];
  for (const f of files) {
    if (!/\.xml$/i.test(f.name)) continue;
    reports.push(parseDmarcXml(f.data.toString("utf8")));
  }
  return reports;
}

type ZipEntry = { name: string; data: Buffer };

function readZipEntries(buf: Buffer): ZipEntry[] {
  const entries: ZipEntry[] = [];
  const inflateRaw = zlib.inflateRawSync;
  let i = 0;
  while (i < buf.length - 30) {
    if (buf.readUInt32LE(i) !== 0x04034b50) break;
    const compMethod = buf.readUInt16LE(i + 8);
    const compSize = buf.readUInt32LE(i + 18);
    const uncompSize = buf.readUInt32LE(i + 22);
    const nameLen = buf.readUInt16LE(i + 26);
    const extraLen = buf.readUInt16LE(i + 28);
    const name = buf.slice(i + 30, i + 30 + nameLen).toString("utf8");
    const dataStart = i + 30 + nameLen + extraLen;
    const dataSlice = buf.slice(dataStart, dataStart + compSize);
    let data: Buffer;
    if (compMethod === 0) data = dataSlice;
    else if (compMethod === 8) data = inflateRaw(dataSlice);
    else throw new Error(`unsupported zip compression: ${compMethod}`);
    if (uncompSize > 0 && data.length !== uncompSize) {
      // tolerate; some streams set size in data descriptor
    }
    entries.push({ name, data });
    i = dataStart + compSize;
  }
  return entries;
}
