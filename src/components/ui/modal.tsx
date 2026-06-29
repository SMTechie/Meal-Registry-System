"use client";

import { useEffect, useState } from "react";
import { AppIcon } from "@/components/app-icon";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Modal({
  title,
  description,
  triggerLabel,
  triggerIcon,
  triggerAriaLabel,
  triggerLabelHidden = false,
  triggerVariant,
  triggerSize,
  triggerClassName,
  children,
  className
}: {
  title: string;
  description?: string;
  triggerLabel: string;
  triggerIcon?: string;
  triggerAriaLabel?: string;
  triggerLabelHidden?: boolean;
  triggerVariant?: ButtonProps["variant"];
  triggerSize?: ButtonProps["size"];
  triggerClassName?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        variant={triggerVariant}
        size={triggerSize}
        className={triggerClassName}
        aria-label={triggerAriaLabel ?? (triggerLabelHidden ? triggerLabel : undefined)}
        title={triggerAriaLabel ?? triggerLabel}
      >
        {triggerIcon ? <AppIcon icon={triggerIcon} className={triggerSize === "icon" ? "size-3.5" : "size-4"} /> : null}
        <span className={triggerLabelHidden ? "sr-only" : undefined}>{triggerLabel}</span>
      </Button>
      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <button className="absolute inset-0 cursor-default" type="button" aria-label="Close modal" onClick={() => setOpen(false)} />
          <div className={cn("relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-lg border bg-white shadow-2xl", className)}>
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b bg-white px-5 py-4">
              <div>
                <h2 id="modal-title" className="text-lg font-semibold">
                  {title}
                </h2>
                {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close modal">
                <AppIcon icon="solar:close-circle-bold-duotone" className="size-5" />
              </Button>
            </div>
            <div className="p-5">{children}</div>
          </div>
        </div>
      ) : null}
    </>
  );
}
