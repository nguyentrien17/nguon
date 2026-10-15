// Unit test cho service/middleware nghiệp vụ, KHÔNG cần DB: các model được thay bằng
// mock.method() — được vì service gọi model qua object (userModel.findById(...)), không
// destructure. Mọi hàm model một test chạm tới đều phải được mock; quên mock thì query thật
// đi tới DB giả ở port 1 (xem _helpers.js) và test fail ngay.
const { mockReq, runMiddleware } = require('./_helpers');
const { test, describe, beforeEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');

const userModel = require('#features/users/userModel');
const permissionModel = require('#features/permissions/permissionModel');
const refreshTokenModel = require('#features/auth/refreshTokenModel');
const auditLogModel = require('#features/audit-logs/auditLogModel');
const userService = require('#features/users/userService');
const permissionService = require('#features/permissions/permissionService');
const authService = require('#features/auth/authService');
const db = require('#core/database/db');
const { requirePermission, requireAnyPermission } = require('#features/permissions/permissionMiddleware');
const AppError = require('#core/errors/AppError');
const { USER_STATUS } = require('#shared');

const ADMIN_ID = 1;
const ACTOR_ID = 10;
const TARGET_ID = 20;

// Ai giữ protected role: chỉ ADMIN_ID, trừ khi test đổi lại.
let adminIds;
function mockAccess(permissionsById = {}) {
    mock.method(permissionModel, 'getUserAccess', async (userId) => ({
        isProtectedRole: adminIds.has(Number(userId)),
        permissions: permissionsById[userId] || [],
    }));
}

beforeEach(() => {
    mock.restoreAll();
    adminIds = new Set([ADMIN_ID]);
    mock.method(auditLogModel, 'create', async () => {});
});

async function rejectsWith(promise, { statusCode, errorCode, actionKey }) {
    await assert.rejects(promise, (err) => {
        assert.ok(err instanceof AppError, `cần AppError, nhận ${err}`);
        assert.equal(err.statusCode, statusCode);
        assert.equal(err.errorCode, errorCode);
        if (actionKey) assert.equal(err.params.actionKey, actionKey);
        return true;
    });
}

describe('permissionMiddleware', () => {
    const USER_VIEW = { module_code: 'MOD_USER', action_code: 'view' };

    test('có đúng quyền -> next()', async () => {
        mockAccess({ [ACTOR_ID]: [USER_VIEW] });
        const { nextCalled, res } = await runMiddleware(requirePermission('MOD_USER', 'view'), mockReq({ user: { id: ACTOR_ID } }));
        assert.ok(nextCalled);
        assert.equal(res.statusCode, 200);
    });

    test('thiếu quyền -> 403 ERR_PERMISSION_DENIED', async () => {
        mockAccess({ [ACTOR_ID]: [USER_VIEW] });
        const { nextCalled, res } = await runMiddleware(requirePermission('MOD_USER', 'edit'), mockReq({ user: { id: ACTOR_ID } }));
        assert.equal(nextCalled, false);
        assert.equal(res.statusCode, 403);
        assert.equal(res.body.errorCode, 'ERR_PERMISSION_DENIED');
    });

    test('protected role -> qua mọi kiểm tra', async () => {
        mockAccess();
        const { nextCalled } = await runMiddleware(requirePermission('MOD_ANY', 'anything'), mockReq({ user: { id: ADMIN_ID } }));
        assert.ok(nextCalled);
    });

    test('requireAnyPermission: chỉ cần một trong các quyền', async () => {
        mockAccess({ [ACTOR_ID]: [USER_VIEW] });
        const mw = requireAnyPermission('MOD_PERMISSION:view', 'MOD_USER:view');
        const { nextCalled } = await runMiddleware(mw, mockReq({ user: { id: ACTOR_ID } }));
        assert.ok(nextCalled);
    });

    test('lỗi DB -> next(err), không cho qua', async () => {
        mock.method(permissionModel, 'getUserAccess', async () => {
            throw new Error('db down');
        });
        const { nextArg } = await runMiddleware(requirePermission('MOD_USER', 'view'), mockReq({ user: { id: ACTOR_ID } }));
        assert.equal(nextArg.message, 'db down');
    });
});

// Transaction giả: chạy callback với một trx giả — đủ để test logic quanh transaction mà không
// cần DB. Danh sách "admin đang hoạt động" (đọc có khoá dòng) được mock theo từng test.
const FAKE_TRX = Symbol('trx');
function mockTransaction() {
    mock.method(db, 'transaction', async (fn) => fn(FAKE_TRX));
}
function mockActiveAdmins(ids) {
    return mock.method(permissionModel, 'lockActiveProtectedUserIds', async () => ids);
}

describe('userService.setUserStatus', () => {
    const LOCK = USER_STATUS.LOCKED;
    const ACTIVE = USER_STATUS.ACTIVE;
    let setStatus;
    let revokeAll;
    beforeEach(() => {
        setStatus = mock.method(userModel, 'setStatus', async () => 1);
        revokeAll = mock.method(refreshTokenModel, 'revokeAllForUser', async () => {});
        mockTransaction();
        mockActiveAdmins([ADMIN_ID]);
    });

    const withUser = (user) => mock.method(userModel, 'findById', async () => user);

    test('actor thường khoá Administrator -> 403 ERR_PROTECTED_ROLE (lock), không ghi gì', async () => {
        mockAccess();
        withUser({ id: ADMIN_ID, username: 'superadmin', status: ACTIVE });
        await rejectsWith(userService.setUserStatus(ADMIN_ID, { status: LOCK, actorId: ACTOR_ID }), {
            statusCode: 403,
            errorCode: 'ERR_PROTECTED_ROLE',
            actionKey: 'lock',
        });
        assert.equal(setStatus.mock.callCount(), 0);
    });

    test('actor thường MỞ khoá Administrator cũng bị chặn', async () => {
        mockAccess();
        withUser({ id: ADMIN_ID, username: 'superadmin', status: LOCK });
        await rejectsWith(userService.setUserStatus(ADMIN_ID, { status: ACTIVE, actorId: ACTOR_ID }), {
            statusCode: 403,
            errorCode: 'ERR_PROTECTED_ROLE',
        });
    });

    test('Administrator khoá Administrator khác khi còn admin hoạt động -> được phép, ghi trong transaction', async () => {
        adminIds.add(2);
        mockAccess();
        mockActiveAdmins([ADMIN_ID, 2]);
        withUser({ id: 2, username: 'admin2', status: ACTIVE });
        const result = await userService.setUserStatus(2, { status: LOCK, actorId: ADMIN_ID });
        assert.equal(result.status, LOCK);
        assert.deepEqual(setStatus.mock.calls[0].arguments, [2, LOCK, FAKE_TRX]);
    });

    test('khoá admin hoạt động CUỐI CÙNG -> 409 ERR_LAST_ADMIN, không ghi gì (vd A và B khoá nhau cùng lúc)', async () => {
        adminIds.add(2);
        mockAccess();
        // Kịch bản race: transaction kia đã khoá ADMIN_ID; khi tới lượt, chỉ còn admin 2 hoạt động.
        mockActiveAdmins([2]);
        withUser({ id: 2, username: 'admin2', status: ACTIVE });
        await rejectsWith(userService.setUserStatus(2, { status: LOCK, actorId: ADMIN_ID }), { statusCode: 409, errorCode: 'ERR_LAST_ADMIN' });
        assert.equal(setStatus.mock.callCount(), 0);
        assert.equal(revokeAll.mock.callCount(), 0);
    });

    test('tự khoá chính mình -> 403 ERR_SELF_LOCK', async () => {
        mockAccess();
        withUser({ id: ACTOR_ID, username: 'me', status: ACTIVE });
        await rejectsWith(userService.setUserStatus(ACTOR_ID, { status: LOCK, actorId: ACTOR_ID }), {
            statusCode: 403,
            errorCode: 'ERR_SELF_LOCK',
        });
    });

    test('khoá user thường -> đổi status VÀ revoke mọi refresh token', async () => {
        mockAccess();
        withUser({ id: TARGET_ID, username: 'bob', status: ACTIVE });
        const result = await userService.setUserStatus(TARGET_ID, { status: LOCK, actorId: ACTOR_ID });
        assert.deepEqual(result, { id: TARGET_ID, status: LOCK });
        assert.deepEqual(setStatus.mock.calls[0].arguments.slice(0, 2), [TARGET_ID, LOCK]);
        assert.equal(revokeAll.mock.callCount(), 1);
        assert.equal(revokeAll.mock.calls[0].arguments[0], TARGET_ID);
    });

    test('mở khoá user thường -> không cần revoke', async () => {
        mockAccess();
        withUser({ id: TARGET_ID, username: 'bob', status: LOCK });
        const result = await userService.setUserStatus(TARGET_ID, { status: ACTIVE, actorId: ACTOR_ID });
        assert.equal(result.status, ACTIVE);
        assert.equal(revokeAll.mock.callCount(), 0);
    });

    test('đặt đúng trạng thái đang có -> không ghi, không audit (gửi lại không đảo trạng thái)', async () => {
        mockAccess();
        withUser({ id: TARGET_ID, username: 'bob', status: LOCK });
        const result = await userService.setUserStatus(TARGET_ID, { status: LOCK, actorId: ACTOR_ID });
        assert.equal(result.status, LOCK);
        assert.equal(setStatus.mock.callCount(), 0);
        assert.equal(auditLogModel.create.mock.callCount(), 0);
    });

    test('user không tồn tại -> 404', async () => {
        mockAccess();
        withUser(null);
        await rejectsWith(userService.setUserStatus(999, { status: LOCK, actorId: ACTOR_ID }), { statusCode: 404, errorCode: 'ERR_NOT_FOUND' });
    });
});

describe('permissionService — gán / gỡ role Administrator', () => {
    const ADMIN_ROLE = { id: 100, permission_code: 'ROLE_ADMIN', permission_name: 'Administrator' };
    const STAFF_ROLE = { id: 200, permission_code: 'ROLE_STAFF', permission_name: 'Staff' };
    let assign;
    let unassign;
    beforeEach(() => {
        mockTransaction();
        mockActiveAdmins([ADMIN_ID, 2]);
        mock.method(userModel, 'findById', async (id) => ({ id: Number(id), username: `u${id}` }));
        assign = mock.method(permissionModel, 'assignRoleToUser', async () => {});
        unassign = mock.method(permissionModel, 'unassignRoleFromUser', async () => 1);
    });
    const withRole = (role) => mock.method(permissionModel, 'findRoleById', async () => role);

    test('KHÔNG phải admin tự gán ROLE_ADMIN cho mình -> 403 (chặn leo quyền)', async () => {
        mockAccess();
        withRole(ADMIN_ROLE);
        await rejectsWith(permissionService.assignRoleToUser({ permissionId: 100, userId: ACTOR_ID, actorId: ACTOR_ID }), {
            statusCode: 403,
            errorCode: 'ERR_PROTECTED_ROLE',
            actionKey: 'assign',
        });
        assert.equal(assign.mock.callCount(), 0);
    });

    test('không phải admin gán role THƯỜNG -> vẫn được (guard không chặn quá rộng)', async () => {
        mockAccess();
        withRole(STAFF_ROLE);
        await permissionService.assignRoleToUser({ permissionId: 200, userId: TARGET_ID, actorId: ACTOR_ID });
        assert.equal(assign.mock.callCount(), 1);
    });

    test('admin gán ROLE_ADMIN -> được', async () => {
        mockAccess();
        withRole(ADMIN_ROLE);
        await permissionService.assignRoleToUser({ permissionId: 100, userId: TARGET_ID, actorId: ADMIN_ID });
        assert.equal(assign.mock.callCount(), 1);
    });

    test('KHÔNG phải admin gỡ ROLE_ADMIN của admin khác -> 403', async () => {
        mockAccess();
        withRole(ADMIN_ROLE);
        await rejectsWith(permissionService.unassignRoleFromUser({ permissionId: 100, userId: ADMIN_ID, actorId: ACTOR_ID }), {
            statusCode: 403,
            errorCode: 'ERR_PROTECTED_ROLE',
        });
        assert.equal(unassign.mock.callCount(), 0);
    });

    test('admin gỡ ROLE_ADMIN của admin khác khi còn admin -> được, trong transaction', async () => {
        adminIds.add(2);
        mockAccess();
        withRole(ADMIN_ROLE);
        await permissionService.unassignRoleFromUser({ permissionId: 100, userId: 2, actorId: ADMIN_ID });
        assert.equal(unassign.mock.calls[0].arguments[1], FAKE_TRX);
    });

    test('gỡ ROLE_ADMIN của admin hoạt động cuối cùng -> 409 ERR_LAST_ADMIN', async () => {
        adminIds.add(2);
        mockAccess();
        mockActiveAdmins([2]); // race: actor vừa bị gỡ admin ở transaction khác
        withRole(ADMIN_ROLE);
        await rejectsWith(permissionService.unassignRoleFromUser({ permissionId: 100, userId: 2, actorId: ADMIN_ID }), {
            statusCode: 409,
            errorCode: 'ERR_LAST_ADMIN',
        });
        assert.equal(unassign.mock.callCount(), 0);
    });

    test('createUser kèm ROLE_ADMIN bởi người không phải admin -> 403, không tạo user', async () => {
        const ACTOR_PERMS = { [ACTOR_ID]: [{ module_code: 'MOD_PERMISSION', action_code: 'edit' }] };
        mockAccess(ACTOR_PERMS);
        withRole(ADMIN_ROLE);
        const create = mock.method(userModel, 'create', async () => 99);
        await rejectsWith(
            userService.createUser({ username: 'x', email: 'x@y.z', password: 'Passw0rd1', full_name: 'X', role_ids: [100], actorId: ACTOR_ID }),
            { statusCode: 403, errorCode: 'ERR_PROTECTED_ROLE', actionKey: 'assign' }
        );
        assert.equal(create.mock.callCount(), 0);
    });
});

describe('userService.updateUser — guard chiếm tài khoản', () => {
    beforeEach(() => {
        mock.method(userModel, 'findById', async (id) => ({ id: Number(id), username: `u${id}`, email: `u${id}@x.io`, full_name: 'X' }));
        mock.method(refreshTokenModel, 'revokeAllForUser', async () => {});
        mock.method(userModel, 'resetLoginAttempts', async () => 1);
    });

    test('actor thường đổi password của Administrator -> 403 (account), không ghi', async () => {
        mockAccess();
        const update = mock.method(userModel, 'update', async () => 1);
        await rejectsWith(userService.updateUser(ADMIN_ID, { password: 'Hacked123', actorId: ACTOR_ID }), {
            statusCode: 403,
            errorCode: 'ERR_PROTECTED_ROLE',
            actionKey: 'account',
        });
        assert.equal(update.mock.callCount(), 0);
    });

    test('actor thường chỉ đổi full_name của Administrator -> được phép (guard không chặn quá rộng)', async () => {
        mockAccess();
        mock.method(userModel, 'update', async () => 1);
        await userService.updateUser(ADMIN_ID, { full_name: 'New Name', actorId: ACTOR_ID });
    });

    test('đổi password user thường -> revoke phiên của user đó', async () => {
        mockAccess();
        mock.method(userModel, 'update', async () => 1);
        await userService.updateUser(TARGET_ID, { password: 'NewPass123', actorId: ACTOR_ID });
        assert.equal(refreshTokenModel.revokeAllForUser.mock.calls[0].arguments[0], TARGET_ID);
    });
});

describe('authService', () => {
    test('isSessionActive: user hoạt động -> true; bị khoá / không tồn tại -> false', async () => {
        const users = { 1: { id: 1, status: USER_STATUS.ACTIVE }, 2: { id: 2, status: USER_STATUS.LOCKED } };
        mock.method(userModel, 'findById', async (id) => users[id] || null);
        assert.equal(await authService.isSessionActive({ id: 1 }), true);
        assert.equal(await authService.isSessionActive({ id: 2 }), false);
        assert.equal(await authService.isSessionActive({ id: 3 }), false);
    });

    test('refresh: token đã bị dùng (consume trả false) -> 401 ERR_TOKEN_EXPIRED', async () => {
        const { signRefreshToken } = require('#core/security/jwt');
        mock.method(refreshTokenModel, 'consume', async () => false);
        await rejectsWith(authService.refresh({ token: signRefreshToken({ id: 1 }) }), { statusCode: 401, errorCode: 'ERR_TOKEN_EXPIRED' });
    });

    test('refresh: user đã bị khoá -> 401 dù token hợp lệ', async () => {
        const { signRefreshToken } = require('#core/security/jwt');
        mock.method(refreshTokenModel, 'consume', async () => true);
        mock.method(userModel, 'findById', async () => ({ id: 1, status: USER_STATUS.LOCKED }));
        await rejectsWith(authService.refresh({ token: signRefreshToken({ id: 1 }) }), { statusCode: 401, errorCode: 'ERR_UNAUTHORIZED' });
    });

    describe('login sai mật khẩu', () => {
        let lockLogin;
        beforeEach(async () => {
            const hash = await bcrypt.hash('Right123', 4);
            mock.method(userModel, 'findByUsername', async () => ({
                id: 5, username: 'bob', password: hash, status: USER_STATUS.ACTIVE, locked_until: null, failed_login_attempts: 0,
            }));
            lockLogin = mock.method(userModel, 'lockLogin', async () => 1);
        });

        test('lần sai thứ 4 -> 401, chưa khoá', async () => {
            mock.method(userModel, 'incrementFailedLogin', async () => 4);
            await rejectsWith(authService.login({ username: 'bob', password: 'Wrong123' }), { statusCode: 401, errorCode: 'ERR_INVALID_CREDENTIALS' });
            assert.equal(lockLogin.mock.callCount(), 0);
        });

        // Ngưỡng dựa trên giá trị DB trả về SAU khi tăng, không phải giá trị đọc lúc đầu
        // (failed_login_attempts: 0 ở trên) — đúng điều kiện để request song song không lọt.
        test('bộ đếm DB chạm 5 -> khoá tài khoản', async () => {
            mock.method(userModel, 'incrementFailedLogin', async () => 5);
            await rejectsWith(authService.login({ username: 'bob', password: 'Wrong123' }), { statusCode: 401, errorCode: 'ERR_INVALID_CREDENTIALS' });
            assert.equal(lockLogin.mock.callCount(), 1);
            assert.ok(lockLogin.mock.calls[0].arguments[1] > new Date());
        });
    });

    test('login: tài khoản đang bị khoá tạm -> 423, không so mật khẩu', async () => {
        mock.method(userModel, 'findByUsername', async () => ({
            id: 5, password: 'x', status: USER_STATUS.ACTIVE, locked_until: new Date(Date.now() + 60000),
        }));
        await rejectsWith(authService.login({ username: 'bob', password: 'any' }), { statusCode: 423, errorCode: 'ERR_ACCOUNT_LOCKED' });
    });
});
