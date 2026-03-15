const Match = require('../../models/Match');
const ApiError = require('../../utils/ApiError');

async function getTatamiQueue(authUser, tatamiNumber) {
  if (!['JUDGE', 'ADMIN'].includes(authUser.role)) {
    throw new ApiError(403, 'Only judge or admin can view tatami queue', 'FORBIDDEN');
  }

  const query = {
    tatamiNumber,
    status: { $in: ['READY', 'IN_PROGRESS', 'REPLAY_REQUIRED'] },
  };

  if (authUser.role === 'JUDGE') {
    query.judgeId = authUser._id;
  }

  const queue = await Match.find(query)
    .populate('slotA.athleteId', 'fullName clubId weight rank')
    .populate('slotB.athleteId', 'fullName clubId weight rank')
    .populate('winnerId', 'fullName')
    .populate('loserId', 'fullName')
    .populate('judgeId', 'fullName email role')
    .sort({ orderNumber: 1, roundNumber: 1, matchNumber: 1 });

  return queue;
}

async function getJudgeMatchBoard(authUser, matchId) {
  if (!['JUDGE', 'ADMIN'].includes(authUser.role)) {
    throw new ApiError(403, 'Only judge or admin can view judge board', 'FORBIDDEN');
  }

  const match = await Match.findById(matchId)
    .populate('slotA.athleteId', 'fullName clubId weight rank gender')
    .populate('slotB.athleteId', 'fullName clubId weight rank gender')
    .populate('judgeId', 'fullName email role');

  if (!match) {
    throw new ApiError(404, 'Match not found', 'MATCH_NOT_FOUND');
  }

  if (authUser.role === 'JUDGE') {
    if (!match.judgeId || String(match.judgeId._id) !== String(authUser._id)) {
      throw new ApiError(403, 'Judge is not assigned to this match', 'FORBIDDEN');
    }
  }

  return match;
}

module.exports = {
  getTatamiQueue,
  getJudgeMatchBoard,
};