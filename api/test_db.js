const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function main() {
  const doc = await prisma.userDocument.findFirst();
  console.log(doc);
}
main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
