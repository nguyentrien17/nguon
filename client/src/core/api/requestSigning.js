import { canonicalMultipart } from '@shared/multipartSignature';

const toHex = (buffer) =>
    Array.from(new Uint8Array(buffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

/**
 * Chuỗi được ký cho body của request:
 *   - FormData (upload file): chuỗi chuẩn hoá dùng chung với server (shared/multipartSignature.js),
 *     mỗi file đại diện bằng SHA-256 + kích thước;
 *   - còn lại: JSON.stringify(body), '' nếu không có body.
 */
export async function signableBody(data) {
    if (typeof FormData !== 'undefined' && data instanceof FormData) {
        const entries = [];
        for (const [name, value] of data.entries()) {
            if (typeof value === 'string') {
                entries.push({ name, value });
            } else {
                const digest = await crypto.subtle.digest('SHA-256', await value.arrayBuffer());
                entries.push({ name, value: { sha256: toHex(digest), size: value.size } });
            }
        }
        return canonicalMultipart(entries);
    }
    return data !== undefined ? JSON.stringify(data) : '';
}

// Ký HMAC-SHA256 bằng Web Crypto (chuỗi ký: "${timestamp}.${rawBody}", khớp chính xác với
// server/core/security/verifySignature.js) — dùng đúng thuật toán này để test được cả bằng Node
// (globalThis.crypto.subtle có sẵn từ Node 19+) mà không cần trình duyệt thật.
export async function signPayload(signingKey, timestamp, rawBody) {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        enc.encode(signingKey),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, enc.encode(`${timestamp}.${rawBody}`));
    return toHex(signature);
}
