const { Server } = require('socket.io');
const env = require('./env');

let ioInstance = null;

function initSocket(server) {
  ioInstance = new Server(server, {
    cors: {
      origin: env.clientUrl,
      credentials: true,
    },
  });

  ioInstance.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on('join_tournament_room', (tournamentId) => {
      if (tournamentId) {
        socket.join(`tournament:${tournamentId}`);
      }
    });

    socket.on('join_tatami_room', (tatamiNumber) => {
      if (tatamiNumber) {
        socket.join(`tatami:${tatamiNumber}`);
      }
    });

    socket.on('join_user_room', (userId) => {
      if (userId) {
        socket.join(`user:${userId}`);
      }
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  return ioInstance;
}

function getIO() {
  if (ioInstance) {
    return ioInstance;
  }

  return {
    to() {
      return {
        emit() {},
      };
    },
    emit() {},
  };
}

module.exports = {
  initSocket,
  getIO,
};