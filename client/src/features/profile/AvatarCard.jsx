import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, Upload } from 'lucide-react';
import { Avatar, Button } from '@/components/ui';
import { FileInput, FormField } from '@/components/form';
import { useToast } from '@/app/providers/ToastContext';
import { getErrorMessage } from '@/core/errors/errorMessage';
import { removeMyAvatar, uploadMyAvatar } from './profileApi';

const MAX_SIZE = 2 * 1024 * 1024; // khớp giới hạn server (authRoutes: 2 MB)
const ACCEPT = 'image/png,image/jpeg,image/webp';

/** Ảnh đại diện: xem, chọn ảnh mới (bấm hoặc kéo thả), tải lên, xoá. */
export default function AvatarCard({ user, onChanged }) {
    const { t } = useTranslation();
    const toast = useToast();
    const [file, setFile] = useState(null);
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);

    const run = async (request, successKey) => {
        setBusy(true);
        try {
            await request();
            toast.success(t(successKey));
            setFile(null);
            await onChanged?.();
        } catch (err) {
            toast.error(getErrorMessage(err, t));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="profile-card">
            <h2>{t('profile.avatarTitle')}</h2>
            <div className="avatar-card-preview">
                <Avatar src={user.avatar} name={user.full_name} size={72} />
            </div>

            <FormField id="avatar-file" label={t('profile.chooseAvatar')} error={error} hint={t('profile.avatarHint')}>
                <FileInput
                    id="avatar-file"
                    value={file}
                    onChange={(f) => {
                        setFile(f);
                        setError(null);
                    }}
                    onReject={setError}
                    accept={ACCEPT}
                    maxSize={MAX_SIZE}
                    disabled={busy}
                    invalid={!!error}
                />
            </FormField>

            <div className="form-actions">
                <Button variant="primary" icon={Upload} loading={busy} disabled={!file} onClick={() => run(() => uploadMyAvatar(file), 'profile.avatarUpdated')}>
                    {t('profile.uploadAvatar')}
                </Button>
                {user.avatar && (
                    <Button variant="ghost" icon={Trash2} disabled={busy} onClick={() => run(removeMyAvatar, 'profile.avatarRemoved')}>
                        {t('profile.removeAvatar')}
                    </Button>
                )}
            </div>
        </div>
    );
}
