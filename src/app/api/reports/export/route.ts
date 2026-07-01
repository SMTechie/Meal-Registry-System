import * as XLSX from "xlsx";
import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth";
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
  const selectedAssistant = report.assistants.find((assistant) => assistant.id === filters.assistantId);
  const selectedCategory = report.categories.find((category) => category.id === filters.categoryId);

  const workbook = XLSX.utils.book_new();

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

  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(overviewRows), "Overview");
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
    XLSX.utils.json_to_sheet(scanLogRows.length ? scanLogRows : [{ Info: "No scan activity matches this filter." }]),
    "Scan Log"
  );

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  const filename = `meal-reports-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`
    }
  });
}
