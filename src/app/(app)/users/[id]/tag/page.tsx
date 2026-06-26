import { notFound, redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { PrintButton } from "@/components/print-button";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
        <div className="flex gap-2">
          <a className={buttonVariants({ variant: "outline" })} href={`/api/users/${assistant.id}/qr`} download={`${assistant.username}-meal-qr.png`}>
            Download QR
          </a>
          <PrintButton />
        </div>
      </div>

      <Card className="mx-auto max-w-md border-slate-300 bg-white print:border-0 print:shadow-none">
        <CardContent className="p-7 text-center">
          <div className="mb-5 rounded-lg bg-slate-950 px-5 py-4 text-white">
            <p className="text-xs uppercase tracking-wide text-white/65">{org.name || "Meal Registry System"}</p>
            <h2 className="mt-1 text-2xl font-semibold">Marking Assistant</h2>
          </div>
          <img
            src={`/api/users/${assistant.id}/qr`}
            alt={`QR code for ${displayName(assistant)}`}
            width={280}
            height={280}
            className="mx-auto size-[280px] rounded-lg border bg-white p-3 object-contain"
          />
          <h3 className="mt-5 text-2xl font-semibold">{displayName(assistant)}</h3>
          <p className="text-sm text-muted-foreground">{assistant.email}</p>
          <Badge tone={assistant.isActive ? "good" : "danger"} className="mt-4">
            {assistant.isActive ? "Active meal access" : "Disabled"}
          </Badge>
          <p className="mt-5 break-all rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">{assistant.qrAccessCode}</p>
        </CardContent>
      </Card>
    </div>
  );
}
