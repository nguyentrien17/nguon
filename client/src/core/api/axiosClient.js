import axios from 'axios';
import { DEFAULT_SERVER_PORT, API_PREFIX, ERROR_CODE } from '@shared/constants.json';
import i18n from '@/i18n';
import { signPayload } from './requestSigning';

const BASE_URL = import.meta.env.VITE_API_URL || `http://localhost:${DEFAULT_SERVER_PORT}${API_PREFIX}`;
const SIGNED_METHODS = ['post', 'put', 'delete', 'patch'];

let accessToken = null;
let signingKey = null;
let onUnauthorized = null;

export function setAccessToken(token) {
    accessToken = token;
}

export function setSigningKey(key) {
    signingKey = key;
}

export function setOnUnauthorized(handler) {
    onUnauthorized = handler;
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
        const raw = config.data !== undefined ? JSON.stringify(config.data) : '';
        const timestamp = Date.now().toString();
        config.headers['X-Signature-Timestamp'] = timestamp;
        config.headers['X-Signature'] = await signPayload(signingKey, timestamp, raw);
    }

    return config;
});

let refreshPromise = null;

axiosClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        const status = error.response?.status;
        const errorCode = error.response?.data?.errorCode;

        const isAuthEndpoint = originalRequest.url.includes('/auth/login') || originalRequest.url.includes('/auth/refresh');

        if (status === 401 && errorCode === ERROR_CODE.TOKEN_EXPIRED && !originalRequest._retry && !isAuthEndpoint) {
            originalRequest._retry = true;

            try {
                if (!refreshPromise) {
                    refreshPromise = axiosClient.post('/auth/refresh').finally(() => {
                        refreshPromise = null;
                    });
                }
                const { data } = await refreshPromise;
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
