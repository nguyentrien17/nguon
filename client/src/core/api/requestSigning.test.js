import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { canonicalMultipart } from '@shared/multipartSignature';
import { signableBody, signPayload } from './requestSigning';

// Server (core/security/verifySignature.js) tính SHA-256 file bằng node:crypto rồi dựng chuỗi qua
// cùng canonicalMultipart — test này đối chiếu client (Web Crypto) với cách tính đó.
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

describe('signableBody', () => {
    it('JSON: giữ nguyên như trước (JSON.stringify), không body -> chuỗi rỗng', async () => {
        expect(await signableBody({ a: 1 })).toBe('{"a":1}');
        expect(await signableBody(undefined)).toBe('');
    });

    it('FormData: chuỗi chuẩn hoá khớp đúng cách server tính (SHA-256 + kích thước file)', async () => {
        const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
        const form = new FormData();
        form.append('note', 'xin chào');
        form.append('avatar', new File([bytes], 'a.png', { type: 'image/png' }));

        const expected = canonicalMultipart([
            { name: 'avatar', value: { sha256: sha256(bytes), size: bytes.length } },
            { name: 'note', value: 'xin chào' },
        ]);
        expect(await signableBody(form)).toBe(expected);
    });

    it('đổi 1 byte của file -> chuỗi ký khác (chữ ký sẽ sai)', async () => {
        const a = new FormData();
        a.append('avatar', new File([new Uint8Array([1, 2, 3])], 'a.png'));
        const b = new FormData();
        b.append('avatar', new File([new Uint8Array([1, 2, 4])], 'a.png'));
        expect(await signableBody(a)).not.toBe(await signableBody(b));
    });
});

describe('signPayload', () => {
    it('HMAC-SHA256 trên "${timestamp}.${body}" — khớp node:crypto (cách server kiểm)', async () => {
        const { createHmac } = await import('node:crypto');
        const expected = createHmac('sha256', 'key').update('123.body').digest('hex');
        expect(await signPayload('key', '123', 'body')).toBe(expected);
    });
});
