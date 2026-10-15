import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import i18n from '@/i18n';

// Ngôn ngữ cố định cho mọi test — không phụ thuộc localStorage / ngôn ngữ trình duyệt giả lập.
await i18n.changeLanguage('vi');

// Không bật globals nên RTL không tự dọn DOM giữa các test.
afterEach(() => {
    cleanup();
    localStorage.clear();
    sessionStorage.clear();
});
