module.exports = function (io, socket) {

    socket.on('join_tatami_room', (tatamiNumber) => {
  
      socket.join(`tatami:${tatamiNumber}`);
  
    });
  
  };