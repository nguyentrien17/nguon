const userService = require('./userService');
const permissionService = require('#features/permissions/permissionService');
const asyncHandler = require('../../utils/asyncHandler');
const { buildUsersWorkbook } = require('../../utils/exportExcel');

const listUsers = asyncHandler(async (req, res) => {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);

    const result = await userService.listUsers({ page, limit, search: req.query.search });
    return res.json({ success: true, ...result });
});

const createUser = asyncHandler(async (req, res) => {
    const { username, email, password, full_name, role_ids } = req.body;
    const data = await userService.createUser({ username, email, password, full_name, role_ids, actorId: req.user.id, ip: req.ip });
    return res.status(201).json({ success: true, data });
});

const updateUser = asyncHandler(async (req, res) => {
    const { email, full_name, avatar, password } = req.body;
    await userService.updateUser(req.params.id, { email, full_name, avatar, password, actorId: req.user.id, ip: req.ip });
    return res.json({ success: true });
});

const toggleUserStatus = asyncHandler(async (req, res) => {
    const data = await userService.toggleUserStatus(req.params.id, { actorId: req.user.id, ip: req.ip });
    return res.json({ success: true, data });
});

const exportUsers = asyncHandler(async (req, res) => {
    const rows = await userService.exportUsers({ search: req.query.search, actorId: req.user.id, ip: req.ip });
    const buffer = await buildUsersWorkbook(rows);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="users-${Date.now()}.xlsx"`);
    return res.send(buffer);
});

const listUserRoles = asyncHandler(async (req, res) => {
    const data = await permissionService.listUserRoles(req.params.id);
    return res.json({ success: true, data });
});

module.exports = { listUsers, createUser, updateUser, toggleUserStatus, exportUsers, listUserRoles };
