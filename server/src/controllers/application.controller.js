const asyncHandler = require('../utils/asyncHandler');
const applicationService = require('../services/application.service');

const createApplication = asyncHandler(async (req, res) => {
  const application = await applicationService.createApplication(req.user, req.body);

  res.status(201).json({
    success: true,
    message: 'Application created successfully',
    data: application,
  });
});

const updateApplication = asyncHandler(async (req, res) => {
  const application = await applicationService.updateApplication(
    req.user,
    req.params.id,
    req.body
  );

  res.status(200).json({
    success: true,
    message: 'Application updated successfully',
    data: application,
  });
});

const getMyApplications = asyncHandler(async (req, res) => {
  const applications = await applicationService.getMyApplications(req.user);

  res.status(200).json({
    success: true,
    data: applications,
  });
});


const getMyAthleteApplications = asyncHandler(async (req, res) => {
  const applications = await applicationService.getMyAthleteApplications(req.user);

  res.status(200).json({
    success: true,
    data: applications,
  });
});

const getApplicationById = asyncHandler(async (req, res) => {
  const application = await applicationService.getApplicationById(req.user, req.params.id);

  res.status(200).json({
    success: true,
    data: application,
  });
});

const getApplicationsByTournament = asyncHandler(async (req, res) => {
  const applications = await applicationService.getApplicationsByTournament(
    req.user,
    req.params.tournamentId
  );

  res.status(200).json({
    success: true,
    data: applications,
  });
});

const submitApplication = asyncHandler(async (req, res) => {
  const application = await applicationService.submitApplication(req.user, req.params.id);

  res.status(200).json({
    success: true,
    message: 'Application submitted successfully',
    data: application,
  });
});

const markUnderReview = asyncHandler(async (req, res) => {
  const application = await applicationService.markApplicationUnderReview(
    req.user,
    req.params.id
  );

  res.status(200).json({
    success: true,
    message: 'Application moved to review successfully',
    data: application,
  });
});

const approveApplication = asyncHandler(async (req, res) => {
  const application = await applicationService.approveApplication(req.user, req.params.id);

  res.status(200).json({
    success: true,
    message: 'Application approved successfully',
    data: application,
  });
});

const rejectApplication = asyncHandler(async (req, res) => {
  const application = await applicationService.rejectApplication(
    req.user,
    req.params.id,
    req.body.reviewComment
  );

  res.status(200).json({
    success: true,
    message: 'Application rejected successfully',
    data: application,
  });
});

module.exports = {
  createApplication,
  updateApplication,
  getMyApplications,
  getMyAthleteApplications,
  getApplicationById,
  getApplicationsByTournament,
  submitApplication,
  markUnderReview,
  approveApplication,
  rejectApplication,
};