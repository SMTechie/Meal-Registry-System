import { Role } from "@prisma/client";
import { createUserAction, deleteUserAction } from "@/app/actions";
import { AppIcon } from "@/components/app-icon";
import { AssistantQrTag } from "@/components/assistant-qr-tag";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { FormPendingOverlay } from "@/components/form-pending-overlay";
import { PageAlert } from "@/components/page-alert";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { displayName } from "@/lib/utils";
import { ImportAssistantsForm } from "./import-assistants-form";
import { AssistantsTable } from "./assistants-table";

function messageFor(error?: string | string[], fields?: string | string[], details?: string | string[]) {
  const value = Array.isArray(error) ? error[0] : error;
  const fieldValue = Array.isArray(fields) ? fields[0] : fields;

  if (value === "duplicate-user") return `An assistant with this ${fieldValue || "username or email"} already exists.`;
  if (value === "invalid-user") return "Please check the assistant details and try again.";
  if (value === "cannot-delete-self") return "You cannot delete your own account.";
  if (value === "deleted") return "Assistant deleted successfully.";
  return null;
}

export default async function AssistantsPage({
  searchParams
}: {
  searchParams: Promise<{
    error?: string | string[];
    fields?: string | string[];
    details?: string | string[];
    created?: string | string[];
    imported?: string | string[];
  }>;
}) {
  await requireRole([Role.ADMIN, Role.SUPER_ADMIN]);
  const params = await searchParams;
  const errorMessage = messageFor(params.error, params.fields, params.details);
  const [users, org] = await Promise.all([
    prisma.user.findMany({
      where: { role: Role.USER },
      orderBy: [{ surnameInitials: "asc" }, { lastName: "asc" }, { firstName: "asc" }]
    }),
    prisma.organizationSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1, name: "Meal Registry System" } })
  ]);

  const counts = {
    active: users.filter((user) => user.isActive).length,
    inactive: users.filter((user) => !user.isActive).length,
    tickets: users.length
  };
  const assistantTemplateCsv = encodeURIComponent(
    '"Surname, Initials",Title,"Persal #",Role,Gender,Accom,Subject\n"BALLOT, TL",Me,21927090,Marker,F,YES,ENGFA-2'
  );

  const addAssistantForm = (
    <form action={createUserAction} className="relative space-y-4">
      <FormPendingOverlay label="Adding assistant..." />
      <input type="hidden" name="role" value={Role.USER} />
      <input type="hidden" name="password" value="ChangeMe123!" />
      <div className="space-y-2">
        <Label htmlFor="assistant-surnameInitials">Surname, Initials</Label>
        <Input id="assistant-surnameInitials" name="surnameInitials" placeholder="BALLOT, TL" required />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="assistant-title">Title</Label>
          <Input id="assistant-title" name="title" placeholder="Me" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="assistant-persalNumber">Persal #</Label>
          <Input id="assistant-persalNumber" name="username" placeholder="21927090" required />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="assistant-assistantRole">Role</Label>
          <Input id="assistant-assistantRole" name="assistantRole" placeholder="Marker" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="assistant-gender">Gender</Label>
          <Input id="assistant-gender" name="gender" placeholder="F" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="assistant-accommodation">Accom</Label>
          <Input id="assistant-accommodation" name="accommodation" placeholder="YES" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="assistant-subject">Subject</Label>
          <Input id="assistant-subject" name="subject" placeholder="ENGFA-2" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="assistant-email">Email</Label>
        <Input id="assistant-email" name="email" type="email" placeholder="Optional. Leave blank to auto-generate." />
      </div>
      <SubmitButton icon="solar:user-plus-bold-duotone" pendingLabel="Adding assistant...">Add assistant</SubmitButton>
    </form>
  );

  const importAssistantsForm = (
    <ImportAssistantsForm
      inputId="assistantsFile"
      returnTo="/assistants"
      templateHref={`data:text/csv;charset=utf-8,${assistantTemplateCsv}`}
    />
  );

  return (
    <div className="space-y-6">
      <section className="rounded-[1.5rem] border border-slate-200 bg-white/90 p-6 shadow-[0_14px_40px_rgba(15,23,42,0.06)] backdrop-blur sm:p-7">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary">
                <AppIcon icon="solar:users-group-rounded-bold-duotone" className="size-6" />
              </div>
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">Assistant Registry</p>
                <h1 className="text-2xl font-semibold tracking-[-0.03em] text-slate-950">Marking Assistants</h1>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              Manage assistant records, import new markers, and keep meal QR access organised in one professional workspace.
            </p>
            <div className="mt-5 flex flex-wrap gap-3 text-sm">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-slate-700">
                <strong className="text-slate-950">{counts.active}</strong> active assistants
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-slate-700">
                <strong className="text-slate-950">{counts.inactive}</strong> disabled
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-slate-700">
                <strong className="text-slate-950">{counts.tickets}</strong> QR tags issued
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 lg:hidden">
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
              {importAssistantsForm}
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
              {addAssistantForm}
            </Modal>
          </div>
        </div>
      </section>

      <Card className="overflow-hidden rounded-[1.5rem] border-slate-200 bg-white/90 shadow-[0_14px_40px_rgba(15,23,42,0.06)]">
        <CardContent className="space-y-4 p-5 sm:p-6">
          {errorMessage ? <PageAlert type={params.error === "deleted" ? "success" : "error"}>{errorMessage}</PageAlert> : null}
          {params.created ? <PageAlert type="success">Assistant created successfully.</PageAlert> : null}
          {params.imported ? <PageAlert type="success">Imported {Array.isArray(params.imported) ? params.imported[0] : params.imported} assistants successfully.</PageAlert> : null}

          <div className="grid gap-3 lg:hidden">
            {users.map((user) => (
              <article key={user.id} className="rounded-lg border bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{displayName(user)}</h3>
                    <p className="text-sm text-muted-foreground">
                      Persal {user.persalNumber || user.username} | {user.subject || "No subject"}
                    </p>
                  </div>
                  <Badge tone={user.isActive ? "good" : "danger"}>{user.isActive ? "Active" : "Disabled"}</Badge>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-md border p-3">
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">Title</dt>
                    <dd className="mt-1 font-medium">{user.title || "Not set"}</dd>
                  </div>
                  <div className="rounded-md border p-3">
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">Role</dt>
                    <dd className="mt-1 font-medium">{user.assistantRole || "Marker"}</dd>
                  </div>
                  <div className="rounded-md border p-3">
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">Gender</dt>
                    <dd className="mt-1 font-medium">{user.gender || "Not set"}</dd>
                  </div>
                  <div className="rounded-md border p-3">
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">Accom</dt>
                    <dd className="mt-1 font-medium">{user.accommodation || "Not set"}</dd>
                  </div>
                </dl>
                <div className="mt-4 flex flex-wrap gap-2">
                  <a className={buttonVariants({ variant: "outline" })} href={`/assistants/${user.id}`}>
                    View
                  </a>
                  <a className={buttonVariants({ variant: "secondary" })} href={`/assistants/${user.id}/edit`}>
                    Edit
                  </a>
                  <a className={buttonVariants({ variant: "outline" })} href={`/api/users/${user.id}/qr`} download={`${user.username}-meal-qr.png`}>
                    QR
                  </a>
                  <Modal
                    title={`Printable Tag for ${displayName(user)}`}
                    description="Preview and print the assistant tag."
                    triggerLabel="Print"
                    triggerIcon="solar:printer-bold-duotone"
                    triggerVariant="outline"
                    className="max-w-2xl"
                  >
                    <AssistantQrTag
                      displayName={displayName(user)}
                      persalNumber={user.persalNumber || user.username}
                      qrAccessCode={user.qrAccessCode}
                      isActive={user.isActive}
                      downloadFilename={`${user.username}-meal-qr.png`}
                      orgName={org.name || "Meal Registry System"}
                    />
                  </Modal>
                </div>
                <form action={deleteUserAction} className="mt-3">
                  <input type="hidden" name="id" value={user.id} />
                  <input type="hidden" name="returnTo" value="/assistants?error=deleted" />
                  <ConfirmDeleteButton confirmMessage={`Delete ${displayName(user)}? The assistant account will be removed, but historical scan records will stay.`} className="w-full">
                    Delete assistant
                  </ConfirmDeleteButton>
                </form>
              </article>
            ))}
          </div>

          <AssistantsTable
            users={users.map((user) => ({
              ...user,
              dateJoined: user.dateJoined.toISOString()
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
