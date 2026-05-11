#!/usr/bin/env tsx
import { readFileSync, existsSync, statSync, readdirSync } from "fs";
import { extname, join, resolve } from "path";
import { ingestBuffer } from "../lib/dmarc-ingest";

async function main() {
  const args = process.argv.slice(2);
  if (!args.length) {
    console.log("Usage: tsx scripts/ingest-cli.ts <file-or-dir> [more...]");
    process.exit(1);
  }
  const files: string[] = [];
  for (const a of args) {
    const p = resolve(a);
    if (!existsSync(p)) { console.warn("skip (not found):", p); continue; }
    const st = statSync(p);
    if (st.isDirectory()) {
      for (const f of readdirSync(p)) {
        const ext = extname(f).toLowerCase();
        if ([".xml", ".gz", ".zip"].includes(ext)) files.push(join(p, f));
      }
    } else {
      files.push(p);
    }
  }
  console.log("Ingesting", files.length, "files...");
  let inserted = 0, duplicates = 0;
  const errs: { file: string; error: string }[] = [];
  for (const f of files) {
    const buf = readFileSync(f);
    const res = await ingestBuffer(buf, f, `cli:${f}`);
    inserted += res.inserted;
    duplicates += res.duplicates;
    errs.push(...res.errors);
    console.log(`  ${f}: +${res.inserted} insert, ${res.duplicates} dup${res.errors.length ? `, ${res.errors.length} err` : ""}`);
  }
  console.log("Done:", { inserted, duplicates, errors: errs.length });
  if (errs.length) console.log(errs.slice(0, 10));
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
