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
const { DEFAULT_SERVER_PORT, API_PREFIX, ERROR_CODE } = require('#shared');
const { translate } = require('#core/errors/errorMessages');

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

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

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

// Đóng HTTP server và connection pool DB cho gọn khi orchestrator (PM2/Docker/K8s)
// dừng process, tránh treo connection hoặc cắt ngang request đang xử lý.
function shutdown(signal) {
    logger.info(`Received ${signal}, shutting down...`);
    server.close(() => {
        db.destroy(() => process.exit(0));
    });
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
