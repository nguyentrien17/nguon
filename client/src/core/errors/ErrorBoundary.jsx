import { Component } from 'react';
import { AlertTriangle } from 'lucide-react';

// Bắt lỗi render bất kỳ trong cây con để hiện fallback UI thay vì làm trắng toàn bộ SPA.
// Phải là class component — React chưa có hook tương đương componentDidCatch/getDerivedStateFromError.
export default class ErrorBoundary extends Component {
    state = { hasError: false };

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error, info) {
        console.error('Unhandled render error:', error, info);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="empty-state">
                    <AlertTriangle size={32} />
                    <p>Đã có lỗi xảy ra. Vui lòng tải lại trang.</p>
                </div>
            );
        }
        return this.props.children;
    }
}
