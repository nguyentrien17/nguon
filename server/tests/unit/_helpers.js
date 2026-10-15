// Nạp TRƯỚC mọi module của app trong file test (require('./_helpers') ở dòng đầu).
//
// Đặt env cố định để unit test không phụ thuộc server/.env của từng máy. dotenv không ghi đè
// biến đã có, nên giá trị ở đây thắng. DB trỏ vào port 1: unit test KHÔNG được chạm DB — nếu
// một hàm chưa được mock lỡ chạy query, nó thất bại ngay (ECONNREFUSED) thay vì âm thầm ghi
// vào MySQL đang chạy trên máy dev.
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
process.env.DB_HOST = '127.0.0.1';
process.env.DB_PORT = '1';
process.env.DB_USER = 'unit';
process.env.DB_PASSWORD = 'unit';
process.env.DB_NAME = 'unit';
process.env.JWT_ACCESS_SECRET = 'unit-test-access-secret-0123456789abcdef';
process.env.JWT_REFRESH_SECRET = 'unit-test-refresh-secret-0123456789abcdef';

function mockReq({ headers = {}, ...rest } = {}) {
    const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
    return { headers: lower, get: (name) => lower[name.toLowerCase()], locale: 'en', ...rest };
}

function mockRes() {
    return {
        statusCode: 200,
        body: undefined,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            this.body = body;
            return this;
        },
    };
}

// Chạy một middleware Express, trả về { res, nextArg, nextCalled } khi nó gọi next() hoặc
// gửi response (middleware async: chờ promise của nó xong).
async function runMiddleware(mw, req, res = mockRes()) {
    let nextCalled = false;
    let nextArg;
    await mw(req, res, (arg) => {
        nextCalled = true;
        nextArg = arg;
    });
    return { res, nextCalled, nextArg };
}

module.exports = { mockReq, mockRes, runMiddleware };
