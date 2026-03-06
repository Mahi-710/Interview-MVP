import { useState, useEffect, useRef, useCallback } from 'react';

const POLL_INTERVAL = 200;

export function useVideoAnalysis() {
  const [videoStatus, setVideoStatus] = useState({
    emotion: 'neutral',
    scores: { happy: 0, sad: 0, angry: 0, neutral: 100, fear: 0 },
    eye_status: 'on_screen',
    eye_direction: 'center',
    gaze_x: 0.5,
    gaze_y: 0.5,
    face_detected: false,
  });
  const [isVideoActive, setIsVideoActive] = useState(false);
  const pollRef = useRef(null);

  const startVideo = useCallback(async () => {
    try {
      await fetch('/api/video/start', { method: 'POST' });
      setIsVideoActive(true);
    } catch (err) {
      console.error('Failed to start video:', err);
      throw err;
    }
  }, []);

  const stopVideo = useCallback(async () => {
    setIsVideoActive(false);
    try {
      await fetch('/api/video/stop', { method: 'POST' });
    } catch (err) {
      console.error('Failed to stop video:', err);
    }
  }, []);

  useEffect(() => {
    if (!isVideoActive) return;

    const poll = async () => {
      try {
        const res = await fetch('/api/video/status');
        const data = await res.json();
        setVideoStatus(data);
      } catch {
        // ignore, will retry next interval
      }
    };

    poll();
    pollRef.current = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(pollRef.current);
  }, [isVideoActive]);

  return { videoStatus, isVideoActive, startVideo, stopVideo };
}
