import { Role } from "@prisma/client";
import { createUserAction } from "@/app/actions";
import { AppIcon } from "@/components/app-icon";
import { FormPendingOverlay } from "@/components/form-pending-overlay";
import { PageAlert } from "@/components/page-alert";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { displayName } from "@/lib/utils";

function messageFor(error?: string | string[], fields?: string | string[]) {
  const value = Array.isArray(error) ? error[0] : error;
  const fieldValue = Array.isArray(fields) ? fields[0] : fields;
  if (value === "duplicate-user") return `A system user with this ${fieldValue || "username or email"} already exists.`;
  if (value === "invalid-user") return "Please check the user details and try again.";
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
        <CardContent className="overflow-x-auto">
          {errorMessage ? <PageAlert type="error">{errorMessage}</PageAlert> : null}
          {params.created ? <PageAlert type="success">System user created successfully.</PageAlert> : null}
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr className="border-b">
                <th className="py-3">User</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last login</th>
                <th>Joined</th>
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
                  <td>{user.lastLogin ? user.lastLogin.toLocaleString("en-ZA") : "Never"}</td>
                  <td>{user.dateJoined.toLocaleDateString("en-ZA")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
