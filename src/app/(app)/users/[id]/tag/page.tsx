import { notFound, redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { AssistantQrTag } from "@/components/assistant-qr-tag";
import { currentUser, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { displayName } from "@/lib/utils";

export default async function AssistantTagPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await currentUser();
  if (!viewer) redirect("/login");
  if (!isAdmin(viewer)) redirect("/");

  const { id } = await params;
  const [assistant, org] = await Promise.all([
    prisma.user.findUnique({ where: { id } }),
    prisma.organizationSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1, name: "Meal Registry System" } })
  ]);
  if (!assistant || assistant.role !== Role.USER) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold">Printable Assistant Tag</h1>
          <p className="text-sm text-muted-foreground">Download the QR image or print this tag for the assistant badge.</p>
        </div>
      </div>
      <AssistantQrTag
        displayName={displayName(assistant)}
        persalNumber={assistant.persalNumber || assistant.username}
        qrAccessCode={assistant.qrAccessCode}
        isActive={assistant.isActive}
        downloadFilename={`${assistant.username}-meal-qr.png`}
        orgName={org.name || "Meal Registry System"}
      />
    </div>
  );
}
