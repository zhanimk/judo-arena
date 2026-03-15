const lifecycleService = require('./match/match-lifecycle.service');
const scoringService = require('./match/match-scoring.service');
const progressionService = require('./match/match-progression.service');

module.exports = {
  ...lifecycleService,
  ...scoringService,
  ...progressionService,
};