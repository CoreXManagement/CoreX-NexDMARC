import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { applyUpdate } from "@/lib/updater";
import { logAudit } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const res = await applyUpdate();
  logAudit({ user_id: session.user.id, user_email: session.user.email, action: "update.apply", details: { ok: res.ok } });
  return NextResponse.json(res);
}
