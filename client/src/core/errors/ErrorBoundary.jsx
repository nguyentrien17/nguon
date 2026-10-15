import { Component } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import i18n from '@/i18n';

/**
 * Bắt lỗi render trong cây con để hiện fallback thay vì làm trắng SPA.
 * Phải là class component — React chưa có hook tương đương getDerivedStateFromError.
 *
 *   <ErrorBoundary>                         gốc ứng dụng (main.jsx) — lưới an toàn cuối cùng
 *   <ErrorBoundary resetKey={pathname}>     quanh nội dung trang (Layout) — một trang lỗi không
 *                                           kéo sập menu/topbar; chuyển trang là tự hồi phục
 *
 * Dùng i18n instance trực tiếp (không qua hook) vì boundary gốc nằm ngoài mọi provider.
 */
export default class ErrorBoundary extends Component {
    state = { error: null };

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error, info) {
        console.error('Unhandled render error:', error, info);
    }

    componentDidUpdate(prevProps) {
        if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
            this.setState({ error: null });
        }
    }

    render() {
        if (!this.state.error) return this.props.children;

        return (
            <div className="empty-state" role="alert">
                <AlertTriangle size={32} aria-hidden="true" />
                <p>{i18n.t('common.unexpectedError')}</p>
                <button type="button" className="btn-secondary" onClick={() => window.location.reload()}>
                    <RotateCcw size={16} aria-hidden="true" />
                    {i18n.t('common.reload')}
                </button>
            </div>
        );
    }
}
