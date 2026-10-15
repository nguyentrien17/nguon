const { mockReq, mockRes } = require('./_helpers');
const { test, describe, mock } = require('node:test');
const assert = require('node:assert/strict');

const AppError = require('#core/errors/AppError');
const errorHandler = require('#core/errors/errorHandler');
const { translate } = require('#core/errors/errorMessages');
const logger = require('#core/logger');

describe('translate', () => {
    test('tra đúng ngôn ngữ và nội suy {{param}}', () => {
        assert.equal(
            translate('ERR_PERMISSION_DENIED', 'en', { module: 'MOD_USER', action: 'view' }),
            'You do not have permission to perform this action (MOD_USER:view)'
        );
    });

    test('locale không hỗ trợ -> rơi về en', () => {
        assert.equal(translate('ERR_NOT_FOUND', 'fr'), translate('ERR_NOT_FOUND', 'en'));
    });

    test('actionKey ưu tiên khoá ghép ERR_X_ACTIONKEY', () => {
        assert.match(translate('ERR_PROTECTED_ROLE', 'en', { actionKey: 'lock' }), /lock or unlock/);
        assert.match(translate('ERR_PROTECTED_ROLE', 'en', { actionKey: 'account' }), /email or password/);
    });

    test('actionKey không có bản dịch riêng -> dùng bản dịch của mã gốc', () => {
        assert.equal(translate('ERR_PROTECTED_ROLE', 'en', { actionKey: 'nope' }), translate('ERR_PROTECTED_ROLE', 'en'));
    });

    test('mã lỗi không tồn tại -> null (để caller dùng fallback)', () => {
        assert.equal(translate('ERR_DOES_NOT_EXIST', 'vi'), null);
    });
});

describe('errorHandler', () => {
    test('AppError -> đúng status, errorCode và message đã dịch', () => {
        const res = mockRes();
        errorHandler(new AppError(404, 'ERR_NOT_FOUND', 'User not found'), mockReq({ locale: 'vi' }), res, () => {});
        assert.equal(res.statusCode, 404);
        assert.deepEqual(res.body, { success: false, errorCode: 'ERR_NOT_FOUND', message: 'Không tìm thấy dữ liệu' });
    });

    test('lỗi validation ghép "field: lý do" theo reasonKey', () => {
        const res = mockRes();
        const err = new AppError(400, 'ERR_VALIDATION', 'x', { field: 'email', reasonKey: 'validation.invalidFormat' });
        errorHandler(err, mockReq(), res, () => {});
        assert.equal(res.body.message, 'email: email has an invalid format');
    });

    test('JSON sai cú pháp (body-parser) -> 400, không log như lỗi server', () => {
        const logged = mock.method(logger, 'error', () => {});
        const res = mockRes();
        const err = Object.assign(new SyntaxError('Unexpected end of JSON'), { type: 'entity.parse.failed', status: 400 });
        errorHandler(err, mockReq(), res, () => {});
        assert.equal(res.statusCode, 400);
        assert.equal(res.body.errorCode, 'ERR_VALIDATION');
        assert.equal(logged.mock.callCount(), 0);
        logged.mock.restore();
    });

    test('body quá lớn -> 413', () => {
        const res = mockRes();
        errorHandler(Object.assign(new Error('too large'), { type: 'entity.too.large' }), mockReq(), res, () => {});
        assert.equal(res.statusCode, 413);
    });

    test('lỗi lạ -> 500 thông báo chung, KHÔNG lộ message/stack nội bộ', () => {
        const logged = mock.method(logger, 'error', () => {});
        const res = mockRes();
        errorHandler(new Error('ER_ACCESS_DENIED for user root@10.0.0.5'), mockReq({ method: 'GET', originalUrl: '/x' }), res, () => {});
        assert.equal(res.statusCode, 500);
        assert.equal(res.body.errorCode, 'ERR_SERVER');
        assert.doesNotMatch(JSON.stringify(res.body), /ER_ACCESS_DENIED|root@|stack/);
        assert.equal(logged.mock.callCount(), 1);
        logged.mock.restore();
    });
});
