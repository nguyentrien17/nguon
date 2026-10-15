import { z } from 'zod';
import { optionalId, optionalText, recordStatus, requiredName, upperCode } from './fields.js';

export const createModuleSchema = z.object({
    module_code: upperCode,
    module_name: requiredName,
    module_href: optionalText(255),
    module_element_id: optionalText(100),
    module_parent_id: optionalId,
    module_type: z.number().int().min(1).max(2).optional(), // MODULE_TYPE: 1 menu, 2 màn hình
    module_icon: optionalText(50),
    module_index: z.number().int().optional(),
    description: optionalText(500),
});

// Cập nhật: không đổi được mã và module cha; được đổi trạng thái.
export const updateModuleSchema = createModuleSchema
    .omit({ module_code: true, module_parent_id: true })
    .extend({ status: recordStatus.optional() });

// Nhân bản: chỉ cần mã + tên mới, cùng quy tắc với tạo mới.
export const cloneModuleSchema = createModuleSchema.pick({ module_code: true, module_name: true });
