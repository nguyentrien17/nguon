import { ACTION_CODE } from '@shared/constants.json';

export const PERMISSION_PRESETS = [
    { key: 'view_only', actionCodes: [ACTION_CODE.VIEW] },
    { key: 'editor', actionCodes: [ACTION_CODE.VIEW, ACTION_CODE.CREATE, ACTION_CODE.EDIT] },
    {
        key: 'full',
        actionCodes: [ACTION_CODE.VIEW, ACTION_CODE.CREATE, ACTION_CODE.EDIT, ACTION_CODE.DELETE, ACTION_CODE.EXPORT_EXCEL],
    },
];
