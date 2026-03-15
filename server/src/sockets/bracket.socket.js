module.exports = function (io, socket) {

    socket.on('join_bracket_room', (bracketId) => {
  
      socket.join(`bracket:${bracketId}`)
  
    })
  
  }