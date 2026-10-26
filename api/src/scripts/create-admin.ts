import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { z } from "zod";

// Run inside the API container. Never print or accept the password in argv.
const input = z
  .object({
    ADMIN_EMAIL: z
      .string()
      .email()
      .transform((value) => value.trim().toLowerCase()),
    ADMIN_PASSWORD: z
      .string()
      .min(12)
      .max(72)
      .refine((value) => Buffer.byteLength(value, "utf8") <= 72),
  })
  .safeParse(process.env);

if (!input.success) {
  process.stderr.write(
    "Set ADMIN_EMAIL and ADMIN_PASSWORD (12–72 characters).\n",
  );
  process.exit(1);
}

const prisma = new PrismaClient();
try {
  const existing = await prisma.user.findUnique({
    where: { email: input.data.ADMIN_EMAIL },
    select: { id: true },
  });
  if (existing) {
    throw new Error("Account already exists; no changes made.");
  }
  await prisma.user.create({
    data: {
      email: input.data.ADMIN_EMAIL,
      passwordHash: await bcrypt.hash(input.data.ADMIN_PASSWORD, 12),
      role: "ADMIN",
      name: "Администратор",
      surname: "Системы",
      preferredLocale: "ru",
      emailVerified: true,
    },
  });
  process.stdout.write(
    "Administrator created. Enable 2FA in account settings.\n",
  );
} catch (error) {
  // Prisma may include query input in its error text; do not log it.
  process.stderr.write(
    error instanceof Error &&
      error.message === "Account already exists; no changes made."
      ? `${error.message}\n`
      : "Administrator creation failed. Check database connectivity and email uniqueness.\n",
  );
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
