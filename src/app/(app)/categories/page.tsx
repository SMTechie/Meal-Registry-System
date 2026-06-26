import { Role } from "@prisma/client";
import { createCategoryAction, deleteCategoryAction, toggleCategoryAction, updateCategoryAction } from "@/app/actions";
import { AppIcon } from "@/components/app-icon";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { FormPendingOverlay } from "@/components/form-pending-overlay";
import { PageAlert } from "@/components/page-alert";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatTime, mealWindowState, todayStart } from "@/lib/utils";

function messageFor(error?: string | string[]) {
  const value = Array.isArray(error) ? error[0] : error;
  if (value === "duplicate-timeslot") return "A meal timeslot with this name already exists.";
  if (value === "invalid-timeslot") return "Please check the timeslot details and try again.";
  if (value === "updated") return "Meal timeslot updated successfully.";
  if (value === "deleted") return "Meal timeslot deleted successfully.";
  return null;
}

export default async function MealTimeslotsPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  await requireRole([Role.ADMIN, Role.SUPER_ADMIN]);
  const params = await searchParams;
  const errorMessage = messageFor(params.error);
  const today = todayStart();
  const [timeslots, assistantCount] = await Promise.all([
    prisma.mealCategory.findMany({
      orderBy: [{ displayOrder: "asc" }, { startsAt: "asc" }, { name: "asc" }],
      include: { mealScans: { where: { scanDate: today, status: "ACCEPTED" } } }
    }),
    prisma.user.count({ where: { role: Role.USER, isActive: true } })
  ]);

  const addTimeslotForm = (
    <form action={createCategoryAction} className="relative space-y-4">
      <FormPendingOverlay label="Adding timeslot..." />
      <div className="space-y-2">
        <Label htmlFor="name">Meal name</Label>
        <Input id="name" name="name" placeholder="Breakfast, Lunch, Dinner" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Input id="description" name="description" placeholder="Main meal, tea break, late service" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="startsAt">Start time</Label>
          <Input id="startsAt" name="startsAt" type="time" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endsAt">End time</Label>
          <Input id="endsAt" name="endsAt" type="time" required />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label htmlFor="dailyLimitPerUser">Meals each</Label>
          <Input id="dailyLimitPerUser" name="dailyLimitPerUser" type="number" min="1" defaultValue="1" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="displayOrder">Order</Label>
          <Input id="displayOrder" name="displayOrder" type="number" min="0" defaultValue="0" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="colourTag">Colour</Label>
          <Input id="colourTag" name="colourTag" type="color" defaultValue="#047c78" className="p-1" />
        </div>
      </div>
      <SubmitButton icon="solar:add-circle-bold-duotone" pendingLabel="Adding timeslot...">Add timeslot</SubmitButton>
    </form>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Meal Timeslots</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Admins add the exact windows when assistants can claim each meal.</p>
            </div>
            <div className="flex items-center gap-3">
              <AppIcon icon="solar:clock-circle-bold-duotone" className="hidden size-7 text-primary sm:block" />
              <Modal
                title="Add Meal Timeslot"
                description="Create the time window when assistants can collect a meal."
                triggerLabel="Add timeslot"
                triggerIcon="solar:add-circle-bold-duotone"
              >
                {addTimeslotForm}
              </Modal>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3">
          {errorMessage ? <PageAlert type={params.error === "updated" || params.error === "deleted" ? "success" : "error"}>{errorMessage}</PageAlert> : null}
          {timeslots.map((timeslot) => {
            const capacity = assistantCount * timeslot.dailyLimitPerUser;
            const usage = capacity ? Math.round((timeslot.mealScans.length / capacity) * 100) : 0;
            const state = timeslot.isActive ? mealWindowState(timeslot.startsAt, timeslot.endsAt) : "inactive";
            const badgeTone = state === "open" ? "good" : state === "upcoming" ? "info" : "neutral";
            const badgeLabel = state === "open" ? "Open now" : state === "upcoming" ? "Upcoming" : state === "closed" ? "Closed" : "Inactive";
            return (
              <div key={timeslot.id} className="rounded-lg border bg-white p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <span className="mt-1 size-3 rounded-full" style={{ backgroundColor: timeslot.colourTag }} />
                    <div>
                      <h3 className="font-semibold">{timeslot.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {timeslot.description || "Meal collection window"} - {formatTime(timeslot.startsAt)} to {formatTime(timeslot.endsAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={badgeTone}>{badgeLabel}</Badge>
                    <form action={toggleCategoryAction}>
                      <input type="hidden" name="id" value={timeslot.id} />
                      <Button variant="outline" size="sm">{timeslot.isActive ? "Disable" : "Enable"}</Button>
                    </form>
                    <Modal
                      title={`Edit ${timeslot.name}`}
                      description="Update this meal timeslot without leaving the page."
                      triggerLabel="Edit timeslot"
                      triggerAriaLabel={`Edit ${timeslot.name}`}
                      triggerIcon="solar:pen-bold-duotone"
                      triggerVariant="secondary"
                      triggerSize="icon"
                      triggerLabelHidden
                    >
                      <form action={updateCategoryAction} className="relative space-y-4">
                        <FormPendingOverlay label="Saving timeslot..." />
                        <input type="hidden" name="id" value={timeslot.id} />
                        <input type="hidden" name="returnTo" value="/timeslots?error=updated" />
                        <div className="space-y-2">
                          <Label htmlFor={`timeslot-name-${timeslot.id}`}>Meal name</Label>
                          <Input id={`timeslot-name-${timeslot.id}`} name="name" defaultValue={timeslot.name} required />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`timeslot-description-${timeslot.id}`}>Description</Label>
                          <Input id={`timeslot-description-${timeslot.id}`} name="description" defaultValue={timeslot.description} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label htmlFor={`timeslot-startsAt-${timeslot.id}`}>Start time</Label>
                            <Input id={`timeslot-startsAt-${timeslot.id}`} name="startsAt" type="time" defaultValue={timeslot.startsAt} required />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`timeslot-endsAt-${timeslot.id}`}>End time</Label>
                            <Input id={`timeslot-endsAt-${timeslot.id}`} name="endsAt" type="time" defaultValue={timeslot.endsAt} required />
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-2">
                            <Label htmlFor={`timeslot-limit-${timeslot.id}`}>Meals each</Label>
                            <Input id={`timeslot-limit-${timeslot.id}`} name="dailyLimitPerUser" type="number" min="1" max="20" defaultValue={timeslot.dailyLimitPerUser} />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`timeslot-order-${timeslot.id}`}>Order</Label>
                            <Input id={`timeslot-order-${timeslot.id}`} name="displayOrder" type="number" min="0" max="999" defaultValue={timeslot.displayOrder} />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`timeslot-colour-${timeslot.id}`}>Colour</Label>
                            <Input id={`timeslot-colour-${timeslot.id}`} name="colourTag" type="color" defaultValue={timeslot.colourTag} className="p-1" />
                          </div>
                        </div>
                        <SubmitButton icon="solar:diskette-bold-duotone" pendingLabel="Saving timeslot...">Save changes</SubmitButton>
                      </form>
                    </Modal>
                    <form action={deleteCategoryAction}>
                      <input type="hidden" name="id" value={timeslot.id} />
                      <input type="hidden" name="returnTo" value="/timeslots" />
                      <ConfirmDeleteButton
                        confirmMessage={`Delete ${timeslot.name}? Historical scans will stay, but this timeslot will be removed.`}
                        className={buttonVariants({ variant: "destructive", size: "icon" })}
                        aria-label={`Delete ${timeslot.name}`}
                        title={`Delete ${timeslot.name}`}
                      >
                        <AppIcon icon="solar:trash-bin-trash-bold-duotone" className="size-4" />
                      </ConfirmDeleteButton>
                    </form>
                  </div>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, usage)}%` }} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {timeslot.mealScans.length} of {capacity} possible claims used today
                </p>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
