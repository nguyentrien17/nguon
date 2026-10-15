const { mockReq, runMiddleware } = require('./_helpers');
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const AppError = require('#core/errors/AppError');
const { validateBody, validateParams } = require('#core/http/validate');
const { idParamSchema, emptyBodySchema } = require('../../../shared/validators/common');
const { createUserSchema, updateUserSchema } = require('../../../shared/validators/userValidators');

describe('validateBody', () => {
    test('hợp lệ -> next() và req.body được thay bằng dữ liệu đã parse (trim, default)', async () => {
        const req = mockReq({
            body: { username: '  alice ', email: 'a@b.co', password: 'Passw0rd', full_name: 'Alice' },
        });
        const { nextCalled, nextArg } = await runMiddleware(validateBody(createUserSchema), req);
        assert.ok(nextCalled);
        assert.equal(nextArg, undefined);
        assert.equal(req.body.username, 'alice');
        assert.deepEqual(req.body.role_ids, []);
    });

    test('không hợp lệ -> AppError 400 ERR_VALIDATION kèm field + reasonKey', async () => {
        const req = mockReq({ body: { username: 'al', email: 'a@b.co', password: 'Passw0rd', full_name: 'A' } });
        const { nextArg } = await runMiddleware(validateBody(createUserSchema), req);
        assert.ok(nextArg instanceof AppError);
        assert.equal(nextArg.statusCode, 400);
        assert.equal(nextArg.errorCode, 'ERR_VALIDATION');
        assert.deepEqual(nextArg.params, { field: 'username', reasonKey: 'validation.tooShort' });
    });

    test('updateUserSchema: body rỗng -> validation.noFieldsToUpdate', async () => {
        const { nextArg } = await runMiddleware(validateBody(updateUserSchema), mockReq({ body: {} }));
        assert.equal(nextArg.params.reasonKey, 'validation.noFieldsToUpdate');
    });

    test('emptyBodySchema: từ chối field lạ', async () => {
        const { nextArg } = await runMiddleware(validateBody(emptyBodySchema), mockReq({ body: { x: 1 } }));
        assert.ok(nextArg instanceof AppError);
    });
});

describe('validateParams + idParamSchema', () => {
    test('"42" -> số 42', async () => {
        const req = mockReq({ params: { id: '42' } });
        const { nextArg } = await runMiddleware(validateParams(idParamSchema), req);
        assert.equal(nextArg, undefined);
        assert.equal(req.params.id, 42);
    });

    // MySQL coerce '1abc' thành 1 — để lọt là sửa nhầm user id 1 (docs/security.md).
    for (const bad of ['1abc', '0', '-3', '1.5', '']) {
        test(`"${bad}" -> 400`, async () => {
            const { nextArg } = await runMiddleware(validateParams(idParamSchema), mockReq({ params: { id: bad } }));
            assert.ok(nextArg instanceof AppError, `id "${bad}" phải bị từ chối`);
            assert.equal(nextArg.statusCode, 400);
        });
    }
});
