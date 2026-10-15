import { describe, expect, it } from 'vitest';
import {
    createModuleTree,
    createRoleTree,
    detailsFromSelection,
    groupState,
    presetSelection,
    roleVisibility,
    selectionFromDetails,
    toggleGrant,
    toggleModuleGrants,
} from './permissionTree';

// USER(1) có con USER_SUB(3); AUDIT(2) gốc.
const modules = [
    { id: 1, module_code: 'MOD_USER', module_parent_id: null },
    { id: 2, module_code: 'MOD_AUDIT', module_parent_id: null },
    { id: 3, module_code: 'MOD_USER_SUB', module_parent_id: 1 },
];
const actions = [
    { id: 10, module_id: 1, action_code: 'view' },
    { id: 11, module_id: 1, action_code: 'edit' },
    { id: 12, module_id: 1, action_code: 'delete' },
    { id: 20, module_id: 2, action_code: 'view' },
    { id: 30, module_id: 3, action_code: 'export_excel' },
];
const tree = createModuleTree(modules, actions);
const sorted = (set) => [...set].sort();

describe('createModuleTree', () => {
    it('gốc, con, action, và keysOf gồm cả module con', () => {
        expect(tree.roots.map((m) => m.id)).toEqual([1, 2]);
        expect(tree.childrenOf(1).map((m) => m.id)).toEqual([3]);
        expect(tree.actionsOf(1)).toHaveLength(3);
        expect(sorted(tree.keysOf(modules[0]))).toEqual(['1_10', '1_11', '1_12', '3_30']);
    });
});

describe('chọn quyền', () => {
    it('tick EDIT / DELETE tự tick VIEW của cùng module', () => {
        expect(sorted(toggleGrant(new Set(), tree, 1, 11))).toEqual(['1_10', '1_11']);
        expect(sorted(toggleGrant(new Set(), tree, 1, 12))).toEqual(['1_10', '1_12']);
    });

    it('bỏ tick EDIT không bỏ VIEW; action khác không kéo theo gì', () => {
        expect(sorted(toggleGrant(new Set(['1_10', '1_11']), tree, 1, 11))).toEqual(['1_10']);
        expect(sorted(toggleGrant(new Set(), tree, 3, 30))).toEqual(['3_30']);
    });

    it('chọn cả nhóm: một phần -> chọn hết (kể cả module con); lần nữa -> bỏ hết', () => {
        const keys = tree.keysOf(modules[0]);
        const all = toggleModuleGrants(new Set(['1_10']), keys);
        expect(keys.every((k) => all.has(k))).toBe(true);
        expect(toggleModuleGrants(all, keys).size).toBe(0);
    });

    it('groupState một phần -> indeterminate', () => {
        expect(groupState(new Set(['1_10']), tree.keysOf(modules[0]))).toEqual({ checked: false, indeterminate: true, count: 1 });
    });

    it('preset THAY THẾ toàn bộ lựa chọn', () => {
        expect(sorted(presetSelection(actions, ['view']))).toEqual(['1_10', '2_20']);
    });

    it('details <-> selection giữ nguyên, id là number', () => {
        const details = [{ module_id: 1, action_id: 10 }, { module_id: 3, action_id: 30 }];
        expect(detailsFromSelection(selectionFromDetails(details))).toEqual(details);
    });
});

describe('cây vai trò', () => {
    const roles = [
        { id: 1, permission_code: 'ROLE_ADMIN', permission_name: 'Admin', permission_parent_id: null },
        { id: 2, permission_code: 'ROLE_STAFF', permission_name: 'Staff', permission_parent_id: null },
        { id: 3, permission_code: 'ROLE_STAFF_HR', permission_name: 'Nhân sự', permission_parent_id: 2 },
    ];
    const rtree = createRoleTree(roles);

    it('role con khớp -> cha cũng hiện; role khác ẩn', () => {
        const vis = roleVisibility(roles, rtree, 'nhân');
        expect([vis.get(1), vis.get(2), vis.get(3)]).toEqual([false, true, true]);
    });

    it('không lọc -> hiện hết', () => {
        expect([...roleVisibility(roles, rtree, '').values()].every(Boolean)).toBe(true);
    });
});
