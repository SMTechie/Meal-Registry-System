import { redirect } from "next/navigation";
import { AppIcon } from "@/components/app-icon";
import { PWAInstallButton } from "@/components/pwa-install-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { currentUser } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const user = await currentUser();
  if (user) redirect("/");

  return (
    <main className="grid min-h-screen place-items-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-3">
          <div className="grid size-11 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <AppIcon icon="solar:qr-code-bold-duotone" className="size-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Meal Registry</h1>
            <p className="text-sm text-muted-foreground">Assistant meal scanning</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Sign in</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <LoginForm />
            <PWAInstallButton />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
