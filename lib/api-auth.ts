import { NextResponse } from "next/server";
import crypto from "crypto";
import { getDb } from "./db";

export type ApiTokenInfo = { id: number; name: string; scopes: string[] };

export function hashToken(plain: string): string {
  return crypto.createHash("sha256").update(plain).digest("hex");
}

export function verifyApiToken(req: Request, requiredScope: string | null = null): ApiTokenInfo | null {
  const auth = req.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const token = m[1].trim();
  const h = hashToken(token);
  const row = getDb().prepare("SELECT id, name, scopes, revoked_at FROM api_tokens WHERE token_hash = ?").get(h) as { id: number; name: string; scopes: string; revoked_at: number | null } | undefined;
  if (!row || row.revoked_at) return null;
  const scopes = row.scopes.split(",").map((s) => s.trim()).filter(Boolean);
  if (requiredScope && !scopes.includes(requiredScope) && !scopes.includes("*")) return null;
  try {
    getDb().prepare("UPDATE api_tokens SET last_used_at = ? WHERE id = ?").run(Date.now(), row.id);
  } catch {}
  return { id: row.id, name: row.name, scopes };
}

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
