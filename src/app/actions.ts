"use server";

import bcrypt from "bcryptjs";
import { Prisma, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole, signIn, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
});

export async function loginAction(_: unknown, formData: FormData) {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { message: "Enter your username and password." };

  const result = await signIn(parsed.data.username, parsed.data.password);
  if (!result.ok) return { message: result.message };
  redirect("/");
}

export async function logoutAction() {
  await signOut();
  redirect("/login");
}

const userSchema = z.object({
  username: z.string().min(2).max(80),
  firstName: z.string().max(80).default(""),
  lastName: z.string().max(80).default(""),
  email: z.string().email(),
  role: z.nativeEnum(Role),
  password: z.string().min(8)
});

const userUpdateSchema = z.object({
  id: z.string().min(1),
  returnTo: z.string().default("/users"),
  username: z.string().min(2).max(80),
  firstName: z.string().max(80).default(""),
  lastName: z.string().max(80).default(""),
  email: z.string().email(),
  role: z.nativeEnum(Role),
  isActive: z.union([z.literal("on"), z.literal("true")]).optional(),
  password: z.union([z.string().min(8), z.literal("")]).optional()
});

const deleteUserSchema = z.object({
  id: z.string().min(1),
  returnTo: z.string().default("/users")
});

export async function createUserAction(formData: FormData) {
  const actor = await requireRole([Role.ADMIN, Role.SUPER_ADMIN]);
  const parsed = userSchema.safeParse(Object.fromEntries(formData));
  const targetPath = parsed.success && parsed.data.role === Role.USER ? "/assistants" : "/users";
  if (!parsed.success) redirect(`${targetPath}?error=invalid-user`);

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  let user;
  try {
    user = await prisma.user.create({
      data: {
        username: parsed.data.username,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        email: parsed.data.email,
        role: parsed.data.role,
        passwordHash
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const fields = Array.isArray(error.meta?.target) ? error.meta.target.join(", ") : "username or email";
      redirect(`${targetPath}?error=duplicate-user&fields=${encodeURIComponent(fields)}`);
    }
    throw error;
  }

  await prisma.auditEvent.create({
    data: {
      actorId: actor.id,
      eventType: "USER_CREATED",
      detail: `Created ${user.username} with role ${user.role}.`
    }
  });

  revalidatePath("/users");
  revalidatePath("/assistants");
  redirect(`${targetPath}?created=1`);
}

export async function updateUserAction(formData: FormData) {
  const actor = await requireRole([Role.ADMIN, Role.SUPER_ADMIN]);
  const parsed = userUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fallback = String(formData.get("returnTo") ?? "/users");
    redirect(`${fallback}?error=invalid-user`);
  }

  const returnTo = parsed.data.returnTo.startsWith("/") ? parsed.data.returnTo : "/users";
  const passwordHash = parsed.data.password ? await bcrypt.hash(parsed.data.password, 12) : undefined;

  try {
    await prisma.user.update({
      where: { id: parsed.data.id },
      data: {
        username: parsed.data.username,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        email: parsed.data.email,
        role: parsed.data.role,
        isActive: parsed.data.isActive === "on" || parsed.data.isActive === "true",
        ...(passwordHash ? { passwordHash } : {})
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const fields = Array.isArray(error.meta?.target) ? error.meta.target.join(", ") : "username or email";
      redirect(`${returnTo}?error=duplicate-user&fields=${encodeURIComponent(fields)}`);
    }
    throw error;
  }

  await prisma.auditEvent.create({
    data: {
      actorId: actor.id,
      eventType: "USER_UPDATED",
      detail: `Updated ${parsed.data.username} with role ${parsed.data.role}.`
    }
  });

  revalidatePath("/users");
  revalidatePath("/assistants");
  revalidatePath(`/users/${parsed.data.id}`);
  revalidatePath(`/users/${parsed.data.id}/edit`);
  revalidatePath(`/assistants/${parsed.data.id}`);
  revalidatePath(`/assistants/${parsed.data.id}/edit`);
  redirect(returnTo);
}

export async function deleteUserAction(formData: FormData) {
  const actor = await requireRole([Role.ADMIN, Role.SUPER_ADMIN]);
  const parsed = deleteUserSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/users?error=invalid-user");

  const returnTo = parsed.data.returnTo.startsWith("/") ? parsed.data.returnTo : "/users";
  if (actor.id === parsed.data.id) {
    redirect(`${returnTo}?error=cannot-delete-self`);
  }

  const target = await prisma.user.findUnique({ where: { id: parsed.data.id } });
  if (!target) redirect(`${returnTo}?error=invalid-user`);

  await prisma.$transaction([
    prisma.mealScan.updateMany({ where: { userId: parsed.data.id }, data: { userId: null } }),
    prisma.mealScan.updateMany({ where: { scannedById: parsed.data.id }, data: { scannedById: null as never } }),
    prisma.session.deleteMany({ where: { userId: parsed.data.id } }),
    prisma.user.delete({ where: { id: parsed.data.id } }),
    prisma.auditEvent.create({
      data: {
        actorId: actor.id,
        eventType: "USER_DELETED",
        detail: `Deleted ${target.username} with role ${target.role}.`
      }
    })
  ]);

  revalidatePath("/users");
  revalidatePath("/assistants");
  redirect(returnTo);
}

const categorySchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(180).default(""),
  startsAt: z.string().regex(/^\d{2}:\d{2}$/),
  endsAt: z.string().regex(/^\d{2}:\d{2}$/),
  dailyLimitPerUser: z.coerce.number().int().min(1).max(20),
  colourTag: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  displayOrder: z.coerce.number().int().min(0).max(999)
});

export async function createCategoryAction(formData: FormData) {
  const actor = await requireRole([Role.ADMIN, Role.SUPER_ADMIN]);
  const parsed = categorySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/timeslots?error=invalid-timeslot");

  try {
    await prisma.mealCategory.create({
      data: {
        ...parsed.data,
        createdById: actor.id,
        updatedById: actor.id
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      redirect("/timeslots?error=duplicate-timeslot");
    }
    throw error;
  }

  await prisma.auditEvent.create({
    data: {
      actorId: actor.id,
      eventType: "MEAL_CATEGORY_SAVED",
      detail: `Created meal category ${parsed.data.name}.`
    }
  });

  revalidatePath("/categories");
  revalidatePath("/timeslots");
  redirect("/timeslots");
}

export async function toggleCategoryAction(formData: FormData) {
  const actor = await requireRole([Role.ADMIN, Role.SUPER_ADMIN]);
  const id = String(formData.get("id") ?? "");
  const category = await prisma.mealCategory.findUniqueOrThrow({ where: { id } });

  await prisma.mealCategory.update({
    where: { id },
    data: { isActive: !category.isActive, updatedById: actor.id }
  });
  await prisma.auditEvent.create({
    data: {
      actorId: actor.id,
      eventType: "MEAL_CATEGORY_STATUS_CHANGED",
      detail: `${category.name} ${category.isActive ? "disabled" : "enabled"}.`
    }
  });

  revalidatePath("/categories");
  revalidatePath("/timeslots");
}

const settingsSchema = z.object({
  name: z.string().min(2).max(160),
  contactEmail: z.string().email().or(z.literal("")),
  contactPhone: z.string().max(40).default(""),
  address: z.string().max(500).default(""),
  fromEmail: z.string().max(160).default(""),
  smtpHost: z.string().max(160).default(""),
  smtpPort: z.coerce.number().int().min(1).max(65535)
});

export async function updateSettingsAction(formData: FormData) {
  const actor = await requireRole([Role.ADMIN, Role.SUPER_ADMIN]);
  const parsed = settingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/settings?error=invalid-settings");

  await prisma.organizationSettings.upsert({
    where: { id: 1 },
    update: {
      name: parsed.data.name,
      contactEmail: parsed.data.contactEmail,
      contactPhone: parsed.data.contactPhone,
      address: parsed.data.address,
      updatedById: actor.id
    },
    create: {
      id: 1,
      name: parsed.data.name,
      contactEmail: parsed.data.contactEmail,
      contactPhone: parsed.data.contactPhone,
      address: parsed.data.address,
      updatedById: actor.id
    }
  });

  await prisma.emailConfiguration.upsert({
    where: { id: 1 },
    update: {
      fromEmail: parsed.data.fromEmail,
      smtpHost: parsed.data.smtpHost,
      smtpPort: parsed.data.smtpPort,
      updatedById: actor.id
    },
    create: {
      id: 1,
      fromEmail: parsed.data.fromEmail,
      smtpHost: parsed.data.smtpHost,
      smtpPort: parsed.data.smtpPort,
      updatedById: actor.id
    }
  });

  await prisma.auditEvent.create({
    data: { actorId: actor.id, eventType: "SETTINGS_UPDATED", detail: "Updated organization and email settings." }
  });

  revalidatePath("/settings");
  redirect("/settings?saved=1");
}
