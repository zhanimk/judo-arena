const Tournament = require('../models/Tournament');
const Bracket = require('../models/Bracket');
const Match = require('../models/Match');
const Application = require('../models/Application');
const ApiError = require('../utils/ApiError');

const TOURNAMENT_STATUSES = [
  'DRAFT',
  'REGISTRATION_OPEN',
  'REGISTRATION_CLOSED',
  'BRACKETS_GENERATED',
  'IN_PROGRESS',
  'PAUSED',
  'COMPLETED',
  'ARCHIVED',
  'CANCELLED',
];

const TOURNAMENT_VISIBILITIES = ['PUBLIC', 'PRIVATE'];

function assertValidStatus(status) {
  if (!TOURNAMENT_STATUSES.includes(status)) {
    throw new ApiError(400, 'Invalid tournament status', 'INVALID_TOURNAMENT_STATUS');
  }
}

function assertValidVisibility(visibility) {
  if (!TOURNAMENT_VISIBILITIES.includes(visibility)) {
    throw new ApiError(400, 'Invalid tournament visibility', 'INVALID_TOURNAMENT_VISIBILITY');
  }
}

async function createTournament(authUser, payload) {
  if (authUser.role !== 'ADMIN') {
    throw new ApiError(403, 'Only admin can create tournaments', 'FORBIDDEN');
  }

  const tournament = await Tournament.create({
    title: payload.title,
    description: payload.description || null,
    location: payload.location,
    address: payload.address || null,
    startDate: payload.startDate,
    endDate: payload.endDate,
    registrationDeadline: payload.registrationDeadline,
    tatamiCount: payload.tatamiCount,
    status: payload.status || 'DRAFT',
    visibility: payload.visibility || 'PRIVATE',
    isPublished: payload.isPublished || false,
    publishedAt: payload.isPublished ? new Date() : null,
    categories: payload.categories || [],
    createdBy: authUser._id,
    settings: {
      bracketFormat: payload.settings?.bracketFormat || 'IJF_REPECHAGE',
      allowManualCorrections:
        payload.settings?.allowManualCorrections !== undefined
          ? payload.settings.allowManualCorrections
          : true,
      enableRepechage:
        payload.settings?.enableRepechage !== undefined
          ? payload.settings.enableRepechage
          : true,
      enableBronzeMatches:
        payload.settings?.enableBronzeMatches !== undefined
          ? payload.settings.enableBronzeMatches
          : true,
    },
  });

  return tournament;
}

async function getTournaments(authUser, query = {}) {
  const filter = {};

  if (query.status) {
    filter.status = query.status;
  }

  if (query.visibility) {
    filter.visibility = query.visibility;
  }

  if (authUser && authUser.role !== 'ADMIN') {
    filter.$or = [{ visibility: 'PUBLIC' }, { createdBy: authUser._id }];
  }

  const tournaments = await Tournament.find(filter)
    .populate('createdBy', 'fullName email role')
    .sort({ startDate: -1, createdAt: -1 });

  return tournaments;
}

async function getTournamentById(authUser, tournamentId) {
  const tournament = await Tournament.findById(tournamentId).populate(
    'createdBy',
    'fullName email role'
  );

  if (!tournament) {
    throw new ApiError(404, 'Tournament not found', 'TOURNAMENT_NOT_FOUND');
  }

  if (
    tournament.visibility === 'PRIVATE' &&
    authUser &&
    authUser.role !== 'ADMIN' &&
    String(tournament.createdBy._id) !== String(authUser._id)
  ) {
    throw new ApiError(403, 'This tournament is private', 'PRIVATE_TOURNAMENT');
  }

  return tournament;
}

async function updateTournament(authUser, tournamentId, payload) {
  if (authUser.role !== 'ADMIN') {
    throw new ApiError(403, 'Only admin can update tournaments', 'FORBIDDEN');
  }

  const tournament = await Tournament.findById(tournamentId);

  if (!tournament) {
    throw new ApiError(404, 'Tournament not found', 'TOURNAMENT_NOT_FOUND');
  }

  const restrictedAfterBrackets = ['categories', 'settings'];
  const hasBracketSensitiveChange = restrictedAfterBrackets.some((field) =>
    Object.prototype.hasOwnProperty.call(payload, field)
  );

  if (
    ['BRACKETS_GENERATED', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'ARCHIVED'].includes(
      tournament.status
    ) &&
    hasBracketSensitiveChange
  ) {
    throw new ApiError(
      409,'Cannot change categories or settings after brackets are generated without override flow',
      'TOURNAMENT_LOCKED'
    );
  }

  const allowedFields = [
    'title',
    'description',
    'location',
    'address',
    'startDate',
    'endDate',
    'registrationDeadline',
    'tatamiCount',
    'categories',
    'settings',
    'visibility',
  ];

  allowedFields.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(payload, field)) {
      tournament[field] = payload[field];
    }
  });

  await tournament.save();

  return tournament;
}

async function deleteTournament(authUser, tournamentId) {
  if (authUser.role !== 'ADMIN') {
    throw new ApiError(403, 'Only admin can delete tournaments', 'FORBIDDEN');
  }

  const tournament = await Tournament.findById(tournamentId);

  if (!tournament) {
    throw new ApiError(404, 'Tournament not found', 'TOURNAMENT_NOT_FOUND');
  }

  const applicationsCount = await Application.countDocuments({ tournamentId });
  const bracketsCount = await Bracket.countDocuments({ tournamentId });
  const matchesCount = await Match.countDocuments({ tournamentId });

  const isHardDeleteAllowed =
    tournament.status === 'DRAFT' &&
    applicationsCount === 0 &&
    bracketsCount === 0 &&
    matchesCount === 0;

  if (!isHardDeleteAllowed) {
    throw new ApiError(
      409,
      'Tournament cannot be deleted. Use cancel or archive instead',
      'TOURNAMENT_DELETE_NOT_ALLOWED'
    );
  }

  await tournament.deleteOne();

  return { deleted: true };
}

async function updateTournamentStatus(authUser, tournamentId, status) {
  if (authUser.role !== 'ADMIN') {
    throw new ApiError(403, 'Only admin can update tournament status', 'FORBIDDEN');
  }

  assertValidStatus(status);

  const tournament = await Tournament.findById(tournamentId);

  if (!tournament) {
    throw new ApiError(404, 'Tournament not found', 'TOURNAMENT_NOT_FOUND');
  }

  if (status === 'IN_PROGRESS') {
    const bracketCount = await Bracket.countDocuments({ tournamentId });
    if (bracketCount === 0) {
      throw new ApiError(
        409,
        'Cannot start tournament without generated brackets',
        'BRACKETS_REQUIRED'
      );
    }
  }

  tournament.status = status;
  await tournament.save();

  return tournament;
}

async function updateTournamentVisibility(authUser, tournamentId, visibility) {
  if (authUser.role !== 'ADMIN') {
    throw new ApiError(403, 'Only admin can update tournament visibility', 'FORBIDDEN');
  }

  assertValidVisibility(visibility);

  const tournament = await Tournament.findById(tournamentId);

  if (!tournament) {
    throw new ApiError(404, 'Tournament not found', 'TOURNAMENT_NOT_FOUND');
  }

  tournament.visibility = visibility;
  await tournament.save();

  return tournament;
}

async function publishTournament(authUser, tournamentId) {
  if (authUser.role !== 'ADMIN') {
    throw new ApiError(403, 'Only admin can publish tournaments', 'FORBIDDEN');
  }

  const tournament = await Tournament.findById(tournamentId);

  if (!tournament) {
    throw new ApiError(404, 'Tournament not found', 'TOURNAMENT_NOT_FOUND');
  }

  tournament.isPublished = true;
  tournament.publishedAt = new Date();
  await tournament.save();

  return tournament;
}

async function unpublishTournament(authUser, tournamentId) {
  if (authUser.role !== 'ADMIN') {
    throw new ApiError(403, 'Only admin can unpublish tournaments', 'FORBIDDEN');
  }

  const tournament = await Tournament.findById(tournamentId);

  if (!tournament) {
    throw new ApiError(404, 'Tournament not found', 'TOURNAMENT_NOT_FOUND');
  }

  tournament.isPublished = false;
  tournament.publishedAt = null;
  await tournament.save();

  return tournament;
}

async function archiveTournament(authUser, tournamentId) {
  if (authUser.role !== 'ADMIN') {
    throw new ApiError(403, 'Only admin can archive tournaments', 'FORBIDDEN');
  }

  const tournament = await Tournament.findById(tournamentId);

  if (!tournament) {
    throw new ApiError(404, 'Tournament not found', 'TOURNAMENT_NOT_FOUND');
  }

  tournament.status = 'ARCHIVED';
  await tournament.save();

  return tournament;
}

async function restoreTournament(authUser, tournamentId) {
  if (authUser.role !== 'ADMIN') {
    throw new ApiError(403, 'Only admin can restore tournaments', 'FORBIDDEN');
  }

  const tournament = await Tournament.findById(tournamentId);

  if (!tournament) {
    throw new ApiError(404, 'Tournament not found', 'TOURNAMENT_NOT_FOUND');
  }

  if (tournament.status !== 'ARCHIVED') {
    throw new ApiError(409, 'Only archived tournament can be restored', 'INVALID_RESTORE');
  }

  tournament.status = 'DRAFT';
  await tournament.save();

  return tournament;
}

async function updateTournamentCategories(authUser, tournamentId, categories) {
  if (authUser.role !== 'ADMIN') {
    throw new ApiError(403, 'Only admin can update categories', 'FORBIDDEN');
  }

  const tournament = await Tournament.findById(tournamentId);

  if (!tournament) {
    throw new ApiError(404, 'Tournament not found', 'TOURNAMENT_NOT_FOUND');
  }

  if (
    ['BRACKETS_GENERATED', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'ARCHIVED'].includes(
      tournament.status
    )
  ) {
    throw new ApiError(
      409,
      'Categories cannot be changed after bracket generation without override flow',
      'CATEGORIES_LOCKED'
    );
  }

  tournament.categories = categories;
  await tournament.save();

  return tournament;
}

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