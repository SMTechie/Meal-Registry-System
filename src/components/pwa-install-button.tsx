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

export function PWAInstallButton() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());

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
    if (!promptEvent) return;
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
    <Button type="button" variant="outline" className="w-full" onClick={install} disabled={!promptEvent} title={!promptEvent ? "Install prompt will appear when the browser allows it." : undefined}>
      <AppIcon icon={promptEvent ? "solar:download-square-bold-duotone" : "solar:smartphone-update-bold-duotone"} className="size-4" />
      Install app
    </Button>
  );
}
