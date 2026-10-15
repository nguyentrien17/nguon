import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.js';

// Dùng lại toàn bộ cấu hình Vite (alias @ và @shared, plugin React) — test chạy đúng như app.
export default mergeConfig(
    viteConfig,
    defineConfig({
        test: {
            environment: 'jsdom',
            setupFiles: ['./src/test/setup.js'],
            include: ['src/**/*.test.{js,jsx}'],
            // Không dùng globals: test import describe/it/expect từ 'vitest' — ESLint không cần
            // khai báo biến toàn cục mới.
            globals: false,
            css: false,
            restoreMocks: true,
        },
    })
);
