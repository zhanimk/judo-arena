const Match = require('../../models/Match');

async function rollbackMatchChain(matchId) {

  const match = await Match.findById(matchId);

  if (!match) return;

  if (!match.winnerTargetMatchId) return;

  const nextMatch = await Match.findById(match.winnerTargetMatchId);

  if (!nextMatch) return;

  if (match.winnerTargetSlot === "A") {
    nextMatch.slotA = {
      athleteId: null,
      sourceType: "WINNER_OF_MATCH",
      sourceMatchId: match._id,
      sourceOutcome: "WINNER",
      isBye: false
    };
  } else {

    nextMatch.slotB = {
      athleteId: null,
      sourceType: "WINNER_OF_MATCH",
      sourceMatchId: match._id,
      sourceOutcome: "WINNER",
      isBye: false
    };
  }

  nextMatch.status = "PENDING";
  nextMatch.winnerId = null;
  nextMatch.loserId = null;

  await nextMatch.save();

  await rollbackMatchChain(nextMatch._id);
}

module.exports = {
  rollbackMatchChain
};