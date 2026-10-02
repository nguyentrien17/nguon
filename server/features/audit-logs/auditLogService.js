const auditLogModel = require('./auditLogModel');

async function listLogs({ page, limit, action, status }) {
    const { rows, total } = await auditLogModel.list({ page, limit, action, status });
    return {
        data: rows,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
}

async function listActionTypes() {
    return auditLogModel.listActions();
}

module.exports = { listLogs, listActionTypes };
