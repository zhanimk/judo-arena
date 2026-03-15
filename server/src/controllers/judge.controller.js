const asyncHandler = require('../utils/asyncHandler');
const tatamiQueueService = require('../services/tatami/tatami-queue.service');
const tatamiAssignmentService = require('../services/tatami/tatami-assignment.service');

const getTatamiQueue = asyncHandler(async (req, res) => {
  const queue = await tatamiQueueService.getTatamiQueue(
    req.user,
    Number(req.params.tatamiNumber)
  );

  res.status(200).json({
    success: true,
    data: queue,
  });
});

const getJudgeMatchBoard = asyncHandler(async (req, res) => {
  const match = await tatamiQueueService.getJudgeMatchBoard(req.user, req.params.id);

  res.status(200).json({
    success: true,
    data: match,
  });
});

const assignMatchToTatami = asyncHandler(async (req, res) => {
  const match = await tatamiAssignmentService.assignMatchToTatami(
    req.user,
    req.params.id,
    req.body
  );

  res.status(200).json({
    success: true,
    message: 'Match assigned to tatami successfully',
    data: match,
  });
});

const reorderTatamiQueue = asyncHandler(async (req, res) => {
  const result = await tatamiAssignmentService.reorderTatamiQueue(
    req.user,
    req.params.tournamentId,
    Number(req.params.tatamiNumber),
    req.body.orderedMatchIds
  );

  res.status(200).json({
    success: true,
    message: 'Tatami queue reordered successfully',
    data: result,
  });
});

module.exports = {
  getTatamiQueue,
  getJudgeMatchBoard,
  assignMatchToTatami,
  reorderTatamiQueue,
};