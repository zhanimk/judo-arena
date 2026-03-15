const Match = require('../../models/Match');
const Tournament = require('../../models/Tournament');
const User = require('../../models/User');
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

async function assignMatchToTatami(authUser, matchId, payload) {
  if (authUser.role !== 'ADMIN') {
    throw new ApiError(403, 'Only admin can assign tatami', 'FORBIDDEN');
  }

  const match = await Match.findById(matchId);
  if (!match) {
    throw new ApiError(404, 'Match not found', 'MATCH_NOT_FOUND');
  }

  const tournament = await Tournament.findById(match.tournamentId);
  if (!tournament) {
    throw new ApiError(404, 'Tournament not found', 'TOURNAMENT_NOT_FOUND');
  }

  const { tatamiNumber, orderNumber, judgeId = null } = payload;

  if (tatamiNumber < 1 || tatamiNumber > tournament.tatamiCount) {
    throw new ApiError(
      400,
      'Tatami number is out of tournament range',
      'INVALID_TATAMI_NUMBER'
    );
  }

  if (judgeId) {
    const judge = await User.findById(judgeId);
    if (!judge || judge.role !== 'JUDGE') {
      throw new ApiError(400, 'Assigned user is not a judge', 'INVALID_JUDGE');
    }
    match.judgeId = judgeId;
  }

  match.tatamiNumber = tatamiNumber;
  if (orderNumber !== undefined && orderNumber !== null) {
    match.orderNumber = orderNumber;
  }

  await match.save();

  emitSafe(
    'tatami_queue_updated',
    {
      matchId: match._id,
      tatamiNumber: match.tatamiNumber,
      orderNumber: match.orderNumber,
      judgeId: match.judgeId,
    },
    match.tournamentId,
    match.tatamiNumber
  );

  return match;
}

async function reorderTatamiQueue(authUser, tournamentId, tatamiNumber, orderedMatchIds) {
  if (authUser.role !== 'ADMIN') {
    throw new ApiError(403, 'Only admin can reorder tatami queue', 'FORBIDDEN');
  }

  const tournament = await Tournament.findById(tournamentId);
  if (!tournament) {
    throw new ApiError(404, 'Tournament not found', 'TOURNAMENT_NOT_FOUND');
  }

  if (tatamiNumber < 1 || tatamiNumber > tournament.tatamiCount) {
    throw new ApiError(400, 'Invalid tatami number', 'INVALID_TATAMI_NUMBER');
  }

  const matches = await Match.find({
    _id: { $in: orderedMatchIds },
    tournamentId,
    tatamiNumber,
  });

  if (matches.length !== orderedMatchIds.length) {
    throw new ApiError(
      400,
      'Some matches do not belong to this tatami queue',
      'INVALID_TATAMI_QUEUE_MATCHES'
    );
  }

  for (let i = 0; i < orderedMatchIds.length; i += 1) {
    await Match.findByIdAndUpdate(orderedMatchIds[i], {
      orderNumber: i + 1,
    });
  }

  emitSafe(
    'tatami_queue_updated',
    {
      tournamentId,
      tatamiNumber,
      orderedMatchIds,
    },
    tournamentId,
    tatamiNumber
  );

  return { success: true };
}

module.exports = {
  assignMatchToTatami,
  reorderTatamiQueue,
};