import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { deleteUserAction } from "@/app/actions";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { displayName, formatDateTime } from "@/lib/utils";

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole([Role.ADMIN, Role.SUPER_ADMIN]);
  const { id } = await params;
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || user.role === Role.USER) {
    if (user?.role === Role.USER) redirect(`/assistants/${user.id}`);
    notFound();
  }

  return (
    <div className="space-y-6">
      <section className="page-head">
        <div>
          <span className="eyebrow">System user</span>
          <h1>{displayName(user)}</h1>
          <p className="page-subtitle">{user.email}</p>
        </div>
        <div className="page-actions">
          <Link className="button" href="/users">
            Back to users
          </Link>
          <Link className="button primary" href={`/users/${user.id}/edit`}>
            Edit account
          </Link>
        </div>
      </section>

      <Card>
        <CardContent className="grid gap-6 p-6 md:grid-cols-[1.2fr_.8fr]">
          <div className="grid gap-4">
            <div className="detail-bubble detail-bubble-wide">
              <span>Username</span>
              <strong>{user.username}</strong>
            </div>
            <div className="detail-bubble detail-bubble-wide">
              <span>Full name</span>
              <strong>{displayName(user)}</strong>
            </div>
            <div className="detail-bubble detail-bubble-wide">
              <span>Email</span>
              <strong>{user.email}</strong>
            </div>
            <div className="detail-bubble">
              <span>Role</span>
              <strong>
                <span className={`role-badge role-${user.role.toLowerCase()}`}>{user.role.replace("_", " ")}</span>
              </strong>
            </div>
            <div className="detail-bubble">
              <span>Status</span>
              <strong>{user.isActive ? "Active" : "Disabled"}</strong>
            </div>
            <div className="detail-bubble detail-bubble-wide">
              <span>Date joined</span>
              <strong>{formatDateTime(user.dateJoined)}</strong>
            </div>
            <div className="detail-bubble detail-bubble-wide">
              <span>Last login</span>
              <strong>{user.lastLogin ? formatDateTime(user.lastLogin) : "Never"}</strong>
            </div>
          </div>

          <div className="grid gap-4">
            <Badge tone={user.isActive ? "good" : "danger"} className="justify-self-start">
              {user.isActive ? "Active" : "Disabled"}
            </Badge>
            <p className="text-sm text-muted-foreground">
              Deleting a system user will keep meal scan records, but remove the login account.
            </p>
            <form action={deleteUserAction} className="grid gap-3">
              <input type="hidden" name="id" value={user.id} />
              <input type="hidden" name="returnTo" value="/users" />
              <ConfirmDeleteButton
                confirmMessage={`Delete ${displayName(user)}? The account will be removed, but historical scan records will stay.`}
                className="w-full"
              >
                Delete account
              </ConfirmDeleteButton>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
