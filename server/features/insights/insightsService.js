const db = require('../../config/database');
const permissionModel = require('#features/permissions/permissionModel');

// Actions chưa được role nào cấp quyền (kể cả ROLE_ADMIN) — ứng viên dọn dẹp hoặc thiếu auto-grant.
async function findUnusedActions() {
    return db('actions as a')
        .join('modules as m', 'm.id', 'a.module_id')
        .leftJoin('permission_details as pd', 'pd.action_id', 'a.id')
        .whereNull('pd.id')
        .orderBy('m.module_code', 'asc')
        .orderBy('a.action_code', 'asc')
        .select('a.id', 'a.action_code', 'a.action_name', 'a.module_id', 'm.module_code');
}

// Module không có action nào và không có module con nào — không phục vụ mục đích gì.
async function findEmptyModules() {
    return db('modules as m')
        .leftJoin('actions as a', 'a.module_id', 'm.id')
        .leftJoin('modules as c', 'c.module_parent_id', 'm.id')
        .whereNull('a.id')
        .whereNull('c.id')
        .orderBy('m.module_code', 'asc')
        .select('m.id', 'm.module_code', 'm.module_name');
}

// Role không ai được gán và không có quyền nào được cấp — an toàn để xoá.
async function findUnusedRoles() {
    const roles = await permissionModel.findAllRoles();
    return roles
        .filter((r) => r.user_count === 0 && r.details.length === 0)
        .map((r) => ({ id: r.id, permission_code: r.permission_code, permission_name: r.permission_name }));
}

// Tra cứu ngược: action_id -> danh sách role đang cấp quyền action đó.
async function buildActionRoleMap() {
    const rows = await db('permission_details as pd')
        .join('permissions as p', 'p.id', 'pd.permission_id')
        .select('pd.action_id', 'p.id', 'p.permission_code', 'p.permission_name');
    const map = {};
    rows.forEach((r) => {
        if (!map[r.action_id]) map[r.action_id] = [];
        map[r.action_id].push({ id: r.id, permission_code: r.permission_code, permission_name: r.permission_name });
    });
    return map;
}

async function getModuleActionInsights() {
    const [unusedActions, emptyModules, unusedRoles, actionRoleMap] = await Promise.all([
        findUnusedActions(),
        findEmptyModules(),
        findUnusedRoles(),
        buildActionRoleMap(),
    ]);
    return { unusedActions, emptyModules, unusedRoles, actionRoleMap };
}

module.exports = { getModuleActionInsights };
