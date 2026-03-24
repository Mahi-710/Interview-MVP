import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useInterview } from '../context/InterviewContext';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { useVideoAnalysis } from '../hooks/useVideoAnalysis';
import { sendInterviewMessage, getTextToSpeech, getEvaluation } from '../utils/api';
import Navbar from '../components/Navbar';
import Stepper from '../components/Stepper';

const INTERVIEW_DURATION = 15 * 60; // 15 minutes in seconds

const MIC_TEST_PHRASES = [
  "I have three years of experience in software engineering",
  "My greatest strength is problem solving under pressure",
  "I enjoy working with cross functional teams on complex projects",
  "I am passionate about building scalable and reliable systems",
  "I look forward to contributing to your engineering team",
  "I thrive in fast paced environments with challenging problems",
];

function getRandomPhrase() {
  return MIC_TEST_PHRASES[Math.floor(Math.random() * MIC_TEST_PHRASES.length)];
}

function computeMatchScore(expected, spoken) {
  const normalize = (s) =>
    s.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
  const expectedWords = normalize(expected);
  const spokenWords = normalize(spoken);
  if (expectedWords.length === 0) return 0;
  let matches = 0;
  for (const word of expectedWords) {
    if (spokenWords.includes(word)) matches++;
  }
  return Math.round((matches / expectedWords.length) * 100);
}

function InterviewPage() {
  const { user } = useAuth();
  const {
    resumeText, jobDescription, jobTitle,
    conversation, addMessage,
    setEvaluation, setIsInterviewComplete,
    voiceId, interviewerName, focusArea,
  } = useInterview();
  const navigate = useNavigate();
  const submitAnswerRef = useRef(null);

  const handleSilenceTimeout = useCallback(() => {
    if (submitAnswerRef.current) {
      submitAnswerRef.current();
    }
  }, []);

  const { isListening, transcript, startListening, stopListening, setTranscript } = useSpeechRecognition({
    silenceTimeoutMs: 3000,
    onSilenceTimeout: handleSilenceTimeout,
  });
  const { isPlaying, playAudio, speakFallback, stop: stopAudio } = useAudioPlayer();
  const { videoStatus, isVideoActive, startVideo, stopVideo, videoRef, blurMode, setBlurMode, blurCanvasRef } = useVideoAnalysis();
  const [isLoading, setIsLoading] = useState(false);
  const [cameraStatus, setCameraStatus] = useState('idle');
  const [isStarted, setIsStarted] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const chatEndRef = useRef(null);

  // Consent state
  const [hasConsented, setHasConsented] = useState(false);

  // Mic test state
  const [micStatus, setMicStatus] = useState('idle');
  const [micTestText, setMicTestText] = useState('');
  const [micPhrase, setMicPhrase] = useState(getRandomPhrase);
  const [matchScore, setMatchScore] = useState(0);
  const micTestRef = useRef(null);

  // Timer state
  const [timeLeft, setTimeLeft] = useState(INTERVIEW_DURATION);
  const timerRef = useRef(null);
  const isEndingRef = useRef(false);

  if (!user || !resumeText) {
    navigate('/');
    return null;
  }

  // ── Mic Test ──────────────────────────────────────────────
  const startMicTest = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMicStatus('error');
      setMicTestText('Speech recognition not supported. Please use Chrome.');
      return;
    }

    setMicStatus('testing');
    setMicTestText('');
    setMatchScore(0);

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    let finalText = '';

    recognition.onresult = (event) => {
      let text = '';
      for (let i = 0; i < event.results.length; i++) {
        text += event.results[i][0].transcript;
      }
      finalText = text;
      setMicTestText(text);
    };

    recognition.onend = () => {
      if (!finalText.trim()) {
        setMicStatus('error');
        setMicTestText('No speech detected. Try speaking louder or check your mic.');
        return;
      }
      const score = computeMatchScore(micPhrase, finalText);
      setMatchScore(score);
      if (score >= 80) {
        setMicStatus('success');
      } else {
        setMicStatus('low');
      }
    };

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed') {
        setMicStatus('error');
        setMicTestText('Microphone access denied. Please allow mic access in your browser settings.');
      } else if (event.error === 'no-speech') {
        setMicStatus('error');
        setMicTestText('No speech detected. Try speaking louder or check your mic.');
      } else {
        setMicStatus('error');
        setMicTestText(`Mic error: ${event.error}`);
      }
    };

    micTestRef.current = recognition;
    recognition.start();

    setTimeout(() => {
      if (micTestRef.current) {
        micTestRef.current.stop();
        micTestRef.current = null;
      }
    }, 8000);
  };

  const retryMicTest = () => {
    setMicPhrase(getRandomPhrase());
    setMicTestText('');
    setMatchScore(0);
    setMicStatus('idle');
  };

  // ── Camera Check ─────────────────────────────────────────
  const handleStartCamera = async () => {
    setCameraStatus('checking');
    try {
      await startVideo();
      setTimeout(async () => {
        try {
          const res = await fetch('/api/video/status');
          await res.json();
          setCameraStatus('ready');
        } catch {
          setCameraStatus('error');
        }
      }, 1500);
    } catch {
      setCameraStatus('error');
    }
  };

  // ── Timer ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isStarted) return;
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [isStarted]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // ── Auto-end interview when timer hits 0 ──────────────────
  const endInterview = useCallback(async () => {
    if (isEndingRef.current) return;
    isEndingRef.current = true;

    stopListening();
    stopAudio();
    stopVideo();
    clearInterval(timerRef.current);
    setIsInterviewComplete(true);
    setIsGeneratingReport(true);

    const transcriptStr = conversation
      .map((m) => `${m.role === 'interviewer' ? `Interviewer (${interviewerName})` : user.name}: ${m.text}`)
      .join('\n\n');

    try {
      const { evaluation } = await getEvaluation({
        candidateName: user.name,
        jobTitle,
        transcript: transcriptStr,
      });
      setEvaluation(evaluation);
      navigate('/report');
    } catch {
      alert('Failed to generate evaluation. Please try again.');
      setIsGeneratingReport(false);
      isEndingRef.current = false;
    }
  }, [conversation, user, jobTitle, stopListening, stopAudio, stopVideo, setIsInterviewComplete, setEvaluation, navigate]);

  const [showQuitConfirm, setShowQuitConfirm] = useState(false);

  useEffect(() => {
    if (isStarted && timeLeft === 0 && !isEndingRef.current) {
      endInterview();
    }
  }, [timeLeft, isStarted, endInterview]);

  // ── Chat scroll ───────────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);

  async function speakText(text) {
    const audioBlob = await getTextToSpeech(text, voiceId);
    if (audioBlob) {
      await playAudio(audioBlob);
    } else {
      await speakFallback(text);
    }
  }

  const startInterview = async () => {
    setIsStarted(true);
    setIsLoading(true);
    try {
      const { reply } = await sendInterviewMessage({
        candidateName: user.name,
        jobTitle,
        resumeText,
        jobDescription,
        conversationHistory: [],
        userMessage: '[Interview begins]',
        interviewerName,
        focusArea,
      });
      addMessage('interviewer', reply);
      setIsLoading(false);
      await speakText(reply);
      startListening();
    } catch (err) {
      alert('Failed to start interview. Check your connection.');
      setIsLoading(false);
      setIsStarted(false);
    }
  };

  const submitAnswer = async () => {
    if (!transcript.trim()) return;
    stopListening();
    const answer = transcript.trim();
    setTranscript('');
    addMessage('candidate', answer);

    setIsLoading(true);
    try {
      const updatedHistory = [...conversation, { role: 'candidate', text: answer }];
      const { reply, isComplete } = await sendInterviewMessage({
        candidateName: user.name,
        jobTitle,
        resumeText,
        jobDescription,
        conversationHistory: updatedHistory,
        userMessage: answer,
        interviewerName,
        focusArea,
      });
      addMessage('interviewer', reply);
      setIsLoading(false);
      await speakText(reply);

      if (isComplete) {
        clearInterval(timerRef.current);
        setIsInterviewComplete(true);
        setIsGeneratingReport(true);

        const fullConversation = [...updatedHistory, { role: 'interviewer', text: reply }];
        const transcriptStr = fullConversation
          .map((m) => `${m.role === 'interviewer' ? `Interviewer (${interviewerName})` : user.name}: ${m.text}`)
          .join('\n\n');

        const { evaluation } = await getEvaluation({
          candidateName: user.name,
          jobTitle,
          transcript: transcriptStr,
        });
        setEvaluation(evaluation);
        navigate('/report');
      } else {
        startListening();
      }
    } catch (err) {
      alert('Error during interview. Please try again.');
      setIsLoading(false);
      startListening();
    }
  };

  useEffect(() => {
    submitAnswerRef.current = submitAnswer;
  });

  const questionCount = conversation.filter((m) => m.role === 'interviewer').length;
  const timerWarning = timeLeft <= 120;
  const timerCritical = timeLeft <= 30;

  return (
    <div className="page-wrapper">
      <Navbar />
      {!isStarted && (
        <div className="page-content">
          <Stepper currentStep={3} />
        </div>
      )}

      <div className={`interview-page ${isStarted && isVideoActive ? 'with-video' : ''}`}>
        {isStarted && (
          <div className="interview-header">
            <h2>Interview with {interviewerName}</h2>
            <div className="header-right">
              <span className="question-badge">{questionCount} / ~12</span>
              <span className={`timer-badge ${timerCritical ? 'critical' : timerWarning ? 'warning' : ''}`}>
                {formatTime(timeLeft)}
              </span>
              <button className="btn-quit" onClick={() => setShowQuitConfirm(true)}>
                End Interview
              </button>
            </div>
          </div>
        )}

        {showQuitConfirm && (
          <div className="quit-overlay">
            <div className="quit-modal">
              <h3>End Interview Early?</h3>
              <p>Your evaluation will be based on the questions answered so far ({questionCount} question{questionCount !== 1 ? 's' : ''}).</p>
              <div className="quit-actions">
                <button className="btn primary" onClick={() => { setShowQuitConfirm(false); endInterview(); }}>
                  Yes, end and get report
                </button>
                <button className="btn secondary" onClick={() => setShowQuitConfirm(false)}>
                  Continue Interview
                </button>
              </div>
            </div>
          </div>
        )}

        {!isStarted ? (
          <div className="pre-interview">

            {/* ── Privacy Consent ─────────────────────────────────── */}
            {!hasConsented ? (
              <div className="consent-card">
                <div className="consent-icon">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                </div>
                <h2 className="consent-title">Your Privacy, Guaranteed</h2>
                <p className="consent-subtitle">
                  Before we begin, here's exactly what we do — and don't do — with your data.
                </p>

                <ul className="consent-list">
                  <li className="consent-list-item">
                    <span className="consent-check">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    </span>
                    <span><strong>Resume &amp; Job Description</strong> — used only to personalise your interview session. Never stored on our servers.</span>
                  </li>
                  <li className="consent-list-item">
                    <span className="consent-check">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    </span>
                    <span><strong>Video feed</strong> — processed entirely in your browser for emotion and eye-tracking feedback. We never record, upload, or store your video.</span>
                  </li>
                  <li className="consent-list-item">
                    <span className="consent-check">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    </span>
                    <span><strong>Microphone</strong> — your voice is transcribed live and never recorded or sent as audio to any server.</span>
                  </li>
                  <li className="consent-list-item">
                    <span className="consent-check">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    </span>
                    <span><strong>Session data</strong> — everything is cleared the moment you close or refresh the page. Nothing persists.</span>
                  </li>
                </ul>

                <button className="btn primary consent-btn" onClick={() => setHasConsented(true)}>
                  I Understand &amp; Agree — Let's Begin
                </button>
              </div>
            ) : (
            <>
            <div className="mic-test-section">
              <div className="section-header">
                <div className="section-icon mic-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                    <line x1="12" y1="19" x2="12" y2="22"/>
                  </svg>
                </div>
                <h3>Microphone Calibration</h3>
                {micStatus === 'success' && (
                  <div className="section-check">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </div>
                )}
              </div>
              <p>Read the phrase below out loud. We'll check if your mic captures it accurately.</p>

              <div className="mic-phrase">
                <span className="phrase-label">READ THIS ALOUD</span>
                <blockquote>"{micPhrase}"</blockquote>
              </div>

              {micStatus === 'idle' && (
                <button className="btn secondary" onClick={startMicTest}>
                  Start Recording
                </button>
              )}

              {micStatus === 'testing' && (
                <div className="mic-test-active">
                  <div className="status listening">
                    <div className="pulse-dot"></div>
                    Listening... read the phrase above
                  </div>
                  {micTestText && <div className="mic-test-preview">{micTestText}</div>}
                </div>
              )}

              {micStatus === 'success' && (
                <div className="mic-test-result success">
                  <div className="mic-calibrated-badge">Microphone calibrated!</div>
                  <div className="match-score-bar">
                    <div className="match-fill" style={{ width: `${matchScore}%` }}></div>
                  </div>
                  <span>{matchScore}% match — excellent clarity</span>
                  {micTestText && <div className="mic-test-preview">Heard: "{micTestText}"</div>}
                  <button className="btn-link" onClick={retryMicTest}>Try a different phrase</button>
                </div>
              )}

              {micStatus === 'low' && (
                <div className="mic-test-result low-match">
                  <div className="match-score-bar">
                    <div className="match-fill low" style={{ width: `${matchScore}%` }}></div>
                  </div>
                  <span>{matchScore}% match — needs 80% to proceed</span>
                  {micTestText && <div className="mic-test-preview">Heard: "{micTestText}"</div>}
                  <p className="hint">Speak clearly and closer to the mic. Make sure there's no background noise.</p>
                  <div className="mic-retry-buttons">
                    <button className="btn secondary" onClick={startMicTest}>Try Again</button>
                    <button className="btn-link" onClick={retryMicTest}>New phrase</button>
                  </div>
                </div>
              )}

              {micStatus === 'error' && (
                <div className="mic-test-result error">
                  <span>{micTestText}</span>
                  <button className="btn-link" onClick={retryMicTest}>Try again</button>
                </div>
              )}
            </div>

            {micStatus === 'success' && (
              <div className="camera-check-section">
                <div className="section-header">
                  <div className="section-icon camera-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                      <circle cx="12" cy="13" r="4"/>
                    </svg>
                  </div>
                  <h3>Camera Setup</h3>
                  {cameraStatus === 'ready' && (
                    <div className="section-check">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    </div>
                  )}
                </div>
                <p>Enable your camera for emotion and eye tracking during the interview.</p>

                {cameraStatus === 'idle' && (
                  <button className="btn secondary camera-btn" onClick={handleStartCamera}>
                    Enable Camera
                  </button>
                )}

                {cameraStatus === 'checking' && (
                  <div className="status thinking">
                    <div className="pulse-dot"></div>
                    Starting camera...
                  </div>
                )}

                {cameraStatus === 'ready' && (
                  <div className="camera-preview">
                    <div className="camera-preview-wrap">
                      {/* Video always plays — never hidden, so the browser keeps decoding frames */}
                      <video ref={videoRef} autoPlay playsInline muted />
                      {/* Canvas overlays the video when blur is active */}
                      {blurMode !== 'none' && (
                        <canvas
                          ref={blurCanvasRef}
                          width={640}
                          height={480}
                          className="blur-display-canvas"
                        />
                      )}
                    </div>

                    <div className="blur-selector">
                      <p className="blur-selector-label">Background effect</p>
                      <div className="blur-options">
                        <button
                          className={`blur-option-btn ${blurMode === 'none' ? 'active' : ''}`}
                          onClick={() => setBlurMode('none')}
                        >
                          {/* Normal: clear striped background */}
                          <svg width="48" height="32" viewBox="0 0 48 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <rect width="48" height="32" rx="3" fill="#edf0f7"/>
                            <line x1="0" y1="8"  x2="48" y2="8"  stroke="#cdd2e2" strokeWidth="1.2"/>
                            <line x1="0" y1="16" x2="48" y2="16" stroke="#cdd2e2" strokeWidth="1.2"/>
                            <line x1="0" y1="24" x2="48" y2="24" stroke="#cdd2e2" strokeWidth="1.2"/>
                            <circle cx="24" cy="14" r="6" fill="#8b92b5"/>
                            <path d="M10 32 Q10 22 24 22 Q38 22 38 32Z" fill="#8b92b5"/>
                          </svg>
                          Normal
                        </button>
                        <button
                          className={`blur-option-btn ${blurMode === 'mild' ? 'active' : ''}`}
                          onClick={() => setBlurMode('mild')}
                        >
                          {/* Mild blur: soft blobs behind person */}
                          <svg width="48" height="32" viewBox="0 0 48 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <defs>
                              <filter id="blur-icon-mild">
                                <feGaussianBlur stdDeviation="2.5"/>
                              </filter>
                            </defs>
                            <rect width="48" height="32" rx="3" fill="#edf0f7"/>
                            <circle cx="8"  cy="8"  r="10" fill="#b8bfd4" filter="url(#blur-icon-mild)"/>
                            <circle cx="42" cy="26" r="12" fill="#c5cade" filter="url(#blur-icon-mild)"/>
                            <circle cx="24" cy="32" r="10" fill="#d0d4e4" filter="url(#blur-icon-mild)"/>
                            <circle cx="24" cy="14" r="6" fill="#8b92b5"/>
                            <path d="M10 32 Q10 22 24 22 Q38 22 38 32Z" fill="#8b92b5"/>
                          </svg>
                          Mild Blur
                        </button>
                        <button
                          className={`blur-option-btn ${blurMode === 'full' ? 'active' : ''}`}
                          onClick={() => setBlurMode('full')}
                        >
                          {/* Full blur: heavy blobs, foggy background */}
                          <svg width="48" height="32" viewBox="0 0 48 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <defs>
                              <filter id="blur-icon-full">
                                <feGaussianBlur stdDeviation="5"/>
                              </filter>
                            </defs>
                            <rect width="48" height="32" rx="3" fill="#cdd2e2"/>
                            <circle cx="6"  cy="8"  r="16" fill="#9ba5c0" filter="url(#blur-icon-full)"/>
                            <circle cx="42" cy="26" r="18" fill="#a8b2c8" filter="url(#blur-icon-full)"/>
                            <circle cx="24" cy="14" r="6" fill="#5b6480"/>
                            <path d="M10 32 Q10 22 24 22 Q38 22 38 32Z" fill="#5b6480"/>
                          </svg>
                          Full Blur
                        </button>
                      </div>
                    </div>

                    <div className="camera-status-badges">
                      <span className={`gaze-badge ${videoStatus.face_detected ? 'detected' : 'not-detected'}`}>
                        {videoStatus.face_detected ? 'Face detected' : 'No face detected'}
                      </span>
                      <span className={`gaze-badge ${videoStatus.eye_status === 'on_screen' ? 'on' : 'off'}`}>
                        {videoStatus.eye_status === 'on_screen' ? 'Looking at screen' : 'Looking away'}
                      </span>
                    </div>
                    <span className="camera-ready-text">Camera ready!</span>
                  </div>
                )}

                {cameraStatus === 'error' && (
                  <div className="mic-test-result error">
                    <span>Could not access camera. Check if another app is using it.</span>
                    <button className="btn-link" onClick={() => setCameraStatus('idle')}>Try again</button>
                  </div>
                )}
              </div>
            )}

            <div className="interview-start">
              <p>Ready to begin your practice interview for <strong>{jobTitle}</strong>?</p>
              <p className="hint">The interview is 15 minutes. {interviewerName} will speak first.</p>
              <button
                className="btn primary"
                onClick={startInterview}
                disabled={micStatus !== 'success' || cameraStatus !== 'ready'}
              >
                Begin Interview
              </button>
              {(micStatus !== 'success' || cameraStatus !== 'ready') && (
                <p className="hint">
                  {micStatus !== 'success'
                    ? 'Complete the mic test above to enable this button'
                    : 'Enable your camera above to proceed'}
                </p>
              )}
            </div>

            </> )} {/* end hasConsented */}
          </div>
        ) : (
          <div className="interview-body">
            {isVideoActive && (
              <div className="video-sidebar">
                <div className="video-feed-wrap">
                  {/* Video always plays — never hidden */}
                  <video ref={videoRef} autoPlay playsInline muted />
                  {/* Canvas overlays the video when blur is active */}
                  {blurMode !== 'none' && (
                    <canvas
                      ref={blurCanvasRef}
                      width={640}
                      height={480}
                      className="blur-display-canvas"
                    />
                  )}
                </div>

                <div className="analysis-panel">
                  <h4>Emotion</h4>
                  <div className="dominant-emotion-badge">
                    {videoStatus.face_detected
                      ? videoStatus.emotion.charAt(0).toUpperCase() + videoStatus.emotion.slice(1)
                      : 'No face'}
                  </div>
                  <div className="emotion-bars">
                    {['happy', 'sad', 'angry', 'neutral', 'fear'].map((emo) => (
                      <div key={emo} className="emotion-row">
                        <span className="emotion-label">{emo}</span>
                        <div className="emotion-bar-bg">
                          <div
                            className={`emotion-bar-fill ${emo}`}
                            style={{ width: `${Math.round(videoStatus.scores[emo] || 0)}%` }}
                          />
                        </div>
                        <span className="emotion-pct">{Math.round(videoStatus.scores[emo] || 0)}%</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="analysis-panel">
                  <h4>Eye Tracking</h4>
                  <div className="eye-indicator">
                    <div className="eye-dot-container">
                      <div className="eye-iris"
                        style={{
                          left: `calc(50% + ${((videoStatus.gaze_x || 0.5) - 0.5) * 20}px)`,
                          top: `calc(50% + ${((videoStatus.gaze_y || 0.5) - 0.5) * 20}px)`,
                        }}
                      >
                        <div className="eye-pupil" />
                      </div>
                    </div>
                    <div className="eye-dot-container">
                      <div className="eye-iris"
                        style={{
                          left: `calc(50% + ${((videoStatus.gaze_x || 0.5) - 0.5) * 20}px)`,
                          top: `calc(50% + ${((videoStatus.gaze_y || 0.5) - 0.5) * 20}px)`,
                        }}
                      >
                        <div className="eye-pupil" />
                      </div>
                    </div>
                  </div>
                  <div className="gaze-direction-label">{videoStatus.eye_direction}</div>
                  <div className={`gaze-status-badge ${videoStatus.eye_status === 'on_screen' ? 'on' : 'off'}`}>
                    {videoStatus.eye_status === 'on_screen' ? 'Looking at screen' : 'Looking away'}
                  </div>
                </div>
              </div>
            )}

            <div className="interview-main">
              <div className="chat-container">
                {conversation.map((msg, i) => (
                  <div key={i} className={`chat-bubble ${msg.role}`}>
                    <div className="bubble-header">
                      {msg.role === 'interviewer' ? interviewerName : 'You'}
                    </div>
                    <p>{msg.text}</p>
                  </div>
                ))}
                {isLoading && (
                  <div className="chat-bubble interviewer">
                    <div className="bubble-header">{interviewerName}</div>
                    <div className="typing-indicator">
                      <span></span><span></span><span></span>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <div className="controls">
                <div className="status-bar">
                  {isGeneratingReport ? (
                    <div className="status thinking">
                      <div className="pulse-dot"></div>
                      Generating your evaluation report...
                    </div>
                  ) : isPlaying ? (
                    <div className="status speaking">
                      <div className="pulse-dot"></div>
                      {interviewerName} is speaking...
                    </div>
                  ) : isLoading ? (
                    <div className="status thinking">
                      <div className="pulse-dot"></div>
                      Thinking...
                    </div>
                  ) : isListening ? (
                    <div className="status listening">
                      <div className="pulse-dot"></div>
                      Listening... (auto-sends when you pause)
                    </div>
                  ) : null}
                </div>

                {isListening && !isGeneratingReport && (
                  <div className="transcript-preview">
                    <p>{transcript || 'Listening...'}</p>
                  </div>
                )}

                <div className="control-buttons">
                  {isPlaying && (
                    <button className="btn secondary" onClick={stopAudio}>
                      Skip Audio
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default InterviewPage;
