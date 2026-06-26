import { Role, ScanStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { containsTime, todayStart } from "@/lib/utils";

export async function claimMealScan(code: string, staffUserId: string) {
  const rawCode = code.trim().slice(0, 120);
  const now = new Date();
  const today = todayStart();

  const [user, categories] = await Promise.all([
    prisma.user.findFirst({ where: { qrAccessCode: rawCode, isActive: true } }),
    prisma.mealCategory.findMany({
      where: { isActive: true },
      orderBy: [{ displayOrder: "asc" }, { startsAt: "asc" }, { name: "asc" }]
    })
  ]);

  const category = categories.find((item) => containsTime(item.startsAt, item.endsAt, now)) ?? null;
  let status: ScanStatus = ScanStatus.DENIED;
  let reason = "";

  if (!user) {
    reason = "Unknown or inactive QR code.";
  } else if (user.role !== Role.USER) {
    reason = `${user.role.replace("_", " ")} QR codes are login identities, not meal tickets.`;
  } else if (!category) {
    reason = "No active meal category for this time.";
  } else {
    const used = await prisma.mealScan.count({
      where: {
        userId: user.id,
        categoryId: category.id,
        scanDate: today,
        status: ScanStatus.ACCEPTED
      }
    });
    if (used >= category.dailyLimitPerUser) {
      reason = `Daily limit reached for ${category.name}.`;
    } else {
      status = ScanStatus.ACCEPTED;
      reason = `${category.name} claim accepted.`;
    }
  }

  const scan = await prisma.mealScan.create({
    data: {
      userId: user?.id,
      categoryId: category?.id,
      scannedById: staffUserId,
      scannedAt: now,
      scanDate: today,
      status,
      reason,
      rawCode
    },
    include: { user: true, category: true }
  });

  await prisma.auditEvent.create({
    data: {
      actorId: staffUserId,
      eventType: "QR_SCAN",
      detail: `${status}: ${user?.username ?? "unknown"}; ${reason}; scan_id=${scan.id}`
    }
  });

  return {
    status,
    reason,
    category: scan.category?.name ?? null,
    user: scan.user ? [scan.user.firstName, scan.user.lastName].filter(Boolean).join(" ") || scan.user.username : null,
    scannedAt: scan.scannedAt.toISOString(),
    scanId: scan.id
  };
}
