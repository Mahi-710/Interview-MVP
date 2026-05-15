import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useInterview } from '../context/InterviewContext';
import { fetchInterviewSession } from '../utils/api';

function CandidatePage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const {
    setResumeText, setJobTitle, setJobDescription,
    setFocusArea, setInterviewerName, setSessionToken, setCandidateName,
    reset,
  } = useInterview();

  const [status, setStatus] = useState('loading'); // loading | ready | expired | not_found | error
  const [session, setSession] = useState(null);

  useEffect(() => {
    reset();
    fetchInterviewSession(token)
      .then((data) => {
        setSession(data);
        // Pre-populate context so Preferences and InterviewPage work without a setup form
        setResumeText(data.resume_text || '');
        setJobTitle(data.job_title || '');
        setJobDescription(data.job_description || '');
        setFocusArea(data.focus_area || 'full_screening');
        setInterviewerName(data.interviewer_name || 'Alex');
        setSessionToken(token);
        setCandidateName(data.applicant_name || 'Candidate');
        setStatus('ready');
      })
      .catch((err) => {
        if (err.message === 'SESSION_EXPIRED') setStatus('expired');
        else if (err.message === 'SESSION_NOT_FOUND') setStatus('not_found');
        else setStatus('error');
      });
  }, [token]);

  const handleBegin = () => {
    navigate('/preferences');
  };

  if (status === 'loading') {
    return (
      <div className="page-wrapper">
        <div className="page-content" style={{ display: 'flex', justifyContent: 'center', paddingTop: '80px' }}>
          <div className="card setup-card" style={{ textAlign: 'center' }}>
            <div className="status thinking" style={{ justifyContent: 'center' }}>
              <div className="pulse-dot"></div>
              Loading your interview...
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'expired') {
    return (
      <div className="page-wrapper">
        <div className="page-content" style={{ display: 'flex', justifyContent: 'center', paddingTop: '80px' }}>
          <div className="card setup-card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>⏰</div>
            <h2>Interview Link Expired</h2>
            <p className="subtitle">This interview link is no longer valid. The time window has passed.</p>
            <p className="hint">Please contact your recruiter to request a new link.</p>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'not_found') {
    return (
      <div className="page-wrapper">
        <div className="page-content" style={{ display: 'flex', justifyContent: 'center', paddingTop: '80px' }}>
          <div className="card setup-card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>🔍</div>
            <h2>Link Not Found</h2>
            <p className="subtitle">This interview link is invalid or has already been used.</p>
            <p className="hint">Please check your email for the correct link or contact your recruiter.</p>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="page-wrapper">
        <div className="page-content" style={{ display: 'flex', justifyContent: 'center', paddingTop: '80px' }}>
          <div className="card setup-card" style={{ textAlign: 'center' }}>
            <h2>Something went wrong</h2>
            <p className="subtitle">Could not load your interview session. Please try again.</p>
            <button className="btn secondary" onClick={() => window.location.reload()}>
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      <div className="page-content">
        <div className="card setup-card">
          <h2>Welcome, {session.applicant_name}</h2>
          <p className="subtitle">
            You've been invited to interview for <strong>{session.job_title}</strong>.
          </p>

          <div style={{ margin: '24px 0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              { icon: '🎙️', text: 'Voice-based interview — speak your answers naturally' },
              { icon: '🤖', text: `Your AI interviewer is ${session.interviewer_name || 'Alex'} — conversational and friendly` },
              { icon: '⏱️', text: '15-minute session with 10–13 questions' },
              { icon: '📋', text: 'Detailed evaluation report generated at the end' },
              { icon: '🔒', text: 'Your video is processed locally — never recorded or uploaded' },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px', color: 'var(--color-text-secondary)' }}>
                <span style={{ fontSize: '18px', width: '24px', textAlign: 'center' }}>{item.icon}</span>
                <span>{item.text}</span>
              </div>
            ))}
          </div>

          <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '20px', marginTop: '8px' }}>
            <p className="hint" style={{ marginBottom: '16px' }}>
              Make sure you're in a quiet environment with a working microphone and camera before starting.
            </p>
            <button className="btn primary" style={{ width: '100%' }} onClick={handleBegin}>
              Choose Interviewer Voice &amp; Begin →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CandidatePage;
