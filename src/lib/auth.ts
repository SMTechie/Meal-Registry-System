import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { Role, type User } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const SESSION_COOKIE = "meal_registry_session";

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function signIn(username: string, password: string) {
  const user = await prisma.user.findFirst({
    where: { OR: [{ username }, { email: username }], isActive: true }
  });

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return { ok: false, message: "Invalid username or password." };
  }

  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 12);

  await prisma.session.create({
    data: {
      tokenHash: hashToken(token),
      userId: user.id,
      expiresAt
    }
  });
  await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });
  await prisma.auditEvent.create({
    data: {
      actorId: user.id,
      eventType: "LOGIN",
      detail: "User signed in.",
      userAgent: (await headers()).get("user-agent") ?? ""
    }
  });

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/"
  });

  return { ok: true };
}

export async function signOut() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) {
    const session = await prisma.session.findUnique({ where: { tokenHash: hashToken(token) } });
    if (session) {
      await prisma.session.delete({ where: { id: session.id } });
      await prisma.auditEvent.create({
        data: { actorId: session.userId, eventType: "LOGOUT", detail: "User signed out." }
      });
    }
  }
  (await cookies()).delete(SESSION_COOKIE);
}

export async function currentUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true }
  });

  if (!session || session.expiresAt < new Date() || !session.user.isActive) {
    return null;
  }

  return session.user;
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireRole(roles: Role[]) {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect("/");
  return user;
}

export function isStaff(user: Pick<User, "role">) {
  return user.role === Role.STAFF || user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN;
}

export function isAdmin(user: Pick<User, "role">) {
  return user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN;
}
