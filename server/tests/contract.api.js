// Contract test: khẳng định server vẫn trả ĐÚNG những field mà client đang đọc.
//
// Danh sách field dưới đây được rút ra bằng cách grep toàn bộ client/src tìm mọi chỗ đọc
// response (`data.accessToken`, `data.pagination`, `data?.errorCode`...). Nếu một test ở đây
// fail nghĩa là một trang client sẽ vỡ — xem docs/api-conventions.md trước khi "sửa cho đẹp".
//
// Yêu cầu: server đang chạy ở BASE_URL và MySQL đã có dữ liệu seed.
// Chạy: npm run test:contract
const crypto = require('crypto');

const BASE = process.env.TEST_API_URL || 'http://localhost:5000/api';
const USERNAME = process.env.TEST_USERNAME || 'superadmin';
const PASSWORD = process.env.TEST_PASSWORD || 'Admin@123';

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

async function main() {
    // --- Contract 1: login trả accessToken / signingKey / user / permissions NGANG CẤP với
    // success (không bọc trong `data`). client/src/api/axiosClient.js và AuthContext đọc vậy.
    const loginRes = await fetch(`${BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
    });
    const s = await loginRes.json();

    check('POST /auth/login -> 200', loginRes.status === 200, `nhận ${loginRes.status}`);
    check('login.success === true', s.success === true);
    check('login.accessToken (ngang cấp, không trong data)', typeof s.accessToken === 'string' && s.accessToken.length > 0);
    check('login.signingKey (ngang cấp)', typeof s.signingKey === 'string' && s.signingKey.length > 0);
    check('login.user là object', s.user && typeof s.user === 'object');
    check('login.permissions là array', Array.isArray(s.permissions));
    check('login KHÔNG trả password', !JSON.stringify(s).toLowerCase().includes('"password"'));

    const auth = { Authorization: `Bearer ${s.accessToken}` };
    const cookie = loginRes.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');

    // --- Contract 2: refresh cookie phải HttpOnly (client không được đọc bằng JS)
    const setCookie = loginRes.headers.getSetCookie().join(' ');
    check('cookie refreshToken có HttpOnly', /httponly/i.test(setCookie), setCookie);
    check('cookie refreshToken có SameSite', /samesite/i.test(setCookie), setCookie);

    // --- Contract 3: danh sách dùng khoá `pagination` (KHÔNG phải `meta`).
    // client/src/pages/users/Users.jsx:52, audit-logs/AuditLogs.jsx:27 đọc data.pagination.
    const usersRes = await fetch(`${BASE}/users?page=1&limit=10`, { headers: auth });
    const users = await usersRes.json();
    check('GET /users -> 200', usersRes.status === 200, `nhận ${usersRes.status}`);
    check('users.data là array', Array.isArray(users.data));
    check('users.pagination tồn tại (không phải `meta`)', users.pagination !== undefined && users.meta === undefined);
    check(
        'users.pagination có page/limit/total/totalPages',
        ['page', 'limit', 'total', 'totalPages'].every((k) => typeof users.pagination?.[k] === 'number'),
        JSON.stringify(users.pagination)
    );
    // Dashboard.jsx:20 đọc r.data.pagination.total
    check('users.pagination.total là number', typeof users.pagination?.total === 'number');
    check('danh sách users KHÔNG chứa cột password', !JSON.stringify(users.data).toLowerCase().includes('"password"'));

    // --- Contract 4: lỗi dùng errorCode + message PHẲNG (không bọc trong `error`).
    // client/src/utils/errorMessage.js đọc data.message và data.errorCode.
    const unauthRes = await fetch(`${BASE}/users`);
    const unauth = await unauthRes.json();
    check('GET /users không token -> 401', unauthRes.status === 401, `nhận ${unauthRes.status}`);
    check('lỗi.success === false', unauth.success === false);
    check('lỗi.errorCode phẳng (không phải error.code)', typeof unauth.errorCode === 'string' && unauth.error === undefined);
    check('lỗi.message là string', typeof unauth.message === 'string');
    check('lỗi KHÔNG trả stack trace', !('stack' in unauth));

    // --- Contract 5: axiosClient.js phân nhánh refresh theo errorCode === ERR_TOKEN_EXPIRED.
    const badTokenRes = await fetch(`${BASE}/users`, { headers: { Authorization: 'Bearer token.khong.hop.le' } });
    const badToken = await badTokenRes.json();
    check('token sai -> 401 ERR_TOKEN_EXPIRED (axiosClient dựa vào mã này để refresh)',
        badTokenRes.status === 401 && badToken.errorCode === 'ERR_TOKEN_EXPIRED',
        `${badTokenRes.status} ${badToken.errorCode}`);

    // --- Contract 6: refresh trả lại accessToken + signingKey mới (axiosClient dùng cả hai)
    const refRes = await fetch(`${BASE}/auth/refresh`, { method: 'POST', headers: { Cookie: cookie } });
    const ref = await refRes.json();
    check('POST /auth/refresh -> 200', refRes.status === 200, `nhận ${refRes.status}`);
    check('refresh.accessToken', typeof ref.accessToken === 'string');
    check('refresh.signingKey', typeof ref.signingKey === 'string');

    // --- Contract 7: i18n lỗi theo header X-Locale
    const viRes = await fetch(`${BASE}/users`, { headers: { 'X-Locale': 'vi' } });
    const enRes = await fetch(`${BASE}/users`, { headers: { 'X-Locale': 'en' } });
    const [vi, en] = [await viRes.json(), await enRes.json()];
    check('message đổi theo X-Locale', vi.message !== en.message, `vi="${vi.message}" en="${en.message}"`);

    // --- Contract 8: chữ ký request vẫn bắt buộc cho method ghi
    const meRes = await fetch(`${BASE}/auth/me`, { headers: auth });
    const me = await meRes.json();
    const body = JSON.stringify({ email: me.data.email, full_name: me.data.full_name });

    const noSig = await fetch(`${BASE}/auth/me`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...auth },
        body,
    });
    check('PUT không ký -> 400 ERR_SIGNATURE_MISSING', noSig.status === 400 && (await noSig.json()).errorCode === 'ERR_SIGNATURE_MISSING');

    const ts = Date.now().toString();
    const sig = crypto.createHmac('sha256', s.signingKey).update(`${ts}.${body}`).digest('hex');
    const signed = await fetch(`${BASE}/auth/me`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...auth, 'X-Signature-Timestamp': ts, 'X-Signature': sig },
        body,
    });
    check('PUT ký đúng -> 200 (gửi lại giá trị cũ, không đổi dữ liệu)', signed.status === 200, `nhận ${signed.status}`);

    const badSig = await fetch(`${BASE}/auth/me`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...auth, 'X-Signature-Timestamp': ts, 'X-Signature': 'ab'.repeat(32) },
        body,
    });
    check('PUT ký sai -> 400 ERR_INVALID_SIGNATURE', badSig.status === 400 && (await badSig.json()).errorCode === 'ERR_INVALID_SIGNATURE');

    // --- Contract 9: validate trả ERR_VALIDATION kèm "field: lý do"
    const ts2 = Date.now().toString();
    const badBody = JSON.stringify({ email: 'khong-phai-email' });
    const sig2 = crypto.createHmac('sha256', s.signingKey).update(`${ts2}.${badBody}`).digest('hex');
    const valRes = await fetch(`${BASE}/auth/me`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...auth, 'X-Signature-Timestamp': ts2, 'X-Signature': sig2 },
        body: badBody,
    });
    const val = await valRes.json();
    check('validate sai -> 400 ERR_VALIDATION', valRes.status === 400 && val.errorCode === 'ERR_VALIDATION', `${valRes.status} ${val.errorCode}`);
    check('message validate có dạng "field: lý do"', typeof val.message === 'string' && val.message.includes(':'), val.message);

    // --- Contract 10: endpoint không tồn tại -> 404 cùng format
    const nfRes = await fetch(`${BASE}/khong-ton-tai`);
    const nf = await nfRes.json();
    check('404 dùng cùng format lỗi', nfRes.status === 404 && nf.success === false && typeof nf.errorCode === 'string');

    console.log(`\n${failed === 0 ? 'CONTRACT OK' : 'CONTRACT FAILED'}: ${passed} đạt, ${failed} lỗi.`);
    if (failed > 0) process.exit(1);
}

main().catch((err) => {
    console.error('\nKhông chạy được contract test:', err.message);
    console.error('Kiểm tra: server đã chạy chưa (npm run dev) và MySQL đã seed chưa?');
    process.exit(1);
});
