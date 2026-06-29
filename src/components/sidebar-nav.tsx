"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppIcon } from "@/components/app-icon";
import { cn } from "@/lib/utils";

export type SidebarNavLink = {
  href: string;
  label: string;
  icon: string;
};

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav({ links }: { links: SidebarNavLink[] }) {
  const pathname = usePathname();

  return (
    <nav className="hidden gap-1.5 lg:flex lg:flex-col">
      {links.map((item) => {
        const active = isActivePath(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950",
              active && "bg-slate-950 text-white shadow-sm hover:bg-slate-900 hover:text-white"
            )}
          >
            <AppIcon icon={item.icon} className="size-5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
