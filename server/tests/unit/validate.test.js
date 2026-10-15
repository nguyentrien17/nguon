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

describe('mọi lỗi validate đều ra key dịch (không lọt câu tiếng Anh của zod)', () => {
    const { createModuleSchema } = require('../../../shared/validators/moduleValidators');
    const { createActionSchema } = require('../../../shared/validators/actionValidators');
    const { createPermissionSchema } = require('../../../shared/validators/permissionValidators');

    const cases = [
        ['chuỗi gửi null', createUserSchema, { username: 'alice', email: 'a@b.co', password: 'Passw0rd1', full_name: null }],
        ['chuỗi gửi số', createUserSchema, { username: 'alice', email: 'a@b.co', password: 'Passw0rd1', full_name: 123 }],
        ['thiếu trường', createUserSchema, { username: 'alice', email: 'a@b.co', password: 'Passw0rd1' }],
        ['tên quá dài', createModuleSchema, { module_code: 'MOD_X', module_name: 'x'.repeat(256) }],
        ['đường dẫn quá dài', createModuleSchema, { module_code: 'MOD_X', module_name: 'X', module_href: 'x'.repeat(256) }],
        ['số nguyên gửi chuỗi', createActionSchema, { module_id: '1', action_code: 'view', action_name: 'Xem' }],
        ['số ngoài khoảng', createModuleSchema, { module_code: 'MOD_X', module_name: 'X', module_type: 9 }],
        ['mảng gửi null', createPermissionSchema, { permission_code: 'ROLE_X', permission_name: 'X', details: null }],
        ['trường lạ ở body rỗng', emptyBodySchema, { x: 1 }],
    ];

    for (const [name, schema, body] of cases) {
        test(name, async () => {
            const { nextArg } = await runMiddleware(validateBody(schema), mockReq({ body }));
            assert.ok(nextArg instanceof AppError, 'phải bị từ chối');
            assert.match(nextArg.params.reasonKey, /^validation\./, `reasonKey thô: ${nextArg.params.reasonKey}`);
        });
    }
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
