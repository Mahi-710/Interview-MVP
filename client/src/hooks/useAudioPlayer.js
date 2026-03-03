import { useState, useRef, useCallback } from 'react';

export function useAudioPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);

  const playAudio = useCallback((audioBlob) => {
    return new Promise((resolve) => {
      if (audioRef.current) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
      }

      const url = URL.createObjectURL(audioBlob);
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onplay = () => setIsPlaying(true);
      audio.onended = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(url);
        resolve();
      };
      audio.onerror = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(url);
        resolve();
      };

      audio.playbackRate = 1.15;
      audio.play().catch(() => {
        setIsPlaying(false);
        resolve();
      });
    });
  }, []);

  // Fallback: browser TTS if ElevenLabs fails
  const speakFallback = useCallback((text) => {
    return new Promise((resolve) => {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.3;
      utterance.pitch = 1.0;
      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find(
        (v) => v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Microsoft')
      );
      if (preferred) utterance.voice = preferred;
      utterance.onstart = () => setIsPlaying(true);
      utterance.onend = () => { setIsPlaying(false); resolve(); };
      utterance.onerror = () => { setIsPlaying(false); resolve(); };
      window.speechSynthesis.speak(utterance);
    });
  }, []);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    window.speechSynthesis.cancel();
    setIsPlaying(false);
  }, []);

  return { isPlaying, playAudio, speakFallback, stop };
}
