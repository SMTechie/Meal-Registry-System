import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function upsertUser(input: {
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  password: string;
}) {
  const passwordHash = await bcrypt.hash(input.password, 12);
  return prisma.user.upsert({
    where: { username: input.username },
    update: {
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email
    },
    create: {
      username: input.username,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      role: input.role,
      passwordHash
    }
  });
}

async function main() {
  const admin = await upsertUser({
    username: "admin",
    firstName: "System",
    lastName: "Admin",
    email: "admin@example.local",
    role: "SUPER_ADMIN",
    password: "ChangeMe123!"
  });

  await upsertUser({
    username: "staff",
    firstName: "Meal",
    lastName: "Staff",
    email: "staff@example.local",
    role: "STAFF",
    password: "ChangeMe123!"
  });

  const students = [
    ["thabo", "Thabo", "Mokoena"],
    ["amina", "Amina", "Jacobs"],
    ["liam", "Liam", "Naidoo"],
    ["zara", "Zara", "Khumalo"]
  ] as const;

  for (const [username, firstName, lastName] of students) {
    await upsertUser({
      username,
      firstName,
      lastName,
      email: `${username}@example.local`,
      role: "USER",
      password: "ChangeMe123!"
    });
  }

  await prisma.organizationSettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      name: "Brebner Primary School",
      contactEmail: "meals@example.local",
      contactPhone: "+27 51 000 0000",
      address: "Bloemfontein, Free State",
      updatedById: admin.id
    }
  });

  await prisma.emailConfiguration.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      fromEmail: "Meal Registry <no-reply@example.local>",
      smtpHost: "smtp.example.local",
      updatedById: admin.id
    }
  });

  const categories = [
    {
      name: "Breakfast",
      description: "Morning service",
      startsAt: "06:30",
      endsAt: "08:30",
      colourTag: "#047c78",
      displayOrder: 1
    },
    {
      name: "Lunch",
      description: "Main meal",
      startsAt: "11:30",
      endsAt: "14:00",
      colourTag: "#2563eb",
      displayOrder: 2
    },
    {
      name: "Aftercare",
      description: "Late afternoon allocation",
      startsAt: "15:00",
      endsAt: "17:30",
      colourTag: "#b45309",
      displayOrder: 3
    }
  ];

  for (const category of categories) {
    await prisma.mealCategory.upsert({
      where: { name: category.name },
      update: category,
      create: {
        ...category,
        dailyLimitPerUser: 1,
        createdById: admin.id,
        updatedById: admin.id
      }
    });
  }

  await prisma.auditEvent.create({
    data: {
      actorId: admin.id,
      eventType: "SYSTEM_BOOTSTRAPPED",
      detail: "Seeded default users, meal categories and settings."
    }
  });
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
