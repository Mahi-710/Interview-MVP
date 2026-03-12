import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useInterview } from '../context/InterviewContext';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { useVideoAnalysis } from '../hooks/useVideoAnalysis';
import { sendInterviewMessage, getTextToSpeech, getEvaluation } from '../utils/api';

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
    voiceId, interviewerName,
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
  const { videoStatus, isVideoActive, startVideo, stopVideo, videoRef } = useVideoAnalysis();
  const [isLoading, setIsLoading] = useState(false);
  const [cameraStatus, setCameraStatus] = useState('idle'); // idle | checking | ready | error
  const [isStarted, setIsStarted] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const chatEndRef = useRef(null);

  // Mic test state
  const [micStatus, setMicStatus] = useState('idle'); // idle | testing | success | low | error
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

    // Auto-stop after 8 seconds (longer for reading a phrase)
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

  // Keep ref in sync so the silence callback always calls the latest version
  useEffect(() => {
    submitAnswerRef.current = submitAnswer;
  });

  const questionCount = conversation.filter((m) => m.role === 'interviewer').length;
  const timerWarning = timeLeft <= 120; // last 2 minutes
  const timerCritical = timeLeft <= 30; // last 30 seconds

  return (
    <div className={`page interview-page ${isStarted && isVideoActive ? 'with-video' : ''}`}>
      <div className="interview-header">
        <h2>Interview with {interviewerName}</h2>
        <div className="header-right">
          {isStarted && (
            <>
              <span className="question-badge">{questionCount} / ~12</span>
              <span className={`timer-badge ${timerCritical ? 'critical' : timerWarning ? 'warning' : ''}`}>
                {formatTime(timeLeft)}
              </span>
              <button className="btn-quit" onClick={() => setShowQuitConfirm(true)}>
                End Interview
              </button>
            </>
          )}
        </div>
      </div>

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
          <div className="mic-test-section">
            <h3>Microphone Calibration</h3>
            <p>Read the phrase below out loud. We'll check if your mic captures it accurately.</p>

            <div className="mic-phrase">
              <span className="phrase-label">Read this aloud:</span>
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
                <div className="match-score-bar">
                  <div className="match-fill" style={{ width: `${matchScore}%` }}></div>
                </div>
                <span>{matchScore}% match — Mic calibrated!</span>
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
              <h3>Camera Setup</h3>
              <p>Enable your camera for emotion and eye tracking during the interview.</p>

              {cameraStatus === 'idle' && (
                <button className="btn secondary" onClick={handleStartCamera}>
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
                    <video ref={videoRef} autoPlay playsInline muted />
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
        </div>
      ) : (
        <div className="interview-body">
          {isVideoActive && (
            <div className="video-sidebar">
              <div className="video-feed-wrap">
                <video ref={videoRef} autoPlay playsInline muted />
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

              {isListening && (
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
  );
}

export default InterviewPage;
