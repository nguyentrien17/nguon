import { describe, expect, it } from 'vitest';
import { canOpenModule } from './moduleAccess';

const perms = (...pairs) => pairs.map(([module_code, action_code]) => ({ module_code, action_code }));

describe('canOpenModule — quy tắc chung của Sidebar và ProtectedRoute', () => {
    it('module có route được chặn: cần đúng quyền view', () => {
        expect(canOpenModule('MOD_USER', perms(['MOD_USER', 'view']))).toBe(true);
        // Trước đây Sidebar hiện mục này (có quyền bất kỳ) nhưng route lại đẩy về Dashboard.
        expect(canOpenModule('MOD_USER', perms(['MOD_USER', 'edit']))).toBe(false);
    });

    it('module tạo thêm (action code tuỳ ý): có quyền bất kỳ là đủ', () => {
        expect(canOpenModule('MOD_REPORT', perms(['MOD_REPORT', 'read']))).toBe(true);
        expect(canOpenModule('MOD_REPORT', perms(['MOD_USER', 'view']))).toBe(false);
    });
});
