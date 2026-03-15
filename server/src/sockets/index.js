const matchSocket = require('./match.socket')
const bracketSocket = require('./bracket.socket')
const notificationSocket = require('./notification.socket')
const tatamiSocket = require('./tatami.socket')
const scoreboardSocket = require('./scoreboard.socket')

module.exports = function initSockets(io) {

  io.on('connection', (socket) => {

    matchSocket(io, socket)
    bracketSocket(io, socket)
    notificationSocket(io, socket)
    tatamiSocket(io, socket)
    scoreboardSocket(io, socket)

  })

}