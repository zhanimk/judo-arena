const Notification = require('../models/Notification')

async function createNotification(data) {

  const notification = await Notification.create({
    userId: data.userId,
    type: data.type,
    title: data.title,
    message: data.message,
    entityType: data.entityType,
    entityId: data.entityId
  })

  const io = global.io

  if (io) {
    io.to(`user:${data.userId}`).emit('notification:new', notification)
  }

  return notification
}

module.exports = {
  createNotification
}