// Chỉ mục cây module -> module con -> action. Dùng chung bởi features/permissions (cây cấp quyền)
// và features/module-actions (cây quản lý) — đặt ở lib/ để hai feature không import chéo nhau.
// Hàm thuần, không phụ thuộc React.

/**
 * Tính một lần thay vì filter cả mảng ở mỗi dòng render.
 *   roots          module gốc (module_parent_id rỗng)
 *   childrenOf(id) module con trực tiếp
 *   actionsOf(id)  action của module
 *   keysOf(m)      khoá 'moduleId_actionId' của mọi action thuộc m VÀ toàn bộ module con
 */
export function createModuleTree(modules, actions) {
    const children = new Map();
    const actionsByModule = new Map();
    for (const m of modules) {
        const parent = m.module_parent_id || null;
        if (!children.has(parent)) children.set(parent, []);
        children.get(parent).push(m);
    }
    for (const a of actions) {
        if (!actionsByModule.has(a.module_id)) actionsByModule.set(a.module_id, []);
        actionsByModule.get(a.module_id).push(a);
    }

    const childrenOf = (id) => children.get(id) ?? [];
    const actionsOf = (id) => actionsByModule.get(id) ?? [];
    const keysCache = new Map();
    const keysOf = (m) => {
        if (!keysCache.has(m.id)) {
            keysCache.set(m.id, [...actionsOf(m.id).map((a) => `${m.id}_${a.id}`), ...childrenOf(m.id).flatMap(keysOf)]);
        }
        return keysCache.get(m.id);
    };

    return { roots: childrenOf(null), childrenOf, actionsOf, keysOf };
}
