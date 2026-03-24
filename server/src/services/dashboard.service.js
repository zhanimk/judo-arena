const User = require('../models/User');
const Club = require('../models/Club');
const Tournament = require('../models/Tournament');
const Application = require('../models/Application');
const Match = require('../models/Match');
const ApiError = require('../utils/ApiError');
const adminService = require('./admin.service');

async function getCoachDashboard(authUser) {
  const club = await Club.findOne({ coachId: authUser._id }).select('name city coachId');

  const [clubAthletes, myApplications, tournamentsTotal] = await Promise.all([
    club ? User.countDocuments({ clubId: club._id, role: 'ATHLETE' }) : 0,
    Application.countDocuments({ coachId: authUser._id }),
    Tournament.countDocuments(),
  ]);

  return {
    role: 'COACH',
    summary: { club },
    stats: {
      clubAthletes,
      myApplications,
      tournamentsTotal,
      clubsTotal: club ? 1 : 0,
    },
  };
}

async function getAthleteDashboard(authUser) {
  const athlete = await User.findById(authUser._id)
    .select('fullName rank weight clubId dateOfBirth')
    .populate('clubId', 'name city');

  if (!athlete) {
    throw new ApiError(404, 'Athlete not found', 'USER_NOT_FOUND');
  }

  const [wins, losses, recentTournaments] = await Promise.all([
    Match.countDocuments({ winnerId: authUser._id, status: 'COMPLETED' }),
    Match.countDocuments({ loserId: authUser._id, status: 'COMPLETED' }),
    Tournament.find({ status: { $in: ['REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'BRACKETS_GENERATED', 'IN_PROGRESS', 'COMPLETED'] } })
      .sort({ startDate: -1 })
      .limit(3)
      .select('title startDate location status'),
  ]);

  return {
    role: 'ATHLETE',
    summary: {
      athlete,
    },
    stats: {
      wins,
      losses,
      performance: wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0,
    },
    recentTournaments,
  };
}

async function getJudgeDashboard(authUser) {
  const [activeMatches, completedMatches, scheduledMatches, queue] = await Promise.all([
    Match.countDocuments({ judgeId: authUser._id, status: 'IN_PROGRESS' }),
    Match.countDocuments({ judgeId: authUser._id, status: 'COMPLETED' }),
    Match.countDocuments({ judgeId: authUser._id, status: { $in: ['READY', 'PENDING'] } }),
    Match.find({ judgeId: authUser._id, status: { $in: ['PENDING', 'READY', 'IN_PROGRESS'] } })
      .sort({ tatamiNumber: 1, orderNumber: 1 })
      .limit(20)
      .select('tatamiNumber roundNumber status slotA.displayNameSnapshot slotB.displayNameSnapshot categoryKey'),
  ]);

  return {
    role: 'JUDGE',
    stats: {
      activeMatches,
      completedMatches,
      scheduledMatches,
      todayMatches: activeMatches + scheduledMatches,
    },
    queue,
  };
}

async function getMyDashboard(authUser) {
  switch (authUser.role) {
    case 'ADMIN':
      return { role: 'ADMIN', ...(await adminService.getDashboardOverview()) };
    case 'COACH':
      return getCoachDashboard(authUser);
    case 'ATHLETE':
      return getAthleteDashboard(authUser);
    case 'JUDGE':
      return getJudgeDashboard(authUser);
    default:
      throw new ApiError(403, 'Unsupported dashboard role', 'FORBIDDEN');
  }
}

module.exports = {
  getMyDashboard,
};
