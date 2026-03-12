import { useState, useRef, useCallback, useEffect } from 'react';

export function useSpeechRecognition({
  silenceTimeoutMs = 3000,
  onSilenceTimeout = null,
} = {}) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const hasSpeechContentRef = useRef(false);

  // Keep callback in a ref so the recognition event handlers always see the latest version
  const onSilenceTimeoutRef = useRef(onSilenceTimeout);
  useEffect(() => {
    onSilenceTimeoutRef.current = onSilenceTimeout;
  }, [onSilenceTimeout]);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const armSilenceTimer = useCallback(() => {
    clearSilenceTimer();
    silenceTimerRef.current = setTimeout(() => {
      if (hasSpeechContentRef.current && onSilenceTimeoutRef.current) {
        onSilenceTimeoutRef.current();
      }
    }, silenceTimeoutMs);
  }, [silenceTimeoutMs, clearSilenceTimer]);

  const startListening = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Please use Chrome.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let final = '';
      for (let i = 0; i < event.results.length; i++) {
        final += event.results[i][0].transcript;
      }
      setTranscript(final);

      // Track that user has actually spoken something
      if (final.trim().length > 0) {
        hasSpeechContentRef.current = true;
      }

      // Reset silence timer — user is still speaking
      armSilenceTimer();
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      if (event.error !== 'no-speech') {
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      // Auto-restart if still supposed to be listening (handles Chrome's auto-stop)
      if (recognitionRef.current && isListening) {
        // Pause silence detection during restart gap
        clearSilenceTimer();
        try {
          recognition.start();
          // Re-arm silence timer after restart if user had been speaking
          if (hasSpeechContentRef.current) {
            armSilenceTimer();
          }
        } catch {
          setIsListening(false);
        }
      }
    };

    recognitionRef.current = recognition;
    hasSpeechContentRef.current = false;
    clearSilenceTimer();
    setTranscript('');
    recognition.start();
    setIsListening(true);
  }, [isListening, armSilenceTimer, clearSilenceTimer]);

  const stopListening = useCallback(() => {
    clearSilenceTimer();
    hasSpeechContentRef.current = false;
    if (recognitionRef.current) {
      recognitionRef.current.onend = null; // Prevent auto-restart
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, [clearSilenceTimer]);

  return { isListening, transcript, startListening, stopListening, setTranscript };
}
