const { z } = require('zod');

const createActionSchema = z.object({
    module_id: z.number().int().positive(),
    action_code: z
        .string()
        .trim()
        .min(1, 'validation.required')
        .max(100)
        .regex(/^[a-z0-9_]+$/, 'validation.invalidFormat'),
    action_name: z.string().trim().min(1, 'validation.required').max(255),
    description: z.string().trim().max(500).optional().nullable(),
    rate_limit_per_minute: z.number().int().positive().optional().nullable(),
});

const updateActionSchema = z.object({
    action_name: z.string().trim().min(1, 'validation.required').max(255),
    status: z.number().int().min(0).max(2).optional(),
    description: z.string().trim().max(500).optional().nullable(),
    rate_limit_per_minute: z.number().int().positive().optional().nullable(),
});

module.exports = { createActionSchema, updateActionSchema };
