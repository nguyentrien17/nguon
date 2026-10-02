import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ShieldCheck, Lock, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import LanguageSwitcher from '@/components/ui/LanguageSwitcher';
import Spinner from '@/components/ui/Spinner';
import { passwordSchema } from '@shared/validators/userValidators';
import axiosClient from '@/core/api/axiosClient';
import { getErrorMessage } from '@/core/errors/errorMessage';

async function resetPassword(token, newPassword) {
    await axiosClient.post('/auth/reset-password', { token, newPassword });
}

export default function ResetPassword() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token') || '';

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [done, setDone] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);

        const parsed = passwordSchema.safeParse(password);
        if (!parsed.success) {
            setError(t('resetPassword.errors.tooShort'));
            return;
        }
        if (password !== confirmPassword) {
            setError(t('resetPassword.errors.mismatch'));
            return;
        }

        setSubmitting(true);
        try {
            await resetPassword(token, password);
            setDone(true);
        } catch (err) {
            setError(getErrorMessage(err, t));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="login-page">
            <div className="login-shell">
                <div className="login-topbar">
                    <div className="login-logo">
                        <ShieldCheck size={22} />
                        <span>{t('app.title')}</span>
                    </div>
                    <LanguageSwitcher />
                </div>

                <div className="login-panels">
                    <div className="login-panel-hero">
                        <h1>{t('resetPassword.heroTitle')}</h1>
                        <p>{t('resetPassword.heroSubtitle')}</p>
                    </div>

                    <div className="login-panel-form">
                        {done ? (
                            <div className="login-sent-state">
                                <div className="login-sent-icon">
                                    <CheckCircle2 size={28} />
                                </div>
                                <h2>{t('resetPassword.doneTitle')}</h2>
                                <p className="login-form-subtitle">{t('resetPassword.doneSubtitle')}</p>
                                <button type="button" className="btn-submit login-back-btn" onClick={() => navigate('/login')}>
                                    {t('forgotPassword.backToLogin')}
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} noValidate>
                                <h2>{t('resetPassword.formTitle')}</h2>
                                <p className="login-form-subtitle">{t('resetPassword.formSubtitle')}</p>

                                {!token && <div className="alert-error">{t('resetPassword.errors.missingToken')}</div>}
                                {error && <div className="alert-error">{error}</div>}

                                <label className="login-field">
                                    <span className="sr-only">{t('resetPassword.newPassword')}</span>
                                    <div className="input-with-icon">
                                        <Lock size={16} className="input-icon-static" />
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            placeholder={t('resetPassword.newPassword')}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            autoComplete="new-password"
                                            autoFocus
                                            required
                                        />
                                        <button
                                            type="button"
                                            className="input-icon-btn"
                                            onClick={() => setShowPassword((s) => !s)}
                                            tabIndex={-1}
                                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                                        >
                                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </label>

                                <label className="login-field">
                                    <span className="sr-only">{t('resetPassword.confirmPassword')}</span>
                                    <div className="input-with-icon">
                                        <Lock size={16} className="input-icon-static" />
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            placeholder={t('resetPassword.confirmPassword')}
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            autoComplete="new-password"
                                            required
                                        />
                                    </div>
                                </label>

                                <button type="submit" disabled={submitting || !token} className="btn-submit">
                                    {submitting && <Spinner size={16} />}
                                    {submitting ? t('resetPassword.loading') : t('resetPassword.submit')}
                                </button>

                                <Link to="/login" className="login-forgot-link login-back-link">
                                    {t('forgotPassword.backToLogin')}
                                </Link>
                            </form>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
