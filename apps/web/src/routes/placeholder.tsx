import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles } from 'lucide-react';

export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className="empty-page panel">
      <div className="empty-icon">
        <Sparkles size={24} />
      </div>
      <span className="eyebrow">404 NOT FOUND</span>
      <h1>Page not found</h1>
      <p>The page you are looking for does not exist or has been moved.</p>
      <button type="button" className="primary-button" onClick={() => navigate('/')}>
        <ArrowLeft size={16} />
        Back to home
      </button>
    </div>
  );
}
