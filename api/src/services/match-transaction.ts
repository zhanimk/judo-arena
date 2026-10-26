import { MatchError } from "./match-types.js";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

/** Retry only aborted database transactions, never a command with an ambiguous commit. */
export async function withSerializableMatchTransaction<T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 30_000,
      });
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== "P2034" ||
        attempt >= 8
      )
        throw error;
      await new Promise((resolve) =>
        setTimeout(
          resolve,
          Math.min(25 * 2 ** attempt, 500) + Math.floor(Math.random() * 50),
        ),
      );
    }
  }
}

/** Read within the write transaction so cancellation/finalization cannot race result commits. */
export async function assertTournamentAcceptsResults(
  tx: Prisma.TransactionClient,
  tournamentId: string,
): Promise<void> {
  const tournament = await tx.tournament.findUnique({
    where: { id: tournamentId },
    select: { status: true },
  });
  if (!tournament)
    throw new MatchError("TOURNAMENT_NOT_FOUND", "Турнир не найден", 404);
  if (tournament.status === "CANCELLED" || tournament.status === "COMPLETED")
    throw new MatchError(
      "TOURNAMENT_FINALIZED",
      "Турнир завершён или отменён",
      409,
    );
}
