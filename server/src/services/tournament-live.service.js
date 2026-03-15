const Tournament = require('../models/Tournament');
const Bracket = require('../models/Bracket');
const Match = require('../models/Match');
const ApiError = require('../utils/ApiError');
const { getIO } = require('../config/socket');

function emitSafe(eventName, payload, tournamentId) {
  try {
    const io = getIO();
    io.to(`tournament:${tournamentId}`).emit(eventName, payload);
  } catch (error) {
    // ignore socket errors
  }
}

async function startTournament(authUser, tournamentId) {
  if (authUser.role !== 'ADMIN') {
    throw new ApiError(403, 'Only admin can start tournament', 'FORBIDDEN');
  }

  const tournament = await Tournament.findById(tournamentId);
  if (!tournament) {
    throw new ApiError(404, 'Tournament not found', 'TOURNAMENT_NOT_FOUND');
  }

  if (tournament.status !== 'BRACKETS_GENERATED') {
    throw new ApiError(
      409,
      'Tournament can only be started after bracket generation',
      'TOURNAMENT_START_NOT_ALLOWED'
    );
  }

  const bracketCount = await Bracket.countDocuments({ tournamentId });
  if (!bracketCount) {
    throw new ApiError(409, 'Tournament has no brackets', 'BRACKETS_REQUIRED');
  }

  tournament.status = 'IN_PROGRESS';
  await tournament.save();

  emitSafe(
    'tournament_updated',
    {
      tournamentId: tournament._id,
      status: tournament.status,
    },
    tournament._id
  );

  return tournament;
}

async function pauseTournament(authUser, tournamentId) {
  if (authUser.role !== 'ADMIN') {
    throw new ApiError(403, 'Only admin can pause tournament', 'FORBIDDEN');
  }

  const tournament = await Tournament.findById(tournamentId);
  if (!tournament) {
    throw new ApiError(404, 'Tournament not found', 'TOURNAMENT_NOT_FOUND');
  }

  if (tournament.status !== 'IN_PROGRESS') {
    throw new ApiError(
      409,
      'Only in-progress tournament can be paused',
      'TOURNAMENT_PAUSE_NOT_ALLOWED'
    );
  }

  tournament.status = 'PAUSED';
  await tournament.save();

  emitSafe(
    'tournament_updated',
    {
      tournamentId: tournament._id,
      status: tournament.status,
    },
    tournament._id
  );

  return tournament;
}

async function resumeTournament(authUser, tournamentId) {
  if (authUser.role !== 'ADMIN') {
    throw new ApiError(403, 'Only admin can resume tournament', 'FORBIDDEN');
  }

  const tournament = await Tournament.findById(tournamentId);
  if (!tournament) {
    throw new ApiError(404, 'Tournament not found', 'TOURNAMENT_NOT_FOUND');
  }

  if (tournament.status !== 'PAUSED') {
    throw new ApiError(
      409,
      'Only paused tournament can be resumed',
      'TOURNAMENT_RESUME_NOT_ALLOWED'
    );
  }

  tournament.status = 'IN_PROGRESS';
  await tournament.save();

  emitSafe(
    'tournament_updated',
    {
      tournamentId: tournament._id,
      status: tournament.status,
    },
    tournament._id
  );

  return tournament;
}

async function completeTournament(authUser, tournamentId) {
  if (authUser.role !== 'ADMIN') {
    throw new ApiError(403, 'Only admin can complete tournament', 'FORBIDDEN');
  }

  const tournament = await Tournament.findById(tournamentId);
  if (!tournament) {
    throw new ApiError(404, 'Tournament not found', 'TOURNAMENT_NOT_FOUND');
  }

  const unfinishedMatches = await Match.countDocuments({
    tournamentId,
    status: { $in: ['READY', 'IN_PROGRESS', 'REPLAY_REQUIRED', 'UNDER_REVIEW', 'PENDING'] },
  });

  if (unfinishedMatches > 0) {
    throw new ApiError(
      409,
      'Tournament has unfinished matches',
      'TOURNAMENT_COMPLETE_NOT_ALLOWED'
    );
  }

  tournament.status = 'COMPLETED';
  await tournament.save();

  emitSafe(
    'tournament_updated',
    {
      tournamentId: tournament._id,
      status: tournament.status,
    },
    tournament._id
  );

  return tournament;
}

async function getTournamentLiveState(authUser, tournamentId) {
  const tournament = await Tournament.findById(tournamentId);
  if (!tournament) {
    throw new ApiError(404, 'Tournament not found', 'TOURNAMENT_NOT_FOUND');
  }

  const brackets = await Bracket.find({ tournamentId });
  const activeMatches = await Match.find({
    tournamentId,
    status: { $in: ['READY', 'IN_PROGRESS', 'REPLAY_REQUIRED', 'UNDER_REVIEW'] },
  })
    .populate('slotA.athleteId', 'fullName')
    .populate('slotB.athleteId', 'fullName')
    .populate('judgeId', 'fullName')
    .sort({ tatamiNumber: 1, orderNumber: 1 });

  const completedMatchesCount = await Match.countDocuments({
    tournamentId,
    status: 'COMPLETED',
  });

  const totalMatchesCount = await Match.countDocuments({ tournamentId });

  return {
    tournament,
    summary: {
      totalBrackets: brackets.length,
      totalMatches: totalMatchesCount,
      completedMatches: completedMatchesCount,
      activeMatches: activeMatches.length,
    },
    activeMatches,
  };
}

module.exports = {
  startTournament,
  pauseTournament,
  resumeTournament,
  completeTournament,
  getTournamentLiveState,
};