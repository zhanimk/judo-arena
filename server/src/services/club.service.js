const Club = require('../models/Club');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');

async function createClub(authUser, payload) {
  if (authUser.role !== 'COACH') {
    throw new ApiError(403, 'Only coach can create a club', 'FORBIDDEN');
  }

  const existingClub = await Club.findOne({ coachId: authUser._id });
  if (existingClub) {
    throw new ApiError(409, 'Coach already owns a club', 'CLUB_ALREADY_EXISTS');
  }

  const club = await Club.create({
    name: payload.name,
    city: payload.city,
    description: payload.description || null,
    contacts: payload.contacts || null,
    coachId: authUser._id,
  });

  // Опционально можно привязать coach к club
  await User.findByIdAndUpdate(authUser._id, {
    clubId: club._id,
  });

  return club;
}

async function getClubs(query = {}) {
  const filter = {};

  if (query.city) {
    filter.city = query.city;
  }

  const clubs = await Club.find(filter)
    .populate('coachId', 'fullName email role')
    .sort({ createdAt: -1 });

  return clubs;
}

async function getClubById(clubId) {
  const club = await Club.findById(clubId).populate('coachId', 'fullName email role');

  if (!club) {
    throw new ApiError(404, 'Club not found', 'CLUB_NOT_FOUND');
  }

  const members = await User.find({
    clubId: club._id,
    role: 'ATHLETE',
  }).select('-passwordHash');

  return {
    club,
    members,
  };
}

async function updateClub(authUser, clubId, payload) {
  const club = await Club.findById(clubId);

  if (!club) {
    throw new ApiError(404, 'Club not found', 'CLUB_NOT_FOUND');
  }

  if (authUser.role !== 'ADMIN' && String(club.coachId) !== String(authUser._id)) {
    throw new ApiError(403, 'You can only update your own club', 'FORBIDDEN');
  }

  const allowedFields = ['name', 'city', 'description', 'contacts'];

  allowedFields.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(payload, field)) {
      club[field] = payload[field];
    }
  });

  await club.save();

  return club;
}

async function sendJoinRequest(authUser, clubId) {
  if (authUser.role !== 'ATHLETE') {
    throw new ApiError(403, 'Only athlete can send join request', 'FORBIDDEN');
  }

  const club = await Club.findById(clubId);
  if (!club) {
    throw new ApiError(404, 'Club not found', 'CLUB_NOT_FOUND');
  }

  const athlete = await User.findById(authUser._id);
  if (!athlete) {
    throw new ApiError(404, 'User not found', 'USER_NOT_FOUND');
  }

  if (athlete.clubId) {
    throw new ApiError(409, 'Athlete is already in a club', 'ALREADY_IN_CLUB');
  }

  if (
    athlete.requestedClubId &&
    String(athlete.requestedClubId) === String(clubId) &&
    athlete.clubRequestStatus === 'PENDING'
  ) {
    throw new ApiError(409, 'Join request already sent', 'JOIN_REQUEST_ALREADY_EXISTS');
  }

  athlete.requestedClubId = club._id;
  athlete.clubRequestStatus = 'PENDING';

  await athlete.save();

  return {
    message: 'Join request sent successfully',
  };
}

async function approveAthlete(authUser, clubId, athleteId) {
  const club = await Club.findById(clubId);

  if (!club) {
    throw new ApiError(404, 'Club not found', 'CLUB_NOT_FOUND');
  }

  if (authUser.role !== 'ADMIN' && String(club.coachId) !== String(authUser._id)) {
    throw new ApiError(403, 'Only club coach or admin can approve athlete', 'FORBIDDEN');
  }

  const athlete = await User.findById(athleteId);
  if (!athlete) {
    throw new ApiError(404, 'Athlete not found', 'USER_NOT_FOUND');
  }

  if (athlete.role !== 'ATHLETE') {
    throw new ApiError(400, 'User is not an athlete', 'INVALID_USER_ROLE');
  }

  if (!athlete.requestedClubId || String(athlete.requestedClubId) !== String(club._id)) {
    throw new ApiError(400, 'Athlete has no request to this club', 'INVALID_JOIN_REQUEST');
  }

  athlete.clubId = club._id;
  athlete.coachId = club.coachId;
  athlete.requestedClubId = null;
  athlete.clubRequestStatus = 'APPROVED';

  await athlete.save();

  return athlete.toJSON();
}

async function rejectAthlete(authUser, clubId, athleteId) {const club = await Club.findById(clubId);

    if (!club) {
      throw new ApiError(404, 'Club not found', 'CLUB_NOT_FOUND');
    }
  
    if (authUser.role !== 'ADMIN' && String(club.coachId) !== String(authUser._id)) {
      throw new ApiError(403, 'Only club coach or admin can reject athlete', 'FORBIDDEN');
    }
  
    const athlete = await User.findById(athleteId);
    if (!athlete) {
      throw new ApiError(404, 'Athlete not found', 'USER_NOT_FOUND');
    }
  
    athlete.requestedClubId = null;
    athlete.clubRequestStatus = 'REJECTED';
  
    await athlete.save();
  
    return athlete.toJSON();
  }
  
  async function removeAthlete(authUser, clubId, athleteId) {
    const club = await Club.findById(clubId);
  
    if (!club) {
      throw new ApiError(404, 'Club not found', 'CLUB_NOT_FOUND');
    }
  
    if (authUser.role !== 'ADMIN' && String(club.coachId) !== String(authUser._id)) {
      throw new ApiError(403, 'Only club coach or admin can remove athlete', 'FORBIDDEN');
    }
  
    const athlete = await User.findById(athleteId);
    if (!athlete) {
      throw new ApiError(404, 'Athlete not found', 'USER_NOT_FOUND');
    }
  
    if (!athlete.clubId || String(athlete.clubId) !== String(club._id)) {
      throw new ApiError(400, 'Athlete is not a member of this club', 'ATHLETE_NOT_IN_CLUB');
    }
  
    athlete.clubId = null;
    athlete.coachId = null;
    athlete.requestedClubId = null;
    athlete.clubRequestStatus = 'NONE';
  
    await athlete.save();
  
    return athlete.toJSON();
  }
  
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