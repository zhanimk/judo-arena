module.exports = function (io, socket) {

    socket.on('join_tournament_room', (tournamentId) => {
  
      socket.join(`tournament:${tournamentId}`);
  
    });
  
  };