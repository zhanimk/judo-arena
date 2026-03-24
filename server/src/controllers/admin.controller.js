const asyncHandler = require('../utils/asyncHandler');
const overrideService = require('../services/match/match-admin-override.service');
const rollbackService = require('../services/match/match-rollback.service');
const adminService = require('../services/admin.service');

const overrideMatchResult = asyncHandler(async (req,res)=>{

  const match = await overrideService.adminOverrideResult(
    req.user,
    req.params.id,
    req.body
  );

  res.status(200).json({
    success:true,
    message:"Match result overridden",
    data:match
  });

});

const rollbackBracket = asyncHandler(async (req,res)=>{

  await rollbackService.rollbackMatchChain(req.params.id);

  res.status(200).json({
    success:true,
    message:"Bracket rollback completed"
  });

});

const requireReplay = asyncHandler(async (req,res)=>{

  const match = await overrideService.markReplayRequired(
    req.user,
    req.params.id
  );

  res.status(200).json({
    success:true,
    message:"Match marked for replay",
    data:match
  });

});


const getDashboardOverview = asyncHandler(async (req,res)=>{

  const data = await adminService.getDashboardOverview();

  res.status(200).json({
    success:true,
    data
  });

});

module.exports = {
  overrideMatchResult,
  rollbackBracket,
  requireReplay,
  getDashboardOverview
};