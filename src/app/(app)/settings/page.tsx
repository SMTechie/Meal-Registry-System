import { Role } from "@prisma/client";
import { updateSettingsAction } from "@/app/actions";
import { FormPendingOverlay } from "@/components/form-pending-overlay";
import { SubmitButton } from "@/components/submit-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/form";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function SettingsPage() {
  await requireRole([Role.ADMIN, Role.SUPER_ADMIN]);
  const [org, email] = await Promise.all([
    prisma.organizationSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } }),
    prisma.emailConfiguration.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } })
  ]);

  return (
    <Card className="max-w-4xl">
      <CardHeader>
        <CardTitle>Organization Settings</CardTitle>
        <p className="text-sm text-muted-foreground">Branding and email defaults used across the registry.</p>
      </CardHeader>
      <CardContent>
        <form action={updateSettingsAction} className="relative grid gap-5 md:grid-cols-2">
          <FormPendingOverlay label="Saving settings..." />
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="name">Organization name</Label>
            <Input id="name" name="name" defaultValue={org.name} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contactEmail">Contact email</Label>
            <Input id="contactEmail" name="contactEmail" type="email" defaultValue={org.contactEmail} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contactPhone">Contact phone</Label>
            <Input id="contactPhone" name="contactPhone" defaultValue={org.contactPhone} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="address">Address</Label>
            <Textarea id="address" name="address" defaultValue={org.address} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fromEmail">From email</Label>
            <Input id="fromEmail" name="fromEmail" defaultValue={email.fromEmail} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="smtpHost">SMTP host</Label>
            <Input id="smtpHost" name="smtpHost" defaultValue={email.smtpHost} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="smtpPort">SMTP port</Label>
            <Input id="smtpPort" name="smtpPort" type="number" defaultValue={email.smtpPort} />
          </div>
          <div className="flex items-end">
            <SubmitButton pendingLabel="Saving settings...">Save settings</SubmitButton>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
