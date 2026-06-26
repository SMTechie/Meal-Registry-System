import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { updateUserAction } from "@/app/actions";
import { AppIcon } from "@/components/app-icon";
import { FormPendingOverlay } from "@/components/form-pending-overlay";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/form";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { displayName } from "@/lib/utils";

function editErrorMessage(error?: string | string[], fields?: string | string[]) {
  const value = Array.isArray(error) ? error[0] : error;
  const fieldValue = Array.isArray(fields) ? fields[0] : fields;
  if (value === "duplicate-user") return `A system user with this ${fieldValue || "username or email"} already exists.`;
  if (value === "invalid-user") return "Please check the user details and try again.";
  if (value === "cannot-delete-self") return "You cannot delete your own account.";
  return null;
}

export default async function EditUserPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string | string[]; fields?: string | string[] }>;
}) {
  await requireRole([Role.ADMIN, Role.SUPER_ADMIN]);
  const { id } = await params;
  const query = await searchParams;
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || user.role === Role.USER) {
    if (user?.role === Role.USER) redirect(`/assistants/${user.id}/edit`);
    notFound();
  }

  const errorMessage = editErrorMessage(query.error, query.fields);

  return (
    <div className="space-y-6">
      <section className="page-head">
        <div>
          <span className="eyebrow">System user</span>
          <h1>Edit account</h1>
          <p className="page-subtitle">Update the login details, role and access state for this account.</p>
        </div>
        <div className="page-actions">
          <Link className="button" href={`/users/${user.id}`}>
            Back to profile
          </Link>
        </div>
      </section>

      <Card className="max-w-3xl">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>{displayName(user)}</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
            </div>
            <div className="flex items-center gap-3">
              <AppIcon icon="solar:user-id-bold-duotone" className="hidden size-7 text-primary sm:block" />
              <Badge tone={user.isActive ? "good" : "danger"}>{user.isActive ? "Active" : "Disabled"}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {errorMessage ? <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</p> : null}
          <form action={updateUserAction} className="relative space-y-4">
            <FormPendingOverlay label="Saving user..." />
            <input type="hidden" name="id" value={user.id} />
            <input type="hidden" name="returnTo" value={`/users/${user.id}`} />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="user-firstName">First name</Label>
                <Input id="user-firstName" name="firstName" defaultValue={user.firstName} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="user-lastName">Last name</Label>
                <Input id="user-lastName" name="lastName" defaultValue={user.lastName} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-username">Username</Label>
              <Input id="user-username" name="username" defaultValue={user.username} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-email">Email</Label>
              <Input id="user-email" name="email" type="email" defaultValue={user.email} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-role">Role</Label>
              <Select id="user-role" name="role" defaultValue={user.role}>
                <option value={Role.STAFF}>Staff scanner</option>
                <option value={Role.ADMIN}>Administrator</option>
                <option value={Role.SUPER_ADMIN}>Super administrator</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-password">Reset password</Label>
              <Input id="user-password" name="password" type="password" minLength={8} placeholder="Leave blank to keep current password" />
            </div>
            <label className="flex items-center gap-3 rounded-md border px-3 py-2">
              <input type="checkbox" name="isActive" defaultChecked={user.isActive} />
              <span>
                <strong className="block text-sm">Account enabled</strong>
                <span className="text-sm text-muted-foreground">Disable this user without removing the record.</span>
              </span>
            </label>
            <div className="flex flex-wrap gap-3">
              <SubmitButton icon="solar:diskette-bold-duotone" pendingLabel="Saving changes...">Save changes</SubmitButton>
              <Link className="button" href={`/users/${user.id}`}>
                Cancel
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
