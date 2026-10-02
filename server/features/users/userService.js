const bcrypt = require('bcryptjs');
const userModel = require('./userModel');
const permissionModel = require('#features/permissions/permissionModel');
const auditLogModel = require('#features/audit-logs/auditLogModel');
const AppError = require('../../utils/AppError');
const { buildFieldDiff } = require('../../utils/auditDiff');
const { USER_STATUS, AUDIT_STATUS, AUDIT_ACTION, ERROR_CODE, MODULE_CODE, ACTION_CODE, PROTECTED_ROLE_CODE } = require('#shared');

function isDuplicateEntry(err) {
    return err.code === 'ER_DUP_ENTRY';
}

async function listUsers({ page, limit, search }) {
    const { rows, total } = await userModel.list({ page, limit, search: search ? `%${search}%` : null });
    return {
        data: rows,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
}

// Gán role lúc tạo user đi ngược qua permission boundary riêng của việc gán role
// (POST /permissions/:id/assign yêu cầu MOD_PERMISSION:edit) — nếu không kiểm tra lại ở đây,
// một actor chỉ có MOD_USER:create (không có MOD_PERMISSION:edit) vẫn có thể tự tạo user mới
// và gán cho nó bất kỳ role nào, kể cả ROLE_ADMIN, để leo quyền.
async function assertCanAssignRoles(actorId) {
    const { isProtectedRole, permissions } = await permissionModel.getUserAccess(actorId, PROTECTED_ROLE_CODE);
    const canAssign = isProtectedRole || permissions.some((p) => p.module_code === MODULE_CODE.PERMISSION && p.action_code === ACTION_CODE.EDIT);
    if (!canAssign) {
        throw new AppError(403, ERROR_CODE.PERMISSION_DENIED, `Missing permission ${MODULE_CODE.PERMISSION}:${ACTION_CODE.EDIT}`);
    }
}

async function createUser({ username, email, password, full_name, role_ids, actorId, ip }) {
    if (!username || !email || !password || !full_name) {
        throw new AppError(400, ERROR_CODE.VALIDATION, 'Missing required fields');
    }

    if (Array.isArray(role_ids) && role_ids.length > 0) {
        await assertCanAssignRoles(actorId);
    }

    try {
        const passwordHash = await bcrypt.hash(password, 12);
        const id = await userModel.create({ username, email, passwordHash, full_name });

        let roleSummary = '';
        if (Array.isArray(role_ids) && role_ids.length > 0) {
            const assignedCodes = [];
            for (const roleId of role_ids) {
                await permissionModel.assignRoleToUser({ userId: id, permissionId: roleId });
                const role = await permissionModel.findRoleById(roleId);
                if (role) assignedCodes.push(role.permission_code);
            }
            if (assignedCodes.length > 0) roleSummary = `; assigned roles ${assignedCodes.join(', ')}`;
        }

        await auditLogModel.create({
            userId: actorId,
            action: AUDIT_ACTION.USER_CREATE,
            ip,
            status: AUDIT_STATUS.SUCCESS,
            detail: `Created user ${username} (${email}), full name '${full_name}'${roleSummary}`,
        });
        return { id, username, email, full_name };
    } catch (err) {
        if (isDuplicateEntry(err)) {
            throw new AppError(409, ERROR_CODE.DUPLICATE, 'Username or email already exists');
        }
        throw err;
    }
}

async function updateUser(id, { email, full_name, avatar, password, actorId, ip }) {
    const existing = await userModel.findById(id);
    if (!existing) {
        throw new AppError(404, ERROR_CODE.NOT_FOUND, 'User not found');
    }

    const fields = {};
    if (email) fields.email = email;
    if (full_name) fields.full_name = full_name;
    if (avatar !== undefined) fields.avatar = avatar;
    if (password) fields.password = await bcrypt.hash(password, 12);

    if (Object.keys(fields).length === 0) {
        throw new AppError(400, ERROR_CODE.VALIDATION, 'No fields to update');
    }

    const diff = buildFieldDiff(existing, { email, full_name, avatar }, {
        email: 'email',
        full_name: 'full name',
        avatar: 'avatar',
    });
    const passwordNote = password ? (diff === 'No changes' ? 'password changed' : '; password changed') : '';

    try {
        const affectedRows = await userModel.update(id, fields);
        if (affectedRows === 0) {
            throw new AppError(404, ERROR_CODE.NOT_FOUND, 'User not found');
        }
        await auditLogModel.create({
            userId: actorId,
            action: AUDIT_ACTION.USER_UPDATE,
            ip,
            status: AUDIT_STATUS.SUCCESS,
            detail: `Updated user ${existing.username}: ${diff}${passwordNote}`,
        });
    } catch (err) {
        if (isDuplicateEntry(err)) {
            throw new AppError(409, ERROR_CODE.DUPLICATE, 'Email already exists');
        }
        throw err;
    }
}

async function exportUsers({ search, actorId, ip }) {
    const rows = await userModel.listAll({ search: search ? `%${search}%` : null });
    await auditLogModel.create({ userId: actorId, action: AUDIT_ACTION.USER_EXPORT, ip, status: AUDIT_STATUS.SUCCESS, detail: `Exported ${rows.length} user(s)` });
    return rows;
}

async function toggleUserStatus(id, { actorId, ip }) {
    const user = await userModel.findById(id);
    if (!user) {
        throw new AppError(404, ERROR_CODE.NOT_FOUND, 'User not found');
    }

    const newStatus = user.status === USER_STATUS.ACTIVE ? USER_STATUS.LOCKED : USER_STATUS.ACTIVE;

    // Cùng nguyên tắc với việc tự gỡ role Administrator của chính mình (permissionService) —
    // không cho actor tự khoá tài khoản đang đăng nhập, tránh tự khoá mình (hoặc admin cuối
    // cùng tự khoá chính mình, không ai unlock lại được).
    if (newStatus === USER_STATUS.LOCKED && Number(id) === Number(actorId)) {
        throw new AppError(403, ERROR_CODE.SELF_LOCK, 'You cannot lock your own account');
    }
    await userModel.setStatus(id, newStatus);

    const action = newStatus === USER_STATUS.ACTIVE ? 'Unlocked' : 'Locked';
    await auditLogModel.create({
        userId: actorId,
        action: AUDIT_ACTION.USER_LOCK_TOGGLE,
        ip,
        status: AUDIT_STATUS.SUCCESS,
        detail: `${action} user ${user.username}`,
    });
    return { id: Number(id), status: newStatus };
}

module.exports = { listUsers, createUser, updateUser, toggleUserStatus, exportUsers };
