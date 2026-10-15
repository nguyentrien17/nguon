import { describe, expect, it } from 'vitest';
import { getErrorMessage, translateErrorCode } from './errorMessage';
import { zodIssueKey } from './zodErrorMessage';

describe('getErrorMessage / translateErrorCode', () => {
    it('ưu tiên message backend trả về', () => {
        expect(getErrorMessage({ response: { data: { errorCode: 'ERR_SERVER', message: 'Từ server' } } })).toBe('Từ server');
    });

    it('không có response (lỗi mạng) -> dịch theo mã từ bảng dùng chung với server', () => {
        expect(getErrorMessage(new Error('Network Error'))).toBe('Lỗi không xác định');
        expect(getErrorMessage({ response: { data: { errorCode: 'ERR_SELF_LOCK' } } })).toBe('Bạn không thể tự khoá tài khoản của chính mình');
    });

    it('mã không tồn tại -> ERR_UNKNOWN; ngôn ngữ không hỗ trợ -> en', () => {
        expect(translateErrorCode('ERR_NOPE', 'vi')).toBe('Lỗi không xác định');
        expect(translateErrorCode('ERR_NOT_FOUND', 'fr')).toBe('The requested item was not found');
    });
});

describe('zodIssueKey — không lọt câu tiếng Anh của zod', () => {
    it.each([
        [{ message: 'validation.tooShort', code: 'too_small' }, 'validation.tooShort'],
        [{ message: 'Invalid input: expected string, received undefined', code: 'invalid_type' }, 'validation.required'],
        [{ message: 'Too small', code: 'too_small', origin: 'string', minimum: 1 }, 'validation.required'],
        [{ message: 'Too big', code: 'too_big' }, 'validation.tooLong'],
        [{ message: 'whatever', code: 'custom' }, 'validation.default'],
    ])('%o -> %s', (issue, key) => {
        expect(zodIssueKey(issue)).toBe(key);
    });
});
