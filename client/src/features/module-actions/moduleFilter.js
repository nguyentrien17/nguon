// Lọc cây module/action theo từ khoá + trạng thái — hàm thuần, test được độc lập.

/**
 * @returns {{ isFiltering: boolean, actionMatches: (a) => boolean, moduleVisible: Map<id, boolean> }}
 *   - action hiện khi khớp trạng thái VÀ khớp từ khoá (mã hoặc tên);
 *   - module hiện khi chính nó khớp, HOẶC có action khớp, HOẶC có module con (bất kỳ cấp) hiện.
 * `status` là chuỗi ('' = mọi trạng thái) vì đến từ <select>.
 */
export function filterModuleTree(modules, tree, { query = '', status = '' } = {}) {
    const q = query.trim().toLowerCase();
    const statusOk = (s) => status === '' || String(s) === String(status);
    const textOk = (text) => !q || text.toLowerCase().includes(q);

    const actionMatches = (a) => statusOk(a.status) && textOk(`${a.action_code} ${a.action_name}`);

    const moduleVisible = new Map();
    const visit = (m) => {
        if (moduleVisible.has(m.id)) return moduleVisible.get(m.id);
        const self = statusOk(m.status) && textOk(`${m.module_code} ${m.module_name}`);
        const visible = self || tree.actionsOf(m.id).some(actionMatches) || tree.childrenOf(m.id).some(visit);
        moduleVisible.set(m.id, visible);
        return visible;
    };
    modules.forEach(visit);

    return { isFiltering: q !== '' || status !== '', actionMatches, moduleVisible };
}
