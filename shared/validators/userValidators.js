const { z } = require('zod');

const passwordSchema = z
    .string()
    .min(8, 'validation.tooShort')
    .regex(/[A-Za-z]/, 'validation.invalidFormat')
    .regex(/[0-9]/, 'validation.invalidFormat');

const createUserSchema = z.object({
    username: z
        .string()
        .trim()
        .min(3, 'validation.tooShort')
        .max(100)
        .regex(/^[a-zA-Z0-9_.]+$/, 'validation.invalidFormat'),
    email: z.string().trim().email('validation.invalidFormat'),
    password: passwordSchema,
    full_name: z.string().trim().min(1, 'validation.required').max(255),
    role_ids: z.array(z.number().int().positive()).optional().default([]),
});

const updateUserSchema = z
    .object({
        email: z.string().trim().email('validation.invalidFormat').optional(),
        full_name: z.string().trim().min(1).max(255).optional(),
        avatar: z.string().trim().max(500).nullable().optional(),
        password: passwordSchema.optional(),
    })
    .refine((data) => Object.keys(data).length > 0, { message: 'validation.noFieldsToUpdate' });

module.exports = { passwordSchema, createUserSchema, updateUserSchema };
