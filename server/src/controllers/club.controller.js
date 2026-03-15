const asyncHandler = require('../utils/asyncHandler');
const clubService = require('../services/club.service');

const createClub = asyncHandler(async (req, res) => {
  const club = await clubService.createClub(req.user, req.body);

  res.status(201).json({
    success: true,
    message: 'Club created successfully',
    data: club,
  });
});

const getClubs = asyncHandler(async (req, res) => {
  const clubs = await clubService.getClubs(req.query);

  res.status(200).json({
    success: true,
    data: clubs,
  });
});

const getClubById = asyncHandler(async (req, res) => {
  const result = await clubService.getClubById(req.params.id);

  res.status(200).json({
    success: true,
    data: result,
  });
});

const updateClub = asyncHandler(async (req, res) => {
  const club = await clubService.updateClub(req.user, req.params.id, req.body);

  res.status(200).json({
    success: true,
    message: 'Club updated successfully',
    data: club,
  });
});

const sendJoinRequest = asyncHandler(async (req, res) => {
  const result = await clubService.sendJoinRequest(req.user, req.params.id);

  res.status(200).json({
    success: true,
    message: result.message,
  });
});

const approveAthlete = asyncHandler(async (req, res) => {
  const athlete = await clubService.approveAthlete(
    req.user,
    req.params.id,
    req.params.athleteId
  );

  res.status(200).json({
    success: true,
    message: 'Athlete approved successfully',
    data: athlete,
  });
});

const rejectAthlete = asyncHandler(async (req, res) => {
  const athlete = await clubService.rejectAthlete(
    req.user,
    req.params.id,
    req.params.athleteId
  );

  res.status(200).json({
    success: true,
    message: 'Athlete request rejected successfully',
    data: athlete,
  });
});

const removeAthlete = asyncHandler(async (req, res) => {
  const athlete = await clubService.removeAthlete(
    req.user,
    req.params.id,
    req.params.athleteId
  );

  res.status(200).json({
    success: true,
    message: 'Athlete removed from club successfully',
    data: athlete,
  });
});

module.exports = {
  createClub,
  getClubs,
  getClubById,
  updateClub,
  sendJoinRequest,
  approveAthlete,
  rejectAthlete,
  removeAthlete,
};