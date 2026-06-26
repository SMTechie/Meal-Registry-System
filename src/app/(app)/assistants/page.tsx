import Link from "next/link";
import { Role } from "@prisma/client";
import { createUserAction } from "@/app/actions";
import { AppIcon } from "@/components/app-icon";
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

function messageFor(error?: string | string[], fields?: string | string[]) {
  const value = Array.isArray(error) ? error[0] : error;
  const fieldValue = Array.isArray(fields) ? fields[0] : fields;
  if (value === "duplicate-user") return `An assistant with this ${fieldValue || "username or email"} already exists.`;
  if (value === "invalid-user") return "Please check the assistant details and try again.";
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
  const users = await prisma.user.findMany({
    where: { role: Role.USER },
    orderBy: [{ dateJoined: "desc" }]
  });
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
        <CardContent className="overflow-x-auto">
          {errorMessage ? <PageAlert type="error">{errorMessage}</PageAlert> : null}
          {params.created ? <PageAlert type="success">Assistant created successfully.</PageAlert> : null}
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr className="border-b">
                <th className="py-3">Assistant</th>
                <th>Status</th>
                <th>QR Code</th>
                <th>Tag Actions</th>
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
                  <td>
                    <Badge tone={user.isActive ? "good" : "danger"}>{user.isActive ? "Active" : "Disabled"}</Badge>
                  </td>
                  <td>
                    <div className="grid size-[58px] place-items-center rounded-md border bg-white p-1">
                      <img src={`/api/users/${user.id}/qr`} alt={`QR code for ${displayName(user)}`} width={50} height={50} className="size-[50px] object-contain" />
                    </div>
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      <a className={buttonVariants({ variant: "outline", size: "sm" })} href={`/api/users/${user.id}/qr`} download={`${user.username}-meal-qr.png`}>
                        <AppIcon icon="solar:download-bold-duotone" className="size-4" />
                        Download
                      </a>
                      <Link className={buttonVariants({ variant: "secondary", size: "sm" })} href={`/users/${user.id}/tag`}>
                        <AppIcon icon="solar:printer-bold-duotone" className="size-4" />
                        Print tag
                      </Link>
                    </div>
                  </td>
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
