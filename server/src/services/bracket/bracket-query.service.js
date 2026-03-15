const Bracket = require('../../models/Bracket')

async function getBracketsByTournament(tournamentId) {

  return Bracket.find({ tournamentId })

}

module.exports = {
  getBracketsByTournament
}