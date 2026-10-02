const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
require('dotenv').config();

const validateEnv = require('./config/validateEnv');
validateEnv();

const db = require('./config/database');
const routes = require('./routes');
const errorHandler = require('./middlewares/errorHandler');
const locale = require('./middlewares/locale');
const { apiLimiter } = require('./middlewares/rateLimiter');
const { DEFAULT_SERVER_PORT, API_PREFIX, ERROR_CODE } = require('#shared');
const { translate } = require('./utils/errorMessages');

const app = express();
const PORT = process.env.PORT || DEFAULT_SERVER_PORT;

// Tin proxy gần nhất (nginx/Cloudflare...) để req.ip lấy đúng IP client thật từ
// X-Forwarded-For — cần cho rate limiter và audit log ghi đúng IP khi chạy sau reverse proxy.
// Nếu không có reverse proxy trước server, đặt lại thành false.
app.set('trust proxy', process.env.TRUST_PROXY === 'false' ? false : 1);

// Middleware
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173', credentials: true }));
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
    console.log(`Server đang chạy tại cổng http://localhost:${PORT}`);
});

// Đóng HTTP server và connection pool DB cho gọn khi orchestrator (PM2/Docker/K8s)
// dừng process, tránh treo connection hoặc cắt ngang request đang xử lý.
function shutdown(signal) {
    console.log(`Received ${signal}, shutting down...`);
    server.close(() => {
        db.destroy(() => process.exit(0));
    });
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
