import Link from "next/link";
import { Role } from "@prisma/client";
import { logoutAction } from "@/app/actions";
import { AppIcon } from "@/components/app-icon";
import { Button } from "@/components/ui/button";
import { requireUser, isAdmin, isStaff } from "@/lib/auth";
import { displayName } from "@/lib/utils";

const nav = [
  { href: "/admin-portal", label: "Dashboard", icon: "solar:chart-square-bold-duotone", admin: true },
  { href: "/scan", label: "Scanner", icon: "solar:scanner-bold-duotone", staff: true },
  { href: "/assistants", label: "Assistants", icon: "solar:users-group-rounded-bold-duotone", admin: true },
  { href: "/users", label: "System Users", icon: "solar:user-id-bold-duotone", admin: true },
  { href: "/timeslots", label: "Meal Timeslots", icon: "solar:clock-circle-bold-duotone", admin: true },
  { href: "/settings", label: "Settings", icon: "solar:settings-bold-duotone", admin: true },
  { href: "/ticket", label: "My Ticket", icon: "solar:ticket-bold-duotone", user: true }
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const links = nav.filter((item) => (item.admin && isAdmin(user)) || (item.staff && isStaff(user)) || (item.user && user.role === Role.USER));

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="border-b bg-white/88 backdrop-blur print:hidden lg:min-h-screen lg:border-b-0 lg:border-r">
        <div className="flex h-16 items-center justify-between px-5 lg:h-auto lg:flex-col lg:items-stretch lg:gap-7 lg:p-5">
          <Link href="/" className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-lg bg-primary text-primary-foreground">
              <AppIcon icon="solar:qr-code-bold-duotone" className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">Meal Registry</p>
              <p className="text-xs text-muted-foreground">{user.role === Role.USER ? "MARKING ASSISTANT" : user.role.replace("_", " ")}</p>
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
        <nav className="flex gap-1 overflow-x-auto px-4 pb-3 lg:hidden">
          {links.map((item) => (
            <Link key={item.href} href={item.href} className="flex shrink-0 items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm">
              <AppIcon icon={item.icon} className="size-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="px-4 py-6 print:p-0 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <header className="mb-6 flex flex-col gap-3 print:hidden sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Signed in as</p>
              <h2 className="text-xl font-semibold">{displayName(user)}</h2>
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
