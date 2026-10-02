const express = require('express');
const router = express.Router();
const { getModuleActionInsights } = require('./insightsController');
const { authenticate, requirePermission } = require('../../middlewares/authMiddleware');
const { MODULE_CODE, ACTION_CODE } = require('#shared');

router.get('/module-actions', authenticate, requirePermission(MODULE_CODE.MODULE_ACTION, ACTION_CODE.VIEW), getModuleActionInsights);

module.exports = router;
