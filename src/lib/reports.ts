import { Role, ScanStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { displayName, todayStart } from "@/lib/utils";

export function firstReportValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export function rangeStart(range: string) {
  const today = todayStart();
  if (range === "7d") {
    const date = new Date(today);
    date.setDate(date.getDate() - 6);
    return date;
  }
  if (range === "30d") {
    const date = new Date(today);
    date.setDate(date.getDate() - 29);
    return date;
  }
  return today;
}

export type ReportsFilters = {
  range: string;
  assistantId: string;
  categoryId: string;
  status: string;
};

export function buildReportFilters(params: {
  range?: string | string[];
  assistant?: string | string[];
  category?: string | string[];
  status?: string | string[];
}): ReportsFilters {
  return {
    range: firstReportValue(params.range) ?? "today",
    assistantId: firstReportValue(params.assistant) ?? "",
    categoryId: firstReportValue(params.category) ?? "",
    status: firstReportValue(params.status) ?? ""
  };
}

export async function getReportsData(filters: ReportsFilters) {
  const statusFilter =
    filters.status === "ACCEPTED" ? ScanStatus.ACCEPTED : filters.status === "DENIED" ? ScanStatus.DENIED : undefined;

  const where = {
    ...(filters.range !== "all" ? { scanDate: { gte: rangeStart(filters.range) } } : {}),
    ...(filters.assistantId ? { userId: filters.assistantId } : {}),
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    ...(statusFilter ? { status: statusFilter } : {})
  };

  const [scans, assistants, categories, staffUsers] = await Promise.all([
    prisma.mealScan.findMany({
      where,
      orderBy: { scannedAt: "desc" },
      include: { user: true, category: true, scannedBy: true }
    }),
    prisma.user.findMany({
      where: { role: Role.USER },
      orderBy: [{ surnameInitials: "asc" }, { firstName: "asc" }, { lastName: "asc" }, { username: "asc" }]
    }),
    prisma.mealCategory.findMany({ orderBy: [{ displayOrder: "asc" }, { startsAt: "asc" }] }),
    prisma.user.findMany({
      where: { role: { in: [Role.STAFF, Role.ADMIN, Role.SUPER_ADMIN] } },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }, { username: "asc" }]
    })
  ]);

  const totals = {
    total: scans.length,
    accepted: scans.filter((scan) => scan.status === ScanStatus.ACCEPTED).length,
    denied: scans.filter((scan) => scan.status === ScanStatus.DENIED).length,
    uniqueAssistants: new Set(scans.map((scan) => scan.userId).filter(Boolean)).size,
    activeScanners: new Set(scans.map((scan) => scan.scannedById).filter(Boolean)).size
  };

  const assistantRows = assistants
    .map((assistant) => {
      const assistantScans = scans.filter((scan) => scan.userId === assistant.id);
      const acceptedCount = assistantScans.filter((scan) => scan.status === ScanStatus.ACCEPTED).length;
      const deniedCount = assistantScans.filter((scan) => scan.status === ScanStatus.DENIED).length;
      const lastScan = assistantScans[0];
      return {
        assistant,
        total: assistantScans.length,
        accepted: acceptedCount,
        denied: deniedCount,
        lastScan
      };
    })
    .filter((row) => row.total > 0 || filters.assistantId === row.assistant.id)
    .sort((left, right) => right.total - left.total);

  const mealRows = categories
    .map((category) => {
      const categoryScans = scans.filter((scan) => scan.categoryId === category.id);
      return {
        category,
        total: categoryScans.length,
        accepted: categoryScans.filter((scan) => scan.status === ScanStatus.ACCEPTED).length,
        denied: categoryScans.filter((scan) => scan.status === ScanStatus.DENIED).length,
        uniqueAssistants: new Set(categoryScans.map((scan) => scan.userId).filter(Boolean)).size
      };
    })
    .filter((row) => row.total > 0 || filters.categoryId === row.category.id)
    .sort((left, right) => right.total - left.total);

  const staffRows = staffUsers
    .map((staffUser) => {
      const staffScans = scans.filter((scan) => scan.scannedById === staffUser.id);
      return {
        staffUser,
        total: staffScans.length,
        accepted: staffScans.filter((scan) => scan.status === ScanStatus.ACCEPTED).length,
        denied: staffScans.filter((scan) => scan.status === ScanStatus.DENIED).length
      };
    })
    .filter((row) => row.total > 0)
    .sort((left, right) => right.total - left.total);

  const denialReasons = Array.from(
    scans
      .filter((scan) => scan.status === ScanStatus.DENIED)
      .reduce((map, scan) => {
        const key = scan.reason || "No denial reason captured";
        map.set(key, (map.get(key) ?? 0) + 1);
        return map;
      }, new Map<string, number>())
  )
    .sort((left, right) => right[1] - left[1])
    .slice(0, 6);

  return {
    filters,
    scans,
    assistants,
    categories,
    staffUsers,
    totals,
    assistantRows,
    mealRows,
    staffRows,
    denialReasons
  };
}

export function reportRangeLabel(range: string) {
  if (range === "7d") return "Last 7 days";
  if (range === "30d") return "Last 30 days";
  if (range === "all") return "All time";
  return "Today";
}

export function assistantLabel(assistant?: {
  surnameInitials?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  username: string;
} | null) {
  return displayName(assistant);
}
