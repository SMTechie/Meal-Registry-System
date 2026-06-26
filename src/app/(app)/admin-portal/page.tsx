import { Role, ScanStatus } from "@prisma/client";
import { AppIcon } from "@/components/app-icon";
import { Reveal } from "@/components/reveal";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { containsTime, displayName, formatTime, todayStart, trendLabel } from "@/lib/utils";

export default async function AdminPortalPage() {
  await requireRole([Role.ADMIN, Role.SUPER_ADMIN]);
  const now = new Date();
  const today = todayStart();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const [users, categories, todayScans, yesterdayScans, recentScans, auditEvents] = await Promise.all([
    prisma.user.findMany(),
    prisma.mealCategory.findMany({ orderBy: [{ displayOrder: "asc" }, { startsAt: "asc" }] }),
    prisma.mealScan.findMany({ where: { scanDate: today }, include: { user: true, category: true, scannedBy: true } }),
    prisma.mealScan.findMany({ where: { scanDate: yesterday } }),
    prisma.mealScan.findMany({
      take: 10,
      orderBy: { scannedAt: "desc" },
      include: { user: true, category: true, scannedBy: true }
    }),
    prisma.auditEvent.findMany({ take: 6, orderBy: { createdAt: "desc" }, include: { actor: true } })
  ]);

  const currentCategory = categories.find((category) => category.isActive && containsTime(category.startsAt, category.endsAt, now));
  const acceptedToday = todayScans.filter((scan) => scan.status === ScanStatus.ACCEPTED).length;
  const deniedToday = todayScans.filter((scan) => scan.status === ScanStatus.DENIED).length;
  const acceptedYesterday = yesterdayScans.filter((scan) => scan.status === ScanStatus.ACCEPTED).length;
  const assistantCount = users.filter((user) => user.role === Role.USER && user.isActive).length;
  const currentAccepted = currentCategory
    ? todayScans.filter((scan) => scan.categoryId === currentCategory.id && scan.status === ScanStatus.ACCEPTED).length
    : 0;
  const capacity = currentCategory ? assistantCount * currentCategory.dailyLimitPerUser : 0;
  const progress = capacity ? Math.min(100, Math.round((currentAccepted / capacity) * 100)) : 0;

  const stats = [
    { label: "Scans today", value: todayScans.length, icon: "solar:scanner-bold-duotone", note: trendLabel(todayScans.length, yesterdayScans.length), tone: "info" },
    { label: "Accepted", value: acceptedToday, icon: "solar:check-circle-bold-duotone", note: trendLabel(acceptedToday, acceptedYesterday), tone: "good" },
    { label: "Denied", value: deniedToday, icon: "solar:shield-warning-bold-duotone", note: `${todayScans.length ? Math.round((deniedToday / todayScans.length) * 100) : 0}% denial rate`, tone: deniedToday ? "warn" : "neutral" },
    { label: "Assistants", value: assistantCount, icon: "solar:user-check-rounded-bold-duotone", note: `${assistantCount} active QR tags`, tone: "neutral" }
  ] as const;

  const categoryCounts = categories.map((category) => ({
    category,
    count: todayScans.filter((scan) => scan.categoryId === category.id && scan.status === ScanStatus.ACCEPTED).length
  }));

  return (
    <Reveal>
      <div className="space-y-6">
        <section data-reveal className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.label}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="mt-2 text-3xl font-semibold">{stat.value}</p>
                  </div>
                  <div className="grid size-11 place-items-center rounded-lg bg-muted text-primary">
                    <AppIcon icon={stat.icon} className="size-6" />
                  </div>
                </div>
                <Badge tone={stat.tone} className="mt-4">
                  {stat.note}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1fr_380px]">
          <Card data-reveal>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle>Active Meal Timeslot</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {currentCategory ? `${formatTime(currentCategory.startsAt)} - ${formatTime(currentCategory.endsAt)}` : "No active timeslot for the current time"}
                  </p>
                </div>
                <Badge tone={currentCategory ? "good" : "warn"}>{currentCategory ? "Open" : "Closed"}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border bg-muted/35 p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Current meal timeslot</p>
                    <h3 className="mt-1 text-3xl font-semibold">{currentCategory?.name ?? "Awaiting schedule"}</h3>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {currentAccepted} of {capacity} claims used
                  </div>
                </div>
                <div className="mt-5 h-3 overflow-hidden rounded-full bg-white">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-reveal>
            <CardHeader>
              <CardTitle>Alerts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-3 rounded-lg border p-3">
                <AppIcon icon={currentCategory ? "solar:shield-check-bold-duotone" : "solar:danger-triangle-bold-duotone"} className="mt-0.5 size-5 text-primary" />
                <div>
                  <p className="text-sm font-semibold">{currentCategory ? "Scanning timeslot healthy" : "No active meal timeslot"}</p>
                  <p className="text-sm text-muted-foreground">{currentCategory ? "Admins can scan marking assistant QR tags for this meal." : "Claims will be denied until a scheduled timeslot opens."}</p>
                </div>
              </div>
              <div className="flex gap-3 rounded-lg border p-3">
                <AppIcon icon="solar:graph-up-bold-duotone" className="mt-0.5 size-5 text-accent" />
                <div>
                  <p className="text-sm font-semibold">Approval rate</p>
                  <p className="text-sm text-muted-foreground">{todayScans.length ? Math.round((acceptedToday / todayScans.length) * 100) : 0}% of scans accepted today.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-[420px_1fr]">
          <Card data-reveal>
            <CardHeader>
              <CardTitle>Timeslot Usage</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {categoryCounts.map(({ category, count }) => (
                <div key={category.id}>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-medium">{category.name}</span>
                    <span className="text-muted-foreground">{count}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, count * 18)}%`, backgroundColor: category.colourTag }} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card data-reveal>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="text-xs uppercase text-muted-foreground">
                  <tr className="border-b">
                    <th className="py-3">Time</th>
                    <th>Assistant</th>
                    <th>Timeslot</th>
                    <th>Status</th>
                    <th>Staff</th>
                  </tr>
                </thead>
                <tbody>
                  {recentScans.map((scan) => (
                    <tr key={scan.id} className="border-b last:border-0">
                      <td className="py-3">{scan.scannedAt.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}</td>
                      <td>{displayName(scan.user)}</td>
                      <td>{scan.category?.name ?? "-"}</td>
                      <td>
                        <Badge tone={scan.status === ScanStatus.ACCEPTED ? "good" : "danger"}>{scan.status}</Badge>
                      </td>
                      <td>{displayName(scan.scannedBy)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-5 border-t pt-4">
                <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Audit trail</p>
                <div className="grid gap-2">
                  {auditEvents.map((event) => (
                    <div key={event.id} className="flex items-center justify-between gap-3 text-sm">
                      <span>{event.eventType.replaceAll("_", " ")}</span>
                      <span className="text-muted-foreground">{displayName(event.actor)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </Reveal>
  );
}
