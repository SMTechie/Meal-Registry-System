import { Role } from "@prisma/client";
import { createUserAction, deleteUserAction, updateUserAction } from "@/app/actions";
import { AppIcon } from "@/components/app-icon";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { FormPendingOverlay } from "@/components/form-pending-overlay";
import { PageAlert } from "@/components/page-alert";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { displayName, formatDate, formatDateTime } from "@/lib/utils";

function messageFor(error?: string | string[], fields?: string | string[]) {
  const value = Array.isArray(error) ? error[0] : error;
  const fieldValue = Array.isArray(fields) ? fields[0] : fields;
  if (value === "duplicate-user") return `A system user with this ${fieldValue || "username or email"} already exists.`;
  if (value === "invalid-user") return "Please check the user details and try again.";
  if (value === "cannot-delete-self") return "You cannot delete your own account.";
  if (value === "updated") return "System user updated successfully.";
  if (value === "deleted") return "System user deleted successfully.";
  return null;
}

export default async function SystemUsersPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string | string[]; fields?: string | string[]; created?: string | string[] }>;
}) {
  await requireRole([Role.ADMIN, Role.SUPER_ADMIN]);
  const params = await searchParams;
  const errorMessage = messageFor(params.error, params.fields);
  const users = await prisma.user.findMany({
    where: { role: { in: [Role.STAFF, Role.ADMIN, Role.SUPER_ADMIN] } },
    orderBy: [{ role: "asc" }, { dateJoined: "desc" }]
  });
  const counts = {
    active: users.filter((user) => user.isActive).length,
    staff: users.filter((user) => user.role === Role.STAFF).length,
    admins: users.filter((user) => user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN).length
  };

  const addUserForm = (
    <form action={createUserAction} className="relative space-y-4">
      <FormPendingOverlay label="Adding user..." />
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="system-firstName">First name</Label>
          <Input id="system-firstName" name="firstName" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="system-lastName">Last name</Label>
          <Input id="system-lastName" name="lastName" required />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="system-username">Username</Label>
        <Input id="system-username" name="username" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="system-email">Email</Label>
        <Input id="system-email" name="email" type="email" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="system-role">Access role</Label>
        <Select id="system-role" name="role" defaultValue={Role.STAFF}>
          <option value={Role.STAFF}>Staff scanner</option>
          <option value={Role.ADMIN}>Administrator</option>
          <option value={Role.SUPER_ADMIN}>Super administrator</option>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="system-password">Temporary password</Label>
        <Input id="system-password" name="password" type="password" minLength={8} required />
      </div>
      <SubmitButton icon="solar:user-plus-bold-duotone" pendingLabel="Adding user...">Add user</SubmitButton>
    </form>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>System Users</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {counts.active} active users, {counts.staff} staff, {counts.admins} admins
              </p>
            </div>
            <div className="flex items-center gap-3">
              <AppIcon icon="solar:user-id-bold-duotone" className="hidden size-7 text-primary sm:block" />
              <Modal title="Add System User" description="Create a login account for staff or administrators." triggerLabel="Add user" triggerIcon="solar:user-plus-bold-duotone">
                {addUserForm}
              </Modal>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {errorMessage ? <PageAlert type={params.error === "updated" || params.error === "deleted" ? "success" : "error"}>{errorMessage}</PageAlert> : null}
          {params.created ? <PageAlert type="success">System user created successfully.</PageAlert> : null}
          <div className="grid gap-3 md:hidden">
            {users.map((user) => (
              <article key={user.id} className="rounded-lg border bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold">{displayName(user)}</h3>
                    <p className="truncate text-sm text-muted-foreground">{user.email}</p>
                  </div>
                  <Badge tone={user.isActive ? "good" : "danger"}>{user.isActive ? "Active" : "Disabled"}</Badge>
                </div>
                <div className="mt-4 rounded-xl border bg-muted/20 p-3">
                  <div className="grid gap-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Role</span>
                    <span className="font-medium">{user.role.replace("_", " ")}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Last login</span>
                    <span className="text-right">{user.lastLogin ? formatDateTime(user.lastLogin) : "Never"}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Joined</span>
                    <span>{formatDate(user.dateJoined)}</span>
                  </div>
                </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <Modal
                    title={displayName(user)}
                    description="System user profile"
                    triggerLabel="View user"
                    triggerAriaLabel={`View ${displayName(user)}`}
                    triggerIcon="solar:eye-bold-duotone"
                    triggerVariant="outline"
                    triggerSize="icon"
                    triggerLabelHidden
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
                          <p className="mt-1 font-medium">{user.lastLogin ? formatDateTime(user.lastLogin) : "Never"}</p>
                        </div>
                        <div className="rounded-lg border p-4">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">Joined</p>
                          <p className="mt-1 font-medium">{formatDateTime(user.dateJoined)}</p>
                        </div>
                      </div>
                    </div>
                  </Modal>
                  <Modal
                    title={`Edit ${displayName(user)}`}
                    description="Update this system user without leaving the page."
                    triggerLabel="Edit user"
                    triggerAriaLabel={`Edit ${displayName(user)}`}
                    triggerIcon="solar:pen-bold-duotone"
                    triggerVariant="secondary"
                    triggerSize="icon"
                    triggerLabelHidden
                  >
                    <form action={updateUserAction} className="relative space-y-4">
                      <FormPendingOverlay label="Saving user..." />
                      <input type="hidden" name="id" value={user.id} />
                      <input type="hidden" name="returnTo" value="/users?error=updated" />
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor={`system-edit-firstName-${user.id}`}>First name</Label>
                          <Input id={`system-edit-firstName-${user.id}`} name="firstName" defaultValue={user.firstName} required />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`system-edit-lastName-${user.id}`}>Last name</Label>
                          <Input id={`system-edit-lastName-${user.id}`} name="lastName" defaultValue={user.lastName} required />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`system-edit-username-${user.id}`}>Username</Label>
                        <Input id={`system-edit-username-${user.id}`} name="username" defaultValue={user.username} required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`system-edit-email-${user.id}`}>Email</Label>
                        <Input id={`system-edit-email-${user.id}`} name="email" type="email" defaultValue={user.email} required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`system-edit-role-${user.id}`}>Access role</Label>
                        <Select id={`system-edit-role-${user.id}`} name="role" defaultValue={user.role}>
                          <option value={Role.STAFF}>Staff scanner</option>
                          <option value={Role.ADMIN}>Administrator</option>
                          <option value={Role.SUPER_ADMIN}>Super administrator</option>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`system-edit-password-${user.id}`}>Reset password</Label>
                        <Input id={`system-edit-password-${user.id}`} name="password" type="password" minLength={8} placeholder="Leave blank to keep current password" />
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
                  <form action={deleteUserAction} className="w-full">
                    <input type="hidden" name="id" value={user.id} />
                    <input type="hidden" name="returnTo" value="/users?error=deleted" />
                    <ConfirmDeleteButton
                      confirmMessage={`Delete ${displayName(user)}? The account will be removed, but historical scan records will stay.`}
                      className={buttonVariants({ variant: "destructive", size: "icon", className: "w-full" })}
                      aria-label={`Delete ${displayName(user)}`}
                      title={`Delete ${displayName(user)}`}
                    >
                      <AppIcon icon="solar:trash-bin-trash-bold-duotone" className="size-4" />
                    </ConfirmDeleteButton>
                  </form>
                </div>
              </article>
            ))}
          </div>
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
                  <td>{user.lastLogin ? formatDateTime(user.lastLogin) : "Never"}</td>
                  <td>{formatDate(user.dateJoined)}</td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      <Modal
                        title={displayName(user)}
                        description="System user profile"
                        triggerLabel="View user"
                        triggerAriaLabel={`View ${displayName(user)}`}
                        triggerIcon="solar:eye-bold-duotone"
                        triggerVariant="outline"
                        triggerSize="icon"
                        triggerLabelHidden
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
                              <p className="mt-1 font-medium">{user.lastLogin ? formatDateTime(user.lastLogin) : "Never"}</p>
                            </div>
                            <div className="rounded-lg border p-4">
                              <p className="text-xs uppercase tracking-wide text-muted-foreground">Joined</p>
                              <p className="mt-1 font-medium">{formatDateTime(user.dateJoined)}</p>
                            </div>
                          </div>
                        </div>
                      </Modal>
                      <Modal
                        title={`Edit ${displayName(user)}`}
                        description="Update this system user without leaving the page."
                        triggerLabel="Edit user"
                        triggerAriaLabel={`Edit ${displayName(user)}`}
                        triggerIcon="solar:pen-bold-duotone"
                        triggerVariant="secondary"
                        triggerSize="icon"
                        triggerLabelHidden
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
                          className={buttonVariants({ variant: "destructive", size: "icon" })}
                          aria-label={`Delete ${displayName(user)}`}
                          title={`Delete ${displayName(user)}`}
                        >
                          <AppIcon icon="solar:trash-bin-trash-bold-duotone" className="size-4" />
                        </ConfirmDeleteButton>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
