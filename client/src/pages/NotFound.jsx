import { Link } from 'react-router-dom';

export default function NotFound() {
    return (
        <div className="page">
            <h1>404</h1>
            <p>Page not found.</p>
            <Link to="/dashboard">Back to dashboard</Link>
        </div>
    );
}
