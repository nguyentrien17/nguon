const auditLogService = require('./auditLogService');
const asyncHandler = require('../../utils/asyncHandler');

const listAuditLogs = asyncHandler(async (req, res) => {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);

    const result = await auditLogService.listLogs({
        page,
        limit,
        action: req.query.action || undefined,
        status: req.query.status || undefined,
    });
    return res.json({ success: true, ...result });
});

const listAuditActionTypes = asyncHandler(async (req, res) => {
    const data = await auditLogService.listActionTypes();
    return res.json({ success: true, data });
});

module.exports = { listAuditLogs, listAuditActionTypes };
