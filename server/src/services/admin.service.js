const Tournament = require('../models/Tournament');
const Application = require('../models/Application');
const Match = require('../models/Match');
const Club = require('../models/Club');
const User = require('../models/User');

async function getDashboardOverview() {
  const [
    tournamentsTotal,
    clubsTotal,
    athletesTotal,
    pendingApplications,
    activeMatches,
    recentTournaments,
  ] = await Promise.all([
    Tournament.countDocuments(),
    Club.countDocuments(),
    User.countDocuments({ role: 'ATHLETE' }),
    Application.countDocuments({ status: { $in: ['SUBMITTED', 'UNDER_REVIEW'] } }),
    Match.countDocuments({ status: 'IN_PROGRESS' }),
    Tournament.find()
      .sort({ startDate: -1, createdAt: -1 })
      .limit(10)
      .select('title startDate endDate location status categories createdAt'),
  ]);

  return {
    stats: {
      tournamentsTotal,
      clubsTotal,
      athletesTotal,
      pendingApplications,
      activeMatches,
    },
    recentTournaments,
  };
}

module.exports = {
  getDashboardOverview,
};
