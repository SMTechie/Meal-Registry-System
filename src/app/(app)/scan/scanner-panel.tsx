"use client";

import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser";
import { useEffect, useRef, useState } from "react";
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
  const [resultOpen, setResultOpen] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const lockedRef = useRef(false);

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
      setResultOpen(true);
      setCode("");
    } finally {
      setPending(false);
    }
  }

  function closeResultModal() {
    setResultOpen(false);
  }

  function playResultSound(status: Result["status"]) {
    if (typeof window === "undefined") return;
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.connect(gain);
    gain.connect(context.destination);

    const now = context.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    oscillator.type = status === "ACCEPTED" ? "sine" : "square";

    if (status === "ACCEPTED") {
      oscillator.frequency.setValueAtTime(880, now);
      oscillator.frequency.exponentialRampToValueAtTime(1174, now + 0.14);
      gain.gain.exponentialRampToValueAtTime(0.14, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
    } else {
      oscillator.frequency.setValueAtTime(320, now);
      oscillator.frequency.exponentialRampToValueAtTime(220, now + 0.22);
      gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
    }

    oscillator.start(now);
    oscillator.stop(now + 0.32);
    window.setTimeout(() => {
      void context.close().catch(() => undefined);
    }, 400);
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

  useEffect(() => {
    if (!resultOpen || !result) return;
    playResultSound(result.status);
  }, [result, resultOpen]);

  useEffect(() => {
    if (!resultOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeResultModal();
    }
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [resultOpen]);

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
      </aside>

      {resultOpen && result ? (
        <div className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/60 px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="scan-result-title">
          <button className="absolute inset-0 cursor-default" type="button" aria-label="Close result modal" onClick={closeResultModal} />
          <div
            className={`relative w-full max-w-md rounded-[1.75rem] border bg-white p-6 shadow-2xl sm:p-7 ${
              result.status === "ACCEPTED" ? "border-emerald-200" : "border-red-200"
            }`}
          >
            <div
              className={`absolute inset-x-0 top-0 h-2 rounded-t-[1.75rem] ${
                result.status === "ACCEPTED"
                  ? "bg-gradient-to-r from-emerald-400 via-teal-400 to-lime-300"
                  : "bg-gradient-to-r from-red-500 via-rose-400 to-orange-300"
              }`}
            />
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Scan result</p>
                <h2
                  id="scan-result-title"
                  className={`mt-3 text-3xl font-semibold ${
                    result.status === "ACCEPTED" ? "text-emerald-700" : "text-red-700"
                  }`}
                >
                  {result.status}
                </h2>
              </div>
              <div
                className={`grid size-14 place-items-center rounded-2xl ${
                  result.status === "ACCEPTED" ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                }`}
              >
                <AppIcon
                  icon={result.status === "ACCEPTED" ? "solar:check-circle-bold-duotone" : "solar:close-circle-bold-duotone"}
                  className="size-8"
                />
              </div>
            </div>

            <p className="mt-5 text-base leading-7 text-slate-600">{result.reason}</p>
            {result.user ? (
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">{result.user}</p>
                <p className="mt-1 text-sm text-slate-500">{result.category ?? "No meal category"}</p>
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-3">
              <Button type="button" onClick={closeResultModal} className="flex-1">
                Continue scanning
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
