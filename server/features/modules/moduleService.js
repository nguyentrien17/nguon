const moduleModel = require('./moduleModel');
const actionModel = require('#features/actions/actionModel');
const actionService = require('#features/actions/actionService');
const auditLogModel = require('#features/audit-logs/auditLogModel');
const AppError = require('../../utils/AppError');
const { buildFieldDiff } = require('../../utils/auditDiff');
const { AUDIT_STATUS, AUDIT_ACTION, RECORD_STATUS, ERROR_CODE } = require('#shared');

function isDuplicateEntry(err) {
    return err.code === 'ER_DUP_ENTRY';
}

async function listModules() {
    return moduleModel.findAll();
}

async function createModule({ module_code, module_name, module_href, module_element_id, module_parent_id, module_type, module_icon, module_index, description, actorId, ip }) {
    try {
        const id = await moduleModel.create({
            module_code,
            module_name,
            module_href,
            module_element_id,
            module_parent_id,
            module_type,
            module_icon,
            module_index,
            description,
        });
        await auditLogModel.create({
            userId: actorId,
            action: AUDIT_ACTION.MODULE_CREATE,
            ip,
            status: AUDIT_STATUS.SUCCESS,
            detail: `Created module ${module_code} '${module_name}'`,
        });
        return { id, module_code, module_name };
    } catch (err) {
        if (isDuplicateEntry(err)) {
            throw new AppError(409, ERROR_CODE.DUPLICATE, 'Module code already exists');
        }
        throw err;
    }
}

async function updateModule(id, { module_name, module_href, module_element_id, module_type, module_icon, module_index, status, description, actorId, ip }) {
    const existing = await moduleModel.findById(id);
    if (!existing) {
        throw new AppError(404, ERROR_CODE.NOT_FOUND, 'Module not found');
    }

    const fields = {};
    if (module_name !== undefined) fields.module_name = module_name;
    if (module_href !== undefined) fields.module_href = module_href;
    if (module_element_id !== undefined) fields.module_element_id = module_element_id;
    if (module_type !== undefined) fields.module_type = module_type;
    if (module_icon !== undefined) fields.module_icon = module_icon;
    if (module_index !== undefined) fields.module_index = module_index;
    if (status !== undefined) fields.status = status;
    if (description !== undefined) fields.description = description;

    if (Object.keys(fields).length === 0) {
        throw new AppError(400, ERROR_CODE.VALIDATION, 'No fields to update');
    }

    const diff = buildFieldDiff(existing, { module_name, module_href, module_element_id, module_type, module_icon, module_index, status, description }, {
        module_name: 'name',
        module_href: 'path',
        module_element_id: 'element id',
        module_type: 'type',
        module_icon: 'icon',
        module_index: 'order',
        status: 'status',
        description: 'description',
    });

    const affectedRows = await moduleModel.update(id, fields);
    if (affectedRows === 0) {
        throw new AppError(404, ERROR_CODE.NOT_FOUND, 'Module not found');
    }

    await auditLogModel.create({
        userId: actorId,
        action: AUDIT_ACTION.MODULE_UPDATE,
        ip,
        status: AUDIT_STATUS.SUCCESS,
        detail: `Updated module ${existing.module_code}: ${diff}`,
    });
}

// Nhân bản 1 module (không đệ quy sang module con) kèm toàn bộ action trực tiếp của nó —
// tái dùng actionService.createAction cho từng action nên vẫn auto-grant ROLE_ADMIN + audit.
async function cloneModule(id, { module_code, module_name, actorId, ip }) {
    const original = await moduleModel.findById(id);
    if (!original) {
        throw new AppError(404, ERROR_CODE.NOT_FOUND, 'Module not found');
    }

    let newId;
    try {
        newId = await moduleModel.create({
            module_code,
            module_name,
            module_href: original.module_href,
            module_element_id: null,
            module_parent_id: original.module_parent_id,
            module_type: original.module_type,
            module_icon: original.module_icon,
            module_index: (original.module_index ?? 0) + 1,
            description: original.description,
        });
    } catch (err) {
        if (isDuplicateEntry(err)) {
            throw new AppError(409, ERROR_CODE.DUPLICATE, 'Module code already exists');
        }
        throw err;
    }

    const originalActions = (await actionModel.findAll()).filter((a) => a.module_id === original.id);
    for (const a of originalActions) {
        await actionService.createAction({
            module_id: newId,
            action_code: a.action_code,
            action_name: a.action_name,
            description: a.description,
            actorId,
            ip,
        });
    }

    await auditLogModel.create({
        userId: actorId,
        action: AUDIT_ACTION.MODULE_CLONE,
        ip,
        status: AUDIT_STATUS.SUCCESS,
        detail: `Cloned module ${original.module_code} -> ${module_code} (${originalActions.length} actions)`,
    });

    return { id: newId, module_code, module_name };
}

// Lưu trữ (soft-delete) module + toàn bộ subtree module con + action thuộc các module đó,
// thay vì xoá cứng ngay — tránh mất dữ liệu ngoài ý muốn do cascade.
async function archiveModule(id, { actorId, ip }) {
    const existing = await moduleModel.findById(id);
    if (!existing) {
        throw new AppError(404, ERROR_CODE.NOT_FOUND, 'Module not found');
    }

    const affectedIds = await moduleModel.setSubtreeStatus(id, RECORD_STATUS.ARCHIVED);
    await auditLogModel.create({
        userId: actorId,
        action: AUDIT_ACTION.MODULE_ARCHIVE,
        ip,
        status: AUDIT_STATUS.SUCCESS,
        detail: `Archived module ${existing.module_code} and ${affectedIds.length - 1} descendant module(s)`,
    });
}

async function restoreModule(id, { actorId, ip }) {
    const existing = await moduleModel.findById(id);
    if (!existing) {
        throw new AppError(404, ERROR_CODE.NOT_FOUND, 'Module not found');
    }

    const affectedIds = await moduleModel.setSubtreeStatus(id, RECORD_STATUS.ACTIVE);
    await auditLogModel.create({
        userId: actorId,
        action: AUDIT_ACTION.MODULE_RESTORE,
        ip,
        status: AUDIT_STATUS.SUCCESS,
        detail: `Restored module ${existing.module_code} and ${affectedIds.length - 1} descendant module(s)`,
    });
}

async function deleteModule(id, { actorId, ip }) {
    const existing = await moduleModel.findById(id);
    if (!existing) {
        throw new AppError(404, ERROR_CODE.NOT_FOUND, 'Module not found');
    }
    if (existing.status !== RECORD_STATUS.ARCHIVED) {
        throw new AppError(400, ERROR_CODE.VALIDATION, 'Module must be archived before it can be permanently deleted');
    }

    await moduleModel.remove(id);
    await auditLogModel.create({
        userId: actorId,
        action: AUDIT_ACTION.MODULE_DELETE,
        ip,
        status: AUDIT_STATUS.SUCCESS,
        detail: `Deleted module ${existing.module_code} '${existing.module_name}'`,
    });
}

module.exports = { listModules, createModule, updateModule, deleteModule, cloneModule, archiveModule, restoreModule };
