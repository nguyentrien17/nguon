import { describe, expect, it } from 'vitest';
import { createModuleTree } from '@/lib/moduleTree';
import { filterModuleTree } from './moduleFilter';

const modules = [
    { id: 1, module_code: 'MOD_USER', module_name: 'Users', module_parent_id: null, status: 1 },
    { id: 2, module_code: 'MOD_AUDIT', module_name: 'Audit', module_parent_id: null, status: 2 },
    { id: 3, module_code: 'MOD_USER_SUB', module_name: 'Sub', module_parent_id: 1, status: 0 },
];
const actions = [
    { id: 10, module_id: 1, action_code: 'view', action_name: 'Xem', status: 1 },
    { id: 12, module_id: 1, action_code: 'delete', action_name: 'Xoá', status: 0 },
    { id: 30, module_id: 3, action_code: 'export_excel', action_name: 'Xuất', status: 1 },
];
const tree = createModuleTree(modules, actions);
const visibleIds = (f) => [...f.moduleVisible].filter(([, v]) => v).map(([id]) => id).sort();

describe('filterModuleTree', () => {
    it('không lọc: hiện hết, isFiltering = false', () => {
        const f = filterModuleTree(modules, tree);
        expect(f.isFiltering).toBe(false);
        expect(visibleIds(f)).toEqual([1, 2, 3]);
    });

    it('khớp tên action ở module con -> module con và cha hiện, module khác ẩn', () => {
        expect(visibleIds(filterModuleTree(modules, tree, { query: 'xuất' }))).toEqual([1, 3]);
    });

    it('lọc trạng thái (chuỗi từ <select>)', () => {
        expect(visibleIds(filterModuleTree(modules, tree, { status: '2' }))).toEqual([2]);
        const inactive = filterModuleTree(modules, tree, { status: '0' });
        expect(visibleIds(inactive)).toEqual([1, 3]); // 1 hiện vì có action ngưng
        expect(inactive.actionMatches(actions[1])).toBe(true);
        expect(inactive.actionMatches(actions[0])).toBe(false);
    });
});
