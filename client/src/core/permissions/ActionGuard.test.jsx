import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PermissionsProvider } from './PermissionsContext';
import ActionGuard from './ActionGuard';

// ModulesProvider thật cần phiên + API; ở đây chỉ cần tra module theo elementId.
vi.mock('./ModulesContext', () => ({
    useModules: () => ({ getModuleByElementId: (id) => (id === 'btn-report' ? { module_code: 'MOD_REPORT' } : undefined) }),
}));

const renderWith = (permissions, ui) => render(<PermissionsProvider permissions={permissions}>{ui}</PermissionsProvider>);
const perm = (module_code, action_code) => ({ module_code, action_code });

describe('<ActionGuard> + PermissionsProvider thật', () => {
    it('có quyền -> hiện; thiếu quyền -> ẩn', () => {
        renderWith(
            [perm('MOD_USER', 'edit')],
            <>
                <ActionGuard module="MOD_USER" action="edit">
                    <button type="button">Sửa</button>
                </ActionGuard>
                <ActionGuard module="MOD_USER" action="lock">
                    <button type="button">Khoá</button>
                </ActionGuard>
            </>
        );
        expect(screen.getByRole('button', { name: 'Sửa' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Khoá' })).not.toBeInTheDocument();
    });

    it('elementId -> tra module qua useModules rồi kiểm quyền', () => {
        renderWith(
            [perm('MOD_REPORT', 'export_excel')],
            <ActionGuard elementId="btn-report" action="export_excel">
                <button type="button">Xuất</button>
            </ActionGuard>
        );
        expect(screen.getByRole('button', { name: 'Xuất' })).toBeInTheDocument();
    });
});
