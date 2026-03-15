const Match = require('../../models/Match');
const ApiError = require('../../utils/ApiError');
const { getIO } = require('../../config/socket');

function emitSafe(eventName, payload, tournamentId, tatamiNumber) {
  try {
    const io = getIO();
    io.to(`tournament:${tournamentId}`).emit(eventName, payload);

    if (tatamiNumber) {
      io.to(`tatami:${tatamiNumber}`).emit(eventName, payload);
    }
  } catch (error) {
    // ignore socket errors
  }
}

function buildAdvancedSlot(athleteId, sourceType, sourceMatchId, sourceOutcome, displayNameSnapshot, clubIdSnapshot) {
  return {
    athleteId,
    sourceType,
    sourceMatchId,
    sourceOutcome,
    isBye: false,
    displayNameSnapshot: displayNameSnapshot || null,
    clubIdSnapshot: clubIdSnapshot || null,
  };
}

function determineWinnerAndLoser(match, winnerSlot) {
  if (!['A', 'B'].includes(winnerSlot)) {
    throw new ApiError(400, 'winnerSlot must be A or B', 'INVALID_WINNER_SLOT');
  }

  const athleteA = match.slotA?.athleteId || null;
  const athleteB = match.slotB?.athleteId || null;

  if (!athleteA && !athleteB) {
    throw new ApiError(400, 'Match has no athletes', 'MATCH_HAS_NO_ATHLETES');
  }

  if (winnerSlot === 'A') {
    if (!athleteA) {
      throw new ApiError(400, 'Slot A athlete is missing', 'INVALID_WINNER_SLOT');
    }
    return {
      winnerId: athleteA,
      loserId: athleteB || null,
      winnerSlotData: match.slotA,
    };
  }

  if (!athleteB) {
    throw new ApiError(400, 'Slot B athlete is missing', 'INVALID_WINNER_SLOT');
  }

  return {
    winnerId: athleteB,
    loserId: athleteA || null,
    winnerSlotData: match.slotB,
  };
}

function shouldAutoReady(match) {
  const slotAReady = Boolean(match.slotA?.athleteId) || Boolean(match.slotA?.isBye);
  const slotBReady = Boolean(match.slotB?.athleteId) || Boolean(match.slotB?.isBye);

  return slotAReady && slotBReady;
}

async function pushWinnerToNextMatch(match, winnerId, winnerSlotData) {
  if (!match.winnerTargetMatchId || !match.winnerTargetSlot) {
    return null;
  }

  const nextMatch = await Match.findById(match.winnerTargetMatchId);
  if (!nextMatch) {
    throw new ApiError(404, 'Next match not found', 'NEXT_MATCH_NOT_FOUND');
  }

  const advancedSlot = buildAdvancedSlot(
    winnerId,
    'WINNER_OF_MATCH',
    match._id,
    'WINNER',
    winnerSlotData?.displayNameSnapshot || null,
    winnerSlotData?.clubIdSnapshot || null
  );

  if (match.winnerTargetSlot === 'A') {
    nextMatch.slotA = advancedSlot;
  } else {
    nextMatch.slotB = advancedSlot;
  }

  if (shouldAutoReady(nextMatch)) {
    nextMatch.status = 'READY';
  }

  await nextMatch.save();
  return nextMatch;
}

async function finishMatch(authUser, matchId, payload) {
  const match = await Match.findById(matchId);

  if (!match) {
    throw new ApiError(404, 'Match not found', 'MATCH_NOT_FOUND');
  }

  if (authUser.role === 'JUDGE') {
    if (!match.judgeId || String(match.judgeId) !== String(authUser._id)) {
      throw new ApiError(403, 'Judge is not assigned to this match', 'FORBIDDEN');
    }
  }

  if (!['IN_PROGRESS', 'READY'].includes(match.status)) {
    throw new ApiError(409, 'Match cannot be finished in current state', 'MATCH_FINISH_NOT_ALLOWED');
  }

  const { winnerId, loserId, winnerSlotData } = determineWinnerAndLoser(match, payload.winnerSlot);

  if (payload.scoreA !== undefined) match.scoreA = payload.scoreA;
  if (payload.scoreB !== undefined) match.scoreB = payload.scoreB;
  if (payload.penaltiesA !== undefined) match.penaltiesA = payload.penaltiesA;
  if (payload.penaltiesB !== undefined) match.penaltiesB = payload.penaltiesB;

  match.winnerId = winnerId;
  match.loserId = loserId;
  match.status = 'COMPLETED';
  match.endedAt = new Date();

  await match.save();

  const nextMatch = await pushWinnerToNextMatch(match, winnerId, winnerSlotData);

  emitSafe(
    'match_completed',
    {
      matchId: match._id,
      winnerId: match.winnerId,
      loserId: match.loserId,
      status: match.status,
    },
    match.tournamentId,
    match.tatamiNumber
  );

  emitSafe(
    'bracket_updated',
    {
      bracketId: match.bracketId,
      categoryKey: match.categoryKey,
      updatedMatchId: match._id,
      nextMatchId: nextMatch?._id || null,
    },
    match.tournamentId,
    match.tatamiNumber
  );

  return {
    match,
    nextMatch,
  };
}

module.exports = {
  finishMatch,
};