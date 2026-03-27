import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useInterview } from '../context/InterviewContext';
import { fetchVoices, getTextToSpeech } from '../utils/api';
import Navbar from '../components/Navbar';
import Stepper from '../components/Stepper';

function PreferencesPage() {
 const { user, loading: authLoading } = useAuth();
  const { voiceId, setVoiceId, interviewerName, setInterviewerName } = useInterview();
  const navigate = useNavigate();
useEffect(() => {
    if (!authLoading && !user) {
      navigate('/');
    }
  }, [user, authLoading, navigate]);

  if (authLoading || !user) return null;
  const [voices, setVoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const audioRef = useRef(null);

  if (!user) {
    navigate('/');
    return null;
  }

  useEffect(() => {
    fetchVoices().then((v) => {
      setVoices(v);
      if (!voiceId && v.length > 0) {
        setVoiceId(v[0].id);
        setInterviewerName(v[0].name);
      }
      setLoading(false);
    });
  }, []);

  const selectedVoice = voices.find((v) => v.id === voiceId) || voices[0];

  const handleVoiceChange = (id) => {
    setVoiceId(id);
    const voice = voices.find((v) => v.id === id);
    if (voice) setInterviewerName(voice.name);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setPreviewing(false);
    }
  };

  const previewVoice = async () => {
    if (previewing) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setPreviewing(false);
      return;
    }

    setPreviewing(true);
    setPreviewError('');
    const name = selectedVoice?.name || 'Alex';
    const blob = await getTextToSpeech(
      `Hi ${user.name}, I'm ${name}. I'll be your interviewer today. Ready when you are!`,
      voiceId
    );
    if (blob) {
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.playbackRate = 1.15;
      audioRef.current = audio;
      audio.onended = () => {
        setPreviewing(false);
        URL.revokeObjectURL(url);
        audioRef.current = null;
      };
      audio.onerror = () => {
        setPreviewing(false);
        setPreviewError('Audio playback failed. Try again.');
        URL.revokeObjectURL(url);
        audioRef.current = null;
      };
      audio.play().catch(() => {
        setPreviewing(false);
        setPreviewError('Browser blocked audio playback. Click to try again.');
      });
    } else {
      setPreviewing(false);
      setPreviewError('Voice preview failed. Check your ElevenLabs API key or try again.');
    }
  };

  const proceed = () => {
    navigate('/interview');
  };

  return (
    <div className="page-wrapper">
      <Navbar />
      <div className="page-content">
        <Stepper currentStep={2} />

        <div className="card setup-card">
          <h2>Choose Your Interviewer</h2>
          <p className="subtitle">Pick the voice and style you'd like to interview with. Preview before you commit.</p>

          {loading ? (
            <p className="hint">Loading voices...</p>
          ) : (
            <>
              <div className="voice-grid">
                {voices.map((voice) => (
                  <button
                    key={voice.id}
                    className={`voice-card ${voiceId === voice.id ? 'selected' : ''}`}
                    onClick={() => handleVoiceChange(voice.id)}
                  >
                    <div className="voice-avatar">
                      {voice.gender === 'Male' ? '👨' : '👩'}
                    </div>
                    <div className="voice-info">
                      <span className="voice-name">{voice.name}</span>
                      <span className="voice-meta">{voice.accent} · {voice.gender}</span>
                      <span className="voice-tone">{voice.tone}</span>
                    </div>
                    {voiceId === voice.id && (
                      <div className="voice-check">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>

              {selectedVoice && (
                <div className="voice-preview-section">
                  <p>
                    Your interviewer: <strong>{selectedVoice.name}</strong> · {selectedVoice.accent} · {selectedVoice.gender}
                  </p>
                  <button className="btn secondary preview-btn" onClick={previewVoice}>
                    {previewing ? 'Stop Preview' : `Preview ${selectedVoice.name}`}
                  </button>
                  {previewError && <p className="hint" style={{ color: '#e74c3c' }}>{previewError}</p>}
                </div>
              )}

              <div className="session-info">
                <span>15-minute session</span>
                <span>10-13 questions</span>
                <span>Voice conversation</span>
                <span>Full evaluation report</span>
              </div>

              <div className="preference-actions">
                <button className="btn secondary" onClick={() => navigate('/setup')}>
                  ← Back
                </button>
                <button className="btn primary" onClick={proceed}>
                  Continue to Interview →
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default PreferencesPage;
