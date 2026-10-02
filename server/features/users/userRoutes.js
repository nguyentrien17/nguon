const express = require('express');
const router = express.Router();
const {
    listUsers,
    createUser,
    updateUser,
    toggleUserStatus,
    exportUsers,
    listUserRoles,
} = require('./userController');
const { authenticate } = require('#core/security/authenticate');
const { requirePermission } = require('#features/permissions/permissionMiddleware');
const { validateBody } = require('#core/http/validate');
const verifySignature = require('#core/security/verifySignature');
const { createUserSchema, updateUserSchema } = require('./userValidators');
const { MODULE_CODE, ACTION_CODE } = require('#shared');

router.get('/', authenticate, requirePermission(MODULE_CODE.USER, ACTION_CODE.VIEW), listUsers);
router.get('/export', authenticate, requirePermission(MODULE_CODE.USER, ACTION_CODE.EXPORT_EXCEL), exportUsers);
router.post('/', authenticate, requirePermission(MODULE_CODE.USER, ACTION_CODE.CREATE), verifySignature, validateBody(createUserSchema), createUser);
router.put('/:id', authenticate, requirePermission(MODULE_CODE.USER, ACTION_CODE.EDIT), verifySignature, validateBody(updateUserSchema), updateUser);
router.delete('/:id', authenticate, requirePermission(MODULE_CODE.USER, ACTION_CODE.DELETE), verifySignature, toggleUserStatus);
router.get('/:id/roles', authenticate, requirePermission(MODULE_CODE.PERMISSION, ACTION_CODE.VIEW), listUserRoles);

module.exports = router;
