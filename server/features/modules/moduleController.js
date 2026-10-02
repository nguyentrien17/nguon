const moduleService = require('./moduleService');
const asyncHandler = require('#core/http/asyncHandler');

const listModules = asyncHandler(async (req, res) => {
    const data = await moduleService.listModules();
    return res.json({ success: true, data });
});

const createModule = asyncHandler(async (req, res) => {
    const { module_code, module_name, module_href, module_element_id, module_parent_id, module_type, module_icon, module_index, description } = req.body;
    const data = await moduleService.createModule({
        module_code,
        module_name,
        module_href,
        module_element_id,
        module_parent_id,
        module_type,
        module_icon,
        module_index,
        description,
        actorId: req.user.id,
        ip: req.ip,
    });
    return res.status(201).json({ success: true, data });
});

const updateModule = asyncHandler(async (req, res) => {
    const { module_name, module_href, module_element_id, module_type, module_icon, module_index, status, description } = req.body;
    await moduleService.updateModule(req.params.id, {
        module_name,
        module_href,
        module_element_id,
        module_type,
        module_icon,
        module_index,
        status,
        description,
        actorId: req.user.id,
        ip: req.ip,
    });
    return res.json({ success: true });
});

const deleteModule = asyncHandler(async (req, res) => {
    await moduleService.deleteModule(req.params.id, { actorId: req.user.id, ip: req.ip });
    return res.json({ success: true });
});

const cloneModule = asyncHandler(async (req, res) => {
    const { module_code, module_name } = req.body;
    const data = await moduleService.cloneModule(req.params.id, {
        module_code,
        module_name,
        actorId: req.user.id,
        ip: req.ip,
    });
    return res.status(201).json({ success: true, data });
});

const archiveModule = asyncHandler(async (req, res) => {
    await moduleService.archiveModule(req.params.id, { actorId: req.user.id, ip: req.ip });
    return res.json({ success: true });
});

const restoreModule = asyncHandler(async (req, res) => {
    await moduleService.restoreModule(req.params.id, { actorId: req.user.id, ip: req.ip });
    return res.json({ success: true });
});

module.exports = { listModules, createModule, updateModule, deleteModule, cloneModule, archiveModule, restoreModule };
