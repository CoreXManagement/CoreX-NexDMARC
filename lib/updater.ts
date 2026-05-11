import { execFile } from "child_process";
import { promisify } from "util";
import pkg from "../package.json";

const exec = promisify(execFile);

const REPO = "CoreXManagement/CoreX-NexDMARC";

export function getCurrentVersion(): string {
  return (pkg as { version: string }).version;
}

export async function getLatestRelease(): Promise<{ tag: string | null }> {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { accept: "application/vnd.github+json" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return { tag: null };
    const data = await res.json();
    return { tag: data?.tag_name ?? null };
  } catch {
    return { tag: null };
  }
}

export function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x - y;
  }
  return 0;
}

export async function applyUpdate(): Promise<{ ok: boolean; log: string }> {
  const script = process.env.NEXDMARC_UPDATE_SCRIPT || "/opt/corex-nexdmarc/scripts/update.sh";
  try {
    const { stdout, stderr } = await exec("sudo", ["-n", script], { maxBuffer: 4 * 1024 * 1024 });
    return { ok: true, log: stdout + "\n" + stderr };
  } catch (e: any) {
    return { ok: false, log: String(e?.stderr ?? e?.message ?? e) };
  }
}
