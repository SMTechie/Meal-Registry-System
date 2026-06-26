"use client";

import { useFormStatus } from "react-dom";
import { AppIcon } from "@/components/app-icon";

export function FormPendingOverlay({ label = "Working..." }: { label?: string }) {
  const { pending } = useFormStatus();
  if (!pending) return null;

  return (
    <div className="absolute inset-0 z-20 grid place-items-center rounded-lg bg-white/75 backdrop-blur-sm">
      <div className="flex items-center gap-2 rounded-md border bg-white px-4 py-3 text-sm font-medium shadow-sm">
        <AppIcon icon="svg-spinners:180-ring" className="size-5 text-primary" />
        {label}
      </div>
    </div>
  );
}
