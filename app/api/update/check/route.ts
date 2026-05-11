import { NextResponse } from "next/server";
import { getCurrentVersion, getLatestRelease, compareVersions } from "@/lib/updater";

export const dynamic = "force-dynamic";

export async function GET() {
  const current = getCurrentVersion();
  const { tag } = await getLatestRelease();
  const latest = tag ? tag.replace(/^v/, "") : null;
  const update_available = !!latest && compareVersions(latest, current) > 0;
  return NextResponse.json({ current, latest, update_available });
}
