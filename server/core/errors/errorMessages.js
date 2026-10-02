const catalog = require('../../../shared/errorMessages.json');

const SUPPORTED_LOCALES = ['vi', 'en', 'zh'];
const DEFAULT_LOCALE = 'en';

function interpolate(template, params) {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => (params[key] !== undefined ? params[key] : ''));
}

// Tra bản dịch theo errorCode + locale, hỗ trợ interpolation {{key}}. Nếu params.actionKey có
// giá trị, ưu tiên tra khoá ghép "${errorCode}_${ACTIONKEY}" trước (vd ERR_PROTECTED_ROLE_DELETED)
// để phân biệt các biến thể hành động của cùng 1 mã lỗi mà không cần dịch động 1 từ tiếng Anh.
function translate(errorCode, locale, params = {}) {
    const lang = SUPPORTED_LOCALES.includes(locale) ? locale : DEFAULT_LOCALE;
    const table = catalog[lang] || catalog[DEFAULT_LOCALE];

    let template;
    if (params.actionKey) {
        template = table[`${errorCode}_${params.actionKey.toUpperCase()}`];
    }
    if (!template) template = table[errorCode];
    if (!template) template = (catalog[DEFAULT_LOCALE] || {})[errorCode];
    if (!template) return null;

    return interpolate(template, params);
}

module.exports = { translate, SUPPORTED_LOCALES, DEFAULT_LOCALE };
