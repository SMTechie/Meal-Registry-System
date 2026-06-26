"use client";

import { useEffect, useState } from "react";
import { AppIcon } from "@/components/app-icon";
import { Button } from "@/components/ui/button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isStandalone() {
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || Boolean(nav.standalone);
}

function isIOSDevice() {
  const nav = navigator as Navigator & { maxTouchPoints?: number };
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && Number(nav.maxTouchPoints) > 1);
}

function isSafari() {
  return /^((?!chrome|android|crios|fxios|edgios).)*safari/i.test(navigator.userAgent);
}

export function PWAInstallButton() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isSafariBrowser, setIsSafariBrowser] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [showInstallGuide, setShowInstallGuide] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());
    setIsIOS(isIOSDevice());
    setIsSafariBrowser(isSafari());

    function onBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    }

    function onInstalled() {
      setInstalled(true);
      setPromptEvent(null);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (isIOS) {
      setShowIOSGuide(true);
      return;
    }

    if (!promptEvent) {
      setShowInstallGuide(true);
      return;
    }
    await promptEvent.prompt();
    await promptEvent.userChoice.catch(() => undefined);
    setPromptEvent(null);
  }

  if (installed) {
    return (
      <Button type="button" variant="secondary" className="w-full" disabled>
        <AppIcon icon="solar:check-circle-bold-duotone" className="size-4" />
        Installed
      </Button>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={install}
      >
        <AppIcon icon={isIOS ? "solar:iphone-bold-duotone" : promptEvent ? "solar:download-square-bold-duotone" : "solar:smartphone-update-bold-duotone"} className="size-4" />
        {isIOS ? "Install on iOS" : "Install app"}
      </Button>

      {showIOSGuide ? (
        <div className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/55 px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="ios-install-title">
          <button className="absolute inset-0 cursor-default" type="button" aria-label="Close iOS install guide" onClick={() => setShowIOSGuide(false)} />
          <div className="relative w-full max-w-md rounded-lg border bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
              <div>
                <h2 id="ios-install-title" className="text-lg font-semibold">
                  Install on iPhone or iPad
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">Add Meal Registry to your Home Screen.</p>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setShowIOSGuide(false)} aria-label="Close iOS install guide">
                <AppIcon icon="solar:close-circle-bold-duotone" className="size-5" />
              </Button>
            </div>
            <div className="space-y-4 p-5">
              {!isSafariBrowser ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  For iOS installation, open this page in Safari first.
                </div>
              ) : null}
              <ol className="space-y-3 text-sm">
                <li className="flex gap-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">1</span>
                  <span>Tap the Share button in Safari.</span>
                </li>
                <li className="flex gap-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">2</span>
                  <span>Choose Add to Home Screen.</span>
                </li>
                <li className="flex gap-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">3</span>
                  <span>Tap Add. The app icon will appear on your Home Screen.</span>
                </li>
              </ol>
              <Button type="button" className="w-full" onClick={() => setShowIOSGuide(false)}>
                Done
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {showInstallGuide ? (
        <div className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/55 px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="install-guide-title">
          <button className="absolute inset-0 cursor-default" type="button" aria-label="Close install guide" onClick={() => setShowInstallGuide(false)} />
          <div className="relative w-full max-w-md rounded-lg border bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
              <div>
                <h2 id="install-guide-title" className="text-lg font-semibold">
                  Install Meal Registry
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">Use your browser install option.</p>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setShowInstallGuide(false)} aria-label="Close install guide">
                <AppIcon icon="solar:close-circle-bold-duotone" className="size-5" />
              </Button>
            </div>
            <div className="space-y-4 p-5">
              <ol className="space-y-3 text-sm">
                <li className="flex gap-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">1</span>
                  <span>Open the browser menu.</span>
                </li>
                <li className="flex gap-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">2</span>
                  <span>Choose Install app or Add to Home screen.</span>
                </li>
                <li className="flex gap-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">3</span>
                  <span>Confirm the install. The app will appear on your device.</span>
                </li>
              </ol>
              <Button type="button" className="w-full" onClick={() => setShowInstallGuide(false)}>
                Done
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
