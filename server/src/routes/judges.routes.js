const express = require('express');

const judgeController = require('../controllers/judge.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const allowRoles = require('../middlewares/role.middleware');
const validate = require('../middlewares/validate.middleware');

const {
  tatamiQueueParamSchema,
  judgeMatchIdParamSchema,
  assignMatchToTatamiSchema,
  reorderTatamiQueueSchema,
} = require('../validators/judge.validator');

const router = express.Router();

router.get(
  '/tatami/:tatamiNumber/queue',
  authMiddleware,
  allowRoles('JUDGE', 'ADMIN'),
  validate(tatamiQueueParamSchema),
  judgeController.getTatamiQueue
);

router.get(
  '/matches/:id',
  authMiddleware,
  allowRoles('JUDGE', 'ADMIN'),
  validate(judgeMatchIdParamSchema),
  judgeController.getJudgeMatchBoard
);

router.patch(
  '/matches/:id/assign',
  authMiddleware,
  allowRoles('ADMIN'),
  validate(assignMatchToTatamiSchema),
  judgeController.assignMatchToTatami
);

router.patch(
  '/tournament/:tournamentId/tatami/:tatamiNumber/reorder',
  authMiddleware,
  allowRoles('ADMIN'),
  validate(reorderTatamiQueueSchema),
  judgeController.reorderTatamiQueue
);

module.exports = router;