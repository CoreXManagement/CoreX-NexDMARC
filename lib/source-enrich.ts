import dns from "dns/promises";
import { getDb } from "./db";

const TTL_MS = 1000 * 60 * 60 * 24 * 30;

export type SourceEnrichment = {
  ip: string;
  rdns: string | null;
  country: string | null;
  asn: string | null;
  asn_org: string | null;
};

export async function enrichSource(ip: string): Promise<SourceEnrichment> {
  const db = getDb();
  const cached = db.prepare("SELECT * FROM source_cache WHERE ip = ?").get(ip) as
    | { ip: string; rdns: string | null; asn: string | null; asn_org: string | null; country: string | null; enriched_at: number }
    | undefined;
  if (cached && Date.now() - cached.enriched_at < TTL_MS) {
    return { ip, rdns: cached.rdns, country: cached.country, asn: cached.asn, asn_org: cached.asn_org };
  }

  const rdns = await reverseDns(ip);
  // ASN + Country via Cymru's DNS service (no API key, slow but no signup needed)
  const cymru = await cymruWhois(ip);

  const enrich: SourceEnrichment = {
    ip,
    rdns,
    country: cymru?.country ?? null,
    asn: cymru?.asn ?? null,
    asn_org: cymru?.org ?? null,
  };
  db.prepare(
    "INSERT INTO source_cache (ip, rdns, asn, asn_org, country, enriched_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(ip) DO UPDATE SET rdns=excluded.rdns, asn=excluded.asn, asn_org=excluded.asn_org, country=excluded.country, enriched_at=excluded.enriched_at"
  ).run(ip, enrich.rdns, enrich.asn, enrich.asn_org, enrich.country, Date.now());
  return enrich;
}

async function reverseDns(ip: string): Promise<string | null> {
  try {
    const names = await dns.reverse(ip);
    return names[0]?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

async function cymruWhois(ip: string): Promise<{ asn: string; country: string; org: string } | null> {
  try {
    const reversed = isIPv4(ip) ? ip.split(".").reverse().join(".") : ipv6Nibbles(ip);
    const suffix = isIPv4(ip) ? ".origin.asn.cymru.com" : ".origin6.asn.cymru.com";
    const txts = await dns.resolveTxt(reversed + suffix);
    const joined = txts[0]?.join("") ?? "";
    const [asn, , , country, org] = joined.split("|").map((s) => s.trim());
    return { asn: asn ? `AS${asn.split(" ")[0]}` : "", country: country || "", org: "" + (org || "") };
  } catch {
    return null;
  }
}

function isIPv4(ip: string): boolean {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(ip);
}

function ipv6Nibbles(ip: string): string {
  const full = expandIpv6(ip);
  return full.replace(/:/g, "").split("").reverse().join(".");
}

function expandIpv6(ip: string): string {
  const parts = ip.split("::");
  const head = parts[0] ? parts[0].split(":") : [];
  const tail = parts[1] ? parts[1].split(":") : [];
  const missing = 8 - (head.length + tail.length);
  const middle = Array(Math.max(0, missing)).fill("0000");
  const all = [...head, ...middle, ...tail].map((g) => g.padStart(4, "0"));
  return all.join(":");
}
