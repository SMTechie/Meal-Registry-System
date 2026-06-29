import Link from "next/link";
import { Role } from "@prisma/client";
import { logoutAction } from "@/app/actions";
import { AppIcon } from "@/components/app-icon";
import { MobileMenu } from "@/components/mobile-menu";
import { SidebarNav } from "@/components/sidebar-nav";
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

      <aside className="hidden bg-white/86 backdrop-blur print:hidden lg:sticky lg:top-0 lg:block lg:h-screen lg:self-start lg:border-r lg:border-slate-200/80">
        <div className="flex h-full flex-col gap-8 overflow-y-auto px-5 py-6">
          <Link href="/" className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-4 shadow-sm">
            <div className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <AppIcon icon="solar:qr-code-bold-duotone" className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Meal Registry</p>
              <p className="text-xs tracking-wide text-muted-foreground">{roleLabel}</p>
            </div>
          </Link>
          <SidebarNav links={links} />
          <form action={logoutAction} className="mt-auto hidden lg:block">
            <Button variant="outline" className="h-11 w-full justify-start rounded-xl border-slate-200 bg-white text-slate-700 shadow-sm">
              <AppIcon icon="solar:logout-3-bold-duotone" className="size-4" />
              Sign out
            </Button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 px-3 py-5 print:p-0 sm:px-6 lg:h-screen lg:overflow-y-auto lg:px-10 lg:py-8">
        <div className="mx-auto max-w-[1200px] min-w-0">
          <header className="mb-8 hidden items-end justify-between gap-6 print:hidden lg:flex">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">Signed in as</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-slate-950">{userLabel}</h2>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm text-slate-600 shadow-sm">
              Africa/Johannesburg - Live operations
            </div>
          </header>
          {children}
        </div>
      </main>
    </div>
  );
}
