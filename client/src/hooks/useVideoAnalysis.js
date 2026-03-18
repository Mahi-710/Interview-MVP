import { useState, useEffect, useRef, useCallback } from 'react';

const ANALYZE_INTERVAL = 300; // send a frame every 300ms

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
  const videoElementRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);

  // Callback ref: auto-attaches stream when a new <video> element mounts
  const videoRef = useCallback((node) => {
    videoElementRef.current = node;
    if (node && streamRef.current) {
      node.srcObject = streamRef.current;
    }
  }, []);

  const startVideo = useCallback(async () => {
    try {
      // Tell backend analysis is active
      await fetch('/api/video/start', { method: 'POST' });

      // Request webcam from browser
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;

      // Attach stream to video element if already mounted
      if (videoElementRef.current) {
        videoElementRef.current.srcObject = stream;
      }

      setIsVideoActive(true);
    } catch (err) {
      console.error('Failed to start video:', err);
      throw err;
    }
  }, []);

  const stopVideo = useCallback(async () => {
    setIsVideoActive(false);

    // Stop the analysis interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Stop all media tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    // Clear video element
    if (videoElementRef.current) {
      videoElementRef.current.srcObject = null;
    }

    try {
      await fetch('/api/video/stop', { method: 'POST' });
    } catch (err) {
      console.error('Failed to stop video:', err);
    }
  }, []);

  // Send frames to backend for analysis while active
  useEffect(() => {
    if (!isVideoActive) return;

    // Create a canvas for frame capture (hidden, not in DOM)
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
      canvasRef.current.width = 640;
      canvasRef.current.height = 480;
    }

    const sendFrame = async () => {
      const video = videoElementRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, 640, 480);
      const base64 = canvas.toDataURL('image/jpeg', 0.7);

      try {
        const res = await fetch('/api/video/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ frame: base64 }),
        });
        const data = await res.json();
        setVideoStatus(data);
      } catch {
        // ignore, will retry next interval
      }
    };

    intervalRef.current = setInterval(sendFrame, ANALYZE_INTERVAL);
    return () => {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [isVideoActive]);

  return { videoStatus, isVideoActive, startVideo, stopVideo, videoRef };
}
