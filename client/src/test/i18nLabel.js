import i18n from '@/i18n';

// Regex khớp nhãn theo key i18n, bỏ qua dấu * của trường bắt buộc nằm cuối nhãn.
// Dùng: screen.getByLabelText(label('users.form.emailLabel'))
export function label(key) {
    const text = i18n.t(key).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`^${text}\\*?$`);
}

export const t = (key, params) => i18n.t(key, params);
