"use client";

import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser";
import { useEffect, useMemo, useRef, useState } from "react";
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

export function ScannerPanel() {
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const lockedRef = useRef(false);

  const tone = useMemo(() => {
    if (!result) return "border-slate-200 bg-white";
    return result.status === "ACCEPTED" ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50";
  }, [result]);

  async function submit(value = code) {
    const nextCode = value.trim();
    if (!nextCode) return;
    setPending(true);
    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: nextCode })
      });
      const data = (await response.json()) as Result;
      setResult(data);
      setCode("");
    } finally {
      setPending(false);
    }
  }

  async function startCamera() {
    if (!videoRef.current || cameraStarting || cameraActive) return;
    setCameraError("");
    setCameraStarting(true);

    try {
      const reader = new BrowserQRCodeReader();
      const controls = await reader.decodeFromConstraints(
        {
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        },
        videoRef.current,
        (scanResult) => {
          const text = scanResult?.getText();
          if (!text || lockedRef.current) return;
          lockedRef.current = true;
          submit(text).finally(() => {
            window.setTimeout(() => {
              lockedRef.current = false;
            }, 1800);
          });
        }
      );
      controlsRef.current = controls;
      setCameraActive(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Camera could not be opened.";
      setCameraError(
        message.includes("Permission") || message.includes("NotAllowed")
          ? "Camera permission was blocked. Allow camera access in your browser and try again."
          : "Camera could not be opened. Use HTTPS or localhost and make sure a camera is available."
      );
    } finally {
      setCameraStarting(false);
    }
  }

  function stopCamera() {
    controlsRef.current?.stop();
    controlsRef.current = null;
    lockedRef.current = false;
    setCameraActive(false);
  }

  useEffect(() => {
    return () => stopCamera();
  }, []);

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
      <section className="scan-grid rounded-lg border bg-slate-950 p-4 text-white shadow-sm sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-white/60">Scanner console</p>
            <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">Assistant meal scan</h1>
          </div>
          <div className="grid size-12 place-items-center rounded-lg bg-white/10">
            <AppIcon icon="solar:scanner-bold-duotone" className="size-7" />
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-lg border border-white/12 bg-slate-900">
          <div className="relative aspect-[4/3] bg-black sm:aspect-video">
            <video ref={videoRef} className="size-full object-cover" muted playsInline />
            {!cameraActive ? (
              <div className="absolute inset-0 grid place-items-center bg-slate-900/92 p-6 text-center">
                <div>
                  <div className="mx-auto grid size-24 place-items-center rounded-lg border border-dashed border-white/25 bg-white/8">
                    <AppIcon icon="solar:camera-bold-duotone" className="size-11 text-white/75" />
                  </div>
                  <p className="mt-4 max-w-sm text-sm text-white/65">Open the camera and point it at a marking assistant QR tag.</p>
                </div>
              </div>
            ) : null}
            {pending ? (
              <div className="absolute inset-x-4 bottom-4 rounded-md bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow-lg">
                <span className="inline-flex items-center gap-2">
                  <AppIcon icon="svg-spinners:180-ring" className="size-4 text-primary" />
                  Marking meal...
                </span>
              </div>
            ) : null}
          </div>
        </div>

        {cameraError ? <p className="mt-3 rounded-md bg-red-500/12 px-3 py-2 text-sm text-red-100">{cameraError}</p> : null}

        <div className="mt-4 grid gap-3 sm:flex">
          <Button type="button" onClick={startCamera} disabled={cameraStarting || cameraActive} className="bg-white text-slate-950 hover:bg-white/90">
            <AppIcon icon={cameraStarting ? "svg-spinners:180-ring" : "solar:camera-bold-duotone"} className="size-4" />
            {cameraStarting ? "Opening camera..." : "Open camera"}
          </Button>
          <Button type="button" variant="outline" onClick={stopCamera} disabled={!cameraActive} className="border-white/25 bg-white/8 text-white hover:bg-white/15">
            <AppIcon icon="solar:stop-circle-bold-duotone" className="size-4" />
            Stop camera
          </Button>
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
            <Input value={code} onChange={(event) => setCode(event.target.value)} placeholder="Paste assistant QR code" />
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
      </aside>
    </div>
  );
}
