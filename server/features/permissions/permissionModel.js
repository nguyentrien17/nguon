const db = require('#core/database/db');
const baseRepository = require('#core/database/baseRepository');

const base = baseRepository('permissions');
const findRoleById = base.findById;
const deleteRole = base.remove;

async function getUserPermissions(userId) {
    return db('user_permissions as up')
        .join('permission_details as pd', 'pd.permission_id', 'up.permission_id')
        .join('modules as m', 'm.id', 'pd.module_id')
        .join('actions as a', 'a.id', 'pd.action_id')
        .where('up.user_id', userId)
        .distinct('m.module_code', 'm.module_name', 'm.module_href', 'a.action_code');
}

async function userHasRole(userId, roleCode) {
    const row = await db('user_permissions as up')
        .join('permissions as p', 'p.id', 'up.permission_id')
        .where('up.user_id', userId)
        .andWhere('p.permission_code', roleCode)
        .first('up.permission_id');
    return !!row;
}

// Gộp userHasRole + getUserPermissions thành 1 round-trip DB duy nhất — dùng cho
// permissionMiddleware (requirePermission/requireAnyPermission) vì middleware này chạy trên
// MỌI request được bảo vệ, nên tiết kiệm 1 query/request đáng để đánh đổi độ phức tạp.
async function getUserAccess(userId, protectedRoleCode) {
    const rows = await db('user_permissions as up')
        .join('permissions as p', 'p.id', 'up.permission_id')
        .leftJoin('permission_details as pd', 'pd.permission_id', 'p.id')
        .leftJoin('modules as m', 'm.id', 'pd.module_id')
        .leftJoin('actions as a', 'a.id', 'pd.action_id')
        .where('up.user_id', userId)
        .select('p.permission_code', 'm.module_code', 'm.module_name', 'm.module_href', 'a.action_code');

    const isProtectedRole = rows.some((r) => r.permission_code === protectedRoleCode);

    const seen = new Set();
    const permissions = [];
    for (const r of rows) {
        if (!r.module_code || !r.action_code) continue;
        const key = `${r.module_code}:${r.action_code}`;
        if (seen.has(key)) continue;
        seen.add(key);
        permissions.push({ module_code: r.module_code, module_name: r.module_name, module_href: r.module_href, action_code: r.action_code });
    }

    return { isProtectedRole, permissions };
}

async function findRoleByCode(code) {
    const row = await db('permissions').where({ permission_code: code }).first();
    return row || null;
}

// Grants a single (module, action) pair to a role directly — used to auto-grant the
// protected admin role whenever a new action is created, so it never falls behind.
async function grantToRole({ permissionId, moduleId, actionId }) {
    await db.raw('INSERT IGNORE INTO permission_details (permission_id, module_id, action_id) VALUES (?, ?, ?)', [
        permissionId,
        moduleId,
        actionId,
    ]);
}

async function findAllRoles() {
    const roles = await db('permissions as p')
        .leftJoin('user_permissions as up', 'up.permission_id', 'p.id')
        .select('p.*')
        .countDistinct('up.user_id as user_count')
        .groupBy('p.id')
        .orderBy('p.id', 'asc');
    const details = await db('permission_details as pd')
        .join('modules as m', 'm.id', 'pd.module_id')
        .join('actions as a', 'a.id', 'pd.action_id')
        .select('pd.permission_id', 'pd.module_id', 'm.module_code', 'pd.action_id', 'a.action_code');

    return roles.map((role) => ({
        ...role,
        user_count: Number(role.user_count),
        details: details.filter((d) => d.permission_id === role.id),
    }));
}

async function findRoleDetailsWithCodes(permissionId) {
    return db('permission_details as pd')
        .join('modules as m', 'm.id', 'pd.module_id')
        .join('actions as a', 'a.id', 'pd.action_id')
        .where('pd.permission_id', permissionId)
        .select('pd.module_id', 'm.module_code', 'pd.action_id', 'a.action_code');
}

async function createRole({ permission_code, permission_name, description, permission_parent_id, details }) {
    return db.transaction(async (trx) => {
        const [permissionId] = await trx('permissions').insert({
            permission_code,
            permission_name,
            description: description || null,
            permission_parent_id: permission_parent_id || null,
        });

        if (Array.isArray(details) && details.length > 0) {
            await trx('permission_details').insert(
                details.map((d) => ({ permission_id: permissionId, module_id: d.module_id, action_id: d.action_id }))
            );
        }

        return permissionId;
    });
}

async function updateRole(id, { permission_name, description, details }) {
    return db.transaction(async (trx) => {
        const affectedRows = await trx('permissions').where({ id }).update({
            permission_name,
            description: description || null,
        });

        if (affectedRows === 0) return false;

        await trx('permission_details').where({ permission_id: id }).del();

        if (Array.isArray(details) && details.length > 0) {
            await trx('permission_details').insert(
                details.map((d) => ({ permission_id: id, module_id: d.module_id, action_id: d.action_id }))
            );
        }

        return true;
    });
}

async function assignRoleToUser({ userId, permissionId }) {
    await db.raw('INSERT IGNORE INTO user_permissions (user_id, permission_id) VALUES (?, ?)', [userId, permissionId]);
}

async function unassignRoleFromUser({ userId, permissionId }) {
    return db('user_permissions').where({ user_id: userId, permission_id: permissionId }).del();
}

async function getRolesForUser(userId) {
    return db('user_permissions as up')
        .join('permissions as p', 'p.id', 'up.permission_id')
        .where('up.user_id', userId)
        .orderBy('p.id', 'asc')
        .select('p.id', 'p.permission_code', 'p.permission_name');
}

module.exports = {
    getUserPermissions,
    userHasRole,
    getUserAccess,
    findRoleByCode,
    grantToRole,
    findAllRoles,
    findRoleById,
    findRoleDetailsWithCodes,
    createRole,
    updateRole,
    deleteRole,
    assignRoleToUser,
    unassignRoleFromUser,
    getRolesForUser,
};
