import { useTranslation } from 'react-i18next';
import { useAuth } from '@/core/auth/AuthContext';
import { useToast } from '@/app/providers/ToastContext';
import { Form } from '@/components/form';
import { updateProfileSchema, changePasswordSchema } from '@shared/validators/authValidators';
import { changeMyPassword, updateMyProfile } from './profileApi';

export default function Profile() {
    const { t } = useTranslation();
    const { user, refreshProfile } = useAuth();
    const toast = useToast();

    if (!user) return null;

    const profileFields = [
        { name: 'username', label: t('users.form.usernameLabel'), disabled: true },
        { name: 'email', label: t('users.form.emailLabel'), required: true },
        { name: 'full_name', label: t('users.form.fullNameLabel'), required: true },
    ];

    const passwordFields = [
        { name: 'currentPassword', label: t('profile.currentPassword'), autoComplete: 'current-password' },
        { name: 'newPassword', label: t('profile.newPassword'), autoComplete: 'new-password' },
        { name: 'confirmPassword', label: t('profile.confirmPassword'), autoComplete: 'new-password', required: true },
    ];

    const saveProfile = async ({ email, full_name }) => {
        await updateMyProfile({ email, full_name });
        await refreshProfile();
        toast.success(t('profile.updated'));
    };

    const changePassword = async ({ currentPassword, newPassword }) => {
        await changeMyPassword(currentPassword, newPassword);
        toast.success(t('profile.passwordChanged'));
    };

    return (
        <div className="page">
            <h1>{t('profile.title')}</h1>

            <div className="profile-grid">
                <Form
                    // key: nạp lại giá trị khi refreshProfile() trả về dữ liệu mới của user.
                    key={`${user.id}-${user.email}-${user.full_name}`}
                    className="profile-card"
                    title={t('profile.infoTitle')}
                    fields={profileFields}
                    schema={updateProfileSchema}
                    initialValues={{ username: user.username, email: user.email || '', full_name: user.full_name || '' }}
                    onSubmit={saveProfile}
                    submitLabel={t('users.form.save')}
                />

                <Form
                    className="profile-card"
                    title={t('profile.passwordTitle')}
                    fields={passwordFields}
                    schema={changePasswordSchema}
                    validate={(data) => (data.newPassword !== data.confirmPassword ? { confirmPassword: t('profile.passwordMismatch') } : null)}
                    onSubmit={changePassword}
                    submitLabel={t('profile.changePassword')}
                    resetOnSuccess
                />
            </div>
        </div>
    );
}
