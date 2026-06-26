"use client";

import { useMemo, useState } from "react";
import { AppIcon } from "@/components/app-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";

type Result = {
  status: "ACCEPTED" | "DENIED";
  reason: string;
  category: string | null;
  user: string | null;
  scannedAt: string;
};

export function ScannerPanel({ recentCodes }: { recentCodes: { label: string; code: string }[] }) {
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const tone = useMemo(() => {
    if (!result) return "border-slate-200 bg-white";
    return result.status === "ACCEPTED" ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50";
  }, [result]);

  async function submit(value = code) {
    if (!value.trim()) return;
    setPending(true);
    const response = await fetch("/api/scan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: value })
    });
    const data = (await response.json()) as Result;
    setResult(data);
    setCode("");
    setPending(false);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
      <section className="scan-grid min-h-[520px] rounded-lg border bg-slate-950 p-6 text-white shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-white/60">Scanner console</p>
            <h1 className="mt-1 text-3xl font-semibold">Assistant meal scan</h1>
          </div>
          <div className="grid size-12 place-items-center rounded-lg bg-white/10">
            <AppIcon icon="solar:scanner-bold-duotone" className="size-7" />
          </div>
        </div>
        <div className="mt-12 grid place-items-center rounded-lg border border-white/12 bg-white/6 p-10">
          <div className="grid size-52 place-items-center rounded-lg border border-dashed border-white/28 bg-slate-900/80">
            <AppIcon icon="solar:qr-code-bold-duotone" className="size-24 text-white/72" />
          </div>
          <p className="mt-5 max-w-md text-center text-sm text-white/60">
            Paste or type the QR code from a marking assistant tag to record the meal claim.
          </p>
        </div>
      </section>

      <aside className="space-y-4">
        <div className="rounded-lg border bg-white p-5 shadow-sm">
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <Input value={code} onChange={(event) => setCode(event.target.value)} placeholder="Paste assistant QR code" autoFocus />
            <Button className="w-full" disabled={pending || !code.trim()}>
              <AppIcon icon={pending ? "svg-spinners:180-ring" : "solar:check-read-bold-duotone"} className="size-4" />
              Mark meal
            </Button>
          </form>
        </div>

        <div className={`rounded-lg border p-5 shadow-sm ${tone}`}>
          <p className="text-sm text-muted-foreground">Latest result</p>
          <h2 className="mt-2 text-2xl font-semibold">{result?.status ?? "Ready"}</h2>
          <p className="mt-2 text-sm">{result?.reason ?? "Waiting for the first scan."}</p>
          {result?.user ? <p className="mt-4 text-sm font-medium">{result.user} - {result.category}</p> : null}
        </div>

        <div className="rounded-lg border bg-white p-5 shadow-sm">
          <h3 className="font-semibold">Sample marking assistants</h3>
          <div className="mt-3 grid gap-2">
            {recentCodes.map((item) => (
              <button
                key={item.code}
                onClick={() => submit(item.code)}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm hover:bg-muted"
              >
                <span>{item.label}</span>
                <AppIcon icon="solar:play-circle-bold-duotone" className="size-5 text-primary" />
              </button>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
