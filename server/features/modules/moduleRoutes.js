const express = require('express');
const router = express.Router();
const { listModules, createModule, updateModule, deleteModule, cloneModule, archiveModule, restoreModule } = require('./moduleController');
const { authenticate } = require('#core/security/authenticate');
const { requirePermission } = require('#features/permissions/permissionMiddleware');
const { validateBody } = require('#core/http/validate');
const { rateLimitForAction } = require('#features/actions/actionRateLimiter');
const verifySignature = require('#core/security/verifySignature');
const { createModuleSchema, updateModuleSchema, cloneModuleSchema } = require('./moduleValidators');
const { emptyBodySchema } = require('../../../shared/validators/common');
const { MODULE_CODE, ACTION_CODE } = require('#shared');

router.get('/', authenticate, listModules);
router.post('/', authenticate, requirePermission(MODULE_CODE.MODULE_ACTION, ACTION_CODE.CREATE), verifySignature, validateBody(createModuleSchema), createModule);
router.post('/:id/clone', authenticate, requirePermission(MODULE_CODE.MODULE_ACTION, ACTION_CODE.CREATE), verifySignature, validateBody(cloneModuleSchema), cloneModule);
router.post('/:id/archive', authenticate, requirePermission(MODULE_CODE.MODULE_ACTION, ACTION_CODE.EDIT), verifySignature, validateBody(emptyBodySchema), archiveModule);
router.post('/:id/restore', authenticate, requirePermission(MODULE_CODE.MODULE_ACTION, ACTION_CODE.EDIT), verifySignature, validateBody(emptyBodySchema), restoreModule);
router.put('/:id', authenticate, requirePermission(MODULE_CODE.MODULE_ACTION, ACTION_CODE.EDIT), verifySignature, validateBody(updateModuleSchema), updateModule);
router.delete(
    '/:id',
    authenticate,
    requirePermission(MODULE_CODE.MODULE_ACTION, ACTION_CODE.DELETE),
    verifySignature,
    rateLimitForAction(MODULE_CODE.MODULE_ACTION, ACTION_CODE.DELETE),
    deleteModule
);

module.exports = router;
