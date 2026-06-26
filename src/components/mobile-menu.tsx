"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { logoutAction } from "@/app/actions";
import { AppIcon } from "@/components/app-icon";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type MobileMenuLink = {
  href: string;
  label: string;
  icon: string;
};

export function MobileMenu({
  links,
  userLabel,
  roleLabel
}: {
  links: MobileMenuLink[];
  userLabel: string;
  roleLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <Button type="button" variant="outline" size="icon" onClick={() => setOpen(true)} aria-label="Open navigation">
        <AppIcon icon="solar:hamburger-menu-bold-duotone" className="size-5" />
      </Button>
      {open ? (
        <div className="fixed inset-0 z-[100] isolate lg:hidden">
          <button className="absolute inset-0 bg-slate-950/55" type="button" aria-label="Close navigation" onClick={() => setOpen(false)} />
          <aside className="absolute right-0 top-0 z-[101] flex h-dvh w-[min(84vw,340px)] flex-col bg-white shadow-2xl">
            <div className="bg-slate-50 px-5 pb-4 pt-5">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div className="grid size-11 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
                  <AppIcon icon="solar:qr-code-bold-duotone" className="size-5" />
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close navigation" className="rounded-full">
                  <AppIcon icon="solar:close-circle-bold-duotone" className="size-5" />
                </Button>
              </div>
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">Signed in as</p>
                <h2 className="truncate text-lg font-semibold">{userLabel}</h2>
                <p className="mt-1 text-xs font-medium uppercase text-muted-foreground">{roleLabel}</p>
              </div>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
              {links.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex min-h-12 items-center gap-3 rounded-md px-3 text-base font-medium transition",
                      active ? "bg-primary text-primary-foreground shadow-sm" : "text-slate-600 hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <span className={cn("grid size-9 shrink-0 place-items-center rounded-md", active ? "bg-white/15" : "bg-muted")}>
                      <AppIcon icon={item.icon} className="size-5" />
                    </span>
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
            <div className="border-t bg-white p-3">
              <form action={logoutAction}>
                <Button variant="outline" className="h-12 w-full justify-start text-base">
                  <AppIcon icon="solar:logout-3-bold-duotone" className="size-4" />
                  Sign out
                </Button>
              </form>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
