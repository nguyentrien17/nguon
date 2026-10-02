const actionModel = require('./actionModel');
const moduleModel = require('#features/modules/moduleModel');
const permissionModel = require('#features/permissions/permissionModel');
const auditLogModel = require('#features/audit-logs/auditLogModel');
const AppError = require('#core/errors/AppError');
const { buildFieldDiff } = require('#core/utils/auditDiff');
const { AUDIT_STATUS, AUDIT_ACTION, PROTECTED_ROLE_CODE, ACTION_CODE, RECORD_STATUS, ERROR_CODE } = require('#shared');

const STANDARD_ACTIONS = [
    { code: ACTION_CODE.VIEW, name: 'Xem danh sách' },
    { code: ACTION_CODE.CREATE, name: 'Thêm mới' },
    { code: ACTION_CODE.EDIT, name: 'Sửa' },
    { code: ACTION_CODE.DELETE, name: 'Xoá' },
];

function isDuplicateEntry(err) {
    return err.code === 'ER_DUP_ENTRY';
}

async function listActions() {
    return actionModel.findAll();
}

async function createAction({ module_id, action_code, action_name, description, rate_limit_per_minute, actorId, ip }) {
    try {
        const id = await actionModel.create({ module_id, action_code, action_name, description, rate_limit_per_minute });
        const module = await moduleModel.findById(module_id);

        // Keep the protected admin role automatically in sync with every new action —
        // without this, a brand-new action starts ungranted to everyone, admin included.
        const adminRole = await permissionModel.findRoleByCode(PROTECTED_ROLE_CODE);
        if (adminRole) {
            await permissionModel.grantToRole({ permissionId: adminRole.id, moduleId: module_id, actionId: id });
        }

        await auditLogModel.create({
            userId: actorId,
            action: AUDIT_ACTION.ACTION_CREATE,
            ip,
            status: AUDIT_STATUS.SUCCESS,
            detail: `Created action ${action_code} '${action_name}' for module ${module?.module_code || module_id}`,
        });
        return { id, module_id, action_code, action_name };
    } catch (err) {
        if (isDuplicateEntry(err)) {
            throw new AppError(409, ERROR_CODE.DUPLICATE, 'Action code already exists for this module');
        }
        throw err;
    }
}

async function updateAction(id, { action_name, status, description, rate_limit_per_minute, actorId, ip }) {
    const existing = await actionModel.findById(id);
    if (!existing) {
        throw new AppError(404, ERROR_CODE.NOT_FOUND, 'Action not found');
    }

    const fields = {};
    if (action_name !== undefined) fields.action_name = action_name;
    if (status !== undefined) fields.status = status;
    if (description !== undefined) fields.description = description;
    if (rate_limit_per_minute !== undefined) fields.rate_limit_per_minute = rate_limit_per_minute;

    if (Object.keys(fields).length === 0) {
        throw new AppError(400, ERROR_CODE.VALIDATION, 'No fields to update');
    }

    const diff = buildFieldDiff(existing, { action_name, status, description, rate_limit_per_minute }, {
        action_name: 'name',
        status: 'status',
        description: 'description',
        rate_limit_per_minute: 'rate limit',
    });

    const affectedRows = await actionModel.update(id, fields);
    if (affectedRows === 0) {
        throw new AppError(404, ERROR_CODE.NOT_FOUND, 'Action not found');
    }

    await auditLogModel.create({
        userId: actorId,
        action: AUDIT_ACTION.ACTION_UPDATE,
        ip,
        status: AUDIT_STATUS.SUCCESS,
        detail: `Updated action ${existing.action_code}: ${diff}`,
    });
}

async function archiveAction(id, { actorId, ip }) {
    const existing = await actionModel.findById(id);
    if (!existing) {
        throw new AppError(404, ERROR_CODE.NOT_FOUND, 'Action not found');
    }
    await actionModel.update(id, { status: RECORD_STATUS.ARCHIVED });
    await auditLogModel.create({
        userId: actorId,
        action: AUDIT_ACTION.ACTION_ARCHIVE,
        ip,
        status: AUDIT_STATUS.SUCCESS,
        detail: `Archived action ${existing.action_code} '${existing.action_name}'`,
    });
}

async function restoreAction(id, { actorId, ip }) {
    const existing = await actionModel.findById(id);
    if (!existing) {
        throw new AppError(404, ERROR_CODE.NOT_FOUND, 'Action not found');
    }
    await actionModel.update(id, { status: RECORD_STATUS.ACTIVE });
    await auditLogModel.create({
        userId: actorId,
        action: AUDIT_ACTION.ACTION_RESTORE,
        ip,
        status: AUDIT_STATUS.SUCCESS,
        detail: `Restored action ${existing.action_code} '${existing.action_name}'`,
    });
}

async function deleteAction(id, { actorId, ip }) {
    const existing = await actionModel.findById(id);
    if (!existing) {
        throw new AppError(404, ERROR_CODE.NOT_FOUND, 'Action not found');
    }
    if (existing.status !== RECORD_STATUS.ARCHIVED) {
        throw new AppError(400, ERROR_CODE.VALIDATION, 'Action must be archived before it can be permanently deleted');
    }

    const module = await moduleModel.findById(existing.module_id);
    await actionModel.remove(id);
    await auditLogModel.create({
        userId: actorId,
        action: AUDIT_ACTION.ACTION_DELETE,
        ip,
        status: AUDIT_STATUS.SUCCESS,
        detail: `Deleted action ${existing.action_code} '${existing.action_name}' from module ${module?.module_code || existing.module_id}`,
    });
}

// Tạo nhanh bộ action CRUD chuẩn cho 1 module, bỏ qua action đã tồn tại thay vì lỗi
// (partial-success) — tái dùng createAction nên vẫn auto-grant ROLE_ADMIN + ghi audit log
// cho từng action mới như tạo thủ công.
async function scaffoldStandardActions(moduleId, { actorId, ip }) {
    const module = await moduleModel.findById(moduleId);
    if (!module) {
        throw new AppError(404, ERROR_CODE.NOT_FOUND, 'Module not found');
    }

    const created = [];
    const skipped = [];
    for (const { code, name } of STANDARD_ACTIONS) {
        try {
            await createAction({ module_id: moduleId, action_code: code, action_name: name, actorId, ip });
            created.push(code);
        } catch (err) {
            if (err instanceof AppError && err.errorCode === ERROR_CODE.DUPLICATE) {
                skipped.push(code);
                continue;
            }
            throw err;
        }
    }
    return { created, skipped };
}

module.exports = {
    listActions,
    createAction,
    updateAction,
    deleteAction,
    scaffoldStandardActions,
    archiveAction,
    restoreAction,
};
