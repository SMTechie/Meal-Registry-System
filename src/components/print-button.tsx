"use client";

import { AppIcon } from "@/components/app-icon";
import { Button } from "@/components/ui/button";

export function PrintButton() {
  return (
    <Button type="button" onClick={() => window.print()}>
      <AppIcon icon="solar:printer-bold-duotone" className="size-4" />
      Print tag
    </Button>
  );
}
