import { Role } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { displayName } from "@/lib/utils";

export default async function TicketPage() {
  const user = await requireUser();

  return (
    <div className="mx-auto max-w-xl">
      <Card>
        <CardHeader>
          <CardTitle>My Assistant Meal Tag</CardTitle>
          <p className="text-sm text-muted-foreground">Present this QR code to an admin during an active meal timeslot.</p>
        </CardHeader>
        <CardContent className="grid place-items-center gap-5 text-center">
          {user.role === Role.USER ? (
            <img
              src={`/api/users/${user.id}/qr`}
              alt="Your assistant QR meal tag"
              width={280}
              height={280}
              className="size-[280px] rounded-lg border bg-white p-3 object-contain"
            />
          ) : (
            <div className="rounded-lg border bg-muted p-8 text-sm text-muted-foreground">
              Staff and administrator accounts do not act as marking assistant meal tags.
            </div>
          )}
          <div>
            <h1 className="text-2xl font-semibold">{displayName(user)}</h1>
            <p className="text-sm text-muted-foreground">{user.email}</p>
            <Badge tone={user.isActive ? "good" : "danger"} className="mt-3">
              {user.isActive ? "Active" : "Disabled"}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
