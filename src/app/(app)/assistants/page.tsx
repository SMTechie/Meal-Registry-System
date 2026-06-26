import { Role } from "@prisma/client";
import { createUserAction, deleteUserAction, updateUserAction } from "@/app/actions";
import { AppIcon } from "@/components/app-icon";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { FormPendingOverlay } from "@/components/form-pending-overlay";
import { PageAlert } from "@/components/page-alert";
import { PrintButton } from "@/components/print-button";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { displayName, formatDate, formatDateTime } from "@/lib/utils";

function messageFor(error?: string | string[], fields?: string | string[]) {
  const value = Array.isArray(error) ? error[0] : error;
  const fieldValue = Array.isArray(fields) ? fields[0] : fields;
  if (value === "duplicate-user") return `An assistant with this ${fieldValue || "username or email"} already exists.`;
  if (value === "invalid-user") return "Please check the assistant details and try again.";
  if (value === "cannot-delete-self") return "You cannot delete your own account.";
  if (value === "updated") return "Assistant updated successfully.";
  if (value === "deleted") return "Assistant deleted successfully.";
  return null;
}

export default async function AssistantsPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string | string[]; fields?: string | string[]; created?: string | string[] }>;
}) {
  await requireRole([Role.ADMIN, Role.SUPER_ADMIN]);
  const params = await searchParams;
  const errorMessage = messageFor(params.error, params.fields);
  const [users, org] = await Promise.all([
    prisma.user.findMany({
      where: { role: Role.USER },
      orderBy: [{ dateJoined: "desc" }]
    }),
    prisma.organizationSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1, name: "Meal Registry System" } })
  ]);
  const counts = {
    active: users.filter((user) => user.isActive).length,
    inactive: users.filter((user) => !user.isActive).length,
    tickets: users.length
  };

  const addAssistantForm = (
    <form action={createUserAction} className="relative space-y-4">
      <FormPendingOverlay label="Adding assistant..." />
      <input type="hidden" name="role" value={Role.USER} />
      <input type="hidden" name="password" value="ChangeMe123!" />
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="assistant-firstName">First name</Label>
          <Input id="assistant-firstName" name="firstName" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="assistant-lastName">Last name</Label>
          <Input id="assistant-lastName" name="lastName" required />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="assistant-username">Assistant number</Label>
        <Input id="assistant-username" name="username" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="assistant-email">Email</Label>
        <Input id="assistant-email" name="email" type="email" required />
      </div>
      <SubmitButton icon="solar:user-plus-bold-duotone" pendingLabel="Adding assistant...">Add assistant</SubmitButton>
    </form>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Marking Assistants</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {counts.active} active assistants, {counts.inactive} disabled, {counts.tickets} QR tags issued
              </p>
            </div>
            <div className="flex items-center gap-3">
              <AppIcon icon="solar:users-group-rounded-bold-duotone" className="hidden size-7 text-primary sm:block" />
              <Modal title="Add Marking Assistant" description="Create an assistant and generate a QR tag for meal scanning." triggerLabel="Add assistant" triggerIcon="solar:user-plus-bold-duotone">
                {addAssistantForm}
              </Modal>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {errorMessage ? <PageAlert type={params.error === "updated" || params.error === "deleted" ? "success" : "error"}>{errorMessage}</PageAlert> : null}
          {params.created ? <PageAlert type="success">Assistant created successfully.</PageAlert> : null}
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
                <div className="mt-5 space-y-4">
                  <div className="grid place-items-center">
                    <div className="grid size-32 shrink-0 place-items-center rounded-xl border bg-white p-2 shadow-sm">
                      <img src={`/api/users/${user.id}/qr`} alt={`QR code for ${displayName(user)}`} width={112} height={112} className="size-28 object-contain" />
                    </div>
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    <Modal
                      title={displayName(user)}
                      description="Assistant profile"
                      triggerLabel="View assistant"
                      triggerAriaLabel={`View ${displayName(user)}`}
                      triggerIcon="solar:eye-bold-duotone"
                      triggerVariant="outline"
                      triggerSize="icon"
                      triggerLabelHidden
                    >
                      <div className="grid gap-4">
                        <div className="mx-auto grid size-40 place-items-center rounded-2xl border bg-white p-2">
                          <img src={`/api/users/${user.id}/qr`} alt={`QR code for ${displayName(user)}`} width={140} height={140} className="size-[140px] object-contain" />
                        </div>
                        <div className="grid gap-3 text-sm">
                          <div className="rounded-lg border bg-muted/30 p-4">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Email</p>
                            <p className="mt-1 font-medium">{user.email}</p>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="rounded-lg border p-4">
                              <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
                              <p className="mt-1 font-medium">{user.isActive ? "Active" : "Disabled"}</p>
                            </div>
                            <div className="rounded-lg border p-4">
                              <p className="text-xs uppercase tracking-wide text-muted-foreground">Joined</p>
                              <p className="mt-1 font-medium">{formatDateTime(user.dateJoined)}</p>
                            </div>
                          </div>
                          <div className="rounded-lg border p-4">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">QR access code</p>
                            <p className="mt-1 break-all font-medium">{user.qrAccessCode}</p>
                          </div>
                        </div>
                      </div>
                    </Modal>
                    <Modal
                      title={`Edit ${displayName(user)}`}
                      description="Update this assistant without leaving the page."
                      triggerLabel="Edit assistant"
                      triggerAriaLabel={`Edit ${displayName(user)}`}
                      triggerIcon="solar:pen-bold-duotone"
                      triggerVariant="secondary"
                      triggerSize="icon"
                      triggerLabelHidden
                    >
                      <form action={updateUserAction} className="relative space-y-4">
                        <FormPendingOverlay label="Saving assistant..." />
                        <input type="hidden" name="id" value={user.id} />
                        <input type="hidden" name="role" value={Role.USER} />
                        <input type="hidden" name="returnTo" value="/assistants?error=updated" />
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label htmlFor={`assistant-edit-firstName-${user.id}`}>First name</Label>
                            <Input id={`assistant-edit-firstName-${user.id}`} name="firstName" defaultValue={user.firstName} required />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`assistant-edit-lastName-${user.id}`}>Last name</Label>
                            <Input id={`assistant-edit-lastName-${user.id}`} name="lastName" defaultValue={user.lastName} required />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`assistant-edit-username-${user.id}`}>Assistant number</Label>
                          <Input id={`assistant-edit-username-${user.id}`} name="username" defaultValue={user.username} required />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`assistant-edit-email-${user.id}`}>Email</Label>
                          <Input id={`assistant-edit-email-${user.id}`} name="email" type="email" defaultValue={user.email} required />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`assistant-edit-password-${user.id}`}>Reset password</Label>
                          <Input id={`assistant-edit-password-${user.id}`} name="password" type="password" minLength={8} placeholder="Leave blank to keep current password" />
                        </div>
                        <label className="flex items-center gap-3 rounded-md border px-3 py-2">
                          <input type="checkbox" name="isActive" defaultChecked={user.isActive} />
                          <span>
                            <strong className="block text-sm">Assistant enabled</strong>
                            <span className="text-sm text-muted-foreground">Disable this assistant without deleting the QR record.</span>
                          </span>
                        </label>
                        <SubmitButton icon="solar:diskette-bold-duotone" pendingLabel="Saving changes...">Save changes</SubmitButton>
                      </form>
                    </Modal>
                    <a
                      className={buttonVariants({ variant: "outline", size: "icon", className: "w-full" })}
                      href={`/api/users/${user.id}/qr`}
                      download={`${user.username}-meal-qr.png`}
                      aria-label={`Download QR for ${displayName(user)}`}
                      title={`Download QR for ${displayName(user)}`}
                    >
                      <AppIcon icon="solar:download-bold-duotone" className="size-4" />
                    </a>
                    <Modal
                      title={`Printable Tag for ${displayName(user)}`}
                      description="Preview, print or download the assistant tag without leaving this page."
                      triggerLabel="Print tag"
                      triggerAriaLabel={`Print tag for ${displayName(user)}`}
                      triggerIcon="solar:printer-bold-duotone"
                      triggerVariant="secondary"
                      triggerSize="icon"
                      triggerLabelHidden
                      className="max-w-2xl"
                    >
                      <div className="space-y-5">
                        <div className="flex flex-wrap gap-2 print:hidden">
                          <a className={buttonVariants({ variant: "outline" })} href={`/api/users/${user.id}/qr`} download={`${user.username}-meal-qr.png`}>
                            <AppIcon icon="solar:download-bold-duotone" className="size-4" />
                            Download QR
                          </a>
                          <PrintButton />
                        </div>
                        <div className="mx-auto max-w-md rounded-2xl border border-slate-300 bg-white p-7 text-center shadow-sm print:border-0 print:shadow-none">
                          <div className="mb-5 rounded-lg bg-slate-950 px-5 py-4 text-white">
                            <p className="text-xs uppercase tracking-wide text-white/65">{org.name || "Meal Registry System"}</p>
                            <h2 className="mt-1 text-2xl font-semibold">Marking Assistant</h2>
                          </div>
                          <img src={`/api/users/${user.id}/qr`} alt={`QR code for ${displayName(user)}`} width={280} height={280} className="mx-auto size-[280px] rounded-lg border bg-white p-3 object-contain" />
                          <h3 className="mt-5 text-2xl font-semibold">{displayName(user)}</h3>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                          <Badge tone={user.isActive ? "good" : "danger"} className="mt-4">
                            {user.isActive ? "Active meal access" : "Disabled"}
                          </Badge>
                          <p className="mt-5 break-all rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">{user.qrAccessCode}</p>
                        </div>
                      </div>
                    </Modal>
                    <form action={deleteUserAction}>
                      <input type="hidden" name="id" value={user.id} />
                      <input type="hidden" name="returnTo" value="/assistants?error=deleted" />
                      <ConfirmDeleteButton
                        confirmMessage={`Delete ${displayName(user)}? The assistant account will be removed, but historical scan records will stay.`}
                        className={buttonVariants({ variant: "destructive", size: "icon", className: "w-full" })}
                        aria-label={`Delete ${displayName(user)}`}
                        title={`Delete ${displayName(user)}`}
                      >
                        <AppIcon icon="solar:trash-bin-trash-bold-duotone" className="size-4" />
                      </ConfirmDeleteButton>
                    </form>
                  </div>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">Joined {formatDate(user.dateJoined)}</p>
              </article>
            ))}
          </div>
          <table className="hidden w-full text-left text-sm md:table">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr className="border-b">
                <th className="py-3">Assistant</th>
                <th>Status</th>
                <th>QR Code</th>
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
                  <td>
                    <Badge tone={user.isActive ? "good" : "danger"}>{user.isActive ? "Active" : "Disabled"}</Badge>
                  </td>
                  <td>
                    <div className="grid size-[58px] place-items-center rounded-md border bg-white p-1">
                      <img src={`/api/users/${user.id}/qr`} alt={`QR code for ${displayName(user)}`} width={50} height={50} className="size-[50px] object-contain" />
                    </div>
                  </td>
                  <td>{formatDate(user.dateJoined)}</td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      <Modal
                        title={displayName(user)}
                        description="Assistant profile"
                        triggerLabel="View assistant"
                        triggerAriaLabel={`View ${displayName(user)}`}
                        triggerIcon="solar:eye-bold-duotone"
                        triggerVariant="outline"
                        triggerSize="icon"
                        triggerLabelHidden
                      >
                        <div className="grid gap-4">
                          <div className="mx-auto grid size-40 place-items-center rounded-2xl border bg-white p-2">
                            <img src={`/api/users/${user.id}/qr`} alt={`QR code for ${displayName(user)}`} width={140} height={140} className="size-[140px] object-contain" />
                          </div>
                          <div className="grid gap-3 text-sm">
                            <div className="rounded-lg border bg-muted/30 p-4">
                              <p className="text-xs uppercase tracking-wide text-muted-foreground">Email</p>
                              <p className="mt-1 font-medium">{user.email}</p>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div className="rounded-lg border p-4">
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
                                <p className="mt-1 font-medium">{user.isActive ? "Active" : "Disabled"}</p>
                              </div>
                              <div className="rounded-lg border p-4">
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Joined</p>
                                <p className="mt-1 font-medium">{formatDateTime(user.dateJoined)}</p>
                              </div>
                            </div>
                            <div className="rounded-lg border p-4">
                              <p className="text-xs uppercase tracking-wide text-muted-foreground">QR access code</p>
                              <p className="mt-1 break-all font-medium">{user.qrAccessCode}</p>
                            </div>
                          </div>
                        </div>
                      </Modal>
                      <Modal
                        title={`Edit ${displayName(user)}`}
                        description="Update this assistant without leaving the page."
                        triggerLabel="Edit assistant"
                        triggerAriaLabel={`Edit ${displayName(user)}`}
                        triggerIcon="solar:pen-bold-duotone"
                        triggerVariant="secondary"
                        triggerSize="icon"
                        triggerLabelHidden
                      >
                        <form action={updateUserAction} className="relative space-y-4">
                          <FormPendingOverlay label="Saving assistant..." />
                          <input type="hidden" name="id" value={user.id} />
                          <input type="hidden" name="role" value={Role.USER} />
                          <input type="hidden" name="returnTo" value="/assistants?error=updated" />
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <Label htmlFor={`assistant-table-edit-firstName-${user.id}`}>First name</Label>
                              <Input id={`assistant-table-edit-firstName-${user.id}`} name="firstName" defaultValue={user.firstName} required />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`assistant-table-edit-lastName-${user.id}`}>Last name</Label>
                              <Input id={`assistant-table-edit-lastName-${user.id}`} name="lastName" defaultValue={user.lastName} required />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`assistant-table-edit-username-${user.id}`}>Assistant number</Label>
                            <Input id={`assistant-table-edit-username-${user.id}`} name="username" defaultValue={user.username} required />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`assistant-table-edit-email-${user.id}`}>Email</Label>
                            <Input id={`assistant-table-edit-email-${user.id}`} name="email" type="email" defaultValue={user.email} required />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`assistant-table-edit-password-${user.id}`}>Reset password</Label>
                            <Input id={`assistant-table-edit-password-${user.id}`} name="password" type="password" minLength={8} placeholder="Leave blank to keep current password" />
                          </div>
                          <label className="flex items-center gap-3 rounded-md border px-3 py-2">
                            <input type="checkbox" name="isActive" defaultChecked={user.isActive} />
                            <span>
                              <strong className="block text-sm">Assistant enabled</strong>
                              <span className="text-sm text-muted-foreground">Disable this assistant without deleting the QR record.</span>
                            </span>
                          </label>
                          <SubmitButton icon="solar:diskette-bold-duotone" pendingLabel="Saving changes...">Save changes</SubmitButton>
                        </form>
                      </Modal>
                      <a
                        className={buttonVariants({ variant: "outline", size: "icon" })}
                        href={`/api/users/${user.id}/qr`}
                        download={`${user.username}-meal-qr.png`}
                        aria-label={`Download QR for ${displayName(user)}`}
                        title={`Download QR for ${displayName(user)}`}
                      >
                        <AppIcon icon="solar:download-bold-duotone" className="size-4" />
                      </a>
                      <Modal
                        title={`Printable Tag for ${displayName(user)}`}
                        description="Preview, print or download the assistant tag without leaving this page."
                        triggerLabel="Print tag"
                        triggerAriaLabel={`Print tag for ${displayName(user)}`}
                        triggerIcon="solar:printer-bold-duotone"
                        triggerVariant="secondary"
                        triggerSize="icon"
                        triggerLabelHidden
                        className="max-w-2xl"
                      >
                        <div className="space-y-5">
                          <div className="flex flex-wrap gap-2 print:hidden">
                            <a className={buttonVariants({ variant: "outline" })} href={`/api/users/${user.id}/qr`} download={`${user.username}-meal-qr.png`}>
                              <AppIcon icon="solar:download-bold-duotone" className="size-4" />
                              Download QR
                            </a>
                            <PrintButton />
                          </div>
                          <div className="mx-auto max-w-md rounded-2xl border border-slate-300 bg-white p-7 text-center shadow-sm print:border-0 print:shadow-none">
                            <div className="mb-5 rounded-lg bg-slate-950 px-5 py-4 text-white">
                              <p className="text-xs uppercase tracking-wide text-white/65">{org.name || "Meal Registry System"}</p>
                              <h2 className="mt-1 text-2xl font-semibold">Marking Assistant</h2>
                            </div>
                            <img src={`/api/users/${user.id}/qr`} alt={`QR code for ${displayName(user)}`} width={280} height={280} className="mx-auto size-[280px] rounded-lg border bg-white p-3 object-contain" />
                            <h3 className="mt-5 text-2xl font-semibold">{displayName(user)}</h3>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                            <Badge tone={user.isActive ? "good" : "danger"} className="mt-4">
                              {user.isActive ? "Active meal access" : "Disabled"}
                            </Badge>
                            <p className="mt-5 break-all rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">{user.qrAccessCode}</p>
                          </div>
                        </div>
                      </Modal>
                      <form action={deleteUserAction}>
                        <input type="hidden" name="id" value={user.id} />
                        <input type="hidden" name="returnTo" value="/assistants?error=deleted" />
                        <ConfirmDeleteButton
                          confirmMessage={`Delete ${displayName(user)}? The assistant account will be removed, but historical scan records will stay.`}
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
