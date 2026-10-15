const bcrypt = require('bcryptjs');
const userModel = require('./userModel');
const permissionModel = require('#features/permissions/permissionModel');
const auditLogModel = require('#features/audit-logs/auditLogModel');
// Đổi password của một user phải thu hồi phiên đăng nhập của user đó — xem updateUser.
const refreshTokenModel = require('#features/auth/refreshTokenModel');
const db = require('#core/database/db');
const AppError = require('#core/errors/AppError');
const { buildFieldDiff } = require('#core/utils/auditDiff');
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

    // Tra role TRƯỚC khi tạo user, một lần cho cả danh sách. Hai lý do:
    //  - role_ids chứa id không tồn tại thì trước đây FK của user_permissions mới ném lỗi, tức
    //    500, và user đã được tạo xong rồi. Giờ là 404 và chưa có gì bị ghi.
    //  - vòng lặp cũ gọi findRoleById cho từng role chỉ để lấy permission_code cho audit log
    //    (N+1 query).
    const roleIds = Array.isArray(role_ids) ? [...new Set(role_ids)] : [];
    let roles = [];
    if (roleIds.length > 0) {
        roles = (await Promise.all(roleIds.map((roleId) => permissionModel.findRoleById(roleId)))).filter(Boolean);
        if (roles.length !== roleIds.length) {
            throw new AppError(404, ERROR_CODE.NOT_FOUND, 'One or more roles do not exist');
        }
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Tạo user và gán role phải cùng thành/cùng thất bại — nếu không, lỗi ở giữa để lại một
    // user đã tồn tại nhưng thiếu role, và client retry sẽ ăn 409.
    let id;
    try {
        id = await db.transaction(async (trx) => {
            const newId = await userModel.create({ username, email, passwordHash, full_name }, trx);
            for (const role of roles) {
                await permissionModel.assignRoleToUser({ userId: newId, permissionId: role.id }, trx);
            }
            return newId;
        });
    } catch (err) {
        // Chỉ username/email có UNIQUE trong luồng này; user_permissions dùng INSERT IGNORE nên
        // không ném trùng. Bọc hẹp quanh đúng transaction để không gán nhầm nguyên nhân 409.
        if (isDuplicateEntry(err)) {
            throw new AppError(409, ERROR_CODE.DUPLICATE, 'Username or email already exists');
        }
        throw err;
    }

    const roleSummary = roles.length > 0 ? `; assigned roles ${roles.map((r) => r.permission_code).join(', ')}` : '';
    await auditLogModel.create({
        userId: actorId,
        action: AUDIT_ACTION.USER_CREATE,
        ip,
        status: AUDIT_STATUS.SUCCESS,
        detail: `Created user ${username} (${email}), full name '${full_name}'${roleSummary}`,
    });
    return { id, username, email, full_name };
}

// Đổi được password hoặc email của một tài khoản là chiếm được tài khoản đó: đặt password mới
// rồi đăng nhập, hoặc đổi email rồi dùng luồng quên mật khẩu. Nếu không chặn, một actor chỉ có
// MOD_USER:edit sẽ chiếm được tài khoản Administrator và có toàn quyền — bỏ qua hết mọi kiểm
// tra quyền chi tiết. Cùng nguyên tắc với assertCanAssignRoles ở trên: khi một endpoint cho
// phép đi đường tắt sang một permission boundary khác, phải kiểm tra lại boundary đó tại đây.
//
// Chỉ chặn khi ĐỐI TƯỢNG bị sửa giữ protected role. Sửa tài khoản thường, hoặc tự sửa chính
// mình, không bị ảnh hưởng — nên hành vi hiện tại của mọi luồng hợp lệ không đổi.
//
// Cũng dùng cho khoá/mở khoá (actionKey 'lock'): MOD_USER:delete không được là đường để một
// actor thường khoá toàn bộ Administrator ra khỏi hệ thống.
async function assertCanTakeOverAccount(targetId, actorId, actionKey = 'account') {
    if (Number(targetId) === Number(actorId)) return;

    const target = await permissionModel.getUserAccess(targetId, PROTECTED_ROLE_CODE);
    if (!target.isProtectedRole) return;

    const actor = await permissionModel.getUserAccess(actorId, PROTECTED_ROLE_CODE);
    if (!actor.isProtectedRole) {
        throw new AppError(403, ERROR_CODE.PROTECTED_ROLE, `Cannot ${actionKey === 'lock' ? 'lock or unlock' : 'change the credentials of'} an Administrator account`, {
            actionKey,
        });
    }
}

async function updateUser(id, { email, full_name, avatar, password, actorId, ip }) {
    const existing = await userModel.findById(id);
    if (!existing) {
        throw new AppError(404, ERROR_CODE.NOT_FOUND, 'User not found');
    }

    // email cũng tính là thông tin đăng nhập: đổi email rồi gọi /forgot-password là chiếm được
    // tài khoản mà không cần biết password cũ.
    if (password || email) {
        await assertCanTakeOverAccount(id, actorId);
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
    // Nối bằng mảng chứ không nối chuỗi: 'No changes' là giá trị thay thế, không phải tiền tố
    // để ghép thêm vào (trước đây chỉ đổi password sinh ra log 'No changespassword changed').
    const detailParts = [diff === 'No changes' ? null : diff, password ? 'password changed' : null].filter(Boolean);
    const detail = `Updated user ${existing.username}: ${detailParts.join('; ') || 'No changes'}`;

    let affectedRows;
    try {
        affectedRows = await userModel.update(id, fields);
    } catch (err) {
        if (isDuplicateEntry(err)) {
            throw new AppError(409, ERROR_CODE.DUPLICATE, 'Email already exists');
        }
        throw err;
    }

    if (affectedRows === 0) {
        throw new AppError(404, ERROR_CODE.NOT_FOUND, 'User not found');
    }

    // Đổi thông tin đăng nhập mà không thu hồi phiên thì user vẫn đăng nhập nguyên trong tối đa
    // JWT_REFRESH_EXPIRES_IN (mặc định 7 ngày) — đúng kịch bản mà việc đổi password cần ngăn.
    // Luồng resetPasswordWithToken của authService đã revoke; chỗ này trước đây thì không.
    if (password) {
        await refreshTokenModel.revokeAllForUser(id);
        await userModel.resetLoginAttempts(id);
    }

    await auditLogModel.create({
        userId: actorId,
        action: AUDIT_ACTION.USER_UPDATE,
        ip,
        status: AUDIT_STATUS.SUCCESS,
        detail,
    });
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
    await assertCanTakeOverAccount(id, actorId, 'lock');

    await userModel.setStatus(id, newStatus);
    // Khoá thì thu hồi luôn refresh token: access token đã bị authenticate chặn qua session
    // guard, nhưng để refresh token sống tới hạn thì mở khoá xong các phiên cũ lại dùng tiếp được.
    if (newStatus === USER_STATUS.LOCKED) {
        await refreshTokenModel.revokeAllForUser(id);
    }

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
