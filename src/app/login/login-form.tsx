"use client";

import { useActionState } from "react";
import { loginAction } from "@/app/actions";
import { AppIcon } from "@/components/app-icon";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/form";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, null);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="username">Username or email</Label>
        <Input id="username" name="username" autoComplete="username" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" />
      </div>
      {state?.message ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.message}</p> : null}
      <Button className="w-full" disabled={pending}>
        <AppIcon icon={pending ? "svg-spinners:180-ring" : "solar:login-3-bold-duotone"} className="size-4" />
        Sign in
      </Button>
    </form>
  );
}
