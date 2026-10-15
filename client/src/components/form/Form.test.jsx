import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/render';
import { createUserSchema } from '@shared/validators/userValidators';
import Form from './Form';
import FormModal from './FormModal';

const fields = [
    { name: 'username', label: 'Tên đăng nhập', normalize: (v) => v.toLowerCase() },
    { name: 'email', label: 'Email' },
    { name: 'full_name', label: 'Họ tên' },
    { name: 'password', label: 'Mật khẩu' },
];

describe('<Form>', () => {
    it('submit form trống: lỗi hiện dưới từng ô, KHÔNG gọi onSubmit, focus ô lỗi đầu tiên', async () => {
        const onSubmit = vi.fn();
        const user = userEvent.setup();
        renderWithProviders(<Form fields={fields} schema={createUserSchema} onSubmit={onSubmit} />);

        await user.click(screen.getByRole('button', { name: 'Lưu' }));

        expect(onSubmit).not.toHaveBeenCalled();
        expect(screen.getByText('Email là bắt buộc')).toBeInTheDocument();
        expect(screen.getByLabelText(/Email/)).toHaveAttribute('aria-invalid', 'true');
        await waitFor(() => expect(screen.getByLabelText(/Tên đăng nhập/)).toHaveFocus());
    });

    it('sửa ô lỗi thì lỗi của ô đó biến mất ngay', async () => {
        const user = userEvent.setup();
        renderWithProviders(<Form fields={fields} schema={createUserSchema} onSubmit={vi.fn()} />);
        await user.click(screen.getByRole('button', { name: 'Lưu' }));
        await user.type(screen.getByLabelText(/Email/), 'a');
        expect(screen.queryByText('Email là bắt buộc')).not.toBeInTheDocument();
    });

    it('dữ liệu hợp lệ: onSubmit nhận data đã qua schema; normalize áp dụng khi gõ', async () => {
        const onSubmit = vi.fn();
        const user = userEvent.setup();
        renderWithProviders(<Form fields={fields} schema={createUserSchema} onSubmit={onSubmit} />);

        await user.type(screen.getByLabelText(/Tên đăng nhập/), 'ALICE');
        expect(screen.getByLabelText(/Tên đăng nhập/)).toHaveValue('alice');
        await user.type(screen.getByLabelText(/Email/), '  a@b.co ');
        await user.type(screen.getByLabelText(/Họ tên/), 'Alice');
        await user.type(screen.getByLabelText(/Mật khẩu/), 'Passw0rd!');
        await user.click(screen.getByRole('button', { name: 'Lưu' }));

        await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
        expect(onSubmit.mock.calls[0][0]).toMatchObject({ username: 'alice', email: 'a@b.co', full_name: 'Alice', role_ids: [] });
    });

    it('onSubmit ném lỗi API -> toast hiện message của server, form mở khoá lại', async () => {
        const user = userEvent.setup();
        const apiError = { response: { data: { errorCode: 'ERR_DUPLICATE', message: 'Email đã tồn tại' } } };
        renderWithProviders(<Form fields={[{ name: 'email', label: 'Email' }]} onSubmit={() => Promise.reject(apiError)} />);

        await user.type(screen.getByLabelText(/Email/), 'a@b.co');
        await user.click(screen.getByRole('button', { name: 'Lưu' }));

        expect(await screen.findByText('Email đã tồn tại')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Lưu' })).toBeEnabled();
    });

    it('trường file: file quá lớn bị loại và báo lỗi dưới ô; file hợp lệ hiện trong danh sách', async () => {
        const user = userEvent.setup();
        renderWithProviders(<Form fields={[{ name: 'doc', type: 'file', label: 'Tệp', accept: '.pdf', maxSize: 1024 }]} onSubmit={vi.fn()} />);
        const input = screen.getByLabelText(/Chọn file/);

        await user.upload(input, new File(['x'.repeat(2048)], 'lon.pdf', { type: 'application/pdf' }));
        expect(screen.getByText(/"lon.pdf" vượt quá 1.0 KB/)).toBeInTheDocument();
        expect(screen.queryByText('lon.pdf')).not.toBeInTheDocument();

        await user.upload(input, new File(['x'], 'nho.pdf', { type: 'application/pdf' }));
        expect(screen.getByText('nho.pdf')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Bỏ nho.pdf' }));
        expect(screen.queryByText('nho.pdf')).not.toBeInTheDocument();
    });
});

describe('<FormModal>', () => {
    it('Escape đóng hộp thoại khi rảnh, KHÔNG đóng khi đang lưu', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        let finish;
        const onSubmit = () => new Promise((resolve) => (finish = resolve));
        renderWithProviders(<FormModal title="Tạo" fields={[{ name: 'email', label: 'Email' }]} onClose={onClose} onSubmit={onSubmit} />);

        await user.keyboard('{Escape}');
        expect(onClose).toHaveBeenCalledTimes(1);

        await user.type(screen.getByLabelText(/Email/), 'a@b.co');
        await user.click(screen.getByRole('button', { name: 'Lưu' }));
        await user.keyboard('{Escape}');
        expect(onClose).toHaveBeenCalledTimes(1); // vẫn 1: đang lưu thì không đóng

        finish();
        await waitFor(() => expect(screen.getByRole('button', { name: 'Lưu' })).toBeEnabled());
    });

    it('nút Huỷ gọi onClose', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        renderWithProviders(<FormModal title="Tạo" fields={['email']} onClose={onClose} onSubmit={vi.fn()} />);
        await user.click(screen.getByRole('button', { name: 'Huỷ' }));
        expect(onClose).toHaveBeenCalled();
    });
});
