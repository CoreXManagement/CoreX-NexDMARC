import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ingestBuffer } from "@/lib/dmarc-ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const form = await req.formData();
  const files = form.getAll("files") as File[];
  if (!files.length) return NextResponse.json({ error: "No files" }, { status: 400 });
  let inserted = 0;
  let duplicates = 0;
  const errors: { file: string; error: string }[] = [];
  for (const f of files) {
    const buf = Buffer.from(await f.arrayBuffer());
    const res = await ingestBuffer(buf, f.name, `upload:${f.name}`);
    inserted += res.inserted;
    duplicates += res.duplicates;
    errors.push(...res.errors);
  }
  return NextResponse.json({ inserted, duplicates, errors });
}
