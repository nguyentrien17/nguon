const permissionModel = require('./permissionModel');
const moduleModel = require('#features/modules/moduleModel');
const actionModel = require('#features/actions/actionModel');
const userModel = require('#features/users/userModel');
const auditLogModel = require('#features/audit-logs/auditLogModel');
const AppError = require('#core/errors/AppError');
const { buildFieldDiff } = require('#core/utils/auditDiff');
const { buildPermissionDiff } = require('./permissionDiff');
const { AUDIT_STATUS, AUDIT_ACTION, PROTECTED_ROLE_CODE, ACTION_CODE, ERROR_CODE } = require('#shared');

function isDuplicateEntry(err) {
    return err.code === 'ER_DUP_ENTRY';
}

// Nếu 1 module được cấp edit/delete mà chưa có view, tự thêm view của module đó vào —
// có quyền sửa/xoá mà không xem được danh sách là vô nghĩa. actions phải là actionModel.findAll().
function applyImpliedViewGrants(details, actions) {
    const actionById = new Map(actions.map((a) => [a.id, a]));
    const grantedKeys = new Set(details.map((d) => `${d.module_id}_${d.action_id}`));
    const byModule = new Map();
    details.forEach((d) => {
        const action = actionById.get(d.action_id);
        if (!action) return;
        if (!byModule.has(d.module_id)) byModule.set(d.module_id, []);
        byModule.get(d.module_id).push(action.action_code);
    });

    const result = [...details];
    byModule.forEach((codes, moduleId) => {
        const needsView = codes.includes(ACTION_CODE.EDIT) || codes.includes(ACTION_CODE.DELETE);
        if (!needsView) return;
        const viewAction = actions.find((a) => a.module_id === moduleId && a.action_code === ACTION_CODE.VIEW);
        if (viewAction && !grantedKeys.has(`${moduleId}_${viewAction.id}`)) {
            result.push({ module_id: moduleId, action_id: viewAction.id });
            grantedKeys.add(`${moduleId}_${viewAction.id}`);
        }
    });
    return result;
}

async function listRoles() {
    return permissionModel.findAllRoles();
}

async function createRole({ permission_code, permission_name, description, permission_parent_id, details, actorId, ip }) {
    if (!permission_code || !permission_name) {
        throw new AppError(400, ERROR_CODE.VALIDATION, 'permission_code and permission_name are required');
    }

    try {
        let finalDetails = details;
        let grantSummary = '';
        if (Array.isArray(details) && details.length > 0) {
            const [modules, actions] = await Promise.all([moduleModel.findAll(), actionModel.findAll()]);
            finalDetails = applyImpliedViewGrants(details, actions);
            const moduleCodeById = new Map(modules.map((m) => [m.id, m.module_code]));
            const actionCodeById = new Map(actions.map((a) => [a.id, a.action_code]));
            grantSummary = `; granted ${buildPermissionDiff([], finalDetails, moduleCodeById, actionCodeById)}`;
        }

        const id = await permissionModel.createRole({ permission_code, permission_name, description, permission_parent_id, details: finalDetails });

        await auditLogModel.create({
            userId: actorId,
            action: AUDIT_ACTION.ROLE_CREATE,
            ip,
            status: AUDIT_STATUS.SUCCESS,
            detail: `Created role ${permission_code} '${permission_name}'${grantSummary}`,
        });
        return { id, permission_code, permission_name };
    } catch (err) {
        if (isDuplicateEntry(err)) {
            throw new AppError(409, ERROR_CODE.DUPLICATE, 'permission_code already exists');
        }
        throw err;
    }
}

async function assertNotProtectedRole(id, actionLabel) {
    const role = await permissionModel.findRoleById(id);
    if (!role) {
        throw new AppError(404, ERROR_CODE.NOT_FOUND, 'Role not found');
    }
    if (role.permission_code === PROTECTED_ROLE_CODE) {
        throw new AppError(403, ERROR_CODE.PROTECTED_ROLE, `The Administrator role cannot be ${actionLabel}`, {
            actionKey: actionLabel,
        });
    }
    return role;
}

async function updateRole(id, { permission_name, description, details, actorId, ip }) {
    if (!permission_name) {
        throw new AppError(400, ERROR_CODE.VALIDATION, 'permission_name is required');
    }

    const existing = await assertNotProtectedRole(id, 'modified');
    const oldDetails = await permissionModel.findRoleDetailsWithCodes(id);

    const fieldDiff = buildFieldDiff(existing, { permission_name, description }, {
        permission_name: 'name',
        description: 'description',
    });

    let finalDetails = details;
    let permissionDiff = 'No permission changes';
    if (Array.isArray(details)) {
        const [modules, actions] = await Promise.all([moduleModel.findAll(), actionModel.findAll()]);
        finalDetails = applyImpliedViewGrants(details, actions);
        const moduleCodeById = new Map(modules.map((m) => [m.id, m.module_code]));
        const actionCodeById = new Map(actions.map((a) => [a.id, a.action_code]));
        permissionDiff = buildPermissionDiff(oldDetails, finalDetails, moduleCodeById, actionCodeById);
    }

    const updated = await permissionModel.updateRole(id, { permission_name, description, details: finalDetails });
    if (!updated) {
        throw new AppError(404, ERROR_CODE.NOT_FOUND, 'Role not found');
    }

    await auditLogModel.create({
        userId: actorId,
        action: AUDIT_ACTION.ROLE_UPDATE,
        ip,
        status: AUDIT_STATUS.SUCCESS,
        detail: `Updated role ${existing.permission_code}: ${fieldDiff}; permissions: ${permissionDiff}`,
    });
}

async function deleteRole(id, { actorId, ip }) {
    const role = await assertNotProtectedRole(id, 'deleted');

    const affectedRows = await permissionModel.deleteRole(id);
    if (affectedRows === 0) {
        throw new AppError(404, ERROR_CODE.NOT_FOUND, 'Role not found');
    }

    await auditLogModel.create({
        userId: actorId,
        action: AUDIT_ACTION.ROLE_DELETE,
        ip,
        status: AUDIT_STATUS.SUCCESS,
        detail: `Deleted role ${role.permission_code} '${role.permission_name}'`,
    });
}

async function assignRoleToUser({ permissionId, userId, actorId, ip }) {
    if (!userId) {
        throw new AppError(400, ERROR_CODE.VALIDATION, 'user_id is required');
    }

    const [role, targetUser] = await Promise.all([permissionModel.findRoleById(permissionId), userModel.findById(userId)]);
    if (!role) {
        throw new AppError(404, ERROR_CODE.NOT_FOUND, 'Role not found');
    }
    if (!targetUser) {
        throw new AppError(404, ERROR_CODE.NOT_FOUND, 'User not found');
    }

    await permissionModel.assignRoleToUser({ userId, permissionId });
    await auditLogModel.create({
        userId: actorId,
        action: AUDIT_ACTION.ROLE_ASSIGN,
        ip,
        status: AUDIT_STATUS.SUCCESS,
        detail: `Assigned role ${role?.permission_code || permissionId} to user ${targetUser?.username || userId}`,
    });
}

async function unassignRoleFromUser({ permissionId, userId, actorId, ip }) {
    if (!userId) {
        throw new AppError(400, ERROR_CODE.VALIDATION, 'user_id is required');
    }

    const [role, targetUser] = await Promise.all([permissionModel.findRoleById(permissionId), userModel.findById(userId)]);
    if (!role) {
        throw new AppError(404, ERROR_CODE.NOT_FOUND, 'Role not found');
    }
    if (!targetUser) {
        throw new AppError(404, ERROR_CODE.NOT_FOUND, 'User not found');
    }
    if (role.permission_code === PROTECTED_ROLE_CODE && Number(userId) === Number(actorId)) {
        throw new AppError(403, ERROR_CODE.PROTECTED_ROLE, 'You cannot remove your own Administrator role');
    }

    await permissionModel.unassignRoleFromUser({ userId, permissionId });
    await auditLogModel.create({
        userId: actorId,
        action: AUDIT_ACTION.ROLE_UNASSIGN,
        ip,
        status: AUDIT_STATUS.SUCCESS,
        detail: `Unassigned role ${role?.permission_code || permissionId} from user ${targetUser?.username || userId}`,
    });
}

async function listUserRoles(userId) {
    return permissionModel.getRolesForUser(userId);
}

module.exports = {
    listRoles,
    createRole,
    updateRole,
    deleteRole,
    assignRoleToUser,
    unassignRoleFromUser,
    listUserRoles,
};
