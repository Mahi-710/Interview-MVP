import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/logo.png';

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
        { theme: 'outline', size: 'large', text: 'signin_with', width: 320 }
      );
    };

    initGoogle();
  }, [user, login, navigate]);

  return (
    <div className="login-split">
      {/* Left dark panel */}
      <div className="login-left">
        <div className="login-left-content">
          <img src={logo} alt="HireCraft" className="login-logo" />

          <h1 className="login-headline">
            Practice interviews.<br />
            <span className="login-headline-accent">Land the job.</span>
          </h1>

          <p className="login-description">
            AI-powered mock interviews with real-time voice, emotion tracking, and detailed feedback
            reports — so you're never caught off guard.
          </p>

          <div className="login-features">
            <div className="login-feature">
              <div className="login-feature-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                  <line x1="12" y1="19" x2="12" y2="22"/>
                </svg>
              </div>
              <div>
                <strong>Live Voice Interviews</strong>
                <p>Speak naturally — AI listens, responds, and adapts in real time</p>
              </div>
            </div>

            <div className="login-feature">
              <div className="login-feature-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              </div>
              <div>
                <strong>Emotion & Eye Tracking</strong>
                <p>Camera analysis gives feedback on confidence and engagement</p>
              </div>
            </div>

            <div className="login-feature">
              <div className="login-feature-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                </svg>
              </div>
              <div>
                <strong>Detailed Evaluation Report</strong>
                <p>Scored feedback across communication, skills, and fit</p>
              </div>
            </div>

            <div className="login-feature">
              <div className="login-feature-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                  <line x1="8" y1="21" x2="16" y2="21"/>
                  <line x1="12" y1="17" x2="12" y2="21"/>
                </svg>
              </div>
              <div>
                <strong>Resume-Aware Questions</strong>
                <p>Upload your resume and job description for tailored interviews</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right white panel */}
      <div className="login-right">
        <div className="login-right-content">
          <h2 className="login-welcome">Welcome back</h2>
          <p className="login-welcome-sub">Sign in to start or continue your interview practice.</p>

          <div id="google-signin-btn" className="google-btn-container"></div>

          <div className="login-divider">
            <span>or</span>
          </div>

          <p className="login-new-user">
            New to HireCraft? Signing in automatically creates your free account.
          </p>

          <p className="login-terms">
            By continuing, you agree to our <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a>.
          </p>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
