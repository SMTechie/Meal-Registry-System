import Link from "next/link";
import { Role } from "@prisma/client";
import { logoutAction } from "@/app/actions";
import { AppIcon } from "@/components/app-icon";
import { MobileMenu } from "@/components/mobile-menu";
import { Button } from "@/components/ui/button";
import { requireUser, isAdmin, isStaff } from "@/lib/auth";
import { displayName } from "@/lib/utils";

const nav = [
  { href: "/admin-portal", label: "Dashboard", icon: "solar:chart-square-bold-duotone", admin: true },
  { href: "/scan", label: "Scanner", icon: "solar:scanner-bold-duotone", staff: true },
  { href: "/assistants", label: "Assistants", icon: "solar:users-group-rounded-bold-duotone", admin: true },
  { href: "/users", label: "System Users", icon: "solar:user-id-bold-duotone", admin: true },
  { href: "/reports", label: "Reports", icon: "solar:document-text-bold-duotone", admin: true },
  { href: "/timeslots", label: "Meal Timeslots", icon: "solar:clock-circle-bold-duotone", admin: true },
  { href: "/settings", label: "Settings", icon: "solar:settings-bold-duotone", admin: true },
  { href: "/ticket", label: "My Ticket", icon: "solar:ticket-bold-duotone", user: true }
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const links = nav.filter((item) => (item.admin && isAdmin(user)) || (item.staff && isStaff(user)) || (item.user && user.role === Role.USER));
  const roleLabel = user.role === Role.USER ? "MARKING ASSISTANT" : user.role.replace("_", " ");
  const userLabel = displayName(user);

  return (
    <div className="min-h-screen overflow-x-hidden lg:grid lg:h-screen lg:grid-cols-[260px_1fr] lg:overflow-hidden">
      <header className="sticky top-0 z-30 border-b bg-white/92 px-4 py-3 backdrop-blur print:hidden lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
              <AppIcon icon="solar:qr-code-bold-duotone" className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold leading-tight">Meal Registry</p>
              <p className="truncate text-xs text-muted-foreground">{roleLabel}</p>
            </div>
          </Link>
          <MobileMenu links={links} userLabel={userLabel} roleLabel={roleLabel} />
        </div>
      </header>

      <aside className="hidden bg-white/88 backdrop-blur print:hidden lg:sticky lg:top-0 lg:block lg:h-screen lg:self-start lg:border-r">
        <div className="flex h-full flex-col gap-7 overflow-y-auto p-5">
          <Link href="/" className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-lg bg-primary text-primary-foreground">
              <AppIcon icon="solar:qr-code-bold-duotone" className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">Meal Registry</p>
              <p className="text-xs text-muted-foreground">{roleLabel}</p>
            </div>
          </Link>
          <nav className="hidden gap-1 lg:flex lg:flex-col">
            {links.map((item) => (
              <Link key={item.href} href={item.href} className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
                <AppIcon icon={item.icon} className="size-5" />
                {item.label}
              </Link>
            ))}
          </nav>
          <form action={logoutAction} className="hidden lg:block">
            <Button variant="outline" className="w-full justify-start">
              <AppIcon icon="solar:logout-3-bold-duotone" className="size-4" />
              Sign out
            </Button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 px-3 py-5 print:p-0 sm:px-6 lg:h-screen lg:overflow-y-auto lg:px-8 lg:py-6">
        <div className="mx-auto max-w-7xl min-w-0">
          <header className="mb-6 hidden flex-col gap-3 print:hidden sm:flex-row sm:items-center sm:justify-between lg:flex">
            <div>
              <p className="text-sm text-muted-foreground">Signed in as</p>
              <h2 className="text-xl font-semibold">{userLabel}</h2>
            </div>
            <div className="rounded-lg border bg-white px-4 py-2 text-sm text-muted-foreground">
              Africa/Johannesburg - Live operations
            </div>
          </header>
          {children}
        </div>
      </main>
    </div>
  );
}
