import { NextResponse } from "next/server";
import { verifyApiToken, unauthorized } from "@/lib/api-auth";
import { getDb } from "@/lib/db";

export async function GET(req: Request) {
  if (!verifyApiToken(req, "domains:read")) return unauthorized();
  const rows = getDb().prepare("SELECT id, domain, label, last_check_at, last_check_grade FROM domains ORDER BY domain").all();
  return NextResponse.json({ domains: rows });
}
