"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function AddDomainForm() {
  const r = useRouter();
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/domains", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ domain }) });
    setLoading(false);
    setDomain("");
    r.refresh();
  }

  return (
    <Card>
      <CardContent className="flex flex-wrap items-end gap-3 p-4">
        <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-zinc-500">Domain hinzufügen</label>
            <Input placeholder="example.com" value={domain} onChange={(e) => setDomain(e.target.value)} className="w-72" />
          </div>
          <Button type="submit" disabled={!domain || loading}>{loading ? "..." : "Hinzufügen"}</Button>
        </form>
        <div className="ml-auto text-xs text-zinc-500">
          Tipp: Domains werden automatisch erkannt, sobald DMARC-Reports für sie eingehen.
        </div>
      </CardContent>
    </Card>
  );
}
