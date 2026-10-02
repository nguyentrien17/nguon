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
    return Array.from(new Uint8Array(signature))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}
