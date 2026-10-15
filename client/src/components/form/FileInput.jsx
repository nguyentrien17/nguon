import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Upload, X } from 'lucide-react';
import { fileMatchesAccept, formatBytes } from './formUtils';
import './form.css';

/**
 * Chọn file: bấm để chọn hoặc kéo thả vào khung.
 *
 *   <FileInput id="avatar" value={file} onChange={setFile} accept="image/*" maxSize={2 * 1024 * 1024}
 *              onReject={(msg) => setError(msg)} />
 *   <FileInput id="docs" multiple value={files} onChange={setFiles} accept=".pdf,.xlsx" />
 *
 * - `value`: File | null (một file) hoặc File[] (multiple).
 * - File sai định dạng (`accept`) hoặc vượt `maxSize` (byte) bị loại; lý do được báo qua
 *   `onReject(message)` — trong <Form> thông báo này hiện thành lỗi của trường.
 * - Việc kiểm tra ở đây chỉ để báo sớm cho người dùng; server VẪN phải tự kiểm tra lại.
 *
 * Gửi lên server: dùng FormData, không gửi File trong JSON. Lưu ý chữ ký request
 * (core/api/axiosClient.js) hiện ký trên JSON.stringify(body) — multipart chưa được hỗ trợ, xem
 * docs/ui-components.md mục "Form".
 */
export default function FileInput({ id, value, onChange, onReject, accept, multiple = false, maxSize, disabled = false, invalid = false, describedBy }) {
    const { t } = useTranslation();
    const [dragOver, setDragOver] = useState(false);
    const files = value ? (Array.isArray(value) ? value : [value]) : [];

    const addFiles = (list) => {
        const incoming = multiple ? list : list.slice(0, 1);
        const accepted = [];
        const rejected = [];
        for (const file of incoming) {
            if (!fileMatchesAccept(file, accept)) rejected.push(t('form.fileTypeNotAllowed', { name: file.name }));
            else if (maxSize && file.size > maxSize) rejected.push(t('form.fileTooLarge', { name: file.name, max: formatBytes(maxSize) }));
            else accepted.push(file);
        }
        if (rejected.length > 0) onReject?.(rejected.join(' '));
        if (accepted.length === 0) return;
        onChange?.(multiple ? [...files, ...accepted] : accepted[0]);
    };

    const removeAt = (index) => {
        const next = files.filter((_, i) => i !== index);
        onChange?.(multiple ? next : null);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        if (!disabled) addFiles(Array.from(e.dataTransfer.files));
    };

    const hints = [accept && t('form.acceptedTypes', { accept }), maxSize && t('form.maxSize', { max: formatBytes(maxSize) })].filter(Boolean);

    return (
        <div className={['file-input', invalid ? 'is-invalid' : '', disabled ? 'is-disabled' : ''].filter(Boolean).join(' ')}>
            <label
                htmlFor={id}
                className={['file-dropzone', dragOver ? 'is-dragover' : ''].filter(Boolean).join(' ')}
                onDragOver={(e) => {
                    e.preventDefault();
                    if (!disabled) setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
            >
                <Upload size={20} aria-hidden="true" />
                <span className="file-dropzone-title">{t(multiple ? 'form.chooseFiles' : 'form.chooseFile')}</span>
                <span className="file-dropzone-hint">{[t('form.dropHere'), ...hints].join(' · ')}</span>
                <input
                    id={id}
                    type="file"
                    accept={accept}
                    multiple={multiple}
                    disabled={disabled}
                    aria-invalid={invalid || undefined}
                    aria-describedby={describedBy}
                    onChange={(e) => {
                        addFiles(Array.from(e.target.files || []));
                        e.target.value = ''; // chọn lại cùng một file vẫn kích hoạt onChange
                    }}
                />
            </label>

            {files.length > 0 && (
                <ul className="file-list">
                    {files.map((file, i) => (
                        <li key={`${file.name}-${file.size}-${i}`}>
                            <FileText size={16} aria-hidden="true" />
                            <span className="file-name">{file.name}</span>
                            <span className="file-size">{formatBytes(file.size)}</span>
                            <button
                                type="button"
                                onClick={() => removeAt(i)}
                                disabled={disabled}
                                aria-label={t('form.removeFile', { name: file.name })}
                            >
                                <X size={14} aria-hidden="true" />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
