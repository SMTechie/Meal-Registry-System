import { Role, ScanStatus } from "@prisma/client";
import { AppIcon } from "@/components/app-icon";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label, Select } from "@/components/ui/form";
import { requireRole } from "@/lib/auth";
import { buildReportFilters, getReportsData } from "@/lib/reports";
import { displayName, formatDateTime } from "@/lib/utils";
import { AssistantReportList } from "./assistant-report-list";

type ReportsSearchParams = Promise<{
  range?: string | string[];
  assistant?: string | string[];
  category?: string | string[];
  status?: string | string[];
}>;

export default async function ReportsPage({ searchParams }: { searchParams: ReportsSearchParams }) {
  await requireRole([Role.ADMIN, Role.SUPER_ADMIN]);
  const params = await searchParams;
  const filters = buildReportFilters(params);
  const { scans, assistants, categories, totals, assistantRows, mealRows, staffRows, denialReasons } = await getReportsData(filters);
  const { range, assistantId, categoryId, status } = filters;

  return (
    <div className="space-y-6">
      <section className="page-head">
        <div>
          <span className="eyebrow">Operations reports</span>
          <h1>Reports</h1>
          <p className="page-subtitle">See meal activity by assistant, meal window, staff scanner and denial reason.</p>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="report-range">Range</Label>
              <Select id="report-range" name="range" defaultValue={range}>
                <option value="today">Today</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="all">All time</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="report-assistant">Assistant</Label>
              <Select id="report-assistant" name="assistant" defaultValue={assistantId}>
                <option value="">All assistants</option>
                {assistants.map((assistant) => (
                  <option key={assistant.id} value={assistant.id}>
                    {displayName(assistant)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="report-category">Meal</Label>
              <Select id="report-category" name="category" defaultValue={categoryId}>
                <option value="">All meals</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="report-status">Status</Label>
              <Select id="report-status" name="status" defaultValue={status}>
                <option value="">All results</option>
                <option value="ACCEPTED">Accepted only</option>
                <option value="DENIED">Denied only</option>
              </Select>
            </div>
            <div className="md:col-span-4 flex flex-wrap gap-3">
              <button className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90">
                Apply filters
              </button>
              <a
                href={`/api/reports/export?range=${encodeURIComponent(range)}&assistant=${encodeURIComponent(assistantId)}&category=${encodeURIComponent(categoryId)}&status=${encodeURIComponent(status)}`}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border px-4 text-sm font-semibold hover:bg-muted"
              >
                <AppIcon icon="solar:download-minimalistic-bold-duotone" className="size-4" />
                Export report
              </a>
              <a href="/reports" className="inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-semibold hover:bg-muted">
                Reset
              </a>
            </div>
          </form>
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {[
          { label: "Scans", value: totals.total, icon: "solar:scanner-bold-duotone" },
          { label: "Accepted", value: totals.accepted, icon: "solar:check-circle-bold-duotone" },
          { label: "Denied", value: totals.denied, icon: "solar:close-circle-bold-duotone" },
          { label: "Assistants", value: totals.uniqueAssistants, icon: "solar:users-group-rounded-bold-duotone" },
          { label: "Scanners", value: totals.activeScanners, icon: "solar:user-id-bold-duotone" }
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{item.label}</p>
                  <p className="mt-2 text-3xl font-semibold">{item.value}</p>
                </div>
                <div className="grid size-11 place-items-center rounded-lg bg-muted text-primary">
                  <AppIcon icon={item.icon} className="size-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Per Assistant</CardTitle>
          </CardHeader>
          <CardContent>
            {assistantRows.length ? (
              <AssistantReportList
                rows={assistantRows.map((row) => ({
                  id: row.assistant.id,
                  name: displayName(row.assistant),
                  email: row.assistant.email,
                  persalNumber: row.assistant.persalNumber || row.assistant.username,
                  subject: row.assistant.subject || "",
                  total: row.total,
                  accepted: row.accepted,
                  denied: row.denied,
                  lastScan: row.lastScan ? formatDateTime(row.lastScan.scannedAt) : "Never"
                }))}
              />
            ) : (
              <p className="text-sm text-muted-foreground">No assistant activity matches this filter.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Per Meal</CardTitle>
          </CardHeader>
          <CardContent>
            {mealRows.length ? (
              <div className="space-y-3">
                {mealRows.map((row) => (
                  <div key={row.category.id} className="rounded-lg border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{row.category.name}</p>
                        <p className="text-sm text-muted-foreground">{row.category.description || "Meal timeslot report"}</p>
                      </div>
                      <Badge tone={row.denied ? "warn" : "good"}>{row.total} scans</Badge>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                      <p>Accepted: <strong>{row.accepted}</strong></p>
                      <p>Denied: <strong>{row.denied}</strong></p>
                      <p>Assistants: <strong>{row.uniqueAssistants}</strong></p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No meal activity matches this filter.</p>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <Card>
          <CardHeader>
            <CardTitle>Per Scanner</CardTitle>
          </CardHeader>
          <CardContent>
            {staffRows.length ? (
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-muted-foreground">
                  <tr className="border-b">
                    <th className="py-3">Staff</th>
                    <th>Total</th>
                    <th>Accepted</th>
                    <th>Denied</th>
                  </tr>
                </thead>
                <tbody>
                  {staffRows.map((row) => (
                    <tr key={row.staffUser.id} className="border-b last:border-0">
                      <td className="py-3">
                        <p className="font-medium">{displayName(row.staffUser)}</p>
                        <p className="text-xs text-muted-foreground">{row.staffUser.role.replace("_", " ")}</p>
                      </td>
                      <td>{row.total}</td>
                      <td>{row.accepted}</td>
                      <td>{row.denied}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-muted-foreground">No scanner activity matches this filter.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Denial Reasons</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {denialReasons.length ? (
              denialReasons.map(([reason, count]) => (
                <div key={reason} className="rounded-lg border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium">{reason}</p>
                    <Badge tone="warn">{count}</Badge>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No denied scans in this view.</p>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
