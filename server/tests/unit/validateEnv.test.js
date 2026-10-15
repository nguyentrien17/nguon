// validateEnv() gọi process.exit(1) khi cấu hình sai, nên mỗi trường hợp chạy trong một child
// process riêng với env được dựng tay. cwd là thư mục tạm để dotenv không đọc server/.env thật.
require('./_helpers');
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');
const os = require('os');
const path = require('path');

const VALIDATE_ENV = path.join(__dirname, '..', '..', 'core', 'config', 'validateEnv.js');

const STRONG_ACCESS = 'a'.repeat(40);
const STRONG_REFRESH = 'b'.repeat(40);
const BASE = {
    DB_HOST: 'localhost',
    DB_USER: 'u',
    DB_PASSWORD: 'p',
    DB_NAME: 'd',
    JWT_ACCESS_SECRET: STRONG_ACCESS,
    JWT_REFRESH_SECRET: STRONG_REFRESH,
};

function run(env) {
    const result = spawnSync(process.execPath, ['-e', `require(${JSON.stringify(VALIDATE_ENV)})()`], {
        cwd: os.tmpdir(),
        // Chỉ giữ PATH/SystemRoot từ môi trường hiện tại — KHÔNG kế thừa DB_*/JWT_* của test runner.
        env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, ...env },
        encoding: 'utf8',
    });
    return { code: result.status, output: `${result.stdout}${result.stderr}` };
}

describe('validateEnv', () => {
    test('đủ biến, production, secret mạnh -> chạy bình thường', () => {
        const { code } = run({ ...BASE, NODE_ENV: 'production' });
        assert.equal(code, 0);
    });

    test('thiếu biến bắt buộc -> exit 1 và nêu tên biến', () => {
        const { DB_PASSWORD, ...rest } = BASE; // eslint-disable-line no-unused-vars
        const { code, output } = run({ ...rest, NODE_ENV: 'development' });
        assert.equal(code, 1);
        assert.match(output, /DB_PASSWORD/);
    });

    test('production còn placeholder của .env.example -> exit 1', () => {
        const { code } = run({ ...BASE, NODE_ENV: 'production', DB_PASSWORD: 'change_this_password' });
        assert.equal(code, 1);
    });

    test('production, secret < 32 ký tự -> exit 1', () => {
        const { code, output } = run({ ...BASE, NODE_ENV: 'production', JWT_ACCESS_SECRET: 'short' });
        assert.equal(code, 1);
        assert.match(output, /JWT_ACCESS_SECRET/);
    });

    test('production, access secret = refresh secret -> exit 1', () => {
        const { code } = run({ ...BASE, NODE_ENV: 'production', JWT_REFRESH_SECRET: STRONG_ACCESS });
        assert.equal(code, 1);
    });

    test('development, secret yếu -> chỉ cảnh báo, không dừng', () => {
        const { code, output } = run({ ...BASE, NODE_ENV: 'development', JWT_ACCESS_SECRET: 'short' });
        assert.equal(code, 0);
        assert.match(output, /WARN/);
    });

    test('thiếu NODE_ENV -> cảnh báo về cờ Secure, không dừng', () => {
        const { code, output } = run(BASE);
        assert.equal(code, 0);
        assert.match(output, /NODE_ENV/);
    });
});
