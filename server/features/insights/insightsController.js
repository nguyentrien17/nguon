const insightsService = require('./insightsService');
const asyncHandler = require('../../utils/asyncHandler');

const getModuleActionInsights = asyncHandler(async (req, res) => {
    const data = await insightsService.getModuleActionInsights();
    return res.json({ success: true, data });
});

module.exports = { getModuleActionInsights };
