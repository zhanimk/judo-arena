import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const user = await prisma.user.findUnique({
    where: { email: "rr.01@almaty-demo.demo.judo-arena.kz" },
    include: { club: true },
  });
  console.log(JSON.stringify(user, null, 2));
}
main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
