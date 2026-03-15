const asyncHandler = require('../utils/asyncHandler');
const bracketService = require('../services/bracket.service');

const generateBrackets = asyncHandler(async (req, res) => {
  const brackets = await bracketService.generateBrackets(req.user, req.params.tournamentId);

  res.status(201).json({
    success: true,
    message: 'Brackets generated successfully',
    data: brackets,
  });
});

const getBracketsByTournament = asyncHandler(async (req, res) => {
  const brackets = await bracketService.getBracketsByTournament(
    req.user,
    req.params.tournamentId
  );

  res.status(200).json({
    success: true,
    data: brackets,
  });
});

const getBracketById = asyncHandler(async (req, res) => {
  const bracket = await bracketService.getBracketById(req.user, req.params.id);

  res.status(200).json({
    success: true,
    data: bracket,
  });
});

const getBracketMatches = asyncHandler(async (req, res) => {
  const matches = await bracketService.getBracketMatches(req.user, req.params.id);

  res.status(200).json({
    success: true,
    data: matches,
  });
});

module.exports = {
  generateBrackets,
  getBracketsByTournament,
  getBracketById,
  getBracketMatches,
};