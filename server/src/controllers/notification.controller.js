const Notification = require('../models/Notification');
const asyncHandler = require('../utils/asyncHandler');
const notificationService = require('../services/notification.service');

const getMyNotifications = asyncHandler(async (req,res)=>{

  const notifications = await Notification.find({

    userId: req.user._id

  })
    .sort({createdAt:-1})
    .limit(50);

  res.status(200).json({
    success:true,
    data:notifications
  });

});


const markRead = asyncHandler(async (req,res)=>{

  const notification = await notificationService.markNotificationRead(

    req.user._id,
    req.params.id

  );

  res.status(200).json({
    success:true,
    data:notification
  });

});


const markAllRead = asyncHandler(async (req,res)=>{

  await notificationService.markAllNotificationsRead(req.user._id);

  res.status(200).json({
    success:true
  });

});

module.exports = {

  getMyNotifications,
  markRead,
  markAllRead

};