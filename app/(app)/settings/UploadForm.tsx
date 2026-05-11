"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function UploadForm() {
  const r = useRouter();
  const [files, setFiles] = useState<FileList | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function upload() {
    if (!files?.length) return;
    setBusy(true);
    setMsg(null);
    const fd = new FormData();
    Array.from(files).forEach((f) => fd.append("files", f));
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) setMsg(`Fehler: ${data.error}`);
    else setMsg(`OK: ${data.inserted} importiert, ${data.duplicates} duplikate, ${data.errors?.length || 0} Fehler.`);
    r.refresh();
  }

  return (
    <div className="space-y-3">
      <input type="file" multiple accept=".xml,.gz,.zip" onChange={(e) => setFiles(e.target.files)} className="block w-full rounded border border-zinc-700 bg-zinc-900 p-2 text-xs text-zinc-300 file:mr-3 file:rounded file:border-0 file:bg-zinc-800 file:px-3 file:py-1.5 file:text-xs file:text-zinc-200" />
      <div className="flex items-center gap-3">
        <Button onClick={upload} disabled={!files?.length || busy}>{busy ? "..." : "Upload + Parse"}</Button>
        {msg ? <span className="text-xs text-zinc-400">{msg}</span> : null}
      </div>
    </div>
  );
}
