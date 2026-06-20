import { PrismaClient, MatchStatus } from "@prisma/client";
import { startMatch, confirmMatchResult } from "../src/services/match-lifecycle.service.js";
import { addScoreEvent } from "../src/services/match-score.service.js";

const prisma = new PrismaClient();
const TOURNAMENT_ID = "mega-stress-test-2026";

async function main() {
  console.log("Starting match simulation for mega tournament...");
  const admin = await prisma.user.findUnique({ where: { email: "admin@judo-arena.kz" } });
  
  if (!admin) throw new Error("Admin not found");

  let iteration = 1;
  while (true) {
    const pendingMatches = await prisma.match.findMany({
      where: {
        tournamentId: TOURNAMENT_ID,
        status: MatchStatus.PENDING,
        redAthleteId: { not: null },
        blueAthleteId: { not: null }
      },
      orderBy: { round: "asc" }
    });

    if (pendingMatches.length === 0) {
      console.log("No more pending matches with both athletes. Simulation complete!");
      break;
    }

    console.log(`Iteration ${iteration}: Found ${pendingMatches.length} ready matches.`);
    
    // Process them in parallel chunks to simulate high load
    const chunkSize = 50;
    for (let i = 0; i < pendingMatches.length; i += chunkSize) {
      const chunk = pendingMatches.slice(i, i + chunkSize);
      
      await Promise.all(chunk.map(async (match) => {
        try {
          // Assign random tatami if not assigned
          if (!match.tatamiNumber) {
            await prisma.match.update({
              where: { id: match.id },
              data: { tatamiNumber: Math.floor(Math.random() * 15) + 1 }
            });
          }
          
          await startMatch(match.id, admin.id);
          const winnerSide = Math.random() > 0.5 ? "RED" : "BLUE";
          await addScoreEvent(match.id, admin.id, { type: "IPPON", side: winnerSide });
          await confirmMatchResult(match.id, admin.id);
        } catch (e) {
          // ignore already started or conflict errors
        }
      }));
    }
    
    iteration++;
    // Add small delay to let DB catch up if needed
    await new Promise(r => setTimeout(r, 500));
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
