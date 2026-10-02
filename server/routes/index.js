const express = require('express');
const router = express.Router();

const authRoutes = require('#features/auth/authRoutes');
const userRoutes = require('#features/users/userRoutes');
const permissionRoutes = require('#features/permissions/permissionRoutes');
const moduleRoutes = require('#features/modules/moduleRoutes');
const actionRoutes = require('#features/actions/actionRoutes');
const auditLogRoutes = require('#features/audit-logs/auditLogRoutes');
const insightsRoutes = require('#features/insights/insightsRoutes');

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/permissions', permissionRoutes);
router.use('/modules', moduleRoutes);
router.use('/actions', actionRoutes);
router.use('/audit-logs', auditLogRoutes);
router.use('/insights', insightsRoutes);

module.exports = router;
