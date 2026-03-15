module.exports = function (io, socket) {

  socket.on('join_user_room', (userId) => {

    socket.join(`user:${userId}`);

  });

};