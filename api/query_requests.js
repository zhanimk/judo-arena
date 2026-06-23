const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const requests = await prisma.clubJoinRequest.findMany({
    include: {
      athlete: { select: { email: true, name: true, surname: true } },
      club: { select: { name: true } },
    },
  });
  console.log("All Club Join Requests:");
  console.dir(requests, { depth: null });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
