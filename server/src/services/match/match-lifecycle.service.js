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
    // socket may not be initialized in tests or early boot
  }
}

async function getMatchById(matchId) {
  const match = await Match.findById(matchId)
    .populate('slotA.athleteId', 'fullName clubId weight rank')
    .populate('slotB.athleteId', 'fullName clubId weight rank')
    .populate('winnerId', 'fullName')
    .populate('loserId', 'fullName')
    .populate('judgeId', 'fullName email role');

  if (!match) {
    throw new ApiError(404, 'Match not found', 'MATCH_NOT_FOUND');
  }

  return match;
}

function isMatchReady(match) {
  const slotAReady = Boolean(match.slotA?.athleteId) || Boolean(match.slotA?.isBye);
  const slotBReady = Boolean(match.slotB?.athleteId) || Boolean(match.slotB?.isBye);

  return slotAReady && slotBReady;
}

async function startMatch(authUser, matchId) {
  const match = await Match.findById(matchId);

  if (!match) {
    throw new ApiError(404, 'Match not found', 'MATCH_NOT_FOUND');
  }

  if (authUser.role === 'JUDGE') {
    if (!match.judgeId || String(match.judgeId) !== String(authUser._id)) {
      throw new ApiError(403, 'Judge is not assigned to this match', 'FORBIDDEN');
    }
  }

  if (!['READY', 'REPLAY_REQUIRED'].includes(match.status)) {
    throw new ApiError(
      409,
      'Only READY or REPLAY_REQUIRED match can be started',
      'MATCH_START_NOT_ALLOWED'
    );
  }

  if (!isMatchReady(match)) {
    throw new ApiError(409, 'Match slots are not ready', 'MATCH_NOT_READY');
  }

  match.status = 'IN_PROGRESS';
  match.startedAt = new Date();

  await match.save();

  emitSafe(
    'match_updated',
    { matchId: match._id, status: match.status, startedAt: match.startedAt },
    match.tournamentId,
    match.tatamiNumber
  );

  return match;
}

async function reopenMatch(authUser, matchId, reason = null) {
  if (!['ADMIN'].includes(authUser.role)) {
    throw new ApiError(403, 'Only admin can reopen match', 'FORBIDDEN');
  }

  const match = await Match.findById(matchId);
  if (!match) {
    throw new ApiError(404, 'Match not found', 'MATCH_NOT_FOUND');
  }

  if (!['COMPLETED', 'UNDER_REVIEW', 'REPLAY_REQUIRED'].includes(match.status)) {
    throw new ApiError(409, 'Match cannot be reopened', 'MATCH_REOPEN_NOT_ALLOWED');
  }

  match.status = 'READY';
  match.winnerId = null;
  match.loserId = null;
  match.endedAt = null;
  match.auditMeta = {
    ...match.auditMeta,
    lastEditedBy: authUser._id,
    lastEditReason: reason || 'Match reopened by admin',
  };
  match.adminFlags = {
    ...match.adminFlags,
    manuallyEdited: true,
    underAdminControl: true,
  };

  await match.save();

  emitSafe(
    'match_updated',
    { matchId: match._id, status: match.status },
    match.tournamentId,
    match.tatamiNumber
  );

  return match;
}

module.exports = {
  getMatchById,
  startMatch,
  reopenMatch,
};