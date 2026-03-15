const Match = require('../../models/Match');
const ApiError = require('../../utils/ApiError');
const progressionService = require('./match-progression.service');

async function adminOverrideResult(authUser, matchId, payload) {

  if (authUser.role !== 'ADMIN') {
    throw new ApiError(403, 'Only admin can override match result', 'FORBIDDEN');
  }

  const match = await Match.findById(matchId);

  if (!match) {
    throw new ApiError(404, 'Match not found', 'MATCH_NOT_FOUND');
  }

  const { winnerSlot, scoreA, scoreB, penaltiesA, penaltiesB, reason } = payload;

  if (!['A','B'].includes(winnerSlot)) {
    throw new ApiError(400, 'winnerSlot must be A or B', 'INVALID_WINNER_SLOT');
  }

  const athleteA = match.slotA?.athleteId;
  const athleteB = match.slotB?.athleteId;

  const winnerId = winnerSlot === 'A' ? athleteA : athleteB;
  const loserId = winnerSlot === 'A' ? athleteB : athleteA;

  if (!winnerId) {
    throw new ApiError(400, 'Winner athlete missing', 'INVALID_WINNER');
  }

  if (scoreA !== undefined) match.scoreA = scoreA;
  if (scoreB !== undefined) match.scoreB = scoreB;
  if (penaltiesA !== undefined) match.penaltiesA = penaltiesA;
  if (penaltiesB !== undefined) match.penaltiesB = penaltiesB;

  match.winnerId = winnerId;
  match.loserId = loserId;
  match.status = 'COMPLETED';
  match.endedAt = new Date();

  match.adminFlags = {
    manuallyEdited: true,
    underAdminControl: true
  };

  match.auditMeta = {
    lastEditedBy: authUser._id,
    lastEditReason: reason || "Admin override"
  };

  await match.save();

  await progressionService.finishMatch(authUser, matchId, {
    winnerSlot
  });

  return match;
}

async function markReplayRequired(authUser, matchId) {

  if (authUser.role !== 'ADMIN') {
    throw new ApiError(403, 'Only admin can require replay', 'FORBIDDEN');
  }

  const match = await Match.findById(matchId);

  if (!match) {
    throw new ApiError(404, 'Match not found', 'MATCH_NOT_FOUND');
  }

  match.status = "REPLAY_REQUIRED";
  match.winnerId = null;
  match.loserId = null;

  await match.save();

  return match;
}

module.exports = {
  adminOverrideResult,
  markReplayRequired
};