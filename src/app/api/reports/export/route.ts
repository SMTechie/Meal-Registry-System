import * as XLSX from "xlsx";
import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assistantLabel, buildReportFilters, getReportsData, reportRangeLabel } from "@/lib/reports";
import { formatDate, formatDateTime } from "@/lib/utils";

export async function GET(request: Request) {
  await requireRole([Role.ADMIN, Role.SUPER_ADMIN]);

  const { searchParams } = new URL(request.url);
  const filters = buildReportFilters({
    range: searchParams.get("range") ?? undefined,
    assistant: searchParams.get("assistant") ?? undefined,
    category: searchParams.get("category") ?? undefined,
    status: searchParams.get("status") ?? undefined
  });

  const report = await getReportsData(filters);
  const organization = await prisma.organizationSettings.findUnique({ where: { id: 1 } });
  const selectedAssistant = report.assistants.find((assistant) => assistant.id === filters.assistantId);
  const selectedCategory = report.categories.find((category) => category.id === filters.categoryId);
  const acceptedScans = report.scans.filter((scan) => scan.status === "ACCEPTED");
  const deniedScans = report.scans.filter((scan) => scan.status === "DENIED");
  const reportDates = report.scans.map((scan) => scan.scanDate).sort((left, right) => left.getTime() - right.getTime());
  const periodStart = reportDates[0] ? formatDate(reportDates[0]) : "No activity";
  const periodEnd = reportDates[reportDates.length - 1] ? formatDate(reportDates[reportDates.length - 1]) : "No activity";

  const workbook = XLSX.utils.book_new();

  const coverRows = [
    { Field: "School / Site", Value: organization?.name || "Meal Registry System" },
    { Field: "Report type", Value: "Department Daily Claim Workbook" },
    { Field: "Reporting range", Value: reportRangeLabel(filters.range) },
    { Field: "Reporting period start", Value: periodStart },
    { Field: "Reporting period end", Value: periodEnd },
    { Field: "Assistant filter", Value: selectedAssistant ? assistantLabel(selectedAssistant) : "All assistants" },
    { Field: "Meal filter", Value: selectedCategory ? selectedCategory.name : "All meals" },
    { Field: "Status filter", Value: filters.status || "All results" },
    { Field: "Workbook generated", Value: formatDateTime(new Date()) },
    { Field: "Prepared for", Value: "Department claim submission" },
    { Field: "Claimable meal rule used", Value: "Accepted scans only" },
    { Field: "Unique assistant warning", Value: "Use unique assistants if the claim is per person fed." },
    { Field: "Multiple scan warning", Value: "Use claimable meals if the claim is per meal served." },
    { Field: "Sign-off prepared by", Value: "" },
    { Field: "Sign-off checked by", Value: "" },
    { Field: "Sign-off approved by", Value: "" }
  ];

  const overviewRows = [
    { Metric: "Range", Value: reportRangeLabel(filters.range) },
    { Metric: "Assistant filter", Value: selectedAssistant ? assistantLabel(selectedAssistant) : "All assistants" },
    { Metric: "Meal filter", Value: selectedCategory ? selectedCategory.name : "All meals" },
    { Metric: "Status filter", Value: filters.status || "All results" },
    { Metric: "Total scans", Value: report.totals.total },
    { Metric: "Accepted scans", Value: report.totals.accepted },
    { Metric: "Denied scans", Value: report.totals.denied },
    { Metric: "Unique assistants", Value: report.totals.uniqueAssistants },
    { Metric: "Active scanners", Value: report.totals.activeScanners }
  ];

  const assistantRows = report.assistantRows.map((row) => ({
    "Surname, Initials": row.assistant.surnameInitials || assistantLabel(row.assistant),
    Title: row.assistant.title || "",
    "Persal #": row.assistant.persalNumber || row.assistant.username,
    Role: row.assistant.assistantRole || "",
    Gender: row.assistant.gender || "",
    Accom: row.assistant.accommodation || "",
    Subject: row.assistant.subject || "",
    Email: row.assistant.email,
    "Total scans": row.total,
    Accepted: row.accepted,
    Denied: row.denied,
    "Last scan": row.lastScan ? formatDateTime(row.lastScan.scannedAt) : "Never"
  }));

  const mealRows = report.mealRows.map((row) => ({
    Meal: row.category.name,
    Description: row.category.description || "",
    "Window start": row.category.startsAt,
    "Window end": row.category.endsAt,
    "Total scans": row.total,
    Accepted: row.accepted,
    Denied: row.denied,
    "Unique assistants": row.uniqueAssistants
  }));

  const scannerRows = report.staffRows.map((row) => ({
    Scanner: assistantLabel(row.staffUser),
    Role: row.staffUser.role.replace("_", " "),
    Email: row.staffUser.email,
    "Total scans": row.total,
    Accepted: row.accepted,
    Denied: row.denied
  }));

  const denialRows = report.denialReasons.map(([reason, count]) => ({
    Reason: reason,
    Count: count
  }));

  const dailySummaryMap = acceptedScans.reduce((map, scan) => {
    const key = formatDate(scan.scanDate);
    const current =
      map.get(key) ??
      {
        date: key,
        claimableMeals: 0,
        uniqueAssistants: new Set<string>(),
        uniqueScanners: new Set<string>(),
        categories: new Set<string>()
      };
    current.claimableMeals += 1;
    if (scan.userId) current.uniqueAssistants.add(scan.userId);
    if (scan.scannedById) current.uniqueScanners.add(scan.scannedById);
    if (scan.category?.name) current.categories.add(scan.category.name);
    map.set(key, current);
    return map;
  }, new Map<string, { date: string; claimableMeals: number; uniqueAssistants: Set<string>; uniqueScanners: Set<string>; categories: Set<string> }>());

  const dailySummaryRows = Array.from(dailySummaryMap.values())
    .sort((left, right) => right.date.localeCompare(left.date))
    .map((row) => ({
      Date: row.date,
      "Claimable meals": row.claimableMeals,
      "Unique assistants fed": row.uniqueAssistants.size,
      "Active scanners": row.uniqueScanners.size,
      "Meal windows used": row.categories.size
    }));

  const dailyMealMap = acceptedScans.reduce((map, scan) => {
    const date = formatDate(scan.scanDate);
    const mealName = scan.category?.name || "Unknown";
    const key = `${date}::${scan.categoryId || mealName}`;
    const current =
      map.get(key) ??
      {
        date,
        mealName,
        windowStart: scan.category?.startsAt || "",
        windowEnd: scan.category?.endsAt || "",
        claimableMeals: 0,
        uniqueAssistants: new Set<string>()
      };
    current.claimableMeals += 1;
    if (scan.userId) current.uniqueAssistants.add(scan.userId);
    map.set(key, current);
    return map;
  }, new Map<string, { date: string; mealName: string; windowStart: string; windowEnd: string; claimableMeals: number; uniqueAssistants: Set<string> }>());

  const dailyMealRows = Array.from(dailyMealMap.values())
    .sort((left, right) => {
      if (left.date === right.date) return left.mealName.localeCompare(right.mealName);
      return right.date.localeCompare(left.date);
    })
    .map((row) => ({
      Date: row.date,
      Meal: row.mealName,
      "Window start": row.windowStart,
      "Window end": row.windowEnd,
      "Claimable meals": row.claimableMeals,
      "Unique assistants fed": row.uniqueAssistants.size
    }));

  const dailyAssistantClaimMap = acceptedScans.reduce((map, scan) => {
    const date = formatDate(scan.scanDate);
    const key = `${date}::${scan.userId || "unknown"}`;
    const current =
      map.get(key) ??
      {
        date,
        surnameInitials: scan.user?.surnameInitials || assistantLabel(scan.user),
        title: scan.user?.title || "",
        persalNumber: scan.user?.persalNumber || scan.user?.username || "",
        role: scan.user?.assistantRole || "",
        gender: scan.user?.gender || "",
        accommodation: scan.user?.accommodation || "",
        subject: scan.user?.subject || "",
        email: scan.user?.email || "",
        claimableMeals: 0,
        firstScan: scan.scannedAt,
        lastScan: scan.scannedAt
      };
    current.claimableMeals += 1;
    if (scan.scannedAt < current.firstScan) current.firstScan = scan.scannedAt;
    if (scan.scannedAt > current.lastScan) current.lastScan = scan.scannedAt;
    map.set(key, current);
    return map;
  }, new Map<string, {
    date: string;
    surnameInitials: string;
    title: string;
    persalNumber: string;
    role: string;
    gender: string;
    accommodation: string;
    subject: string;
    email: string;
    claimableMeals: number;
    firstScan: Date;
    lastScan: Date;
  }>());

  const dailyAssistantClaimRows = Array.from(dailyAssistantClaimMap.values())
    .sort((left, right) => {
      if (left.date === right.date) return left.surnameInitials.localeCompare(right.surnameInitials);
      return right.date.localeCompare(left.date);
    })
    .map((row) => ({
      Date: row.date,
      "Surname, Initials": row.surnameInitials,
      Title: row.title,
      "Persal #": row.persalNumber,
      Role: row.role,
      Gender: row.gender,
      Accom: row.accommodation,
      Subject: row.subject,
      Email: row.email,
      "Claimable meals": row.claimableMeals,
      "First accepted scan": formatDateTime(row.firstScan),
      "Last accepted scan": formatDateTime(row.lastScan)
    }));

  const deniedExceptionRows = deniedScans.map((scan) => ({
    Date: formatDate(scan.scanDate),
    "Scanned at": formatDateTime(scan.scannedAt),
    Assistant: assistantLabel(scan.user),
    "Surname, Initials": scan.user?.surnameInitials || "",
    "Persal #": scan.user?.persalNumber || scan.user?.username || "",
    Subject: scan.user?.subject || "",
    Meal: scan.category?.name || "Unknown",
    Scanner: assistantLabel(scan.scannedBy),
    "Scanner role": scan.scannedBy?.role.replace("_", " ") || "",
    Reason: scan.reason || "No denial reason captured",
    "Raw code": scan.rawCode
  }));

  const acceptedScanLogRows = acceptedScans.map((scan) => ({
    "Scanned at": formatDateTime(scan.scannedAt),
    "Scan date": formatDate(scan.scanDate),
    Assistant: assistantLabel(scan.user),
    "Persal #": scan.user?.persalNumber || scan.user?.username || "",
    Subject: scan.user?.subject || "",
    Meal: scan.category?.name || "Unknown",
    Status: scan.status,
    Scanner: assistantLabel(scan.scannedBy),
    "Scanner role": scan.scannedBy?.role.replace("_", " ") || "",
    "Raw code": scan.rawCode
  }));

  const scanLogRows = report.scans.map((scan) => ({
    "Scanned at": formatDateTime(scan.scannedAt),
    "Scan date": formatDate(scan.scanDate),
    Assistant: assistantLabel(scan.user),
    "Persal #": scan.user?.persalNumber || scan.user?.username || "",
    Subject: scan.user?.subject || "",
    Meal: scan.category?.name || "Unknown",
    Status: scan.status,
    Reason: scan.reason || "",
    Scanner: assistantLabel(scan.scannedBy),
    "Scanner role": scan.scannedBy?.role.replace("_", " ") || "",
    "Raw code": scan.rawCode
    }));

  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(coverRows), "Claim Cover");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(overviewRows), "Overview");
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(dailySummaryRows.length ? dailySummaryRows : [{ Info: "No daily activity matches this filter." }]),
    "Daily Claim Summary"
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(dailyMealRows.length ? dailyMealRows : [{ Info: "No daily meal activity matches this filter." }]),
    "Daily Per Meal"
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(
      dailyAssistantClaimRows.length ? dailyAssistantClaimRows : [{ Info: "No daily assistant claim activity matches this filter." }]
    ),
    "Daily Assistant Claim"
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(assistantRows.length ? assistantRows : [{ Info: "No assistant activity matches this filter." }]),
    "Per Assistant"
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(mealRows.length ? mealRows : [{ Info: "No meal activity matches this filter." }]),
    "Per Meal"
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(scannerRows.length ? scannerRows : [{ Info: "No scanner activity matches this filter." }]),
    "Per Scanner"
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(denialRows.length ? denialRows : [{ Info: "No denied scans in this view." }]),
    "Denial Reasons"
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(deniedExceptionRows.length ? deniedExceptionRows : [{ Info: "No denied exceptions match this filter." }]),
    "Exceptions Denied"
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(acceptedScanLogRows.length ? acceptedScanLogRows : [{ Info: "No accepted scan activity matches this filter." }]),
    "Accepted Scan Log"
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(scanLogRows.length ? scanLogRows : [{ Info: "No scan activity matches this filter." }]),
    "Full Scan Log"
  );

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  const filename = `department-daily-claim-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`
    }
  });
}
