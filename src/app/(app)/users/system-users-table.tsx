"use client";

import { useEffect, useState } from "react";
import { Role } from "@prisma/client";
import { deleteUserAction, updateUserAction } from "@/app/actions";
import { AppIcon } from "@/components/app-icon";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { FormPendingOverlay } from "@/components/form-pending-overlay";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { displayName, formatDate, formatDateTime } from "@/lib/utils";

type SystemUserRow = {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  isActive: boolean;
  lastLogin: string | null;
  dateJoined: string;
};

export function SystemUsersTable({ users }: { users: SystemUserRow[] }) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.closest("[data-system-user-actions-menu]")) return;
      setOpenMenuId(null);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenMenuId(null);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <table className="hidden w-full text-left text-sm md:table">
      <thead className="text-xs uppercase text-muted-foreground">
        <tr className="border-b">
          <th className="py-3">User</th>
          <th>Role</th>
          <th>Status</th>
          <th>Last login</th>
          <th>Joined</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {users.map((user) => (
          <tr key={user.id} className="border-b last:border-0">
            <td className="py-3">
              <p className="font-medium">{displayName(user)}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </td>
            <td>{user.role.replace("_", " ")}</td>
            <td>
              <Badge tone={user.isActive ? "good" : "danger"}>{user.isActive ? "Active" : "Disabled"}</Badge>
            </td>
            <td>{user.lastLogin ? formatDateTime(new Date(user.lastLogin)) : "Never"}</td>
            <td>{formatDate(new Date(user.dateJoined))}</td>
            <td>
              <div className="relative inline-flex" data-system-user-actions-menu>
                <button
                  type="button"
                  className={buttonVariants({
                    variant: "outline",
                    size: "icon",
                    className: "h-9 w-9 rounded-lg border-slate-200 bg-white text-slate-600 shadow-none hover:bg-slate-100"
                  })}
                  aria-label={`Open actions for ${displayName(user)}`}
                  onClick={() => setOpenMenuId((current) => (current === user.id ? null : user.id))}
                >
                  <AppIcon icon="solar:menu-dots-bold" className="size-4" />
                </button>
                {openMenuId === user.id ? (
                  <div className="absolute right-0 top-11 z-20 w-48 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                    <div className="grid gap-1">
                      <Modal
                        title={displayName(user)}
                        description="System user profile"
                        triggerLabel="View user"
                        triggerAriaLabel={`View ${displayName(user)}`}
                        triggerIcon="solar:eye-bold"
                        triggerVariant="ghost"
                        triggerClassName="w-full justify-start rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                      >
                        <div className="grid gap-3 text-sm">
                          <div className="rounded-lg border bg-muted/30 p-4">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Email</p>
                            <p className="mt-1 font-medium">{user.email}</p>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="rounded-lg border p-4">
                              <p className="text-xs uppercase tracking-wide text-muted-foreground">Role</p>
                              <p className="mt-1 font-medium">{user.role.replace("_", " ")}</p>
                            </div>
                            <div className="rounded-lg border p-4">
                              <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
                              <p className="mt-1 font-medium">{user.isActive ? "Active" : "Disabled"}</p>
                            </div>
                            <div className="rounded-lg border p-4">
                              <p className="text-xs uppercase tracking-wide text-muted-foreground">Last login</p>
                              <p className="mt-1 font-medium">{user.lastLogin ? formatDateTime(new Date(user.lastLogin)) : "Never"}</p>
                            </div>
                            <div className="rounded-lg border p-4">
                              <p className="text-xs uppercase tracking-wide text-muted-foreground">Joined</p>
                              <p className="mt-1 font-medium">{formatDateTime(new Date(user.dateJoined))}</p>
                            </div>
                          </div>
                        </div>
                      </Modal>
                      <Modal
                        title={`Edit ${displayName(user)}`}
                        description="Update this system user without leaving the page."
                        triggerLabel="Edit user"
                        triggerAriaLabel={`Edit ${displayName(user)}`}
                        triggerIcon="solar:pen-2-bold"
                        triggerVariant="ghost"
                        triggerClassName="w-full justify-start rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-amber-50 hover:text-amber-900"
                      >
                        <form action={updateUserAction} className="relative space-y-4">
                          <FormPendingOverlay label="Saving user..." />
                          <input type="hidden" name="id" value={user.id} />
                          <input type="hidden" name="returnTo" value="/users?error=updated" />
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <Label htmlFor={`system-table-edit-firstName-${user.id}`}>First name</Label>
                              <Input id={`system-table-edit-firstName-${user.id}`} name="firstName" defaultValue={user.firstName} required />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`system-table-edit-lastName-${user.id}`}>Last name</Label>
                              <Input id={`system-table-edit-lastName-${user.id}`} name="lastName" defaultValue={user.lastName} required />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`system-table-edit-username-${user.id}`}>Username</Label>
                            <Input id={`system-table-edit-username-${user.id}`} name="username" defaultValue={user.username} required />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`system-table-edit-email-${user.id}`}>Email</Label>
                            <Input id={`system-table-edit-email-${user.id}`} name="email" type="email" defaultValue={user.email} required />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`system-table-edit-role-${user.id}`}>Access role</Label>
                            <Select id={`system-table-edit-role-${user.id}`} name="role" defaultValue={user.role}>
                              <option value={Role.STAFF}>Staff scanner</option>
                              <option value={Role.ADMIN}>Administrator</option>
                              <option value={Role.SUPER_ADMIN}>Super administrator</option>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`system-table-edit-password-${user.id}`}>Reset password</Label>
                            <Input id={`system-table-edit-password-${user.id}`} name="password" type="password" minLength={8} placeholder="Leave blank to keep current password" />
                          </div>
                          <label className="flex items-center gap-3 rounded-md border px-3 py-2">
                            <input type="checkbox" name="isActive" defaultChecked={user.isActive} />
                            <span>
                              <strong className="block text-sm">Account enabled</strong>
                              <span className="text-sm text-muted-foreground">Disable this user without removing the record.</span>
                            </span>
                          </label>
                          <SubmitButton icon="solar:diskette-bold-duotone" pendingLabel="Saving changes...">Save changes</SubmitButton>
                        </form>
                      </Modal>
                      <form action={deleteUserAction}>
                        <input type="hidden" name="id" value={user.id} />
                        <input type="hidden" name="returnTo" value="/users?error=deleted" />
                        <ConfirmDeleteButton
                          confirmMessage={`Delete ${displayName(user)}? The account will be removed, but historical scan records will stay.`}
                          className={buttonVariants({
                            variant: "ghost",
                            className: "w-full justify-start rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 hover:text-white"
                          })}
                          aria-label={`Delete ${displayName(user)}`}
                          title={`Delete ${displayName(user)}`}
                        >
                          <AppIcon icon="solar:trash-bin-trash-bold" className="size-4" />
                          Delete user
                        </ConfirmDeleteButton>
                      </form>
                    </div>
                  </div>
                ) : null}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
