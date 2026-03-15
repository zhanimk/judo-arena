module.exports = function (io, socket) {

    socket.on('join_scoreboard', (matchId) => {
  
      socket.join(`scoreboard:${matchId}`)
  
    })
  
  }