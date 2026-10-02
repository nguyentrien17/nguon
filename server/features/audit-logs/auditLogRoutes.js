const express = require('express');
const router = express.Router();
const { listAuditLogs, listAuditActionTypes } = require('./auditLogController');
const { authenticate, requirePermission } = require('../../middlewares/authMiddleware');
const { MODULE_CODE, ACTION_CODE } = require('#shared');

router.get('/', authenticate, requirePermission(MODULE_CODE.AUDIT, ACTION_CODE.VIEW), listAuditLogs);
router.get('/actions', authenticate, requirePermission(MODULE_CODE.AUDIT, ACTION_CODE.VIEW), listAuditActionTypes);

module.exports = router;
