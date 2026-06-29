"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { createUserAction, deleteUserAction, updateUserAction } from "@/app/actions";
import { AppIcon } from "@/components/app-icon";
import { AssistantQrTag } from "@/components/assistant-qr-tag";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { FormPendingOverlay } from "@/components/form-pending-overlay";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { displayName, formatDate } from "@/lib/utils";
import { ImportAssistantsForm } from "./import-assistants-form";

type AssistantRow = {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  surnameInitials: string;
  title: string;
  persalNumber: string;
  assistantRole: string;
  gender: string;
  accommodation: string;
  subject: string;
  email: string;
  qrAccessCode: string;
  isActive: boolean;
  dateJoined: string;
};

type SortKey = "surnameInitials" | "title" | "persalNumber" | "assistantRole" | "gender" | "accommodation" | "subject" | "status" | "dateJoined";
type SortDirection = "asc" | "desc";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

function compareText(left: string, right: string, direction: SortDirection) {
  return direction === "asc" ? left.localeCompare(right) : right.localeCompare(left);
}

function normalizeValue(value: string) {
  return value.trim().toLowerCase();
}

export function AssistantsTable({ users }: { users: AssistantRow[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("surnameInitials");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [pageSize, setPageSize] = useState<number>(10);
  const [page, setPage] = useState(1);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.closest("[data-assistant-actions-menu]")) return;
      setOpenMenuId(null);
      setMenuPosition(null);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenMenuId(null);
        setMenuPosition(null);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const filteredUsers = useMemo(() => {
    const normalizedQuery = normalizeValue(query);

    return users.filter((user) => {
      const matchesQuery =
        !normalizedQuery ||
        [
          displayName(user),
          user.persalNumber || user.username,
          user.title,
          user.assistantRole,
          user.gender,
          user.accommodation,
          user.subject,
          user.email
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);

      const matchesStatus = status === "all" || (status === "active" ? user.isActive : !user.isActive);
      return matchesQuery && matchesStatus;
    });
  }, [query, status, users]);

  const sortedUsers = useMemo(() => {
    const list = [...filteredUsers];
    list.sort((left, right) => {
      switch (sortKey) {
        case "status":
          return compareText(String(left.isActive), String(right.isActive), sortDirection);
        case "dateJoined":
          return sortDirection === "asc"
            ? new Date(left.dateJoined).getTime() - new Date(right.dateJoined).getTime()
            : new Date(right.dateJoined).getTime() - new Date(left.dateJoined).getTime();
        case "surnameInitials":
          return compareText(displayName(left), displayName(right), sortDirection);
        case "persalNumber":
          return compareText(left.persalNumber || left.username, right.persalNumber || right.username, sortDirection);
        default:
          return compareText(String(left[sortKey] || ""), String(right[sortKey] || ""), sortDirection);
      }
    });
    return list;
  }, [filteredUsers, sortDirection, sortKey]);

  const totalPages = Math.max(1, Math.ceil(sortedUsers.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedUsers = sortedUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const startRow = sortedUsers.length ? (currentPage - 1) * pageSize + 1 : 0;
  const endRow = sortedUsers.length ? Math.min(currentPage * pageSize, sortedUsers.length) : 0;

  function toggleSort(key: SortKey) {
    setPage(1);
    if (key === sortKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection(key === "dateJoined" ? "desc" : "asc");
  }

  function sortLabel(key: SortKey) {
    if (sortKey !== key) return "solar:sort-bold";
    return sortDirection === "asc" ? "solar:sort-from-top-to-bottom-bold" : "solar:sort-from-bottom-to-top-bold";
  }

  function updateQuery(value: string) {
    setQuery(value);
    setPage(1);
  }

  function updateStatus(value: string) {
    setStatus(value);
    setPage(1);
  }

  function updatePageSize(value: string) {
    setPageSize(Number(value));
    setPage(1);
  }

  function toggleActionsMenu(userId: string, event: React.MouseEvent<HTMLButtonElement>) {
    if (openMenuId === userId) {
      setOpenMenuId(null);
      setMenuPosition(null);
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const estimatedMenuHeight = 220;
    const menuWidth = 192;
    const openUp = window.innerHeight - rect.bottom < estimatedMenuHeight;

    setOpenMenuId(userId);
    setMenuPosition({
      top: openUp ? Math.max(12, rect.top - estimatedMenuHeight - 8) : rect.bottom + 8,
      left: Math.max(12, rect.right - menuWidth)
    });
  }

  const assistantTemplateCsv = encodeURIComponent(
    '"Surname, Initials",Title,"Persal #",Role,Gender,Accom,Subject\n"BALLOT, TL",Me,21927090,Marker,F,YES,ENGFA-2'
  );

  return (
    <div className="hidden space-y-5 lg:block">
      <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-5 xl:grid-cols-[minmax(0,1fr)_280px] xl:items-end">
        <div className="grid min-w-0 gap-4 md:grid-cols-[minmax(0,1.5fr)_240px_240px]">
          <div className="space-y-2">
            <label htmlFor="assistant-table-search" className="text-sm font-medium text-slate-700">
              Search assistants
            </label>
            <Input
              id="assistant-table-search"
              value={query}
              onChange={(event) => updateQuery(event.target.value)}
              placeholder="Search by surname, persal number, subject, role or email"
              className="h-11 rounded-xl border-slate-200 bg-white shadow-none"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="assistant-table-status" className="text-sm font-medium text-slate-700">
              Status
            </label>
            <Select id="assistant-table-status" value={status} onChange={(event) => updateStatus(event.target.value)} className="h-11 rounded-xl border-slate-200 bg-white shadow-none">
              <option value="all">All assistants</option>
              <option value="active">Active only</option>
              <option value="inactive">Disabled only</option>
            </Select>
          </div>
          <div className="space-y-2">
            <label htmlFor="assistant-table-page-size" className="text-sm font-medium text-slate-700">
              Rows per page
            </label>
            <Select id="assistant-table-page-size" value={String(pageSize)} onChange={(event) => updatePageSize(event.target.value)} className="h-11 rounded-xl border-slate-200 bg-white shadow-none">
              {PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option} rows
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="flex flex-col gap-3 xl:items-end xl:self-end">
          <div className="flex items-center justify-end gap-2 self-stretch">
            <Modal
              title="Import Marking Assistants"
              description="Upload an Excel or CSV file that contains the required assistant columns."
              triggerLabel="Import assistants"
              triggerAriaLabel="Import assistants"
              triggerIcon="solar:upload-bold-duotone"
              triggerVariant="outline"
              triggerSize="icon"
              triggerLabelHidden
              triggerClassName="h-11 w-11 rounded-xl border-0 bg-primary text-white shadow-sm hover:bg-primary/90"
            >
              <ImportAssistantsForm
                inputId="assistantsFile-toolbar"
                returnTo="/assistants"
                templateHref={`data:text/csv;charset=utf-8,${assistantTemplateCsv}`}
              />
            </Modal>
            <Modal
              title="Add Marking Assistant"
              description="Create one assistant record and generate a QR tag."
              triggerLabel="Add assistant"
              triggerAriaLabel="Add assistant"
              triggerIcon="solar:user-plus-bold-duotone"
              triggerVariant="outline"
              triggerSize="icon"
              triggerLabelHidden
              triggerClassName="h-11 w-11 rounded-xl border-0 bg-primary text-white shadow-sm hover:bg-primary/90"
            >
              <form action={createUserAction} className="relative space-y-4">
                <FormPendingOverlay label="Adding assistant..." />
                <input type="hidden" name="role" value="USER" />
                <input type="hidden" name="password" value="ChangeMe123!" />
                <div className="space-y-2">
                  <Label htmlFor="assistant-surnameInitials-toolbar">Surname, Initials</Label>
                  <Input id="assistant-surnameInitials-toolbar" name="surnameInitials" placeholder="BALLOT, TL" required />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="assistant-title-toolbar">Title</Label>
                    <Input id="assistant-title-toolbar" name="title" placeholder="Me" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="assistant-persalNumber-toolbar">Persal #</Label>
                    <Input id="assistant-persalNumber-toolbar" name="username" placeholder="21927090" required />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="assistant-assistantRole-toolbar">Role</Label>
                    <Input id="assistant-assistantRole-toolbar" name="assistantRole" placeholder="Marker" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="assistant-gender-toolbar">Gender</Label>
                    <Input id="assistant-gender-toolbar" name="gender" placeholder="F" />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="assistant-accommodation-toolbar">Accom</Label>
                    <Input id="assistant-accommodation-toolbar" name="accommodation" placeholder="YES" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="assistant-subject-toolbar">Subject</Label>
                    <Input id="assistant-subject-toolbar" name="subject" placeholder="ENGFA-2" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="assistant-email-toolbar">Email</Label>
                  <Input id="assistant-email-toolbar" name="email" type="email" placeholder="Optional. Leave blank to auto-generate." />
                </div>
                <SubmitButton icon="solar:user-plus-bold-duotone" pendingLabel="Adding assistant...">Add assistant</SubmitButton>
              </form>
            </Modal>
          </div>
          <div className="self-stretch text-right text-sm text-slate-500">
            Showing {startRow}-{endRow} of {sortedUsers.length} assistants
          </div>
        </div>
      </div>

      <div className="overflow-visible rounded-2xl border border-slate-200 bg-white">
        <div className="overflow-x-auto overflow-y-visible">
        <table className="w-full min-w-[1080px] text-left text-sm">
          <thead className="bg-slate-950 text-white">
            <tr>
              <th className="px-3 py-3">
                <button type="button" className="flex items-center gap-2 font-semibold" onClick={() => toggleSort("surnameInitials")}>
                  Surname, Initials
                  <AppIcon icon={sortLabel("surnameInitials")} className="size-4" />
                </button>
              </th>
              <th className="px-3 py-3">
                <button type="button" className="flex items-center gap-2 font-semibold" onClick={() => toggleSort("title")}>
                  Title
                  <AppIcon icon={sortLabel("title")} className="size-4" />
                </button>
              </th>
              <th className="px-3 py-3">
                <button type="button" className="flex items-center gap-2 font-semibold" onClick={() => toggleSort("persalNumber")}>
                  Persal #
                  <AppIcon icon={sortLabel("persalNumber")} className="size-4" />
                </button>
              </th>
              <th className="px-3 py-3">
                <button type="button" className="flex items-center gap-2 font-semibold" onClick={() => toggleSort("assistantRole")}>
                  Role
                  <AppIcon icon={sortLabel("assistantRole")} className="size-4" />
                </button>
              </th>
              <th className="px-3 py-3">
                <button type="button" className="flex items-center gap-2 font-semibold" onClick={() => toggleSort("gender")}>
                  Gender
                  <AppIcon icon={sortLabel("gender")} className="size-4" />
                </button>
              </th>
              <th className="px-3 py-3">
                <button type="button" className="flex items-center gap-2 font-semibold" onClick={() => toggleSort("accommodation")}>
                  Accom
                  <AppIcon icon={sortLabel("accommodation")} className="size-4" />
                </button>
              </th>
              <th className="px-3 py-3">
                <button type="button" className="flex items-center gap-2 font-semibold" onClick={() => toggleSort("subject")}>
                  Subject
                  <AppIcon icon={sortLabel("subject")} className="size-4" />
                </button>
              </th>
              <th className="px-3 py-3">
                <button type="button" className="flex items-center gap-2 font-semibold" onClick={() => toggleSort("status")}>
                  Status
                  <AppIcon icon={sortLabel("status")} className="size-4" />
                </button>
              </th>
              <th className="px-3 py-3">
                <button type="button" className="flex items-center gap-2 font-semibold" onClick={() => toggleSort("dateJoined")}>
                  Joined
                  <AppIcon icon={sortLabel("dateJoined")} className="size-4" />
                </button>
              </th>
              <th className="px-3 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {pagedUsers.length ? (
              pagedUsers.map((user, index) => (
                <tr key={user.id} className="border-b border-slate-200 align-top last:border-0 hover:bg-slate-50/70">
                  <td className="px-3 py-3">
                    <p className="font-semibold text-slate-950">{displayName(user)}</p>
                    <p className="text-xs text-slate-500">{user.email}</p>
                  </td>
                  <td className="px-3 py-3 text-slate-700">{user.title || "Not set"}</td>
                  <td className="px-3 py-3 font-medium text-slate-900">{user.persalNumber || user.username}</td>
                  <td className="px-3 py-3 text-slate-700">{user.assistantRole || "Marker"}</td>
                  <td className="px-3 py-3 text-slate-700">{user.gender || "Not set"}</td>
                  <td className="px-3 py-3 text-slate-700">{user.accommodation || "Not set"}</td>
                  <td className="px-3 py-3 text-slate-700">{user.subject || "Not set"}</td>
                  <td className="px-3 py-3">
                    <Badge tone={user.isActive ? "good" : "danger"}>{user.isActive ? "Active" : "Disabled"}</Badge>
                  </td>
                  <td className="px-3 py-3 text-slate-700">{formatDate(new Date(user.dateJoined))}</td>
                  <td className="px-3 py-3">
                    <div className="relative inline-flex" data-assistant-actions-menu>
                      <button
                        type="button"
                        className={buttonVariants({
                          variant: "outline",
                          size: "icon",
                          className: "h-9 w-9 rounded-lg border-slate-200 bg-white text-slate-600 shadow-none hover:bg-slate-100"
                        })}
                        aria-label={`Open actions for ${displayName(user)}`}
                        onClick={(event) => toggleActionsMenu(user.id, event)}
                      >
                        <AppIcon icon="solar:menu-dots-bold" className="size-4" />
                      </button>
                      {openMenuId === user.id && menuPosition
                        ? createPortal(
                        <div
                          className="fixed z-[80] w-48 rounded-xl border border-slate-200 bg-white p-2 shadow-xl"
                          data-assistant-actions-menu
                          style={{
                            top: menuPosition.top,
                            left: menuPosition.left
                          }}
                        >
                          <div className="grid gap-1">
                            <Modal
                              title={displayName(user)}
                              description="Assistant profile"
                              triggerLabel="View assistant"
                              triggerAriaLabel={`View ${displayName(user)}`}
                              triggerIcon="solar:eye-bold"
                              triggerVariant="ghost"
                              triggerClassName="w-full justify-start rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                            >
                              <div className="grid gap-4">
                                <div className="grid gap-3 text-sm">
                                  <div className="rounded-lg border bg-muted/30 p-4">
                                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Surname, Initials</p>
                                    <p className="mt-1 font-medium">{user.surnameInitials || displayName(user)}</p>
                                  </div>
                                  <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="rounded-lg border p-4">
                                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Persal #</p>
                                      <p className="mt-1 font-medium">{user.persalNumber || user.username}</p>
                                    </div>
                                    <div className="rounded-lg border p-4">
                                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
                                      <p className="mt-1 font-medium">{user.isActive ? "Active" : "Disabled"}</p>
                                    </div>
                                    <div className="rounded-lg border p-4">
                                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Role</p>
                                      <p className="mt-1 font-medium">{user.assistantRole || "Marker"}</p>
                                    </div>
                                    <div className="rounded-lg border p-4">
                                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Joined</p>
                                      <p className="mt-1 font-medium">{formatDate(new Date(user.dateJoined))}</p>
                                    </div>
                                  </div>
                                  <div className="grid gap-3 sm:grid-cols-3">
                                    <div className="rounded-lg border p-4">
                                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Title</p>
                                      <p className="mt-1 font-medium">{user.title || "Not set"}</p>
                                    </div>
                                    <div className="rounded-lg border p-4">
                                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Gender</p>
                                      <p className="mt-1 font-medium">{user.gender || "Not set"}</p>
                                    </div>
                                    <div className="rounded-lg border p-4">
                                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Accom</p>
                                      <p className="mt-1 font-medium">{user.accommodation || "Not set"}</p>
                                    </div>
                                  </div>
                                  <div className="rounded-lg border p-4">
                                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Subject</p>
                                    <p className="mt-1 font-medium">{user.subject || "Not set"}</p>
                                  </div>
                                </div>
                              </div>
                            </Modal>
                            <Modal
                              title={`Edit ${displayName(user)}`}
                              description="Update this assistant without leaving the table."
                              triggerLabel="Edit assistant"
                              triggerAriaLabel={`Edit ${displayName(user)}`}
                              triggerIcon="solar:pen-2-bold"
                              triggerVariant="ghost"
                              triggerClassName="w-full justify-start rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-amber-50 hover:text-amber-900"
                            >
                              <form action={updateUserAction} className="relative space-y-4">
                                <FormPendingOverlay label="Saving assistant..." />
                                <input type="hidden" name="id" value={user.id} />
                                <input type="hidden" name="returnTo" value="/assistants" />
                                <input type="hidden" name="role" value="USER" />
                                <div className="space-y-2">
                                  <Label htmlFor={`assistant-modal-surnameInitials-${user.id}`}>Surname, Initials</Label>
                                  <Input id={`assistant-modal-surnameInitials-${user.id}`} name="surnameInitials" defaultValue={user.surnameInitials} required />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-2">
                                    <Label htmlFor={`assistant-modal-title-${user.id}`}>Title</Label>
                                    <Input id={`assistant-modal-title-${user.id}`} name="title" defaultValue={user.title} />
                                  </div>
                                  <div className="space-y-2">
                                    <Label htmlFor={`assistant-modal-username-${user.id}`}>Persal #</Label>
                                    <Input id={`assistant-modal-username-${user.id}`} name="username" defaultValue={user.persalNumber || user.username} required />
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-2">
                                    <Label htmlFor={`assistant-modal-role-${user.id}`}>Role</Label>
                                    <Input id={`assistant-modal-role-${user.id}`} name="assistantRole" defaultValue={user.assistantRole} />
                                  </div>
                                  <div className="space-y-2">
                                    <Label htmlFor={`assistant-modal-gender-${user.id}`}>Gender</Label>
                                    <Input id={`assistant-modal-gender-${user.id}`} name="gender" defaultValue={user.gender} />
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-2">
                                    <Label htmlFor={`assistant-modal-accommodation-${user.id}`}>Accom</Label>
                                    <Input id={`assistant-modal-accommodation-${user.id}`} name="accommodation" defaultValue={user.accommodation} />
                                  </div>
                                  <div className="space-y-2">
                                    <Label htmlFor={`assistant-modal-subject-${user.id}`}>Subject</Label>
                                    <Input id={`assistant-modal-subject-${user.id}`} name="subject" defaultValue={user.subject} />
                                  </div>
                                </div>
                                <input type="hidden" name="email" value="" />
                                {user.isActive ? <input type="hidden" name="isActive" value="true" /> : null}
                                <SubmitButton icon="solar:diskette-bold" pendingLabel="Saving changes...">Save changes</SubmitButton>
                              </form>
                            </Modal>
                            <Modal
                              title={`QR Tag for ${displayName(user)}`}
                              description="Preview, print or download the assistant tag."
                              triggerLabel="QR tag"
                              triggerAriaLabel={`Open QR tag for ${displayName(user)}`}
                              triggerIcon="solar:download-minimalistic-bold"
                              triggerVariant="ghost"
                              triggerClassName="w-full justify-start rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-sky-50 hover:text-sky-900"
                              className="max-w-2xl"
                            >
                              <AssistantQrTag
                                displayName={displayName(user)}
                                persalNumber={user.persalNumber || user.username}
                                qrAccessCode={user.qrAccessCode}
                                isActive={user.isActive}
                                downloadFilename={`${user.username}-meal-qr.png`}
                                orgName="Meal Registry System"
                              />
                            </Modal>
                            <form action={deleteUserAction}>
                              <input type="hidden" name="id" value={user.id} />
                              <input type="hidden" name="returnTo" value="/assistants?error=deleted" />
                              <ConfirmDeleteButton
                                confirmMessage={`Delete ${displayName(user)}? The assistant account will be removed, but historical scan records will stay.`}
                                className={buttonVariants({
                                  variant: "ghost",
                                  className: "w-full justify-start rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 hover:text-white"
                                })}
                                aria-label={`Delete ${displayName(user)}`}
                                title={`Delete ${displayName(user)}`}
                              >
                                <AppIcon icon="solar:trash-bin-trash-bold" className="size-4" />
                                Delete assistant
                              </ConfirmDeleteButton>
                            </form>
                          </div>
                        </div>,
                        document.body
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No assistants match the current search or filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
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
            Previous
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
