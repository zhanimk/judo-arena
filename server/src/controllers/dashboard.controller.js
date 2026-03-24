const asyncHandler = require('../utils/asyncHandler');
const dashboardService = require('../services/dashboard.service');

const getMyDashboard = asyncHandler(async (req, res) => {
  const data = await dashboardService.getMyDashboard(req.user);

  res.status(200).json({
    success: true,
    data,
  });
});

module.exports = {
  getMyDashboard,
};
