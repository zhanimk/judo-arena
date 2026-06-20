const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.user.findFirst({
  where: { documents: { some: {} } },
  select: {
    id: true,
    documents: { orderBy: { updatedAt: "desc" } }
  }
}).then(console.dir).finally(() => prisma.$disconnect());
