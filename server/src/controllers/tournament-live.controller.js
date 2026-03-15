const asyncHandler = require('../utils/asyncHandler');
const tournamentLiveService = require('../services/tournament-live.service');

const startTournament = asyncHandler(async (req, res) => {
  const tournament = await tournamentLiveService.startTournament(req.user, req.params.id);

  res.status(200).json({
    success: true,
    message: 'Tournament started successfully',
    data: tournament,
  });
});

const pauseTournament = asyncHandler(async (req, res) => {
  const tournament = await tournamentLiveService.pauseTournament(req.user, req.params.id);

  res.status(200).json({
    success: true,
    message: 'Tournament paused successfully',
    data: tournament,
  });
});

const resumeTournament = asyncHandler(async (req, res) => {
  const tournament = await tournamentLiveService.resumeTournament(req.user, req.params.id);

  res.status(200).json({
    success: true,
    message: 'Tournament resumed successfully',
    data: tournament,
  });
});

const completeTournament = asyncHandler(async (req, res) => {
  const tournament = await tournamentLiveService.completeTournament(req.user, req.params.id);

  res.status(200).json({
    success: true,
    message: 'Tournament completed successfully',
    data: tournament,
  });
});

const getTournamentLiveState = asyncHandler(async (req, res) => {
  const data = await tournamentLiveService.getTournamentLiveState(req.user, req.params.id);

  res.status(200).json({
    success: true,
    data,
  });
});

module.exports = {
  startTournament,
  pauseTournament,
  resumeTournament,
  completeTournament,
  getTournamentLiveState,
};