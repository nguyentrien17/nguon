import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/render';
import { t } from '@/test/i18nLabel';
import AvatarCard from './AvatarCard';
import * as api from './profileApi';

vi.mock('./profileApi', () => ({ uploadMyAvatar: vi.fn(), removeMyAvatar: vi.fn() }));

const png = (size = 10) => new File([new Uint8Array(size)], 'me.png', { type: 'image/png' });

describe('<AvatarCard>', () => {
    beforeEach(() => {
        api.uploadMyAvatar.mockResolvedValue({ data: {} });
        api.removeMyAvatar.mockResolvedValue({ data: {} });
    });

    it('chưa chọn file -> nút Tải lên bị khoá; chọn file -> tải lên, báo thành công, gọi onChanged', async () => {
        const user = userEvent.setup();
        const onChanged = vi.fn();
        renderWithProviders(<AvatarCard user={{ full_name: 'Nguyễn Văn A', avatar: null }} onChanged={onChanged} />);

        const uploadBtn = screen.getByRole('button', { name: t('profile.uploadAvatar') });
        expect(uploadBtn).toBeDisabled();

        const file = png();
        await user.upload(screen.getByLabelText(/Chọn file/), file);
        await user.click(uploadBtn);

        await waitFor(() => expect(api.uploadMyAvatar).toHaveBeenCalledWith(file));
        expect(await screen.findByText(t('profile.avatarUpdated'))).toBeInTheDocument();
        expect(onChanged).toHaveBeenCalled();
    });

    it('ảnh quá 2 MB bị loại ngay ở trình duyệt, không gọi API', async () => {
        const user = userEvent.setup();
        renderWithProviders(<AvatarCard user={{ full_name: 'A', avatar: null }} />);
        await user.upload(screen.getByLabelText(/Chọn file/), png(2 * 1024 * 1024 + 1));
        expect(screen.getByText(/vượt quá 2.0 MB/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: t('profile.uploadAvatar') })).toBeDisabled();
        expect(api.uploadMyAvatar).not.toHaveBeenCalled();
    });

    it('đã có ảnh -> hiện ảnh (URL tuyệt đối tới server) và nút Xoá ảnh', async () => {
        const user = userEvent.setup();
        renderWithProviders(<AvatarCard user={{ full_name: 'A', avatar: '/uploads/avatars/x.png' }} />);
        expect(screen.getByRole('img')).toHaveAttribute('src', expect.stringMatching(/^http:\/\/localhost:5000\/uploads\/avatars\/x\.png$/));
        await user.click(screen.getByRole('button', { name: t('profile.removeAvatar') }));
        await waitFor(() => expect(api.removeMyAvatar).toHaveBeenCalled());
    });
});
