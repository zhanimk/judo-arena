/**
 * complete-demo.ts
 * Завершает все PENDING матчи демо-турнира с реалистичными счётами.
 * Запуск: npx tsx prisma/complete-demo.ts
 */
import { PrismaClient, MatchStatus } from "@prisma/client";
import { propagateWinner } from "../src/services/match-propagation.js";
import { finalizeTournament } from "../src/services/rating.service.js";

const TOURNAMENT_ID = "demo-complete-flow-2026";

const prisma = new PrismaClient();

// Реалистичные результаты дзюдо
const SCORE_OUTCOMES = [
  // 45% — победа Иппоном
  { red: { ippon: 1, wazaari: 0, yuko: 0, shido: 0, hansoku: false }, blue: { ippon: 0, wazaari: 0, yuko: 0, shido: 0, hansoku: false }, winner: "RED" as const, label: "Ippon" },
  { red: { ippon: 0, wazaari: 0, yuko: 0, shido: 0, hansoku: false }, blue: { ippon: 1, wazaari: 0, yuko: 0, shido: 0, hansoku: false }, winner: "BLUE" as const, label: "Ippon" },
  { red: { ippon: 1, wazaari: 0, yuko: 0, shido: 0, hansoku: false }, blue: { ippon: 0, wazaari: 0, yuko: 0, shido: 0, hansoku: false }, winner: "RED" as const, label: "Ippon" },
  { red: { ippon: 0, wazaari: 0, yuko: 0, shido: 0, hansoku: false }, blue: { ippon: 1, wazaari: 0, yuko: 0, shido: 0, hansoku: false }, winner: "BLUE" as const, label: "Ippon" },
  { red: { ippon: 1, wazaari: 0, yuko: 0, shido: 0, hansoku: false }, blue: { ippon: 0, wazaari: 0, yuko: 0, shido: 0, hansoku: false }, winner: "RED" as const, label: "Ippon" },
  // 30% — победа Вадза-ари
  { red: { ippon: 0, wazaari: 2, yuko: 0, shido: 0, hansoku: false }, blue: { ippon: 0, wazaari: 0, yuko: 0, shido: 0, hansoku: false }, winner: "RED" as const, label: "Waza-ari" },
  { red: { ippon: 0, wazaari: 0, yuko: 0, shido: 0, hansoku: false }, blue: { ippon: 0, wazaari: 2, yuko: 0, shido: 0, hansoku: false }, winner: "BLUE" as const, label: "Waza-ari" },
  { red: { ippon: 0, wazaari: 1, yuko: 0, shido: 0, hansoku: false }, blue: { ippon: 0, wazaari: 0, yuko: 0, shido: 0, hansoku: false }, winner: "RED" as const, label: "Waza-ari" },
  { red: { ippon: 0, wazaari: 0, yuko: 0, shido: 0, hansoku: false }, blue: { ippon: 0, wazaari: 1, yuko: 0, shido: 0, hansoku: false }, winner: "BLUE" as const, label: "Waza-ari" },
  // 15% — победа по Шидо соперника
  { red: { ippon: 0, wazaari: 0, yuko: 0, shido: 0, hansoku: false }, blue: { ippon: 0, wazaari: 0, yuko: 0, shido: 3, hansoku: true }, winner: "RED" as const, label: "Hansoku" },
  { red: { ippon: 0, wazaari: 0, yuko: 0, shido: 3, hansoku: true }, blue: { ippon: 0, wazaari: 0, yuko: 0, shido: 0, hansoku: false }, winner: "BLUE" as const, label: "Hansoku" },
  // 10% — Золотой счёт
  { red: { ippon: 1, wazaari: 0, yuko: 0, shido: 0, hansoku: false }, blue: { ippon: 0, wazaari: 0, yuko: 0, shido: 0, hansoku: false }, winner: "RED" as const, label: "Golden Score" },
  { red: { ippon: 0, wazaari: 0, yuko: 0, shido: 0, hansoku: false }, blue: { ippon: 1, wazaari: 0, yuko: 0, shido: 0, hansoku: false }, winner: "BLUE" as const, label: "Golden Score" },
];

function pickOutcome() {
  return SCORE_OUTCOMES[Math.floor(Math.random() * SCORE_OUTCOMES.length)];
}

function makeScore(outcome: typeof SCORE_OUTCOMES[0], isGoldenScore: boolean) {
  return {
    red: outcome.red,
    blue: outcome.blue,
    isGoldenScore,
    osaekomi: null,
    clock: { running: false, elapsedSec: isGoldenScore ? 240 : Math.floor(100 + Math.random() * 120), runningStartedAt: null },
    pendingResult: null,
  };
}

async function main() {
  console.log("⚡ Completing demo tournament matches...\n");

  // Get all brackets for the tournament
  const brackets = await prisma.bracket.findMany({
    where: { tournamentId: TOURNAMENT_ID },
    select: { id: true, format: true, size: true },
  });

  console.log(`Found ${brackets.length} brackets`);

  let completed = 0;
  const startTime = new Date("2026-06-13T09:00:00Z");

  for (const bracket of brackets) {
    // Get all PENDING matches for this bracket, sorted by round
    const matches = await prisma.match.findMany({
      where: {
        bracketId: bracket.id,
        status: MatchStatus.PENDING,
      },
      orderBy: [{ round: "asc" }, { position: "asc" }],
    });

    // Process rounds in order — after completing round N, propagation fills round N+1
    let round = 0;
    let maxAttempts = 20;

    while (maxAttempts-- > 0) {
      const pending = await prisma.match.findMany({
        where: { bracketId: bracket.id, status: MatchStatus.PENDING },
        orderBy: [{ round: "asc" }, { position: "asc" }],
      });

      if (pending.length === 0) break;

      // Only process the lowest round available
      const lowestRound = pending[0].round;
      const currentRoundMatches = pending.filter(m => m.round === lowestRound);

      let processedAny = false;
      for (const match of currentRoundMatches) {
        const hasRed = Boolean(match.redAthleteId);
        const hasBlue = Boolean(match.blueAthleteId);

        if (!hasRed && !hasBlue) {
          // Empty slot — mark as completed with no winner (dead bracket path)
          await prisma.match.update({
            where: { id: match.id },
            data: { status: MatchStatus.COMPLETED, scoreSnapshot: { bye: true } as any },
          });
          completed++;
          processedAny = true;
          continue;
        }

        if (hasRed !== hasBlue) {
          // BYE: one athlete, auto-complete
          const winnerId = (match.redAthleteId ?? match.blueAthleteId)!;
          const matchStarted = new Date(startTime.getTime() + completed * 6 * 60 * 1000);
          const matchFinished = new Date(matchStarted.getTime() + 30 * 1000);

          await prisma.match.update({
            where: { id: match.id },
            data: {
              status: MatchStatus.COMPLETED,
              winnerId,
              startedAt: matchStarted,
              finishedAt: matchFinished,
              scoreSnapshot: { bye: true },
            },
          });

          await propagateWinner(
            { ...match, status: MatchStatus.PENDING },
            winnerId
          );
          completed++;
          processedAny = true;
          continue;
        }

        // Real match — pick a winner
        const outcome = pickOutcome();
        const isGoldenScore = outcome.label === "Golden Score";
        const winnerId = outcome.winner === "RED" ? match.redAthleteId! : match.blueAthleteId!;
        const durationSec = isGoldenScore ? 240 + Math.floor(Math.random() * 60) : Math.floor(60 + Math.random() * 160);
        const matchStarted = new Date(startTime.getTime() + completed * 7 * 60 * 1000);
        const matchFinished = new Date(matchStarted.getTime() + durationSec * 1000);

        const score = makeScore(outcome, isGoldenScore);

        await prisma.match.update({
          where: { id: match.id },
          data: {
            status: MatchStatus.COMPLETED,
            winnerId,
            startedAt: matchStarted,
            finishedAt: matchFinished,
            scoreSnapshot: score as any,
          },
        });

        // Advance winner through bracket
        await propagateWinner(
          { ...match, status: MatchStatus.PENDING },
          winnerId
        );

        completed++;
        processedAny = true;
      }

      if (!processedAny) {
        // No progress — break to avoid infinite loop
        break;
      }

      round++;
    }
  }

  console.log(`✅ Completed ${completed} matches\n`);

  // Recalculate ratings
  console.log("📊 Recalculating ratings...");
  try {
    const admin = await prisma.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } });
    if (!admin) throw new Error("No admin user found");
    const stats = await finalizeTournament(admin.id, TOURNAMENT_ID);
    console.log(`✅ Ratings done:`, stats);
  } catch (e) {
    console.error("⚠️  Rating calc error:", (e as Error).message);
  }

  // Final stats
  const [total, done, pending] = await Promise.all([
    prisma.match.count({ where: { tournamentId: TOURNAMENT_ID } }),
    prisma.match.count({ where: { tournamentId: TOURNAMENT_ID, status: MatchStatus.COMPLETED } }),
    prisma.match.count({ where: { tournamentId: TOURNAMENT_ID, status: MatchStatus.PENDING } }),
  ]);
  const ratingCount = await prisma.ratingEntry.count({
    where: { tournament: { id: TOURNAMENT_ID } },
  });

  console.log(`\n📈 Tournament: ${TOURNAMENT_ID}`);
  console.log(`   Total: ${total} | Done: ${done} | Pending: ${pending}`);
  console.log(`   Rating entries: ${ratingCount}`);
}

main()
  .catch((e) => { console.error("❌ Error:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
