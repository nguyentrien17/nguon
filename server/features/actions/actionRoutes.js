const express = require('express');
const router = express.Router();
const { listActions, createAction, updateAction, deleteAction, scaffoldActions, archiveAction, restoreAction } = require('./actionController');
const { authenticate, requirePermission } = require('../../middlewares/authMiddleware');
const { validateBody } = require('../../middlewares/validate');
const { rateLimitForAction } = require('../../middlewares/actionRateLimiter');
const verifySignature = require('../../middlewares/verifySignature');
const { createActionSchema, updateActionSchema } = require('./actionValidators');
const { emptyBodySchema } = require('../../../shared/validators/common');
const { MODULE_CODE, ACTION_CODE } = require('#shared');

router.get('/', authenticate, listActions);
router.post('/', authenticate, requirePermission(MODULE_CODE.MODULE_ACTION, ACTION_CODE.CREATE), verifySignature, validateBody(createActionSchema), createAction);
router.post('/scaffold/:moduleId', authenticate, requirePermission(MODULE_CODE.MODULE_ACTION, ACTION_CODE.CREATE), verifySignature, validateBody(emptyBodySchema), scaffoldActions);
router.post('/:id/archive', authenticate, requirePermission(MODULE_CODE.MODULE_ACTION, ACTION_CODE.EDIT), verifySignature, validateBody(emptyBodySchema), archiveAction);
router.post('/:id/restore', authenticate, requirePermission(MODULE_CODE.MODULE_ACTION, ACTION_CODE.EDIT), verifySignature, validateBody(emptyBodySchema), restoreAction);
router.put('/:id', authenticate, requirePermission(MODULE_CODE.MODULE_ACTION, ACTION_CODE.EDIT), verifySignature, validateBody(updateActionSchema), updateAction);
router.delete(
    '/:id',
    authenticate,
    requirePermission(MODULE_CODE.MODULE_ACTION, ACTION_CODE.DELETE),
    verifySignature,
    rateLimitForAction(MODULE_CODE.MODULE_ACTION, ACTION_CODE.DELETE),
    deleteAction
);

module.exports = router;
