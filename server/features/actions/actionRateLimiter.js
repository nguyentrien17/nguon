const actionModel = require('./actionModel');
const { ERROR_CODE } = require('#shared');

const WINDOW_MS = 60 * 1000;
const CACHE_TTL_MS = 30 * 1000;

const configCache = new Map(); // `${moduleCode}:${actionCode}` -> { action, expiresAt }
const buckets = new Map(); // `${userId}:${moduleCode}:${actionCode}` -> { count, resetAt }

// buckets chỉ được ghi đè khi cùng key bị gọi lại sau resetAt — nếu không dọn định kỳ,
// Map này phình vô hạn theo số user/action từng gọi (rò rỉ bộ nhớ trên process chạy lâu dài).
setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
        if (now > bucket.resetAt) buckets.delete(key);
    }
}, WINDOW_MS).unref();

async function getActionConfig(moduleCode, actionCode) {
    const cacheKey = `${moduleCode}:${actionCode}`;
    const cached = configCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.action;
    }
    const action = await actionModel.findByModuleAndCode(moduleCode, actionCode);
    configCache.set(cacheKey, { action, expiresAt: Date.now() + CACHE_TTL_MS });
    return action;
}

// Giới hạn tần suất gọi riêng cho 1 (module, action) theo rate_limit_per_minute cấu hình trong
// DB — độc lập với apiLimiter chung. Không cấu hình (NULL) thì bỏ qua, không giới hạn thêm.
function rateLimitForAction(moduleCode, actionCode) {
    return async (req, res, next) => {
        try {
            const action = await getActionConfig(moduleCode, actionCode);
            if (!action?.rate_limit_per_minute) {
                return next();
            }

            const key = `${req.user.id}:${moduleCode}:${actionCode}`;
            const now = Date.now();
            let bucket = buckets.get(key);
            if (!bucket || now > bucket.resetAt) {
                bucket = { count: 0, resetAt: now + WINDOW_MS };
                buckets.set(key, bucket);
            }
            bucket.count += 1;

            if (bucket.count > action.rate_limit_per_minute) {
                return res.status(429).json({
                    success: false,
                    errorCode: ERROR_CODE.TOO_MANY_REQUESTS,
                    message: 'Too many requests for this action. Please slow down.',
                });
            }
            next();
        } catch (err) {
            next(err);
        }
    };
}

module.exports = { rateLimitForAction };
