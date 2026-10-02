const { z } = require('zod');

const detailSchema = z.object({
    module_id: z.number().int().positive(),
    action_id: z.number().int().positive(),
});

const createPermissionSchema = z.object({
    permission_code: z
        .string()
        .trim()
        .min(2, 'validation.tooShort')
        .max(100)
        .regex(/^[A-Z0-9_]+$/, 'validation.invalidFormat'),
    permission_name: z.string().trim().min(1, 'validation.required').max(255),
    description: z.string().trim().max(500).optional().nullable(),
    permission_parent_id: z.number().int().positive().optional().nullable(),
    details: z.array(detailSchema).optional().default([]),
});

const updatePermissionSchema = z.object({
    permission_name: z.string().trim().min(1, 'validation.required').max(255),
    description: z.string().trim().max(500).optional().nullable(),
    details: z.array(detailSchema).optional().default([]),
});

const assignRoleSchema = z.object({
    user_id: z.number().int().positive(),
});

module.exports = { createPermissionSchema, updatePermissionSchema, assignRoleSchema };
