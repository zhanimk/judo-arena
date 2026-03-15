const asyncHandler = require('../utils/asyncHandler');
const tournamentService = require('../services/tournament.service');

const createTournament = asyncHandler(async (req, res) => {
  const tournament = await tournamentService.createTournament(req.user, req.body);

  res.status(201).json({
    success: true,
    message: 'Tournament created successfully',
    data: tournament,
  });
});

const getTournaments = asyncHandler(async (req, res) => {
  const tournaments = await tournamentService.getTournaments(req.user, req.query);

  res.status(200).json({
    success: true,
    data: tournaments,
  });
});

const getTournamentById = asyncHandler(async (req, res) => {
  const tournament = await tournamentService.getTournamentById(req.user, req.params.id);

  res.status(200).json({
    success: true,
    data: tournament,
  });
});

const updateTournament = asyncHandler(async (req, res) => {
  const tournament = await tournamentService.updateTournament(
    req.user,
    req.params.id,
    req.body
  );

  res.status(200).json({
    success: true,
    message: 'Tournament updated successfully',
    data: tournament,
  });
});

const deleteTournament = asyncHandler(async (req, res) => {
  const result = await tournamentService.deleteTournament(req.user, req.params.id);

  res.status(200).json({
    success: true,
    message: 'Tournament deleted successfully',
    data: result,
  });
});

const updateTournamentStatus = asyncHandler(async (req, res) => {
  const tournament = await tournamentService.updateTournamentStatus(
    req.user,
    req.params.id,
    req.body.status
  );

  res.status(200).json({
    success: true,
    message: 'Tournament status updated successfully',
    data: tournament,
  });
});

const updateTournamentVisibility = asyncHandler(async (req, res) => {
  const tournament = await tournamentService.updateTournamentVisibility(
    req.user,
    req.params.id,
    req.body.visibility
  );

  res.status(200).json({
    success: true,
    message: 'Tournament visibility updated successfully',
    data: tournament,
  });
});

const publishTournament = asyncHandler(async (req, res) => {
  const tournament = await tournamentService.publishTournament(req.user, req.params.id);

  res.status(200).json({
    success: true,
    message: 'Tournament published successfully',
    data: tournament,
  });
});

const unpublishTournament = asyncHandler(async (req, res) => {
  const tournament = await tournamentService.unpublishTournament(req.user, req.params.id);

  res.status(200).json({
    success: true,
    message: 'Tournament unpublished successfully',
    data: tournament,
  });
});

const archiveTournament = asyncHandler(async (req, res) => {
  const tournament = await tournamentService.archiveTournament(req.user, req.params.id);

  res.status(200).json({
    success: true,
    message: 'Tournament archived successfully',
    data: tournament,
  });
});

const restoreTournament = asyncHandler(async (req, res) => {
  const tournament = await tournamentService.restoreTournament(req.user, req.params.id);

  res.status(200).json({
    success: true,
    message: 'Tournament restored successfully',
    data: tournament,
  });
});

const updateTournamentCategories = asyncHandler(async (req, res) => {
  const tournament = await tournamentService.updateTournamentCategories(
    req.user,
    req.params.id,
    req.body.categories
  );

  res.status(200).json({
    success: true,
    message: 'Tournament categories updated successfully',
    data: tournament,
  });
});

module.exports = {
  createTournament,
  getTournaments,
  getTournamentById,
  updateTournament,
  deleteTournament,
  updateTournamentStatus,
  updateTournamentVisibility,
  publishTournament,
  unpublishTournament,
  archiveTournament,
  restoreTournament,
  updateTournamentCategories,
};