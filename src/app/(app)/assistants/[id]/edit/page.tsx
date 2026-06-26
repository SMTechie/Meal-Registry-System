import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { updateUserAction } from "@/app/actions";
import { AppIcon } from "@/components/app-icon";
import { FormPendingOverlay } from "@/components/form-pending-overlay";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/form";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { displayName } from "@/lib/utils";

function editErrorMessage(error?: string | string[], fields?: string | string[]) {
  const value = Array.isArray(error) ? error[0] : error;
  const fieldValue = Array.isArray(fields) ? fields[0] : fields;
  if (value === "duplicate-user") return `An assistant with this ${fieldValue || "username or email"} already exists.`;
  if (value === "invalid-user") return "Please check the assistant details and try again.";
  return null;
}

export default async function EditAssistantPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string | string[]; fields?: string | string[] }>;
}) {
  await requireRole([Role.ADMIN, Role.SUPER_ADMIN]);
  const { id } = await params;
  const query = await searchParams;
  const assistant = await prisma.user.findUnique({ where: { id } });
  if (!assistant || assistant.role !== Role.USER) {
    if (assistant && assistant.role !== Role.USER) redirect(`/users/${assistant.id}/edit`);
    notFound();
  }

  const errorMessage = editErrorMessage(query.error, query.fields);

  return (
    <div className="space-y-6">
      <section className="page-head">
        <div>
          <span className="eyebrow">Marking assistant</span>
          <h1>Edit assistant</h1>
          <p className="page-subtitle">Update the QR account details and access state for this assistant.</p>
        </div>
        <div className="page-actions">
          <Link className="button" href={`/assistants/${assistant.id}`}>
            Back to profile
          </Link>
        </div>
      </section>

      <Card className="max-w-3xl">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>{displayName(assistant)}</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">{assistant.email}</p>
            </div>
            <div className="flex items-center gap-3">
              <AppIcon icon="solar:users-group-rounded-bold-duotone" className="hidden size-7 text-primary sm:block" />
              <Badge tone={assistant.isActive ? "good" : "danger"}>{assistant.isActive ? "Active" : "Disabled"}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {errorMessage ? <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</p> : null}
          <form action={updateUserAction} className="relative space-y-4">
            <FormPendingOverlay label="Saving assistant..." />
            <input type="hidden" name="id" value={assistant.id} />
            <input type="hidden" name="returnTo" value={`/assistants/${assistant.id}`} />
            <input type="hidden" name="role" value={Role.USER} />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="assistant-firstName">First name</Label>
                <Input id="assistant-firstName" name="firstName" defaultValue={assistant.firstName} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="assistant-lastName">Last name</Label>
                <Input id="assistant-lastName" name="lastName" defaultValue={assistant.lastName} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="assistant-username">Assistant number</Label>
              <Input id="assistant-username" name="username" defaultValue={assistant.username} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="assistant-email">Email</Label>
              <Input id="assistant-email" name="email" type="email" defaultValue={assistant.email} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="assistant-password">Reset password</Label>
              <Input id="assistant-password" name="password" type="password" minLength={8} placeholder="Leave blank to keep current password" />
            </div>
            <label className="flex items-center gap-3 rounded-md border px-3 py-2">
              <input type="checkbox" name="isActive" defaultChecked={assistant.isActive} />
              <span>
                <strong className="block text-sm">Account enabled</strong>
                <span className="text-sm text-muted-foreground">Disable this assistant without removing the QR tag.</span>
              </span>
            </label>
            <div className="flex flex-wrap gap-3">
              <SubmitButton icon="solar:diskette-bold-duotone" pendingLabel="Saving changes...">Save changes</SubmitButton>
              <Link className="button" href={`/assistants/${assistant.id}`}>
                Cancel
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
