"use client";

import { useEffect, useMemo, useState } from "react";
import { AppIcon } from "@/components/app-icon";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/form";

type AssistantReportRow = {
  id: string;
  name: string;
  email: string;
  persalNumber: string;
  subject: string;
  total: number;
  accepted: number;
  denied: number;
  lastScan: string;
};

const PAGE_SIZE = 4;

function normalize(value: string) {
  return value.trim().toLowerCase();
}

export function AssistantReportList({ rows }: { rows: AssistantReportRow[] }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const filteredRows = useMemo(() => {
    const normalizedQuery = normalize(query);
    if (!normalizedQuery) return rows;

    return rows.filter((row) =>
      [row.name, row.email, row.persalNumber, row.subject, row.lastScan].join(" ").toLowerCase().includes(normalizedQuery)
    );
  }, [query, rows]);

  useEffect(() => {
    setPage(1);
  }, [query]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = filteredRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <AppIcon icon="solar:magnifer-linear" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by assistant, persal number, subject or email"
            className="h-11 rounded-xl border-slate-200 bg-white pl-10 shadow-none"
          />
        </div>
        <div className="text-sm text-slate-500">
          Showing {filteredRows.length} of {rows.length} assistants
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white">
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Assistant</th>
                <th className="px-4 py-3 font-semibold">Persal #</th>
                <th className="px-4 py-3 font-semibold">Subject</th>
                <th className="px-4 py-3 font-semibold">Accepted</th>
                <th className="px-4 py-3 font-semibold">Denied</th>
                <th className="px-4 py-3 font-semibold">Total</th>
                <th className="px-4 py-3 font-semibold">Last scan</th>
              </tr>
            </thead>
            <tbody>
              {pagedRows.length ? (
                pagedRows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-200 last:border-0">
                    <td className="px-4 py-4">
                      <p className="font-semibold text-slate-950">{row.name}</p>
                      <p className="text-xs text-slate-500">{row.email}</p>
                    </td>
                    <td className="px-4 py-4 text-slate-700">{row.persalNumber || "Not set"}</td>
                    <td className="px-4 py-4 text-slate-700">{row.subject || "Not set"}</td>
                    <td className="px-4 py-4 font-medium text-emerald-700">{row.accepted}</td>
                    <td className="px-4 py-4 font-medium text-amber-700">{row.denied}</td>
                    <td className="px-4 py-4">
                      <Badge tone={row.denied ? "warn" : "good"}>{row.total} scans</Badge>
                    </td>
                    <td className="px-4 py-4 text-slate-700">{row.lastScan}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">
                    No assistants match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="space-y-3 p-4 md:hidden">
          {pagedRows.length ? (
            pagedRows.map((row) => (
              <div key={row.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-950">{row.name}</p>
                    <p className="text-sm text-slate-500">{row.email}</p>
                  </div>
                  <Badge tone={row.denied ? "warn" : "good"}>{row.total} scans</Badge>
                </div>
                <div className="mt-3 grid gap-2 text-sm text-slate-700">
                  <p>Persal #: <strong>{row.persalNumber || "Not set"}</strong></p>
                  <p>Subject: <strong>{row.subject || "Not set"}</strong></p>
                  <p>Accepted: <strong className="text-emerald-700">{row.accepted}</strong></p>
                  <p>Denied: <strong className="text-amber-700">{row.denied}</strong></p>
                  <p>Last scan: <strong>{row.lastScan}</strong></p>
                </div>
              </div>
            ))
          ) : (
            <p className="py-6 text-center text-sm text-slate-500">No assistants match your search.</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-slate-500">
          Page {currentPage} of {totalPages}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={buttonVariants({ variant: "outline", className: "rounded-xl border-slate-200 bg-white text-slate-700 shadow-none" })}
            disabled={currentPage === 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
          >
            Back
          </button>
          <button
            type="button"
            className={buttonVariants({ variant: "outline", className: "rounded-xl border-slate-200 bg-white text-slate-700 shadow-none" })}
            disabled={currentPage === totalPages}
            onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
