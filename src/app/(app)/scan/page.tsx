import { Role } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { containsTime, formatTime } from "@/lib/utils";
import { ScannerPanel } from "./scanner-panel";

export default async function ScanPage() {
  await requireRole([Role.STAFF, Role.ADMIN, Role.SUPER_ADMIN]);
  const categories = await prisma.mealCategory.findMany({ where: { isActive: true }, orderBy: [{ displayOrder: "asc" }, { startsAt: "asc" }] });
  const current = categories.find((category) => containsTime(category.startsAt, category.endsAt));

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Current meal timeslot</p>
            <h1 className="text-2xl font-semibold">{current?.name ?? "No active meal timeslot"}</h1>
          </div>
          <Badge tone={current ? "good" : "warn"}>{current ? `${formatTime(current.startsAt)} - ${formatTime(current.endsAt)}` : "Closed"}</Badge>
        </CardContent>
      </Card>
      <ScannerPanel />
    </div>
  );
}
