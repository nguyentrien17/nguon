const { SUPPORTED_LOCALES, DEFAULT_LOCALE } = require('../errors/errorMessages');

// Đọc ngôn ngữ UI hiện tại của client qua header X-Locale (client set theo i18n.language đang
// chọn) — không dùng Accept-Language vì header đó phản ánh ngôn ngữ OS/browser, không phải lựa
// chọn trong app.
function locale(req, res, next) {
    const requested = req.get('X-Locale');
    req.locale = SUPPORTED_LOCALES.includes(requested) ? requested : DEFAULT_LOCALE;
    next();
}

module.exports = locale;
