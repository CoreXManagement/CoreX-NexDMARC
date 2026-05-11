import { NextResponse } from "next/server";
import { verifyApiToken, unauthorized } from "@/lib/api-auth";
import { ingestBuffer } from "@/lib/dmarc-ingest";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!verifyApiToken(req, "ingest")) return unauthorized();
  const ct = req.headers.get("content-type") || "";
  if (ct.startsWith("multipart/form-data")) {
    const form = await req.formData();
    const files = form.getAll("files") as File[];
    let inserted = 0, duplicates = 0;
    const errors: { file: string; error: string }[] = [];
    for (const f of files) {
      const buf = Buffer.from(await f.arrayBuffer());
      const res = await ingestBuffer(buf, f.name);
      inserted += res.inserted;
      duplicates += res.duplicates;
      errors.push(...res.errors);
    }
    return NextResponse.json({ inserted, duplicates, errors });
  }
  const buf = Buffer.from(await req.arrayBuffer());
  const filename = req.headers.get("x-filename") || "upload.bin";
  const res = await ingestBuffer(buf, filename);
  return NextResponse.json(res);
}
