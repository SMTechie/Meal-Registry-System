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

export default async function AssistantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole([Role.ADMIN, Role.SUPER_ADMIN]);
  const { id } = await params;
  const assistant = await prisma.user.findUnique({ where: { id } });
  if (!assistant || assistant.role !== Role.USER) {
    if (assistant && assistant.role !== Role.USER) redirect(`/users/${assistant.id}`);
    notFound();
  }

  return (
    <div className="space-y-6">
      <section className="page-head">
        <div>
          <span className="eyebrow">Marking assistant</span>
          <h1>{displayName(assistant)}</h1>
          <p className="page-subtitle">{assistant.email}</p>
        </div>
        <div className="page-actions">
          <Link className="button" href="/assistants">
            Back to assistants
          </Link>
          <Link className="button primary" href={`/assistants/${assistant.id}/edit`}>
            Edit assistant
          </Link>
          <Link className="button" href={`/users/${assistant.id}/tag`}>
            Print tag
          </Link>
        </div>
      </section>

      <Card>
        <CardContent className="grid gap-6 p-6 md:grid-cols-[1.05fr_.95fr]">
          <div className="qr-display access-pass">
            <div className="pass-topline">
              <span>Meal access pass</span>
              <span>{assistant.role.replace("_", " ")}</span>
            </div>
            <div className="qr-bubble">
              <img src={`/api/users/${assistant.id}/qr`} alt={`QR code for ${displayName(assistant)}`} width={280} height={280} className="size-[280px] rounded-lg border bg-white p-3 object-contain" />
            </div>
            <div className="code-bubble">
              <span>Access code</span>
              <code>{assistant.qrAccessCode}</code>
            </div>
            <Badge tone={assistant.isActive ? "good" : "danger"}>{assistant.isActive ? "Active meal access" : "Disabled"}</Badge>
          </div>

          <div className="grid gap-4">
            <div className="detail-bubble detail-bubble-wide">
              <span>Username</span>
              <strong>{assistant.username}</strong>
            </div>
            <div className="detail-bubble detail-bubble-wide">
              <span>Full name</span>
              <strong>{displayName(assistant)}</strong>
            </div>
            <div className="detail-bubble detail-bubble-wide">
              <span>Email</span>
              <strong>{assistant.email}</strong>
            </div>
            <div className="detail-bubble">
              <span>Status</span>
              <strong>{assistant.isActive ? "Active" : "Disabled"}</strong>
            </div>
            <div className="detail-bubble">
              <span>Joined</span>
              <strong>{formatDateTime(assistant.dateJoined)}</strong>
            </div>
            <p className="text-sm text-muted-foreground">
              Deleting an assistant will keep their scan history, but remove the account and QR login.
            </p>
            <form action={deleteUserAction} className="grid gap-3">
              <input type="hidden" name="id" value={assistant.id} />
              <input type="hidden" name="returnTo" value="/assistants" />
              <ConfirmDeleteButton
                confirmMessage={`Delete ${displayName(assistant)}? The assistant account will be removed, but historical scan records will stay.`}
                className="w-full"
              >
                Delete assistant
              </ConfirmDeleteButton>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
