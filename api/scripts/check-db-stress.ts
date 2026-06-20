import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const tournament = await prisma.tournament.findUnique({
    where: { id: "mega-stress-test-2026" },
    include: { categories: true }
  });
  if (!tournament) return console.log("Tournament not found");
  
  const entries = await prisma.applicationEntry.findMany({
    where: {
      application: { tournamentId: "mega-stress-test-2026", status: "APPROVED" },
      weighInStatus: "PASSED"
    },
    include: { athlete: true }
  });
  console.log("Total entries:", entries.length);
  
  const bracket = await prisma.bracket.findFirst({
    where: { tournamentId: "mega-stress-test-2026" }
  });
  console.log("Bracket exists:", !!bracket);
  
  const matches = await prisma.match.count({
    where: { tournamentId: "mega-stress-test-2026" }
  });
  console.log("Matches:", matches);
}

main().finally(() => prisma.$disconnect());
