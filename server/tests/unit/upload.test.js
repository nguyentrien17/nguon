const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

// UPLOAD_DIR tạm cho test — đặt TRƯỚC khi nạp core/config/env (qua fileStorage).
require('./_helpers');
const TMP_UPLOAD = fs.mkdtempSync(path.join(os.tmpdir(), 'upload-test-'));
process.env.UPLOAD_DIR = TMP_UPLOAD;

const express = require('express');
const { singleFileUpload, sniffFileType } = require('#core/http/upload');
const { saveUpload, removeUpload } = require('#core/storage/fileStorage');
const verifySignature = require('#core/security/verifySignature');
const errorHandler = require('#core/errors/errorHandler');
const { canonicalMultipart } = require('../../../shared/multipartSignature');

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), crypto.randomBytes(64)]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), crypto.randomBytes(32)]);
const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex');

describe('sniffFileType — theo nội dung, không theo tên / Content-Type', () => {
    test('nhận đúng png / jpeg / webp / pdf', () => {
        assert.equal(sniffFileType(PNG).ext, 'png');
        assert.equal(sniffFileType(JPEG).ext, 'jpeg');
        assert.equal(sniffFileType(Buffer.from('RIFF\0\0\0\0WEBPVP8 ')).ext, 'webp');
        assert.equal(sniffFileType(Buffer.from('%PDF-1.7')).ext, 'pdf');
    });
    test('file chữ đổi tên thành .png -> null', () => {
        assert.equal(sniffFileType(Buffer.from('<script>alert(1)</script>')), null);
    });
});

describe('canonicalMultipart (dùng chung client/server)', () => {
    const file = { sha256: 'ab', size: 2 };
    test('không phụ thuộc thứ tự trường', () => {
        assert.equal(
            canonicalMultipart([{ name: 'a', value: '1' }, { name: 'f', value: file }]),
            canonicalMultipart([{ name: 'f', value: file }, { name: 'a', value: '1' }])
        );
    });
    test('đổi giá trị trường / hash / kích thước file -> chuỗi khác', () => {
        const base = canonicalMultipart([{ name: 'a', value: '1' }, { name: 'f', value: file }]);
        assert.notEqual(base, canonicalMultipart([{ name: 'a', value: '2' }, { name: 'f', value: file }]));
        assert.notEqual(base, canonicalMultipart([{ name: 'a', value: '1' }, { name: 'f', value: { ...file, sha256: 'ac' } }]));
        assert.notEqual(base, canonicalMultipart([{ name: 'a', value: '1' }, { name: 'f', value: { ...file, size: 3 } }]));
    });
});

describe('fileStorage', () => {
    test('lưu file tên ngẫu nhiên dưới UPLOAD_DIR, xoá được theo đường dẫn công khai', async () => {
        const publicPath = await saveUpload(PNG, { folder: 'avatars', ext: 'png' });
        assert.match(publicPath, /^\/uploads\/avatars\/[0-9a-f-]{36}\.png$/);
        const abs = path.join(TMP_UPLOAD, 'avatars', path.basename(publicPath));
        assert.ok(fs.existsSync(abs));
        await removeUpload(publicPath);
        assert.ok(!fs.existsSync(abs));
    });

    test('removeUpload bỏ qua đường dẫn ngoài thư mục upload (path traversal, URL ngoài)', async () => {
        const secret = path.join(TMP_UPLOAD, '..', `secret-${Date.now()}.txt`);
        fs.writeFileSync(secret, 'x');
        await removeUpload(`/uploads/../${path.basename(secret)}`);
        await removeUpload('https://example.com/a.png');
        await removeUpload(null);
        assert.ok(fs.existsSync(secret), 'file ngoài UPLOAD_DIR không được bị xoá');
        fs.rmSync(secret);
    });
});

describe('upload + verifySignature qua HTTP thật (multer + fetch/FormData)', () => {
    const sigKey = crypto.randomBytes(32).toString('hex');
    let server;
    let url;

    before(async () => {
        const app = express();
        app.use((req, res, next) => {
            req.user = { id: 1, sigKey }; // thay authenticate
            next();
        });
        app.post(
            '/avatar',
            singleFileUpload({ field: 'avatar', maxSize: 1024, allowedTypes: ['png', 'jpeg'] }),
            verifySignature,
            (req, res) => res.json({ ok: true, ext: req.file.detectedType.ext, note: req.body.note ?? null })
        );
        app.use(errorHandler);
        await new Promise((resolve) => {
            server = app.listen(0, resolve);
        });
        url = `http://127.0.0.1:${server.address().port}/avatar`;
    });

    after(() => {
        server.close();
        fs.rmSync(TMP_UPLOAD, { recursive: true, force: true });
    });

    // Ký như client: canonical(trường text + sha256/size của file đã ký) -> HMAC.
    function sign({ signedFile, fields = {} }) {
        const entries = Object.entries(fields).map(([name, value]) => ({ name, value }));
        if (signedFile) entries.push({ name: 'avatar', value: { sha256: sha256(signedFile), size: signedFile.length } });
        const ts = Date.now().toString();
        const sig = crypto.createHmac('sha256', sigKey).update(`${ts}.${canonicalMultipart(entries)}`).digest('hex');
        return { 'X-Signature': sig, 'X-Signature-Timestamp': ts };
    }

    async function post({ file, signedFile = file, fields = {}, signedFields = fields, filename = 'a.png', type = 'image/png' }) {
        const form = new FormData();
        for (const [k, v] of Object.entries(fields)) form.append(k, v);
        if (file) form.append('avatar', new Blob([file], { type }), filename);
        const res = await fetch(url, { method: 'POST', body: form, headers: sign({ signedFile: file ? signedFile : null, fields: signedFields }) });
        return { status: res.status, body: await res.json() };
    }

    test('file hợp lệ + chữ ký đúng -> 200, loại file theo nội dung', async () => {
        const r = await post({ file: PNG, fields: { note: 'xin chào' } });
        assert.equal(r.status, 200, JSON.stringify(r.body));
        assert.deepEqual(r.body, { ok: true, ext: 'png', note: 'xin chào' });
    });

    test('file bị tráo trên đường truyền (ký file A, gửi file B) -> 400 ERR_INVALID_SIGNATURE', async () => {
        const r = await post({ file: JPEG, signedFile: PNG });
        assert.equal(r.status, 400);
        assert.equal(r.body.errorCode, 'ERR_INVALID_SIGNATURE');
    });

    test('trường text bị sửa -> 400 ERR_INVALID_SIGNATURE', async () => {
        const r = await post({ file: PNG, fields: { note: 'sửa' }, signedFields: { note: 'gốc' } });
        assert.equal(r.body.errorCode, 'ERR_INVALID_SIGNATURE');
    });

    test('vượt dung lượng -> 413', async () => {
        const big = Buffer.concat([PNG, crypto.randomBytes(2048)]);
        const r = await post({ file: big });
        assert.equal(r.status, 413);
        assert.equal(r.body.errorCode, 'ERR_VALIDATION');
    });

    test('file chữ đặt tên .png, Content-Type image/png -> 400 (kiểm tra magic bytes)', async () => {
        const r = await post({ file: Buffer.from('<?php system($_GET[0]); ?>'), filename: 'shell.png' });
        assert.equal(r.status, 400);
        assert.equal(r.body.errorCode, 'ERR_VALIDATION');
    });

    test('loại đúng định dạng nhưng không được phép (pdf) -> 400', async () => {
        const r = await post({ file: Buffer.from('%PDF-1.7 ...'), filename: 'a.pdf', type: 'application/pdf' });
        assert.equal(r.status, 400);
    });

    test('không có file -> 400 ERR_VALIDATION', async () => {
        const r = await post({ file: null, fields: { note: 'x' } });
        assert.equal(r.status, 400);
        assert.equal(r.body.errorCode, 'ERR_VALIDATION');
    });
});
