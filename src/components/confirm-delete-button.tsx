"use client";

import { Button, type ButtonProps } from "@/components/ui/button";

export function ConfirmDeleteButton({
  confirmMessage,
  children = "Delete",
  ...props
}: ButtonProps & { confirmMessage: string }) {
  return (
    <Button
      type="submit"
      variant="destructive"
      {...props}
      onClick={(event) => {
        if (!window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
    >
      {children}
    </Button>
  );
}
