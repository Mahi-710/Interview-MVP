import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/setup');
      return;
    }

    const initGoogle = () => {
      if (!window.google?.accounts) {
        setTimeout(initGoogle, 100);
        return;
      }
      window.google.accounts.id.initialize({
        client_id: '1095010966756-s82o8dq4m3e8ql6jm8ga0dmi9rvdj45d.apps.googleusercontent.com',
        callback: (response) => {
          login(response);
          navigate('/setup');
        },
      });
      window.google.accounts.id.renderButton(
        document.getElementById('google-signin-btn'),
        { theme: 'outline', size: 'large', text: 'signin_with', width: 300 }
      );
    };

    initGoogle();
  }, [user, login, navigate]);

  return (
    <div className="page login-page">
      <div className="card login-card">
        <div className="login-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a3 3 0 0 0-3 3v1a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 14c0-3.87-3.13-7-7-7s-7 3.13-7 7" />
            <circle cx="12" cy="19" r="3" />
          </svg>
        </div>
        <h1>AI Interview Practice</h1>
        <p className="subtitle">
          Practice your interview skills with a realistic AI interviewer.
          Get audio-based conversation and a detailed evaluation report.
        </p>
        <div id="google-signin-btn" className="google-btn-container"></div>
        <p className="hint">Sign in with Google to get started</p>
      </div>
    </div>
  );
}

export default LoginPage;
