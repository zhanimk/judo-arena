const asyncHandler = require('../utils/asyncHandler');
const matchService = require('../services/match.service');


const getMatchesByTournament = asyncHandler(async (req, res) => {
  const matches = await matchService.getMatchesByTournament(req.user, req.params.tournamentId);

  res.status(200).json({
    success: true,
    data: matches,
  });
});

const getMatchById = asyncHandler(async (req, res) => {
  const match = await matchService.getMatchById(req.params.id);

  res.status(200).json({
    success: true,
    data: match,
  });
});

const startMatch = asyncHandler(async (req, res) => {
  const match = await matchService.startMatch(req.user, req.params.id);

  res.status(200).json({
    success: true,
    message: 'Match started successfully',
    data: match,
  });
});

const updateScore = asyncHandler(async (req, res) => {
  const match = await matchService.updateScore(req.user, req.params.id, req.body);

  res.status(200).json({
    success: true,
    message: 'Score updated successfully',
    data: match,
  });
});

const updatePenalties = asyncHandler(async (req, res) => {
  const match = await matchService.updatePenalties(req.user, req.params.id, req.body);

  res.status(200).json({
    success: true,
    message: 'Penalties updated successfully',
    data: match,
  });
});

const finishMatch = asyncHandler(async (req, res) => {
  const result = await matchService.finishMatch(req.user, req.params.id, req.body);

  res.status(200).json({
    success: true,
    message: 'Match finished successfully',
    data: result,
  });
});

const reopenMatch = asyncHandler(async (req, res) => {
  const match = await matchService.reopenMatch(
    req.user,
    req.params.id,
    req.body.reason || null
  );

  res.status(200).json({
    success: true,
    message: 'Match reopened successfully',
    data: match,
  });
});

module.exports = {
  getMatchesByTournament,
  getMatchById,
  startMatch,
  updateScore,
  updatePenalties,
  finishMatch,
  reopenMatch,
};