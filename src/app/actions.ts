"use server";

import bcrypt from "bcryptjs";
import { Prisma, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as XLSX from "xlsx";
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
  surnameInitials: z.string().max(160).default(""),
  title: z.string().max(40).default(""),
  persalNumber: z.string().max(40).default(""),
  assistantRole: z.string().max(80).default(""),
  gender: z.string().max(30).default(""),
  accommodation: z.string().max(30).default(""),
  subject: z.string().max(80).default(""),
  email: z.string().email().or(z.literal("")),
  role: z.nativeEnum(Role),
  password: z.string().min(8)
});

const userUpdateSchema = z.object({
  id: z.string().min(1),
  returnTo: z.string().default("/users"),
  username: z.string().min(2).max(80),
  firstName: z.string().max(80).default(""),
  lastName: z.string().max(80).default(""),
  surnameInitials: z.string().max(160).default(""),
  title: z.string().max(40).default(""),
  persalNumber: z.string().max(40).default(""),
  assistantRole: z.string().max(80).default(""),
  gender: z.string().max(30).default(""),
  accommodation: z.string().max(30).default(""),
  subject: z.string().max(80).default(""),
  email: z.string().email().or(z.literal("")).default(""),
  role: z.nativeEnum(Role),
  isActive: z.union([z.literal("on"), z.literal("true")]).optional(),
  password: z.union([z.string().min(8), z.literal("")]).optional()
});

const deleteUserSchema = z.object({
  id: z.string().min(1),
  returnTo: z.string().default("/users")
});

const assistantImportSchema = z.object({
  returnTo: z.string().default("/assistants")
});

export type AssistantImportState = {
  status: "idle" | "success" | "error";
  message: string;
  importedCount?: number;
};

function buildAssistantEmail(value: string) {
  const localPart = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `assistant-${localPart || "user"}@import.local`;
}

function splitAssistantName(value: string) {
  const [surname = "", initials = ""] = value.split(",", 2);
  return {
    lastName: surname.trim(),
    firstName: initials.trim()
  };
}

function normalizeUserData(input: z.infer<typeof userSchema> | z.infer<typeof userUpdateSchema>) {
  const surnameInitials = input.surnameInitials.trim();
  const username = input.username.trim();
  const persalNumber = (input.persalNumber.trim() || username).slice(0, 40);
  const parsedName = splitAssistantName(surnameInitials);
  const firstName = input.firstName.trim() || parsedName.firstName;
  const lastName = input.lastName.trim() || parsedName.lastName;
  const fallbackEmail = input.role === Role.USER ? buildAssistantEmail(persalNumber || username) : "";
  const email = input.email.trim() || fallbackEmail;

  return {
    username,
    firstName,
    lastName,
    surnameInitials,
    title: input.title.trim(),
    persalNumber,
    assistantRole: input.assistantRole.trim(),
    gender: input.gender.trim(),
    accommodation: input.accommodation.trim(),
    subject: input.subject.trim(),
    email
  };
}

function normalizeAssistantColumns(columns: string[]) {
  const trimmed = columns.map((value) => value.trim()).filter((value, index, array) => value || index < array.length - 1);
  if (trimmed.length === 8 && (trimmed[0] === "#" || /^\d+$/.test(trimmed[0]) || trimmed[0].toLowerCase() === "no")) {
    return trimmed.slice(1);
  }
  return trimmed;
}

function parseAssistantColumns(columns: string[]) {
  const normalized = normalizeAssistantColumns(columns);
  const nonEmptyValues = normalized.filter(Boolean);
  if (nonEmptyValues.length <= 1) return null;

  const isHeader =
    normalized.length >= 7 &&
    normalized[0].toLowerCase().includes("surname") &&
    normalized[2].toLowerCase().includes("persal") &&
    normalized[6].toLowerCase().includes("subject");

  if (isHeader) return null;

  const looksLikeWorksheetTitle =
    nonEmptyValues.length === 1 &&
    /marker list|accommodation list|school/i.test(nonEmptyValues[0]);
  if (looksLikeWorksheetTitle) return null;

  if (normalized.length !== 7) {
    throw new Error('Each assistant row must contain exactly these columns: "Surname, Initials", "Title", "Persal #", "Role", "Gender", "Accom", "Subject".');
  }

  const [surnameInitials, title, persalNumber, assistantRole, gender, accommodation, subject] = normalized;
  const looksLikeSummaryRow =
    !persalNumber &&
    !title &&
    !assistantRole &&
    !gender &&
    !accommodation &&
    Boolean(subject) &&
    /total|female|male|diabetic|vegetarian|halaal|halal|kosher|no red meat|no pork|fish/i.test(surnameInitials);

  if (looksLikeSummaryRow) return null;

  if (!surnameInitials || !persalNumber) {
    throw new Error('Each assistant row must include "Surname, Initials" and "Persal #".');
  }

  return {
    surnameInitials,
    title,
    persalNumber,
    assistantRole,
    gender,
    accommodation,
    subject
  };
}

async function parseAssistantImportFile(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error("The uploaded workbook is empty.");
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
    header: 1,
    raw: false,
    defval: ""
  });

  const assistants: Array<{
    surnameInitials: string;
    title: string;
    persalNumber: string;
    assistantRole: string;
    gender: string;
    accommodation: string;
    subject: string;
  }> = [];

  for (const [index, row] of rows.entries()) {
    const values = row.map((value) => String(value ?? "").trim());
    if (!values.some(Boolean)) continue;
    let parsed;
    try {
      parsed = parseAssistantColumns(values);
    } catch (error) {
      const message = error instanceof Error ? error.message : "The assistant import format is invalid.";
      throw new Error(`Row ${index + 1}: ${message}`);
    }
    if (parsed) assistants.push(parsed);
  }

  return assistants;
}

async function importAssistantsFromFormData(formData: FormData) {
  const actor = await requireRole([Role.ADMIN, Role.SUPER_ADMIN]);
  const parsed = assistantImportSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false as const,
      returnTo: "/assistants",
      message: "The import form is invalid. Please try again."
    };
  }

  const returnTo = parsed.data.returnTo.startsWith("/") ? parsed.data.returnTo : "/assistants";
  const assistantsFile = formData.get("assistantsFile");
  if (!(assistantsFile instanceof File) || assistantsFile.size === 0) {
    return {
      ok: false as const,
      returnTo,
      message: "Upload an Excel or CSV file before importing assistants."
    };
  }

  let assistants;
  try {
    assistants = await parseAssistantImportFile(assistantsFile);
  } catch (error) {
    return {
      ok: false as const,
      returnTo,
      message: error instanceof Error ? error.message : "The assistant import format is invalid."
    };
  }

  if (!assistants.length) {
    return {
      ok: false as const,
      returnTo,
      message: "No assistant rows were found to import."
    };
  }

  const uniqueAssistants = Array.from(new Map(assistants.map((assistant) => [assistant.persalNumber, assistant])).values());
  const defaultPasswordHash = await bcrypt.hash("ChangeMe123!", 12);

  try {
    await prisma.$transaction(async (tx) => {
      const persalNumbers = uniqueAssistants.map((assistant) => assistant.persalNumber);
      const existingUsers = await tx.user.findMany({
        where: {
          OR: [{ username: { in: persalNumbers } }, { persalNumber: { in: persalNumbers } }]
        }
      });

      const existingMap = new Map<string, (typeof existingUsers)[number]>();
      for (const user of existingUsers) {
        existingMap.set(user.username, user);
        if (user.persalNumber) existingMap.set(user.persalNumber, user);
      }

      for (const assistant of uniqueAssistants) {
        const existing = existingMap.get(assistant.persalNumber);
        if (existing && existing.role !== Role.USER) {
          throw new Error(`Persal number ${assistant.persalNumber} already belongs to a non-assistant account.`);
        }

        const parsedName = splitAssistantName(assistant.surnameInitials);
        const data = {
          username: assistant.persalNumber,
          firstName: parsedName.firstName,
          lastName: parsedName.lastName,
          surnameInitials: assistant.surnameInitials,
          title: assistant.title,
          persalNumber: assistant.persalNumber,
          assistantRole: assistant.assistantRole,
          gender: assistant.gender,
          accommodation: assistant.accommodation,
          subject: assistant.subject,
          email: existing?.email || buildAssistantEmail(assistant.persalNumber),
          role: Role.USER,
          isActive: true
        };

        if (existing) {
          await tx.user.update({
            where: { id: existing.id },
            data
          });
        } else {
          await tx.user.create({
            data: {
              ...data,
              passwordHash: defaultPasswordHash
            }
          });
        }
      }

      await tx.auditEvent.create({
        data: {
          actorId: actor.id,
          eventType: "ASSISTANTS_IMPORTED",
          detail: `Imported ${uniqueAssistants.length} assistant record${uniqueAssistants.length === 1 ? "" : "s"}.`
        }
      });
    }, {
      maxWait: 10_000,
      timeout: 120_000
    });
  } catch (error) {
    return {
      ok: false as const,
      returnTo,
      message: error instanceof Error ? error.message : "Assistant import failed."
    };
  }

  revalidatePath("/assistants");
  revalidatePath("/reports");
  revalidatePath("/scan");
  revalidatePath("/admin-portal");

  return {
    ok: true as const,
    returnTo,
    importedCount: uniqueAssistants.length
  };
}

export async function createUserAction(formData: FormData) {
  const actor = await requireRole([Role.ADMIN, Role.SUPER_ADMIN]);
  const parsed = userSchema.safeParse(Object.fromEntries(formData));
  const targetPath = parsed.success && parsed.data.role === Role.USER ? "/assistants" : "/users";
  if (!parsed.success) redirect(`${targetPath}?error=invalid-user`);
  const normalized = normalizeUserData(parsed.data);
  if (!normalized.email) redirect(`${targetPath}?error=invalid-user`);

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  let user;
  try {
    user = await prisma.user.create({
      data: {
        username: normalized.username,
        firstName: normalized.firstName,
        lastName: normalized.lastName,
        surnameInitials: normalized.surnameInitials,
        title: normalized.title,
        persalNumber: normalized.persalNumber,
        assistantRole: normalized.assistantRole,
        gender: normalized.gender,
        accommodation: normalized.accommodation,
        subject: normalized.subject,
        email: normalized.email,
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
  const normalized = normalizeUserData(parsed.data);
  if (!normalized.email) {
    redirect(`${returnTo}?error=invalid-user`);
  }
  const passwordHash = parsed.data.password ? await bcrypt.hash(parsed.data.password, 12) : undefined;

  try {
    await prisma.user.update({
      where: { id: parsed.data.id },
      data: {
        username: normalized.username,
        firstName: normalized.firstName,
        lastName: normalized.lastName,
        surnameInitials: normalized.surnameInitials,
        title: normalized.title,
        persalNumber: normalized.persalNumber,
        assistantRole: normalized.assistantRole,
        gender: normalized.gender,
        accommodation: normalized.accommodation,
        subject: normalized.subject,
        email: normalized.email,
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

export async function importAssistantsAction(formData: FormData) {
  const result = await importAssistantsFromFormData(formData);
  if (!result.ok) {
    redirect(`${result.returnTo}?error=invalid-import&details=${encodeURIComponent(result.message)}`);
  }

  redirect(`${result.returnTo}?imported=${result.importedCount}`);
}

export async function importAssistantsFormAction(_: AssistantImportState, formData: FormData): Promise<AssistantImportState> {
  const result = await importAssistantsFromFormData(formData);

  if (!result.ok) {
    return {
      status: "error",
      message: result.message
    };
  }

  return {
    status: "success",
    message: `Imported ${result.importedCount} assistant${result.importedCount === 1 ? "" : "s"} successfully.`,
    importedCount: result.importedCount
  };
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

const categoryUpdateSchema = categorySchema.extend({
  id: z.string().min(1),
  returnTo: z.string().default("/timeslots")
});

const deleteCategorySchema = z.object({
  id: z.string().min(1),
  returnTo: z.string().default("/timeslots")
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
  revalidatePath("/scan");
  revalidatePath("/admin-portal");
  revalidatePath("/reports");
  redirect("/timeslots");
}

export async function updateCategoryAction(formData: FormData) {
  const actor = await requireRole([Role.ADMIN, Role.SUPER_ADMIN]);
  const parsed = categoryUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fallback = String(formData.get("returnTo") ?? "/timeslots");
    redirect(`${fallback}?error=invalid-timeslot`);
  }

  const returnTo = parsed.data.returnTo.startsWith("/") ? parsed.data.returnTo : "/timeslots";

  try {
    await prisma.mealCategory.update({
      where: { id: parsed.data.id },
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
        startsAt: parsed.data.startsAt,
        endsAt: parsed.data.endsAt,
        dailyLimitPerUser: parsed.data.dailyLimitPerUser,
        colourTag: parsed.data.colourTag,
        displayOrder: parsed.data.displayOrder,
        updatedById: actor.id
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      redirect(`${returnTo}?error=duplicate-timeslot`);
    }
    throw error;
  }

  await prisma.auditEvent.create({
    data: {
      actorId: actor.id,
      eventType: "MEAL_CATEGORY_SAVED",
      detail: `Updated meal category ${parsed.data.name}.`
    }
  });

  revalidatePath("/categories");
  revalidatePath("/timeslots");
  revalidatePath("/scan");
  revalidatePath("/admin-portal");
  revalidatePath("/reports");
  redirect(returnTo);
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
  revalidatePath("/scan");
  revalidatePath("/admin-portal");
  revalidatePath("/reports");
}

export async function deleteCategoryAction(formData: FormData) {
  const actor = await requireRole([Role.ADMIN, Role.SUPER_ADMIN]);
  const parsed = deleteCategorySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/timeslots?error=invalid-timeslot");

  const returnTo = parsed.data.returnTo.startsWith("/") ? parsed.data.returnTo : "/timeslots";
  const category = await prisma.mealCategory.findUnique({ where: { id: parsed.data.id } });
  if (!category) redirect(`${returnTo}?error=invalid-timeslot`);

  await prisma.$transaction([
    prisma.mealScan.updateMany({ where: { categoryId: parsed.data.id }, data: { categoryId: null } }),
    prisma.mealCategory.delete({ where: { id: parsed.data.id } }),
    prisma.auditEvent.create({
      data: {
        actorId: actor.id,
        eventType: "MEAL_CATEGORY_DELETED",
        detail: `Deleted meal category ${category.name}.`
      }
    })
  ]);

  revalidatePath("/categories");
  revalidatePath("/timeslots");
  revalidatePath("/scan");
  revalidatePath("/admin-portal");
  revalidatePath("/reports");
  redirect(`${returnTo}?error=deleted`);
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
