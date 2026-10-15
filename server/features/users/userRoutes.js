const express = require('express');
const router = express.Router();
const {
    listUsers,
    createUser,
    updateUser,
    setUserStatus,
    exportUsers,
    listUserRoles,
} = require('./userController');
const { authenticate } = require('#core/security/authenticate');
const { requirePermission } = require('#features/permissions/permissionMiddleware');
const { validateBody, validateParams } = require('#core/http/validate');
const verifySignature = require('#core/security/verifySignature');
const { createUserSchema, updateUserSchema, userStatusSchema } = require('./userValidators');
const { idParamSchema } = require('../../../shared/validators/common');
const { MODULE_CODE, ACTION_CODE } = require('#shared');

router.get('/', authenticate, requirePermission(MODULE_CODE.USER, ACTION_CODE.VIEW), listUsers);
router.get('/export', authenticate, requirePermission(MODULE_CODE.USER, ACTION_CODE.EXPORT_EXCEL), exportUsers);
router.post('/', authenticate, requirePermission(MODULE_CODE.USER, ACTION_CODE.CREATE), verifySignature, validateBody(createUserSchema), createUser);
router.put('/:id', authenticate, requirePermission(MODULE_CODE.USER, ACTION_CODE.EDIT), verifySignature, validateParams(idParamSchema), validateBody(updateUserSchema), updateUser);
// Khoá / mở khoá tài khoản — quyền riêng MOD_USER:lock (trước đây là DELETE /users/:id đòi
// MOD_USER:delete; đã bỏ, xem docs/api-conventions.md mục 5).
router.patch(
    '/:id/status',
    authenticate,
    requirePermission(MODULE_CODE.USER, ACTION_CODE.LOCK),
    verifySignature,
    validateParams(idParamSchema),
    validateBody(userStatusSchema),
    setUserStatus
);
router.get('/:id/roles', authenticate, requirePermission(MODULE_CODE.PERMISSION, ACTION_CODE.VIEW), validateParams(idParamSchema), listUserRoles);

module.exports = router;
