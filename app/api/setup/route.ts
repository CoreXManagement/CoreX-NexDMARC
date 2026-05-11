import { NextResponse } from "next/server";
import { getDb, getSetting, setSetting } from "@/lib/db";
import { hashPassword } from "@/lib/passwords";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(req: Request) {
  if (getSetting("setup_complete") === "true") {
    return NextResponse.json({ error: "Setup already complete" }, { status: 400 });
  }
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const { email, password } = parsed.data;
  const hash = await hashPassword(password);
  const db = getDb();
  db.prepare("INSERT INTO users (email, password_hash, role, created_at) VALUES (?, ?, 'admin', ?)").run(email.toLowerCase(), hash, Date.now());
  setSetting("setup_complete", "true");
  return NextResponse.json({ ok: true });
}
