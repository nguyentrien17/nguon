const { z } = require('zod');

const createModuleSchema = z.object({
    module_code: z
        .string()
        .trim()
        .min(2, 'validation.tooShort')
        .max(100)
        .regex(/^[A-Z0-9_]+$/, 'validation.invalidFormat'),
    module_name: z.string().trim().min(1, 'validation.required').max(255),
    module_href: z.string().trim().max(255).optional().nullable(),
    module_element_id: z.string().trim().max(100).optional().nullable(),
    module_parent_id: z.number().int().positive().optional().nullable(),
    module_type: z.number().int().min(1).max(2).optional(),
    module_icon: z.string().trim().max(50).optional().nullable(),
    module_index: z.number().int().optional(),
    description: z.string().trim().max(500).optional().nullable(),
});

const updateModuleSchema = z.object({
    module_name: z.string().trim().min(1, 'validation.required').max(255),
    module_href: z.string().trim().max(255).optional().nullable(),
    module_element_id: z.string().trim().max(100).optional().nullable(),
    module_type: z.number().int().min(1).max(2).optional(),
    module_icon: z.string().trim().max(50).optional().nullable(),
    module_index: z.number().int().optional(),
    status: z.number().int().min(0).max(2).optional(),
    description: z.string().trim().max(500).optional().nullable(),
});

const cloneModuleSchema = z.object({
    module_code: z
        .string()
        .trim()
        .min(2, 'validation.tooShort')
        .max(100)
        .regex(/^[A-Z0-9_]+$/, 'validation.invalidFormat'),
    module_name: z.string().trim().min(1, 'validation.required').max(255),
});

module.exports = { createModuleSchema, updateModuleSchema, cloneModuleSchema };
