import axios from 'axios';
import { DEFAULT_SERVER_PORT, API_PREFIX, ERROR_CODE } from '@shared/constants.json';
import i18n from '@/i18n';
import { signableBody, signPayload } from './requestSigning';

const BASE_URL = import.meta.env.VITE_API_URL || `http://localhost:${DEFAULT_SERVER_PORT}${API_PREFIX}`;

/**
 * URL tuyệt đối cho file server phục vụ tĩnh (vd ảnh đại diện '/uploads/avatars/x.png'). File
 * nằm ở gốc server, không dưới API_PREFIX — nên lấy origin của BASE_URL.
 */
export function assetUrl(path) {
    if (!path) return null;
    if (/^https?:\/\//i.test(path)) return path;
    return `${new URL(BASE_URL, window.location.origin).origin}${path}`;
}
const SIGNED_METHODS = ['post', 'put', 'delete', 'patch'];

let accessToken = null;
let signingKey = null;
let onUnauthorized = null;
let onPermissionDenied = null;

export function setAccessToken(token) {
    accessToken = token;
}

export function setSigningKey(key) {
    signingKey = key;
}

export function setOnUnauthorized(handler) {
    onUnauthorized = handler;
}

// Gọi khi server trả 403 ERR_PERMISSION_DENIED: danh sách quyền client đang giữ (lấy lúc
// login/refresh) đã cũ hơn quyền thật trong DB — AuthContext dùng để đồng bộ lại.
export function setOnPermissionDenied(handler) {
    onPermissionDenied = handler;
}

const axiosClient = axios.create({
    baseURL: BASE_URL,
    withCredentials: true, // gửi kèm HttpOnly refreshToken cookie
});

const UNSIGNED_URLS = ['/auth/login', '/auth/refresh', '/auth/logout', '/auth/forgot-password', '/auth/reset-password'];

axiosClient.interceptors.request.use(async (config) => {
    if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
    }
    config.headers['X-Locale'] = i18n.resolvedLanguage || i18n.language;

    const method = (config.method || 'get').toLowerCase();
    const isUnsigned = UNSIGNED_URLS.some((u) => config.url?.includes(u));
    if (signingKey && SIGNED_METHODS.includes(method) && !isUnsigned) {
        // JSON: ký trên chuỗi JSON; FormData (upload): ký trên chuỗi chuẩn hoá có SHA-256 từng file.
        const raw = await signableBody(config.data);
        const timestamp = Date.now().toString();
        config.headers['X-Signature-Timestamp'] = timestamp;
        config.headers['X-Signature'] = await signPayload(signingKey, timestamp, raw);
    }

    return config;
});

let refreshPromise = null;

// MỌI lần gọi /auth/refresh phải đi qua đây. Server rotate refresh token nguyên tử: hai request
// refresh song song cùng một cookie thì chỉ một cái thành công, cái kia nhận 401 và client sẽ
// xoá phiên. Gộp về một promise dùng chung để không bao giờ gửi hai request như vậy — kể cả khi
// React StrictMode chạy effect khởi tạo phiên hai lần ở dev.
export function refreshSession() {
    if (!refreshPromise) {
        refreshPromise = axiosClient.post('/auth/refresh').finally(() => {
            refreshPromise = null;
        });
    }
    return refreshPromise;
}

axiosClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        const status = error.response?.status;
        const errorCode = error.response?.data?.errorCode;

        if (!originalRequest) return Promise.reject(error); // request bị huỷ / lỗi cấu hình

        if (status === 403 && errorCode === ERROR_CODE.PERMISSION_DENIED && onPermissionDenied) {
            onPermissionDenied();
        }

        const isAuthEndpoint = originalRequest.url.includes('/auth/login') || originalRequest.url.includes('/auth/refresh');

        if (status === 401 && errorCode === ERROR_CODE.TOKEN_EXPIRED && !originalRequest._retry && !isAuthEndpoint) {
            originalRequest._retry = true;

            try {
                const { data } = await refreshSession();
                setAccessToken(data.accessToken);
                setSigningKey(data.signingKey);
                originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
                return axiosClient(originalRequest);
            } catch (refreshError) {
                setAccessToken(null);
                if (onUnauthorized) onUnauthorized();
                return Promise.reject(refreshError);
            }
        }

        return Promise.reject(error);
    }
);

export default axiosClient;
