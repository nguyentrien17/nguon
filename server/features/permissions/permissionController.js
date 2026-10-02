const permissionService = require('./permissionService');
const asyncHandler = require('#core/http/asyncHandler');

const listPermissions = asyncHandler(async (req, res) => {
    const data = await permissionService.listRoles();
    return res.json({ success: true, data });
});

const createPermission = asyncHandler(async (req, res) => {
    const { permission_code, permission_name, description, permission_parent_id, details } = req.body;
    const data = await permissionService.createRole({
        permission_code,
        permission_name,
        description,
        permission_parent_id,
        details,
        actorId: req.user.id,
        ip: req.ip,
    });
    return res.status(201).json({ success: true, data });
});

const updatePermission = asyncHandler(async (req, res) => {
    const { permission_name, description, details } = req.body;
    await permissionService.updateRole(req.params.id, { permission_name, description, details, actorId: req.user.id, ip: req.ip });
    return res.json({ success: true });
});

const deletePermission = asyncHandler(async (req, res) => {
    await permissionService.deleteRole(req.params.id, { actorId: req.user.id, ip: req.ip });
    return res.json({ success: true });
});

const assignRoleToUser = asyncHandler(async (req, res) => {
    await permissionService.assignRoleToUser({
        permissionId: req.params.id,
        userId: req.body.user_id,
        actorId: req.user.id,
        ip: req.ip,
    });
    return res.json({ success: true });
});

const unassignRoleFromUser = asyncHandler(async (req, res) => {
    await permissionService.unassignRoleFromUser({
        permissionId: req.params.id,
        userId: req.body.user_id,
        actorId: req.user.id,
        ip: req.ip,
    });
    return res.json({ success: true });
});

module.exports = {
    listPermissions,
    createPermission,
    updatePermission,
    deletePermission,
    assignRoleToUser,
    unassignRoleFromUser,
};
