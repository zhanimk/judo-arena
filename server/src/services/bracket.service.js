const Tournament = require('../models/Tournament');
const Application = require('../models/Application');
const Bracket = require('../models/Bracket');
const Match = require('../models/Match');
const ApiError = require('../utils/ApiError');

function getNearestPowerOfTwo(n) {
  let power = 2;
  while (power < n) {
    power *= 2;
  }
  return power;
}

function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function calculateAge(dateOfBirth, referenceDate = new Date()) {
  if (!dateOfBirth) return null;

  const dob = new Date(dateOfBirth);
  let age = referenceDate.getFullYear() - dob.getFullYear();
  const monthDiff = referenceDate.getMonth() - dob.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && referenceDate.getDate() < dob.getDate())) {
    age -= 1;
  }

  return age;
}

function athleteFitsCategory(athlete, category, referenceDate) {
  if (!athlete) return false;

  if (category.gender && athlete.gender !== category.gender) {
    return false;
  }

  const athleteAge = calculateAge(athlete.dateOfBirth, referenceDate);

  if (category.minAge !== null && category.minAge !== undefined) {
    if (athleteAge === null || athleteAge < category.minAge) {
      return false;
    }
  }

  if (category.maxAge !== null && category.maxAge !== undefined) {
    if (athleteAge === null || athleteAge > category.maxAge) {
      return false;
    }
  }

  if (category.minWeight !== null && category.minWeight !== undefined) {
    if (athlete.weight === null || athlete.weight < category.minWeight) {
      return false;
    }
  }

  if (category.maxWeight !== null && category.maxWeight !== undefined) {
    if (athlete.weight === null || athlete.weight > category.maxWeight) {
      return false;
    }
  }

  return true;
}

function buildAthleteSlot(athlete) {
  return {
    athleteId: athlete._id,
    sourceType: 'STATIC_ATHLETE',
    sourceMatchId: null,
    sourceOutcome: 'NONE',
    isBye: false,
    displayNameSnapshot: athlete.fullName || null,
    clubIdSnapshot: athlete.clubId || null,
  };
}

function buildByeSlot() {
  return {
    athleteId: null,
    sourceType: 'BYE',
    sourceMatchId: null,
    sourceOutcome: 'NONE',
    isBye: true,
    displayNameSnapshot: 'BYE',
    clubIdSnapshot: null,
  };
}

function buildPlaceholderSlot(sourceType, sourceMatchId, sourceOutcome) {
  return {
    athleteId: null,
    sourceType,
    sourceMatchId,
    sourceOutcome,
    isBye: false,
    displayNameSnapshot: null,
    clubIdSnapshot: null,
  };
}

function getRoundLabel(roundSize, totalBracketSize) {
  if (roundSize === 2) return 'FINAL';
  if (roundSize === 4) return 'SEMIFINAL';
  if (roundSize === 8) return 'QUARTERFINAL';
  if (roundSize === 16) return 'ROUND_OF_16';
  if (roundSize === 32) return 'ROUND_OF_32';
  if (roundSize === 64) return 'ROUND_OF_64';
  return 'ROUND_OF_${totalBracketSize}';
}

async function generateBracketForCategory({
  tournament,
  category,
  athletes,
  adminUserId,
}) {
  if (!athletes.length) {
    return null;
  }

  const participantCount = athletes.length;
  const bracketSize = getNearestPowerOfTwo(participantCount);
  const shuffledAthletes = shuffleArray(athletes);

  const paddedEntries = [...shuffledAthletes];
  while (paddedEntries.length < bracketSize) {
    paddedEntries.push(null);
  }

  const bracket = await Bracket.create({
    tournamentId: tournament._id,
    categoryKey: category.categoryKey,
    format: tournament.settings?.bracketFormat || 'IJF_REPECHAGE',
    participantCount,
    bracketSize,
    mainRounds: [],
    repechageRounds: [],
    bronzeMatchIds: [],
    finalMatchId: null,
    status: 'DRAFT',
    generatedAt: new Date(),
    generatedBy: adminUserId,
  });

  const allRounds = [];
  const roundMatches = [];

  // Round 1
  const firstRoundMatchCount = bracketSize / 2;
  const firstRoundSizeLabel = getRoundLabel(bracketSize, bracketSize);
  const firstRoundDocs = [];

  for (let i = 0; i < firstRoundMatchCount; i += 1) {
    const athleteA = paddedEntries[i * 2];
    const athleteB = paddedEntries[i * 2 + 1];

    const slotA = athleteA ? buildAthleteSlot(athleteA) : buildByeSlot();
    const slotB = athleteB ? buildAthleteSlot(athleteB) : buildByeSlot();

    let status = 'PENDING';
    if (
      (slotA.athleteId && slotB.athleteId) ||
      (slotA.athleteId && slotB.isBye) ||
      (slotB.athleteId && slotA.isBye)
    ) {
      status = 'READY';
    }

    const match = await Match.create({
      tournamentId: tournament._id,
      bracketId: bracket._id,
      categoryKey: category.categoryKey,
      matchType: bracketSize === 2 ? 'FINAL' : 'MAIN',
      roundType: firstRoundSizeLabel,
      roundNumber: 1,
      matchNumber: i + 1,
      slotA,
      slotB,
      status,
      scoreA: 0,
      scoreB: 0,
      penaltiesA: 0,
      penaltiesB: 0,
    });

    firstRoundDocs.push(match);
  }

  roundMatches.push(firstRoundDocs);
  allRounds.push({
    roundNumber: 1,
    title: firstRoundSizeLabel,
    matchIds: firstRoundDocs.map((m) => m._id),
  });

  // Next rounds
  let currentRoundMatches = firstRoundDocs;
  let currentRoundNumber = 2;
  let currentRoundSize = firstRoundMatchCount;

  while (currentRoundMatches.length > 1) {
    const nextRoundMatches = [];
    const roundLabel = getRoundLabel(currentRoundSize, bracketSize);

    for (let i = 0; i < currentRoundMatches.length / 2; i += 1) {
      const previousA = currentRoundMatches[i * 2];
      const previousB = currentRoundMatches[i * 2 + 1];

      const matchType = currentRoundMatches.length / 2 === 1 ? 'FINAL' : 'MAIN';

      const nextMatch = await Match.create({
        tournamentId: tournament._id,
        bracketId: bracket._id,
        categoryKey: category.categoryKey,
        matchType,
        roundType: roundLabel,
        roundNumber: currentRoundNumber,
        matchNumber: i + 1,
        slotA: buildPlaceholderSlot('WINNER_OF_MATCH', previousA._id, 'WINNER'),
        slotB: buildPlaceholderSlot('WINNER_OF_MATCH', previousB._id, 'WINNER'),
        status: 'PENDING',
        scoreA: 0,
        scoreB: 0,
        penaltiesA: 0,
        penaltiesB: 0,
      });

      previousA.winnerTargetMatchId = nextMatch._id;
      previousA.winnerTargetSlot = 'A';

      previousB.winnerTargetMatchId = nextMatch._id;
      previousB.winnerTargetSlot = 'B';

      await previousA.save();
      await previousB.save();

      nextRoundMatches.push(nextMatch);
    }

    roundMatches.push(nextRoundMatches);
    allRounds.push({
      roundNumber: currentRoundNumber,
      title: roundLabel,
      matchIds: nextRoundMatches.map((m) => m._id),
    });

    currentRoundMatches = nextRoundMatches;
    currentRoundNumber += 1;
    currentRoundSize = currentRoundMatches.length;
  }

  const finalMatch = currentRoundMatches[0] || null;

  bracket.mainRounds = allRounds;
  bracket.finalMatchId = finalMatch ? finalMatch._id : null;
  bracket.status = 'ACTIVE';

  await bracket.save();

  return bracket;
}

async function generateBrackets(authUser, tournamentId) {
  if (authUser.role !== 'ADMIN') {
    throw new ApiError(403, 'Only admin can generate brackets', 'FORBIDDEN');
  }

  const tournament = await Tournament.findById(tournamentId);
  if (!tournament) {
    throw new ApiError(404, 'Tournament not found', 'TOURNAMENT_NOT_FOUND');
  }

  if (!['REGISTRATION_CLOSED', 'BRACKETS_GENERATED'].includes(tournament.status)) {
    throw new ApiError(
      409,
      'Brackets can only be generated after registration is closed',
      'INVALID_TOURNAMENT_STATUS_FOR_BRACKETS'
    );
  }

  if (!tournament.categories || tournament.categories.length === 0) {
    throw new ApiError(400, 'Tournament has no categories', 'CATEGORIES_REQUIRED');
  }

  const existingBrackets = await Bracket.countDocuments({ tournamentId });
  if (existingBrackets > 0) {
    throw new ApiError(
      409,
      'Brackets already exist for this tournament',
      'BRACKETS_ALREADY_EXIST'
    );
  }
  const approvedApplications = await Application.find({
    tournamentId,
    status: 'APPROVED',
  }).populate('athletes');

  if (!approvedApplications.length) {
    throw new ApiError(
      400,
      'No approved applications found for this tournament',
      'NO_APPROVED_APPLICATIONS'
    );
  }

  const allAthletes = approvedApplications.flatMap((app) => app.athletes || []);

  if (!allAthletes.length) {
    throw new ApiError(
      400,
      'No approved athletes found for this tournament',
      'NO_APPROVED_ATHLETES'
    );
  }

  const referenceDate = tournament.startDate || new Date();
  const generatedBrackets = [];

  for (const category of tournament.categories) {
    const categoryAthletes = allAthletes.filter((athlete) =>
      athleteFitsCategory(athlete, category, referenceDate)
    );

    if (!categoryAthletes.length) {
      continue;
    }

    const bracket = await generateBracketForCategory({
      tournament,
      category,
      athletes: categoryAthletes,
      adminUserId: authUser._id,
    });

    if (bracket) {
      generatedBrackets.push(bracket);
    }
  }

  if (!generatedBrackets.length) {
    throw new ApiError(
      400,
      'No brackets were generated. Check category rules and athlete data',
      'BRACKET_GENERATION_EMPTY'
    );
  }

  tournament.status = 'BRACKETS_GENERATED';
  await tournament.save();

  return generatedBrackets;
}

async function getBracketsByTournament(authUser, tournamentId) {
  const tournament = await Tournament.findById(tournamentId);
  if (!tournament) {
    throw new ApiError(404, 'Tournament not found', 'TOURNAMENT_NOT_FOUND');
  }

  if (
    tournament.visibility === 'PRIVATE' &&
    authUser.role !== 'ADMIN' &&
    String(tournament.createdBy) !== String(authUser._id)
  ) {
    throw new ApiError(403, 'This tournament is private', 'PRIVATE_TOURNAMENT');
  }

  const brackets = await Bracket.find({ tournamentId })
    .populate('finalMatchId')
    .populate('bronzeMatchIds')
    .sort({ createdAt: 1 });

  return brackets;
}

async function getBracketById(authUser, bracketId) {
  const bracket = await Bracket.findById(bracketId)
    .populate('finalMatchId')
    .populate('bronzeMatchIds');

  if (!bracket) {
    throw new ApiError(404, 'Bracket not found', 'BRACKET_NOT_FOUND');
  }

  const tournament = await Tournament.findById(bracket.tournamentId);
  if (!tournament) {
    throw new ApiError(404, 'Tournament not found', 'TOURNAMENT_NOT_FOUND');
  }

  if (
    tournament.visibility === 'PRIVATE' &&
    authUser.role !== 'ADMIN' &&
    String(tournament.createdBy) !== String(authUser._id)
  ) {
    throw new ApiError(403, 'This tournament is private', 'PRIVATE_TOURNAMENT');
  }

  return bracket;
}

async function getBracketMatches(authUser, bracketId) {
  const bracket = await Bracket.findById(bracketId);
  if (!bracket) {
    throw new ApiError(404, 'Bracket not found', 'BRACKET_NOT_FOUND');
  }

  const tournament = await Tournament.findById(bracket.tournamentId);
  if (!tournament) {
    throw new ApiError(404, 'Tournament not found', 'TOURNAMENT_NOT_FOUND');
  }

  if (
    tournament.visibility === 'PRIVATE' &&
    authUser.role !== 'ADMIN' &&
    String(tournament.createdBy) !== String(authUser._id)
  ) {
    throw new ApiError(403, 'This tournament is private', 'PRIVATE_TOURNAMENT');
  }

  const matches = await Match.find({ bracketId })
    .populate('slotA.athleteId', 'fullName clubId weight rank')
    .populate('slotB.athleteId', 'fullName clubId weight rank')
    .populate('winnerId', 'fullName')
    .populate('loserId', 'fullName')
    .populate('judgeId', 'fullName email')
    .sort({ roundNumber: 1, matchNumber: 1 });

  return matches;
}

module.exports = {
  generateBrackets,
  getBracketsByTournament,
  getBracketById,
  getBracketMatches,
};