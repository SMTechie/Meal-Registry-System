"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { AppIcon } from "@/components/app-icon";
import { cn } from "@/lib/utils";

type ToastTone = "success" | "error" | "info";

type ToastItem = {
  id: number;
  message: string;
  tone: ToastTone;
};

const ToastContext = createContext<{
  pushToast: (message: string, tone?: ToastTone) => void;
} | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback((message: string, tone: ToastTone = "info") => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => dismissToast(id), 4500);
  }, [dismissToast]);

  const value = useMemo(() => ({ pushToast }), [pushToast]);

  const styles: Record<ToastTone, string> = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
    error: "border-red-200 bg-red-50 text-red-900",
    info: "border-sky-200 bg-sky-50 text-sky-900"
  };

  const icons: Record<ToastTone, string> = {
    success: "solar:check-circle-bold-duotone",
    error: "solar:danger-triangle-bold-duotone",
    info: "solar:info-circle-bold-duotone"
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[70] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "pointer-events-auto flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-lg backdrop-blur-sm",
              styles[toast.tone]
            )}
            role="status"
            aria-live="polite"
          >
            <AppIcon icon={icons[toast.tone]} className="mt-0.5 size-5 shrink-0" />
            <p className="flex-1 text-sm font-medium leading-6">{toast.message}</p>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              className="rounded-md p-1 text-current/70 transition hover:bg-black/5 hover:text-current"
              aria-label="Dismiss notification"
            >
              <AppIcon icon="solar:close-circle-bold-duotone" className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider.");
  }

  return context;
}
