const express = require('express');
const router = express.Router();
const {
    listPermissions,
    createPermission,
    updatePermission,
    deletePermission,
    assignRoleToUser,
    unassignRoleFromUser,
} = require('./permissionController');
const { authenticate, requirePermission } = require('../../middlewares/authMiddleware');
const { validateBody } = require('../../middlewares/validate');
const verifySignature = require('../../middlewares/verifySignature');
const { createPermissionSchema, updatePermissionSchema, assignRoleSchema } = require('./permissionValidators');
const { MODULE_CODE, ACTION_CODE } = require('#shared');

router.get('/', authenticate, requirePermission(MODULE_CODE.PERMISSION, ACTION_CODE.VIEW), listPermissions);
router.post('/', authenticate, requirePermission(MODULE_CODE.PERMISSION, ACTION_CODE.CREATE), verifySignature, validateBody(createPermissionSchema), createPermission);
router.put('/:id', authenticate, requirePermission(MODULE_CODE.PERMISSION, ACTION_CODE.EDIT), verifySignature, validateBody(updatePermissionSchema), updatePermission);
router.delete('/:id', authenticate, requirePermission(MODULE_CODE.PERMISSION, ACTION_CODE.DELETE), verifySignature, deletePermission);
router.post('/:id/assign', authenticate, requirePermission(MODULE_CODE.PERMISSION, ACTION_CODE.EDIT), verifySignature, validateBody(assignRoleSchema), assignRoleToUser);
router.delete('/:id/assign', authenticate, requirePermission(MODULE_CODE.PERMISSION, ACTION_CODE.EDIT), verifySignature, validateBody(assignRoleSchema), unassignRoleFromUser);

module.exports = router;
