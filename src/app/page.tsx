import { redirect } from "next/navigation";
import { currentUser, isAdmin, isStaff } from "@/lib/auth";

export default async function HomePage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (isAdmin(user)) redirect("/admin-portal");
  if (isStaff(user)) redirect("/scan");
  redirect("/ticket");
}
