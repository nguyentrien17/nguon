import { z } from 'zod';
import { lowerCode, optionalText, positiveId, recordStatus, requiredName } from './fields.js';

export const createActionSchema = z.object({
    module_id: positiveId,
    action_code: lowerCode,
    action_name: requiredName,
    description: optionalText(500),
    rate_limit_per_minute: z.number().int().positive().optional().nullable(),
});

// Cập nhật: không đổi được module và mã; được đổi trạng thái.
export const updateActionSchema = createActionSchema
    .omit({ module_id: true, action_code: true })
    .extend({ status: recordStatus.optional() });
