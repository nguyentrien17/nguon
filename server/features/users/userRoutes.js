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
const { validateBody, validateParams } = require('#core/http/validate');
const verifySignature = require('#core/security/verifySignature');
const { createUserSchema, updateUserSchema } = require('./userValidators');
const { idParamSchema } = require('../../../shared/validators/common');
const { MODULE_CODE, ACTION_CODE } = require('#shared');

router.get('/', authenticate, requirePermission(MODULE_CODE.USER, ACTION_CODE.VIEW), listUsers);
router.get('/export', authenticate, requirePermission(MODULE_CODE.USER, ACTION_CODE.EXPORT_EXCEL), exportUsers);
router.post('/', authenticate, requirePermission(MODULE_CODE.USER, ACTION_CODE.CREATE), verifySignature, validateBody(createUserSchema), createUser);
router.put('/:id', authenticate, requirePermission(MODULE_CODE.USER, ACTION_CODE.EDIT), verifySignature, validateParams(idParamSchema), validateBody(updateUserSchema), updateUser);
// DELETE ở đây thực chất là KHOÁ/MỞ KHOÁ tài khoản, không xoá — xem docs/api-conventions.md mục 5.
router.delete('/:id', authenticate, requirePermission(MODULE_CODE.USER, ACTION_CODE.DELETE), verifySignature, validateParams(idParamSchema), toggleUserStatus);
router.get('/:id/roles', authenticate, requirePermission(MODULE_CODE.PERMISSION, ACTION_CODE.VIEW), validateParams(idParamSchema), listUserRoles);

module.exports = router;
