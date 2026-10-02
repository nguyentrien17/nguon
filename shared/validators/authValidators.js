const { z } = require('zod');
const { passwordSchema } = require('./userValidators');

const loginSchema = z.object({
    username: z.string().trim().min(1, 'validation.required'),
    password: z.string().min(1, 'validation.required'),
});

const updateProfileSchema = z
    .object({
        email: z.string().trim().email('validation.invalidFormat').optional(),
        full_name: z.string().trim().min(1).max(255).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, { message: 'validation.noFieldsToUpdate' });

const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, 'validation.required'),
    newPassword: passwordSchema,
});

const forgotPasswordSchema = z.object({
    email: z.string().trim().email('validation.invalidFormat'),
});

const resetPasswordSchema = z.object({
    token: z.string().min(1, 'validation.required'),
    newPassword: passwordSchema,
});

module.exports = { loginSchema, updateProfileSchema, changePasswordSchema, forgotPasswordSchema, resetPasswordSchema };
