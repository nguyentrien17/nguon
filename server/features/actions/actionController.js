const actionService = require('./actionService');
const asyncHandler = require('#core/http/asyncHandler');

const listActions = asyncHandler(async (req, res) => {
    const data = await actionService.listActions();
    return res.json({ success: true, data });
});

const createAction = asyncHandler(async (req, res) => {
    const { module_id, action_code, action_name, description, rate_limit_per_minute } = req.body;
    const data = await actionService.createAction({
        module_id,
        action_code,
        action_name,
        description,
        rate_limit_per_minute,
        actorId: req.user.id,
        ip: req.ip,
    });
    return res.status(201).json({ success: true, data });
});

const updateAction = asyncHandler(async (req, res) => {
    const { action_name, status, description, rate_limit_per_minute } = req.body;
    await actionService.updateAction(req.params.id, {
        action_name,
        status,
        description,
        rate_limit_per_minute,
        actorId: req.user.id,
        ip: req.ip,
    });
    return res.json({ success: true });
});

const deleteAction = asyncHandler(async (req, res) => {
    await actionService.deleteAction(req.params.id, { actorId: req.user.id, ip: req.ip });
    return res.json({ success: true });
});

const scaffoldActions = asyncHandler(async (req, res) => {
    const data = await actionService.scaffoldStandardActions(req.params.moduleId, { actorId: req.user.id, ip: req.ip });
    return res.status(201).json({ success: true, data });
});

const archiveAction = asyncHandler(async (req, res) => {
    await actionService.archiveAction(req.params.id, { actorId: req.user.id, ip: req.ip });
    return res.json({ success: true });
});

const restoreAction = asyncHandler(async (req, res) => {
    await actionService.restoreAction(req.params.id, { actorId: req.user.id, ip: req.ip });
    return res.json({ success: true });
});

module.exports = { listActions, createAction, updateAction, deleteAction, scaffoldActions, archiveAction, restoreAction };
