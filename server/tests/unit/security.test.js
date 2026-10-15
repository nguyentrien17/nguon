const { mockReq, runMiddleware } = require('./_helpers');
const { test, describe, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const { authenticate, setSessionGuard } = require('#core/security/authenticate');
const verifySignature = require('#core/security/verifySignature');
const { signAccessToken, signRefreshToken } = require('#core/security/jwt');

const bearer = (token) => mockReq({ headers: { Authorization: `Bearer ${token}` } });

describe('authenticate', () => {
    afterEach(() => setSessionGuard(null));

    test('thiếu token -> 401 ERR_UNAUTHORIZED', async () => {
        const { res, nextCalled } = await runMiddleware(authenticate, mockReq());
        assert.equal(nextCalled, false);
        assert.equal(res.statusCode, 401);
        assert.equal(res.body.errorCode, 'ERR_UNAUTHORIZED');
    });

    test('token sai -> 401 ERR_TOKEN_EXPIRED (client dựa vào mã này để refresh)', async () => {
        const { res } = await runMiddleware(authenticate, bearer('not-a-jwt'));
        assert.equal(res.statusCode, 401);
        assert.equal(res.body.errorCode, 'ERR_TOKEN_EXPIRED');
    });

    test('refresh token KHÔNG dùng thay access token được (khác secret)', async () => {
        const { res } = await runMiddleware(authenticate, bearer(signRefreshToken({ id: 1 })));
        assert.equal(res.statusCode, 401);
    });

    test('token hợp lệ, không có guard -> next() và gán req.user', async () => {
        const req = bearer(signAccessToken({ id: 7, username: 'u' }));
        const { nextCalled, nextArg } = await runMiddleware(authenticate, req);
        assert.ok(nextCalled);
        assert.equal(nextArg, undefined);
        assert.equal(req.user.id, 7);
    });

    test('guard trả false (user bị khoá) -> 401 ERR_TOKEN_EXPIRED, không gán req.user', async () => {
        setSessionGuard(async (payload) => payload.id !== 7);
        const req = bearer(signAccessToken({ id: 7 }));
        const { res, nextCalled } = await runMiddleware(authenticate, req);
        assert.equal(nextCalled, false);
        assert.equal(res.statusCode, 401);
        assert.equal(res.body.errorCode, 'ERR_TOKEN_EXPIRED');
        assert.equal(req.user, undefined);
    });

    test('guard ném lỗi (DB chết) -> chuyển lỗi cho errorHandler, không cho qua', async () => {
        setSessionGuard(async () => {
            throw new Error('db down');
        });
        const req = bearer(signAccessToken({ id: 7 }));
        const { nextArg } = await runMiddleware(authenticate, req);
        assert.equal(nextArg.message, 'db down');
        assert.equal(req.user, undefined);
    });
});

describe('verifySignature', () => {
    const sigKey = crypto.randomBytes(32).toString('hex');

    function signedReq(body, { ts = Date.now().toString(), key = sigKey, tamper } = {}) {
        const raw = JSON.stringify(body);
        const sig = crypto.createHmac('sha256', key).update(`${ts}.${raw}`).digest('hex');
        return mockReq({
            headers: { 'X-Signature': sig, 'X-Signature-Timestamp': ts },
            rawBody: Buffer.from(tamper ?? raw),
            user: { id: 1, sigKey },
        });
    }

    test('chữ ký đúng -> next()', async () => {
        const { nextCalled, nextArg } = await runMiddleware(verifySignature, signedReq({ a: 1 }));
        assert.ok(nextCalled);
        assert.equal(nextArg, undefined);
    });

    test('thiếu header -> ERR_SIGNATURE_MISSING', async () => {
        const { nextArg } = await runMiddleware(verifySignature, mockReq({ user: { sigKey } }));
        assert.equal(nextArg.errorCode, 'ERR_SIGNATURE_MISSING');
    });

    test('body bị sửa trên đường truyền -> ERR_INVALID_SIGNATURE', async () => {
        const { nextArg } = await runMiddleware(verifySignature, signedReq({ a: 1 }, { tamper: '{"a":2}' }));
        assert.equal(nextArg.errorCode, 'ERR_INVALID_SIGNATURE');
    });

    test('ký bằng key khác -> ERR_INVALID_SIGNATURE', async () => {
        const otherKey = crypto.randomBytes(32).toString('hex');
        const { nextArg } = await runMiddleware(verifySignature, signedReq({ a: 1 }, { key: otherKey }));
        assert.equal(nextArg.errorCode, 'ERR_INVALID_SIGNATURE');
    });

    test('timestamp cũ hơn 5 phút -> ERR_SIGNATURE_EXPIRED', async () => {
        const old = (Date.now() - 6 * 60 * 1000).toString();
        const { nextArg } = await runMiddleware(verifySignature, signedReq({ a: 1 }, { ts: old }));
        assert.equal(nextArg.errorCode, 'ERR_SIGNATURE_EXPIRED');
    });

    test('timestamp không phải số -> ERR_SIGNATURE_EXPIRED', async () => {
        const { nextArg } = await runMiddleware(verifySignature, signedReq({ a: 1 }, { ts: 'abc' }));
        assert.equal(nextArg.errorCode, 'ERR_SIGNATURE_EXPIRED');
    });
});
