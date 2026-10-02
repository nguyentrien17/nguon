import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axiosClient from '@/core/api/axiosClient';
import { useAuth } from '@/core/auth/AuthContext';
import { useToast } from '@/app/providers/ToastContext';
import Spinner from '@/components/ui/Spinner';
import { updateProfileSchema, changePasswordSchema } from '@shared/validators/authValidators';
import { getErrorMessage } from '@/core/errors/errorMessage';
import { getZodErrorMessage } from '@/core/errors/zodErrorMessage';

export default function Profile() {
    const { t } = useTranslation();
    const { user, refreshProfile } = useAuth();
    const toast = useToast();

    const [profileForm, setProfileForm] = useState({ email: '', full_name: '' });
    const [savingProfile, setSavingProfile] = useState(false);

    const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
    const [savingPassword, setSavingPassword] = useState(false);

    useEffect(() => {
        if (user) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setProfileForm({ email: user.email || '', full_name: user.full_name || '' });
        }
    }, [user]);

    const handleProfileSubmit = async (e) => {
        e.preventDefault();
        const parsed = updateProfileSchema.safeParse(profileForm);
        if (!parsed.success) {
            toast.error(getZodErrorMessage(parsed, t));
            return;
        }

        setSavingProfile(true);
        try {
            await axiosClient.put('/auth/me', profileForm);
            await refreshProfile();
            toast.success(t('profile.updated'));
        } catch (err) {
            toast.error(getErrorMessage(err, t));
        } finally {
            setSavingProfile(false);
        }
    };

    const handlePasswordSubmit = async (e) => {
        e.preventDefault();
        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            toast.error(t('profile.passwordMismatch'));
            return;
        }

        const payload = { currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword };
        const parsed = changePasswordSchema.safeParse(payload);
        if (!parsed.success) {
            toast.error(getZodErrorMessage(parsed, t));
            return;
        }

        setSavingPassword(true);
        try {
            await axiosClient.put('/auth/password', payload);
            toast.success(t('profile.passwordChanged'));
            setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } catch (err) {
            toast.error(getErrorMessage(err, t));
        } finally {
            setSavingPassword(false);
        }
    };

    if (!user) return null;

    return (
        <div className="page">
            <h1>{t('profile.title')}</h1>

            <div className="profile-grid">
                <form className="profile-card" onSubmit={handleProfileSubmit}>
                    <h2>{t('profile.infoTitle')}</h2>

                    <label>
                        {t('users.form.usernameLabel')}
                        <input type="text" value={user.username} disabled />
                    </label>

                    <label>
                        {t('users.form.emailLabel')}
                        <input
                            type="email"
                            value={profileForm.email}
                            onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                            required
                        />
                    </label>

                    <label>
                        {t('users.form.fullNameLabel')}
                        <input
                            type="text"
                            value={profileForm.full_name}
                            onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
                            required
                        />
                    </label>

                    <button type="submit" className="btn-primary" disabled={savingProfile}>
                        {savingProfile && <Spinner size={14} />}
                        {t('users.form.save')}
                    </button>
                </form>

                <form className="profile-card" onSubmit={handlePasswordSubmit}>
                    <h2>{t('profile.passwordTitle')}</h2>

                    <label>
                        {t('profile.currentPassword')}
                        <input
                            type="password"
                            value={passwordForm.currentPassword}
                            onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                            autoComplete="current-password"
                            required
                        />
                    </label>

                    <label>
                        {t('profile.newPassword')}
                        <input
                            type="password"
                            value={passwordForm.newPassword}
                            onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                            autoComplete="new-password"
                            required
                        />
                    </label>

                    <label>
                        {t('profile.confirmPassword')}
                        <input
                            type="password"
                            value={passwordForm.confirmPassword}
                            onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                            autoComplete="new-password"
                            required
                        />
                    </label>

                    <button type="submit" className="btn-primary" disabled={savingPassword}>
                        {savingPassword && <Spinner size={14} />}
                        {t('profile.changePassword')}
                    </button>
                </form>
            </div>
        </div>
    );
}
