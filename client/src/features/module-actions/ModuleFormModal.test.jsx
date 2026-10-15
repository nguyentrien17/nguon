import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/render';
import { label, t } from '@/test/i18nLabel';
import ModuleFormModal from './ModuleFormModal';
import ActionFormModal from './ActionFormModal';
import * as api from './moduleActionApi';

vi.mock('./moduleActionApi', () => ({ createModule: vi.fn(), updateModule: vi.fn(), createAction: vi.fn(), updateAction: vi.fn() }));

describe('<ModuleFormModal>', () => {
    beforeEach(() => {
        api.createModule.mockResolvedValue({});
        api.updateModule.mockResolvedValue({});
    });

    it('tạo module con: mã tự viết hoa khi gõ, chọn icon, gửi kèm parent', async () => {
        const user = userEvent.setup();
        renderWithProviders(<ModuleFormModal module={null} parentId={4} onClose={vi.fn()} />);

        await user.type(screen.getByLabelText(label('moduleActions.form.moduleCode')), 'mod_report');
        expect(screen.getByLabelText(label('moduleActions.form.moduleCode'))).toHaveValue('MOD_REPORT');
        await user.type(screen.getByLabelText(label('moduleActions.form.moduleName')), 'Báo cáo');
        await user.click(screen.getByRole('button', { name: 'Users' })); // một icon trong IconPicker
        await user.click(screen.getByRole('button', { name: t('moduleActions.form.save') }));

        await waitFor(() => expect(api.createModule).toHaveBeenCalledTimes(1));
        expect(api.createModule.mock.calls[0][0]).toMatchObject({
            module_code: 'MOD_REPORT',
            module_name: 'Báo cáo',
            module_parent_id: 4,
            module_icon: 'Users',
            module_href: null,
            description: null,
            module_index: 0,
        });
    });

    it('sửa module, xoá trắng đường dẫn -> gửi module_href: null (giữ hành vi cũ: xoá được giá trị)', async () => {
        const user = userEvent.setup();
        const module = { id: 2, module_name: 'Cũ', module_href: '/old', module_type: 1, module_index: 3, description: 'x' };
        renderWithProviders(<ModuleFormModal module={module} onClose={vi.fn()} />);

        await user.clear(screen.getByLabelText(label('moduleActions.form.moduleHref')));
        await user.click(screen.getByRole('button', { name: t('moduleActions.form.save') }));

        await waitFor(() => expect(api.updateModule).toHaveBeenCalledTimes(1));
        const [id, payload] = api.updateModule.mock.calls[0];
        expect(id).toBe(2);
        expect(payload).toMatchObject({ module_name: 'Cũ', module_href: null, module_index: 3, description: 'x' });
    });
});

describe('<ActionFormModal>', () => {
    it('xoá trắng giới hạn tần suất -> rate_limit_per_minute: null; mã tự viết thường', async () => {
        api.updateAction.mockResolvedValue({});
        const user = userEvent.setup();
        renderWithProviders(
            <ActionFormModal action={{ id: 8, module_id: 1, action_name: 'Xuất', rate_limit_per_minute: 10, description: '' }} moduleId={1} onClose={vi.fn()} />
        );
        await user.clear(screen.getByLabelText(label('moduleActions.form.rateLimit')));
        await user.click(screen.getByRole('button', { name: t('moduleActions.form.save') }));
        await waitFor(() => expect(api.updateAction).toHaveBeenCalledWith(8, { action_name: 'Xuất', description: null, rate_limit_per_minute: null }));
    });

    it('tạo action: mã tự viết thường, gửi kèm module_id', async () => {
        api.createAction.mockResolvedValue({});
        const user = userEvent.setup();
        renderWithProviders(<ActionFormModal action={null} moduleId={1} onClose={vi.fn()} />);
        await user.type(screen.getByLabelText(label('moduleActions.form.actionCode')), 'EXPORT_PDF');
        await user.type(screen.getByLabelText(label('moduleActions.form.actionName')), 'Xuất PDF');
        await user.type(screen.getByLabelText(label('moduleActions.form.rateLimit')), '5');
        await user.click(screen.getByRole('button', { name: t('moduleActions.form.save') }));
        await waitFor(() =>
            expect(api.createAction).toHaveBeenCalledWith({
                module_id: 1,
                action_code: 'export_pdf',
                action_name: 'Xuất PDF',
                description: null,
                rate_limit_per_minute: 5,
            })
        );
    });
});
