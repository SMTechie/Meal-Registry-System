"use client";

import { Icon } from "@iconify/react";

export function AppIcon({ icon, className }: { icon: string; className?: string }) {
  return <Icon icon={icon} className={className} aria-hidden="true" />;
}
