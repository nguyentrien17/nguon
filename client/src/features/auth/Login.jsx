import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, User, Lock } from 'lucide-react';
import { useSession } from '@/core/auth/SessionContext';
import { useToast } from '@/app/providers/ToastContext';
import Spinner from '@/components/ui/Spinner';
import { loginSchema } from '@shared/validators/authValidators';
import { getZodErrorMessage } from '@/core/errors/zodErrorMessage';
import { translateErrorCode } from '@/core/errors/errorMessage';
import AuthLayout from './AuthLayout';

export default function Login() {
    const { t, i18n } = useTranslation();
    const { login } = useSession();
    const toast = useToast();
    const navigate = useNavigate();
    const location = useLocation();

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [errorCode, setErrorCode] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorCode(null);

        const parsed = loginSchema.safeParse({ username, password });
        if (!parsed.success) {
            toast.error(getZodErrorMessage(parsed, t));
            return;
        }

        setSubmitting(true);
        try {
            const data = await login(username, password);
            toast.success(`${t('dashboard.welcome', { name: data.user.full_name })}`);
            // ProtectedRoute gửi kèm trang người dùng đang định mở trước khi bị chuyển sang /login.
            const from = location.state?.from;
            const redirectTo = from?.pathname && from.pathname !== '/login' ? `${from.pathname}${from.search || ''}` : '/dashboard';
            navigate(redirectTo, { replace: true });
        } catch (err) {
            const code = err.response?.data?.errorCode || 'ERR_UNKNOWN';
            setErrorCode(code);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <AuthLayout heroTitle={t('login.heroTitle')} heroSubtitle={t('login.heroSubtitle')}>
            <form className="login-panel-form" onSubmit={handleSubmit} noValidate>
                <h2>{t('login.formTitle')}</h2>
                <p className="login-form-subtitle">{t('login.title')}</p>

                {/* Lưu MÃ lỗi (không lưu câu) để đổi ngôn ngữ thì thông báo đổi theo. */}
            {errorCode && (
                <div className="alert-error" role="alert">
                    {translateErrorCode(errorCode, i18n.resolvedLanguage)}
                </div>
            )}

                <label className="login-field">
                    <span className="sr-only">{t('login.username')}</span>
                    <div className="input-with-icon">
                        <User size={16} className="input-icon-static" />
                        <input
                            type="text"
                            placeholder={t('login.username')}
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            autoComplete="username"
                            autoFocus
                            required
                        />
                    </div>
                </label>

                <label className="login-field">
                    <span className="sr-only">{t('login.password')}</span>
                    <div className="input-with-icon">
                        <Lock size={16} className="input-icon-static" />
                        <input
                            type={showPassword ? 'text' : 'password'}
                            placeholder={t('login.password')}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete="current-password"
                            required
                        />
                        <button
                            type="button"
                            className="input-icon-btn"
                            onClick={() => setShowPassword((s) => !s)}
                            tabIndex={-1}
                            aria-label={showPassword ? t('login.hidePassword') : t('login.showPassword')}
                        >
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>
                </label>

                <Link to="/forgot-password" className="login-forgot-link">
                    {t('login.forgotPassword')}
                </Link>

                <button type="submit" disabled={submitting} className="btn-submit">
                    {submitting && <Spinner size={16} />}
                    {submitting ? t('login.loading') : t('login.submit')}
                </button>
            </form>
        </AuthLayout>
    );
}
