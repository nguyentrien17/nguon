import { Inbox } from 'lucide-react';

export default function EmptyState({ message = 'No data' }) {
    return (
        <div className="empty-state">
            <Inbox size={32} />
            <p>{message}</p>
        </div>
    );
}
