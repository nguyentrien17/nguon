import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Mail, ArrowLeft, MailCheck } from 'lucide-react';
import Spinner from '@/components/ui/Spinner';
import { useToast } from '@/app/providers/ToastContext';
import { getErrorMessage } from '@/core/errors/errorMessage';
import AuthLayout from './AuthLayout';
import { requestPasswordReset } from './authApi';

export default function ForgotPassword() {
    const { t } = useTranslation();
    const toast = useToast();

    const [email, setEmail] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [sent, setSent] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await requestPasswordReset(email);
            setSent(true);
        } catch (err) {
            toast.error(getErrorMessage(err, t));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <AuthLayout heroTitle={t('forgotPassword.heroTitle')} heroSubtitle={t('forgotPassword.heroSubtitle')}>
            <div className="login-panel-form">
                {sent ? (
                    <div className="login-sent-state">
                        <div className="login-sent-icon">
                            <MailCheck size={28} aria-hidden="true" />
                        </div>
                        <h2>{t('forgotPassword.sentTitle')}</h2>
                        <p className="login-form-subtitle">{t('forgotPassword.sentSubtitle', { email })}</p>
                        <Link to="/login" className="btn-submit login-back-btn">
                            <ArrowLeft size={16} aria-hidden="true" />
                            {t('forgotPassword.backToLogin')}
                        </Link>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} noValidate>
                        <h2>{t('forgotPassword.formTitle')}</h2>
                        <p className="login-form-subtitle">{t('forgotPassword.formSubtitle')}</p>

                        <label className="login-field">
                            <span className="sr-only">{t('login.email')}</span>
                            <div className="input-with-icon">
                                <Mail size={16} className="input-icon-static" aria-hidden="true" />
                                <input
                                    type="email"
                                    placeholder={t('login.email')}
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    autoComplete="email"
                                    autoFocus
                                    required
                                />
                            </div>
                        </label>

                        <button type="submit" disabled={submitting} className="btn-submit">
                            {submitting && <Spinner size={16} />}
                            {submitting ? t('forgotPassword.loading') : t('forgotPassword.submit')}
                        </button>

                        <Link to="/login" className="login-forgot-link login-back-link">
                            <ArrowLeft size={14} aria-hidden="true" />
                            {t('forgotPassword.backToLogin')}
                        </Link>
                    </form>
                )}
            </div>
        </AuthLayout>
    );
}
