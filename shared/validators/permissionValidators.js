import { z } from 'zod';
import { optionalId, optionalText, positiveId, requiredName, upperCode } from './fields.js';

const detailSchema = z.object({
    module_id: positiveId,
    action_id: positiveId,
});

export const createPermissionSchema = z.object({
    permission_code: upperCode,
    permission_name: requiredName,
    description: optionalText(500),
    permission_parent_id: optionalId,
    details: z.array(detailSchema).optional().default([]),
});

// Cập nhật: không đổi được mã và role cha.
export const updatePermissionSchema = createPermissionSchema.omit({ permission_code: true, permission_parent_id: true });

export const assignRoleSchema = z.object({
    user_id: positiveId,
});
