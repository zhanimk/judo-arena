const Application = require('../models/Application');
const Tournament = require('../models/Tournament');
const Club = require('../models/Club');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const notificationService = require('./notification.service');
const auditService = require('./audit.service');
const { getIO } = require('../config/socket');

const APPLICATION_STATUSES = ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'];

function assertCoachOrAdmin(user) {
  if (!['COACH', 'ADMIN'].includes(user.role)) {
    throw new ApiError(403, 'Only coach or admin can perform this action', 'FORBIDDEN');
  }
}

async function createApplication(authUser, payload) {
  assertCoachOrAdmin(authUser);

  if (authUser.role !== 'ADMIN') {
    const coachClub = await Club.findOne({ coachId: authUser._id });
    if (!coachClub) {
      throw new ApiError(404, 'Coach does not own a club', 'CLUB_NOT_FOUND');
    }

    if (String(coachClub._id) !== String(payload.clubId)) {
      throw new ApiError(
        403,
        'Coach can create application only for own club',
        'FORBIDDEN'
      );
    }
  }

  const tournament = await Tournament.findById(payload.tournamentId);
  if (!tournament) {
    throw new ApiError(404, 'Tournament not found', 'TOURNAMENT_NOT_FOUND');
  }

  if (!['DRAFT', 'REGISTRATION_OPEN'].includes(tournament.status)) {
    throw new ApiError(
      409,
      'Applications can only be created before registration closes',
      'TOURNAMENT_REGISTRATION_CLOSED'
    );
  }

  const club = await Club.findById(payload.clubId);
  if (!club) {
    throw new ApiError(404, 'Club not found', 'CLUB_NOT_FOUND');
  }

  const existingApplication = await Application.findOne({
    tournamentId: payload.tournamentId,
    clubId: payload.clubId,
  });

  if (existingApplication) {
    throw new ApiError(
      409,
      'Application for this club and tournament already exists',
      'APPLICATION_ALREADY_EXISTS'
    );
  }

  if (payload.athletes && payload.athletes.length > 0) {
    const athletes = await User.find({
      _id: { $in: payload.athletes },
      role: 'ATHLETE',
      clubId: payload.clubId,
    });

    if (athletes.length !== payload.athletes.length) {
      throw new ApiError(
        400,
        'Some athletes are invalid or do not belong to this club',
        'INVALID_ATHLETES'
      );
    }
  }

  const application = await Application.create({
    tournamentId: payload.tournamentId,
    clubId: payload.clubId,
    coachId: authUser.role === 'ADMIN' ? payload.coachId || club.coachId : authUser._id,
    athletes: payload.athletes || [],
    documents: payload.documents || [],
    status: 'DRAFT',
  });

  return application;
}

async function updateApplication(authUser, applicationId, payload) {
  const application = await Application.findById(applicationId);

  if (!application) {
    throw new ApiError(404, 'Application not found', 'APPLICATION_NOT_FOUND');
  }

  if (authUser.role !== 'ADMIN' && String(application.coachId) !== String(authUser._id)) {
    throw new ApiError(403, 'You can update only your own application', 'FORBIDDEN');
  }

  if (!['DRAFT', 'REJECTED'].includes(application.status)) {
    throw new ApiError(
      409,
      'Only DRAFT or REJECTED applications can be edited',
      'APPLICATION_LOCKED'
    );
  }

  if (payload.athletes) {
    const athletes = await User.find({
      _id: { $in: payload.athletes },
      role: 'ATHLETE',
      clubId: application.clubId,
    });

    if (athletes.length !== payload.athletes.length) {
      throw new ApiError(
        400,
        'Some athletes are invalid or do not belong to this club',
        'INVALID_ATHLETES'
      );
    }

    application.athletes = payload.athletes;
  }

  if (payload.documents) {
    application.documents = payload.documents;
  }

  await application.save();

  return application;
}

async function getMyApplications(authUser) {
  if (authUser.role === 'COACH') {
    return Application.find({ coachId: authUser._id })
      .populate('tournamentId', 'title status startDate endDate')
      .populate('clubId', 'name city')
      .populate('athletes', 'fullName weight rank clubId')
      .populate('documents')
      .sort({ createdAt: -1 });
  }

  if (authUser.role === 'ADMIN') {
    return Application.find({})
      .populate('tournamentId', 'title status startDate endDate')
      .populate('clubId', 'name city')
      .populate('coachId', 'fullName email')
      .sort({ createdAt: -1 });
  }

  throw new ApiError(403, 'Only coach or admin can view applications list', 'FORBIDDEN');
}

async function getApplicationById(authUser, applicationId) {
  const application = await Application.findById(applicationId)
    .populate('tournamentId', 'title status startDate endDate registrationDeadline')
    .populate('clubId', 'name city')
    .populate('coachId', 'fullName email')
    .populate('athletes', 'fullName gender dateOfBirth city weight rank clubId')
    .populate('documents');

  if (!application) {
    throw new ApiError(404, 'Application not found', 'APPLICATION_NOT_FOUND');
  }

  if (
    authUser.role !== 'ADMIN' &&
    String(application.coachId._id) !== String(authUser._id)
  ) {
    throw new ApiError(403, 'You can access only your own application', 'FORBIDDEN');
  }

  return application;
}

async function getApplicationsByTournament(authUser, tournamentId) {
  if (authUser.role !== 'ADMIN') {
    throw new ApiError(403, 'Only admin can view tournament applications', 'FORBIDDEN');
  }

  const applications = await Application.find({ tournamentId })
    .populate('clubId', 'name city')
    .populate('coachId', 'fullName email')
    .populate('athletes', 'fullName gender dateOfBirth city weight rank clubId')
    .populate('documents')
    .sort({ createdAt: -1 });

  return applications;
}

async function submitApplication(authUser, applicationId) {
  const application = await Application.findById(applicationId);

  if (!application) {
    throw new ApiError(404, 'Application not found', 'APPLICATION_NOT_FOUND');
  }

  if (authUser.role !== 'ADMIN' && String(application.coachId) !== String(authUser._id)) {
    throw new ApiError(403, 'You can submit only your own application', 'FORBIDDEN');
  }

  if (!['DRAFT', 'REJECTED'].includes(application.status)) {
    throw new ApiError(
      409,
      'Only DRAFT or REJECTED applications can be submitted',
      'APPLICATION_SUBMIT_NOT_ALLOWED'
    );
  }

  if (!application.athletes || application.athletes.length === 0) {
    throw new ApiError(
      400,
      'Application must contain at least one athlete',
      'APPLICATION_EMPTY'
    );
  }

  const tournament = await Tournament.findById(application.tournamentId);
  if (!tournament) {
    throw new ApiError(404, 'Tournament not found', 'TOURNAMENT_NOT_FOUND');
  }

  if (tournament.status !== 'REGISTRATION_OPEN') {
    throw new ApiError(
      409,
      'Applications can only be submitted while registration is open',
      'REGISTRATION_NOT_OPEN'
    );
  }

  application.status = 'SUBMITTED';
  application.submittedAt = new Date();

  await application.save();

  return application;
}

async function approveApplication(authUser, applicationId) {
  if (authUser.role !== 'ADMIN') {
    throw new ApiError(403, 'Only admin can approve applications', 'FORBIDDEN');
  }

  const application = await Application.findById(applicationId);

  if (!application) {
    throw new ApiError(404, 'Application not found', 'APPLICATION_NOT_FOUND');
  }

  if (!['SUBMITTED', 'UNDER_REVIEW'].includes(application.status)) {
    throw new ApiError(
      409,
      'Only submitted or reviewing applications can be approved',
      'APPLICATION_APPROVE_NOT_ALLOWED'
    );
  }

  const before = {
    status: application.status,
    reviewComment: application.reviewComment,
    reviewedAt: application.reviewedAt,
  };

  application.status = 'APPROVED';
  application.reviewedAt = new Date();
  application.reviewComment = null;

  await application.save();

  await auditService.recordAuditEvent({
    actorId: authUser._id,
    actorRole: authUser.role,
    action: 'APPLICATION_APPROVED',
    entityType: 'Application',
    entityId: application._id,
    before,
    after: {
      status: application.status,
      reviewComment: application.reviewComment,
      reviewedAt: application.reviewedAt,
    },
    meta: {
      tournamentId: application.tournamentId,
      clubId: application.clubId,
      coachId: application.coachId,
    },
  });

  await notificationService.createNotification({
    userId: application.coachId,
    type: 'APPLICATION_APPROVED',
    title: 'Заявка одобрена',
    message: 'Ваша заявка на турнир была одобрена организатором',
    entityType: 'Application',
    entityId: application._id,
  });

  const io = getIO();
  io.to(`user:${application.coachId}`).emit('notification:new', {
    type: 'APPLICATION_APPROVED',
    applicationId: application._id,
  });

  io.to(`tournament:${application.tournamentId}`).emit('tournament_updated', {
    type: 'APPLICATION_APPROVED',
    applicationId: application._id,
  });

  return application;
}

async function rejectApplication(authUser, applicationId, reviewComment) {
  if (authUser.role !== 'ADMIN') {
    throw new ApiError(403, 'Only admin can reject applications', 'FORBIDDEN');
  }

  const application = await Application.findById(applicationId);

  if (!application) {
    throw new ApiError(404, 'Application not found', 'APPLICATION_NOT_FOUND');
  }

  const before = {
    status: application.status,
    reviewComment: application.reviewComment,
    reviewedAt: application.reviewedAt,
  };

  application.status = 'REJECTED';
  application.reviewComment = reviewComment || null;
  application.reviewedAt = new Date();

  await application.save();

  await auditService.recordAuditEvent({
    actorId: authUser._id,
    actorRole: authUser.role,
    action: 'APPLICATION_REJECTED',
    entityType: 'Application',
    entityId: application._id,
    before,
    after: {
      status: application.status,
      reviewComment: application.reviewComment,
      reviewedAt: application.reviewedAt,
    },
    reason: reviewComment || null,
    meta: {
      tournamentId: application.tournamentId,
      clubId: application.clubId,
      coachId: application.coachId,
    },
  });

  await notificationService.createNotification({
    userId: application.coachId,
    type: 'APPLICATION_REJECTED',
    title: 'Заявка отклонена',
    message: `Причина: ${reviewComment || 'Не указана'}`,
    entityType: 'Application',
    entityId: application._id,
  });

  const io = getIO();
  io.to(`user:${application.coachId}`).emit('notification:new', {
    type: 'APPLICATION_REJECTED',
    applicationId: application._id,
  });

  return application;
}
  
async function markApplicationUnderReview(authUser, applicationId) {
  if (authUser.role !== 'ADMIN') {
    throw new ApiError(403, 'Only admin can review applications', 'FORBIDDEN');
  }

  const application = await Application.findById(applicationId);

  if (!application) {
    throw new ApiError(404, 'Application not found', 'APPLICATION_NOT_FOUND');
  }

  const before = {
    status: application.status,
  };

  application.status = 'UNDER_REVIEW';
  await application.save();

  await auditService.recordAuditEvent({
    actorId: authUser._id,
    actorRole: authUser.role,
    action: 'APPLICATION_UNDER_REVIEW',
    entityType: 'Application',
    entityId: application._id,
    before,
    after: {
      status: application.status,
    },
    meta: {
      tournamentId: application.tournamentId,
      clubId: application.clubId,
      coachId: application.coachId,
    },
  });

  await notificationService.createNotification({
    userId: application.coachId,
    type: 'APPLICATION_UNDER_REVIEW',
    title: 'Заявка на проверке',
    message: 'Администратор начал рассмотрение вашей заявки.',
    entityType: 'Application',
    entityId: application._id,
  });

  const io = getIO();
  io.to(`user:${application.coachId}`).emit('notification:new', {
    type: 'APPLICATION_UNDER_REVIEW',
    applicationId: application._id,
  });

  return application;
}
  

module.exports = {
  createApplication,
  updateApplication,
  getMyApplications,
  getApplicationById,
  getApplicationsByTournament,
  submitApplication,
  approveApplication,
  rejectApplication,
  markApplicationUnderReview,
};