const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');

// env tự gọi dotenv.config() — đây là điểm duy nhất đọc process.env (docs/architecture.md §3).
const env = require('#core/config/env');
const logger = require('#core/logger');

const validateEnv = require('#core/config/validateEnv');
validateEnv();

const db = require('#core/database/db');
const routes = require('./routes');
const errorHandler = require('#core/errors/errorHandler');
const locale = require('#core/http/locale');
const { apiLimiter } = require('#core/security/rateLimiter');
const { setSessionGuard } = require('#core/security/authenticate');
const { isSessionActive } = require('#features/auth/authService');
const { DEFAULT_SERVER_PORT, API_PREFIX, ERROR_CODE } = require('#shared');
const { translate } = require('#core/errors/errorMessages');
const { UPLOAD_PUBLIC_PREFIX } = require('#core/storage/fileStorage');

// Core không import Feature, nên bootstrap là nơi nối hai bên: authenticate (Core) hỏi feature
// auth xem user của access token còn được phép dùng phiên không (chưa bị khoá/xoá).
setSessionGuard(isSessionActive);

const SHUTDOWN_TIMEOUT_MS = 10 * 1000;

const app = express();
const PORT = env.PORT || DEFAULT_SERVER_PORT;

// Tin proxy gần nhất (nginx/Cloudflare...) để req.ip lấy đúng IP client thật từ
// X-Forwarded-For — cần cho rate limiter và audit log ghi đúng IP khi chạy sau reverse proxy.
// Nếu không có reverse proxy trước server, đặt TRUST_PROXY=false.
app.set('trust proxy', env.TRUST_PROXY);

// Middleware
app.use(helmet());
app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
// verify lưu lại đúng byte gốc của body (req.rawBody) — cần cho việc xác minh chữ ký request
// (ký/verify trên raw bytes, không re-serialize, tránh lệch chuẩn hoá JSON.stringify).
app.use(express.json({ limit: '200kb', verify: (req, res, buf) => { req.rawBody = buf; } }));
app.use(cookieParser());
app.use(locale);

// Kiểm tra server chạy
app.get('/', (req, res) => {
    res.json({ message: 'API RBAC System is running...' });
});

// Liveness: process còn sống. Không chạm DB để orchestrator không restart app chỉ vì MySQL chập chờn.
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Readiness: có phục vụ được request thật không (DB kết nối được). Dùng cho load balancer /
// readinessProbe để ngừng đẩy traffic vào khi DB mất kết nối.
app.get('/health/ready', async (req, res) => {
    try {
        await db.raw('SELECT 1');
        res.json({ status: 'ok', db: 'ok' });
    } catch (err) {
        logger.error('Readiness check failed:', err.message);
        res.status(503).json({ status: 'error', db: 'unavailable' });
    }
});

// File người dùng tải lên (ảnh đại diện...) — xem core/storage/fileStorage.js.
// - Cross-Origin-Resource-Policy: helmet mặc định 'same-origin' sẽ chặn client (origin khác,
//   vd :5173) hiển thị ảnh; file ở đây là công khai nên cho phép cross-origin.
// - CSP 'none' + nosniff (helmet): trình duyệt không chạy được gì từ file tải lên, kể cả khi ai
//   đó lách được kiểm tra loại file.
app.use(
    UPLOAD_PUBLIC_PREFIX,
    express.static(env.UPLOAD_DIR, {
        index: false,
        dotfiles: 'deny',
        maxAge: '7d',
        setHeaders: (res) => {
            res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
            res.setHeader('Content-Security-Policy', "default-src 'none'");
        },
    })
);

// Routes
app.use(API_PREFIX, apiLimiter, routes);

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        errorCode: ERROR_CODE.NOT_FOUND,
        message: translate(ERROR_CODE.NOT_FOUND, req.locale) || 'Endpoint not found',
    });
});

// Xử lý lỗi tập trung (phải đặt sau cùng)
app.use(errorHandler);

// Khởi động server
const server = app.listen(PORT, () => {
    logger.info(`Server đang chạy tại http://localhost:${PORT} (NODE_ENV=${env.NODE_ENV})`);
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        logger.error(`Port ${PORT} đang được process khác dùng. Tắt process đó hoặc đổi PORT trong .env.`);
    } else {
        logger.error('HTTP server error:', err);
    }
    process.exit(1);
});

// Đóng HTTP server và connection pool DB cho gọn khi orchestrator (PM2/Docker/K8s)
// dừng process, tránh treo connection hoặc cắt ngang request đang xử lý.
// server.close() chờ mọi connection keep-alive tự đóng — có thể không bao giờ xảy ra, nên đặt
// hạn chót rồi thoát cưỡng bức thay vì treo cho tới khi orchestrator SIGKILL.
let shuttingDown = false;
function shutdown(signal, exitCode = 0) {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`Received ${signal}, shutting down...`);

    setTimeout(() => {
        logger.error(`Shutdown quá ${SHUTDOWN_TIMEOUT_MS}ms, thoát cưỡng bức.`);
        process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS).unref();

    server.close(() => {
        db.destroy(() => process.exit(exitCode));
    });
    server.closeIdleConnections();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Lỗi lọt khỏi mọi try/catch: log lại rồi tắt có kiểm soát. Tiếp tục chạy sau
// uncaughtException là chạy trong trạng thái không xác định; để orchestrator khởi động lại.
process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection:', reason);
    shutdown('unhandledRejection', 1);
});
process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception:', err);
    shutdown('uncaughtException', 1);
});
