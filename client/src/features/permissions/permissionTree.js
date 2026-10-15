// Hàm thuần cho cây vai trò và cây cấp quyền (module -> module con -> action). Không phụ thuộc
// React, để component gọn và để test được độc lập.
import { ACTION_CODE } from '@shared/constants.json';

export { createModuleTree } from '@/lib/moduleTree';

/** Khoá của một quyền (module, action) — cùng định dạng với keysOf() của createModuleTree. */
export const grantKey = (moduleId, actionId) => `${moduleId}_${actionId}`;

/** Set khoá quyền từ role.details. */
export const selectionFromDetails = (details = []) => new Set(details.map((d) => grantKey(d.module_id, d.action_id)));

/** Payload details gửi lên API từ Set khoá đang chọn. */
export const detailsFromSelection = (selection) =>
    [...selection].map((key) => {
        const [module_id, action_id] = key.split('_').map(Number);
        return { module_id, action_id };
    });

/**
 * Bật/tắt một quyền. Tick edit/delete/lock thì tự tick kèm view của cùng module (backend cũng tự
 * đảm bảo điều này khi lưu, đây chỉ là phản hồi tức thời trên UI).
 */
export function toggleGrant(selection, tree, moduleId, actionId) {
    const key = grantKey(moduleId, actionId);
    const next = new Set(selection);
    if (next.has(key)) {
        next.delete(key);
        return next;
    }
    next.add(key);
    const moduleActions = tree.actionsOf(moduleId);
    const action = moduleActions.find((a) => a.id === actionId);
    // Cùng danh sách với server (permissionService: edit / delete / lock kéo theo view).
    if ([ACTION_CODE.EDIT, ACTION_CODE.DELETE, ACTION_CODE.LOCK].includes(action?.action_code)) {
        const view = moduleActions.find((a) => a.action_code === ACTION_CODE.VIEW);
        if (view) next.add(grantKey(moduleId, view.id));
    }
    return next;
}

/** Ô "chọn tất cả" của một module: đã chọn đủ thì bỏ hết, chưa đủ thì chọn hết (gồm module con). */
export function toggleModuleGrants(selection, keys) {
    const allChecked = keys.length > 0 && keys.every((k) => selection.has(k));
    const next = new Set(selection);
    keys.forEach((k) => (allChecked ? next.delete(k) : next.add(k)));
    return next;
}

/** Áp preset: THAY THẾ toàn bộ lựa chọn — mọi action có action_code thuộc preset được chọn. */
export const presetSelection = (actions, actionCodes) =>
    new Set(actions.filter((a) => actionCodes.includes(a.action_code)).map((a) => grantKey(a.module_id, a.id)));

/** Trạng thái ô tích của một nhóm khoá: { checked, indeterminate, count } */
export function groupState(selection, keys) {
    const count = keys.filter((k) => selection.has(k)).length;
    return { checked: keys.length > 0 && count === keys.length, indeterminate: count > 0 && count < keys.length, count };
}

// ---------- Cây vai trò ----------

export function createRoleTree(roles) {
    const children = new Map();
    for (const r of roles) {
        const parent = r.permission_parent_id || null;
        if (!children.has(parent)) children.set(parent, []);
        children.get(parent).push(r);
    }
    const childrenOf = (id) => children.get(id) ?? [];
    return { roots: childrenOf(null), childrenOf };
}

/** Map role.id -> có hiện không: role khớp từ khoá, hoặc có role con (ở bất kỳ cấp nào) khớp. */
export function roleVisibility(roles, tree, query) {
    const q = query.trim().toLowerCase();
    const cache = new Map();
    const visit = (r) => {
        if (cache.has(r.id)) return cache.get(r.id);
        const self = !q || `${r.permission_code} ${r.permission_name}`.toLowerCase().includes(q);
        const visible = self || tree.childrenOf(r.id).some(visit);
        cache.set(r.id, visible);
        return visible;
    };
    roles.forEach(visit);
    return cache;
}
