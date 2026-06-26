"use client";

import { useFormStatus } from "react-dom";
import { AppIcon } from "@/components/app-icon";
import { Button, type ButtonProps } from "@/components/ui/button";

export function SubmitButton({
  children,
  icon = "solar:diskette-bold-duotone",
  pendingLabel = "Saving...",
  ...props
}: ButtonProps & { icon?: string; pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button disabled={pending} {...props}>
      <AppIcon icon={pending ? "svg-spinners:180-ring" : icon} className="size-4" />
      {pending ? pendingLabel : children}
    </Button>
  );
}
