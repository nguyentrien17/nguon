// Integration test cho guard chống chiếm tài khoản đặc quyền (docs/security.md 9.1).
//
// Test này TẠO rồi TỰ XOÁ dữ liệu của nó: 1 role tạm + 2 user tạm, tất cả mang tiền tố
// `sectest_` / `ROLE_SECTEST_TMP`. Nó KHÔNG sửa dữ liệu có sẵn — đặc biệt không đổi mật khẩu
// superadmin (bước kiểm tra 403 đúng là bước phải thất bại). Dọn dẹp chạy trong `finally`.
//
// Yêu cầu: server đang chạy + MySQL. Chạy: npm run test:security
const crypto = require('crypto');
const db = require('#core/database/db');
const { MODULE_CODE, ACTION_CODE } = require('#shared');

const BASE = process.env.TEST_API_URL || 'http://localhost:5000/api';
const TMP_ROLE_CODE = 'ROLE_SECTEST_TMP';
const TMP_PASSWORD = 'SecTest@12345';

let passed = 0;
let failed = 0;

function check(name, condition, detail = '') {
    if (condition) {
        passed += 1;
        console.log(`  ok   ${name}`);
    } else {
        failed += 1;
        console.error(`  FAIL ${name}${detail ? `\n       ${detail}` : ''}`);
    }
}

async function signedRequest(method, path, token, signingKey, payload, extraHeaders = {}) {
    const body = payload === undefined ? '' : JSON.stringify(payload);
    const ts = Date.now().toString();
    const sig = crypto.createHmac('sha256', signingKey).update(`${ts}.${body}`).digest('hex');
    const res = await fetch(`${BASE}${path}`, {
        method,
        headers: {
            ...(body ? { 'Content-Type': 'application/json' } : {}),
            Authorization: `Bearer ${token}`,
            'X-Signature-Timestamp': ts,
            'X-Signature': sig,
            ...extraHeaders,
        },
        body: body || undefined,
    });
    return { status: res.status, body: await res.json() };
}

const signedPut = (path, token, signingKey, payload) => signedRequest('PUT', path, token, signingKey, payload);

// Lấy "refreshToken=..." từ Set-Cookie để gửi lại ở header Cookie.
function refreshCookieOf(res) {
    const match = /refreshToken=[^;]+/.exec(res.headers.get('set-cookie') || '');
    return match ? match[0] : '';
}

async function refreshWith(cookie) {
    const res = await fetch(`${BASE}/auth/refresh`, { method: 'POST', headers: { Cookie: cookie } });
    return { status: res.status, body: await res.json(), cookie: refreshCookieOf(res) };
}

// loginLimiter giới hạn 5 request/phút/IP trên /auth/login (core/security/rateLimiter.js).
// Test này dùng 4 lần đăng nhập; chạy nó ngay sau test:contract (vốn cũng đăng nhập) có thể
// chạm trần. Đếm và báo rõ thay vì để assertion fail với thông báo vô nghĩa.
let loginCount = 0;

async function login(username, password) {
    loginCount += 1;
    const res = await fetch(`${BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
    });
    const body = await res.json();
    const cookie = refreshCookieOf(res);
    if (res.status === 429) {
        throw new Error(
            `Bị loginLimiter chặn ở lần đăng nhập thứ ${loginCount} (429). Giới hạn là 5 req/phút/IP.\n` +
            '       Chờ 1 phút rồi chạy lại, hoặc đừng chạy test:contract và test:security liền nhau.'
        );
    }
    return { status: res.status, body, cookie };
}

// Trạng thái gốc của superadmin, ghi lại trước khi test đụng tới — nếu guard khoá-admin hỏng
// và bước 13 lỡ khoá được tài khoản này, cleanup trả nó về như cũ.
let adminOriginalStatus = null;

async function cleanup() {
    // ON DELETE CASCADE dọn luôn user_permissions và permission_details liên quan.
    await db('users').where('username', 'like', 'sectest_%').del();
    await db('permissions').where({ permission_code: TMP_ROLE_CODE }).del();
    if (adminOriginalStatus !== null) {
        await db('users').where({ id: 1 }).update({ status: adminOriginalStatus });
    }
}

async function main() {
    await cleanup(); // xoá sót của lần chạy trước, nếu có
    adminOriginalStatus = (await db('users').where({ id: 1 }).first('status'))?.status ?? null;

    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash(TMP_PASSWORD, 12);

    // 1. Role tạm chỉ có MOD_USER:view/edit/delete — KHÔNG phải protected role.
    //    delete = khoá/mở khoá tài khoản (DELETE /users/:id), dùng ở bước 13.
    const [roleId] = await db('permissions').insert({
        permission_code: TMP_ROLE_CODE,
        permission_name: 'Sec test temporary role',
    });
    const actions = await db('actions as a')
        .join('modules as m', 'm.id', 'a.module_id')
        .where('m.module_code', MODULE_CODE.USER)
        .whereIn('a.action_code', [ACTION_CODE.VIEW, ACTION_CODE.EDIT, ACTION_CODE.DELETE])
        .select('a.id', 'a.module_id');
    if (actions.length === 0) throw new Error(`Không tìm thấy action ${MODULE_CODE.USER}:view/edit — DB chưa seed?`);
    await db('permission_details').insert(
        actions.map((a) => ({ permission_id: roleId, module_id: a.module_id, action_id: a.id }))
    );

    // 2. Hai user tạm: attacker (có role trên) và victim (user thường, không role).
    const [attackerId] = await db('users').insert({
        username: 'sectest_attacker', email: 'sectest_attacker@example.com', password: hash, full_name: 'Sec Test Attacker',
    });
    const [victimId] = await db('users').insert({
        username: 'sectest_victim', email: 'sectest_victim@example.com', password: hash, full_name: 'Sec Test Victim',
    });
    await db('user_permissions').insert({ user_id: attackerId, permission_id: roleId });

    // 3. attacker đăng nhập được và THẬT SỰ có quyền MOD_USER:edit.
    const session = await login('sectest_attacker', TMP_PASSWORD);
    check('attacker đăng nhập được', session.status === 200, JSON.stringify(session.body).slice(0, 150));
    if (session.status !== 200) return;
    const { accessToken, signingKey } = session.body;
    check(
        'attacker có quyền MOD_USER:edit (nếu không thì các test sau vô nghĩa)',
        session.body.permissions.some((p) => p.module_code === MODULE_CODE.USER && p.action_code === ACTION_CODE.EDIT)
    );

    // 4. CỐT LÕI: attacker đổi mật khẩu superadmin (id 1, giữ protected role) -> phải 403.
    const takeover = await signedPut('/users/1', accessToken, signingKey, { password: 'Hacked@12345' });
    check(
        'đổi PASSWORD của tài khoản Administrator -> 403 ERR_PROTECTED_ROLE',
        takeover.status === 403 && takeover.body.errorCode === 'ERR_PROTECTED_ROLE',
        `${takeover.status} ${JSON.stringify(takeover.body)}`
    );

    // 5. Đổi email cũng là đường chiếm tài khoản (đổi email rồi dùng /forgot-password).
    const emailTakeover = await signedPut('/users/1', accessToken, signingKey, { email: 'attacker@evil.test' });
    check(
        'đổi EMAIL của tài khoản Administrator -> 403 ERR_PROTECTED_ROLE',
        emailTakeover.status === 403 && emailTakeover.body.errorCode === 'ERR_PROTECTED_ROLE',
        `${emailTakeover.status} ${JSON.stringify(emailTakeover.body)}`
    );

    // 6. Xác nhận mật khẩu superadmin KHÔNG bị đổi (guard chặn trước khi ghi).
    //    Giữ lại session này để bước 12 dùng lại, tiết kiệm 1 lần đăng nhập (xem loginLimiter).
    const adminSession = await login('superadmin', 'Admin@123');
    check('mật khẩu superadmin không bị thay đổi', adminSession.status === 200, `nhận ${adminSession.status}`);
    const hackedWorks = await login('superadmin', 'Hacked@12345');
    check('mật khẩu "Hacked@12345" KHÔNG đăng nhập được', hackedWorks.status !== 200, `nhận ${hackedWorks.status}`);

    // 7. Guard không được chặn quá rộng: sửa user thường vẫn phải thành công.
    const normalEdit = await signedPut(`/users/${victimId}`, accessToken, signingKey, { full_name: 'Sec Test Victim Renamed' });
    check('sửa full_name của user thường -> 200 (guard không chặn quá rộng)', normalEdit.status === 200, `nhận ${normalEdit.status}`);

    const normalPwd = await signedPut(`/users/${victimId}`, accessToken, signingKey, { password: 'Changed@12345' });
    check('đổi password của user THƯỜNG -> 200 (vẫn cho phép)', normalPwd.status === 200, `nhận ${normalPwd.status}`);

    // 8. Đổi password phải thu hồi phiên của user đó (docs/security.md 9.2).
    const victimSession = await login('sectest_victim', 'Changed@12345');
    check('victim đăng nhập được bằng mật khẩu mới', victimSession.status === 200, `nhận ${victimSession.status}`);
    const remaining = await db('refresh_tokens').where({ user_id: victimId, revoked: 0 }).count({ c: '*' }).first();
    check(
        'phiên cũ của victim đã bị revoke (chỉ còn đúng 1 phiên vừa đăng nhập)',
        Number(remaining.c) === 1,
        `còn ${remaining.c} refresh token chưa revoke`
    );

    // 8b. JSON hỏng là lỗi của client -> 400, không phải 500. /auth/refresh không có loginLimiter
    //     và express.json() chạy trước mọi route nên lỗi parse xảy ra trước khi tới controller.
    const badJson = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"broken": ',
    });
    const badJsonBody = await badJson.json();
    check(
        'body JSON sai cú pháp -> 400 ERR_VALIDATION (không phải 500)',
        badJson.status === 400 && badJsonBody.errorCode === 'ERR_VALIDATION',
        `${badJson.status} ${JSON.stringify(badJsonBody)}`
    );

    // 8c. Hai request refresh song song cùng một refresh token -> CHỈ MỘT được cấp phiên mới.
    const [r1, r2] = await Promise.all([refreshWith(victimSession.cookie), refreshWith(victimSession.cookie)]);
    const winners = [r1, r2].filter((r) => r.status === 200);
    check(
        'refresh song song cùng 1 token -> đúng 1 request thành công',
        winners.length === 1,
        `trạng thái: ${r1.status}, ${r2.status}`
    );
    const victimLive = winners[0];

    // 8d. User tự đổi mật khẩu -> thu hồi các phiên KHÁC, giữ phiên đang thao tác.
    if (victimLive) {
        const [otherId] = await db('refresh_tokens').insert({
            user_id: victimId,
            token_hash: crypto.randomBytes(32).toString('hex'),
            expires_at: new Date(Date.now() + 3600 * 1000),
        });
        const selfChange = await signedRequest(
            'PUT', '/auth/password', victimLive.body.accessToken, victimLive.body.signingKey,
            { currentPassword: 'Changed@12345', newPassword: 'Changed@67890' },
            { Cookie: victimLive.cookie }
        );
        check('tự đổi mật khẩu -> 200', selfChange.status === 200, `${selfChange.status} ${JSON.stringify(selfChange.body)}`);

        const other = await db('refresh_tokens').where({ id: otherId }).first('revoked');
        check('tự đổi mật khẩu -> phiên khác bị revoke', other && Number(other.revoked) === 1);

        const stillAlive = await refreshWith(victimLive.cookie);
        check('tự đổi mật khẩu -> phiên đang dùng vẫn refresh được', stillAlive.status === 200, `nhận ${stillAlive.status}`);
        if (stillAlive.status === 200) Object.assign(victimLive, stillAlive);
    }

    // 8e. Bộ đếm đăng nhập sai tăng nguyên tử: 5 lần tăng song song phải ra đúng 5. Gọi thẳng
    //     model thay vì qua HTTP để không đốt hạn mức loginLimiter.
    const userModel = require('#features/users/userModel');
    await userModel.resetLoginAttempts(victimId);
    await Promise.all(Array.from({ length: 5 }, () => userModel.incrementFailedLogin(victimId)));
    const counter = await db('users').where({ id: victimId }).first('failed_login_attempts');
    check(
        '5 lần tăng failed_login_attempts song song -> đúng 5 (không mất lần nào)',
        Number(counter.failed_login_attempts) === 5,
        `nhận ${counter.failed_login_attempts}`
    );
    await userModel.resetLoginAttempts(victimId);

    // 9. :id không hợp lệ phải bị chặn, không được coerce thành số.
    const badId = await signedPut('/users/1abc', accessToken, signingKey, { full_name: 'X' });
    check(
        'PUT /users/1abc -> 400 ERR_VALIDATION (không coerce thành id 1)',
        badId.status === 400 && badId.body.errorCode === 'ERR_VALIDATION',
        `${badId.status} ${JSON.stringify(badId.body)}`
    );

    // 10. limit âm phải bị clamp, không được thành 500.
    const negLimit = await fetch(`${BASE}/users?limit=-5`, { headers: { Authorization: `Bearer ${accessToken}` } });
    const negBody = await negLimit.json();
    check(
        'GET /users?limit=-5 -> 200 và limit được clamp về 1',
        negLimit.status === 200 && negBody.pagination?.limit === 1,
        `${negLimit.status} ${JSON.stringify(negBody.pagination)}`
    );

    // 11. Audit log của lần đổi password phải đọc được, không bị dính chữ.
    const log = await db('audit_logs')
        .where({ action: 'USER_UPDATE' })
        .andWhere('detail', 'like', '%sectest_victim%')
        .orderBy('id', 'desc')
        .first();
    check(
        'audit log đổi password không còn dính chữ "No changespassword"',
        log && !log.detail.includes('No changespassword'),
        log ? log.detail : '(không tìm thấy bản ghi)'
    );
    check(
        'audit log chỉ-đổi-password ghi rõ "password changed"',
        log && log.detail.includes('password changed'),
        log ? log.detail : '(không tìm thấy bản ghi)'
    );

    // 12. role_ids không tồn tại -> 404, và KHÔNG được tạo user nào (transaction).
    //     Dùng lại adminSession của bước 6 thay vì đăng nhập lần nữa.
    const bodyCreate = JSON.stringify({
        username: 'sectest_rollback', email: 'sectest_rollback@example.com',
        password: TMP_PASSWORD, full_name: 'Sec Test Rollback', role_ids: [999999],
    });
    const ts = Date.now().toString();
    const sig = crypto.createHmac('sha256', adminSession.body.signingKey).update(`${ts}.${bodyCreate}`).digest('hex');
    const createRes = await fetch(`${BASE}/users`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${adminSession.body.accessToken}`,
            'X-Signature-Timestamp': ts, 'X-Signature': sig,
        },
        body: bodyCreate,
    });
    const createBody = await createRes.json();
    check(
        'tạo user với role_ids không tồn tại -> 404, không phải 500',
        createRes.status === 404 && createBody.errorCode === 'ERR_NOT_FOUND',
        `${createRes.status} ${JSON.stringify(createBody)}`
    );
    const orphan = await db('users').where({ username: 'sectest_rollback' }).first();
    check('không có user mồ côi nào được tạo', !orphan, orphan ? `đã tạo id ${orphan.id}` : '');

    // 13. attacker có MOD_USER:delete nhưng KHÔNG được khoá tài khoản Administrator.
    const lockAdmin = await signedRequest('DELETE', '/users/1', accessToken, signingKey);
    check(
        'khoá tài khoản Administrator bằng actor thường -> 403 ERR_PROTECTED_ROLE',
        lockAdmin.status === 403 && lockAdmin.body.errorCode === 'ERR_PROTECTED_ROLE',
        `${lockAdmin.status} ${JSON.stringify(lockAdmin.body)}`
    );
    const adminRow = await db('users').where({ id: 1 }).first('status');
    check('superadmin vẫn chưa bị khoá', adminRow && Number(adminRow.status) === Number(adminOriginalStatus));

    // 14. Khoá user có hiệu lực NGAY: access token còn hạn bị từ chối, refresh token bị thu hồi.
    if (!victimLive) return;
    const lockVictim = await signedRequest('DELETE', `/users/${victimId}`, adminSession.body.accessToken, adminSession.body.signingKey);
    check('admin khoá victim -> 200', lockVictim.status === 200, `${lockVictim.status} ${JSON.stringify(lockVictim.body)}`);

    const meAfterLock = await fetch(`${BASE}/auth/me`, { headers: { Authorization: `Bearer ${victimLive.body.accessToken}` } });
    const meBody = await meAfterLock.json();
    check(
        'access token của user vừa bị khoá -> 401 ERR_TOKEN_EXPIRED ngay lập tức',
        meAfterLock.status === 401 && meBody.errorCode === 'ERR_TOKEN_EXPIRED',
        `${meAfterLock.status} ${JSON.stringify(meBody)}`
    );
    const activeTokens = await db('refresh_tokens').where({ user_id: victimId, revoked: 0 }).count({ c: '*' }).first();
    check('khoá user -> mọi refresh token của user bị revoke', Number(activeTokens.c) === 0, `còn ${activeTokens.c}`);
}

main()
    .catch((err) => {
        failed += 1;
        console.error('\nLỖI khi chạy test:', err.message);
        console.error('Kiểm tra: server đã chạy chưa, MySQL đã seed chưa?');
    })
    .finally(async () => {
        await cleanup().catch((e) => console.error('CẢNH BÁO: dọn dữ liệu test thất bại:', e.message));
        await db.destroy();
        console.log(`\n${failed === 0 ? 'SECURITY OK' : 'SECURITY FAILED'}: ${passed} đạt, ${failed} lỗi.`);
        process.exit(failed === 0 ? 0 : 1);
    });
