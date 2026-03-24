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
  const [blurMode, setBlurMode] = useState('none'); // 'none' | 'mild' | 'full'

  const videoElementRef = useRef(null);
  const captureCanvasRef = useRef(null);  // raw frames → backend
  const displayCanvasRef = useRef(null);  // processed frames → user display
  const tempCanvasRef = useRef(null);     // compositing canvas (persists)
  const streamRef = useRef(null);
  const intervalRef = useRef(null);       // backend analysis interval
  const segmentationRef = useRef(null);   // MediaPipe SelfieSegmentation instance
  const blurModeRef = useRef('none');     // always-current ref for use in callbacks

  // Keep blurModeRef in sync with state
  useEffect(() => {
    blurModeRef.current = blurMode;
  }, [blurMode]);

  // Callback ref: attaches stream to the <video> element (always playing)
  const videoRef = useCallback((node) => {
    videoElementRef.current = node;
    if (node && streamRef.current) {
      node.srcObject = streamRef.current;
    }
  }, []);

  // Callback ref: holds the display <canvas> element
  const blurCanvasRef = useCallback((node) => {
    displayCanvasRef.current = node;
  }, []);

  const startVideo = useCallback(async () => {
    try {
      await fetch('/api/video/start', { method: 'POST' });

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;

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

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    if (videoElementRef.current) {
      videoElementRef.current.srcObject = null;
    }

    if (segmentationRef.current) {
      segmentationRef.current.close();
      segmentationRef.current = null;
    }

    try {
      await fetch('/api/video/stop', { method: 'POST' });
    } catch {
      // ignore
    }
  }, []);

  // ── Backend frame analysis (unchanged) ───────────────────────────────────
  useEffect(() => {
    if (!isVideoActive) return;

    if (!captureCanvasRef.current) {
      captureCanvasRef.current = document.createElement('canvas');
      captureCanvasRef.current.width = 640;
      captureCanvasRef.current.height = 480;
    }

    const sendFrame = async () => {
      const video = videoElementRef.current;
      const canvas = captureCanvasRef.current;
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
        // retry next tick
      }
    };

    intervalRef.current = setInterval(sendFrame, ANALYZE_INTERVAL);
    return () => {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [isVideoActive]);

  // ── Background blur (MediaPipe loaded from CDN as global) ────────────────
  //
  // Correct RAF pattern (from MediaPipe official examples):
  //   1. `await send(video)` — MediaPipe processes the frame, calls onResults
  //   2. Schedule the NEXT frame unconditionally after the await resolves
  //   3. onResults just renders — it never schedules anything
  //
  // This is robust because the loop never depends on onResults firing:
  // even if MediaPipe drops a frame, the RAF chain continues.
  useEffect(() => {
    if (!isVideoActive || blurMode === 'none') return;

    let active = true;

    // Compositing canvas — created once, reused across mode switches
    if (!tempCanvasRef.current) {
      tempCanvasRef.current = document.createElement('canvas');
      tempCanvasRef.current.width = 640;
      tempCanvasRef.current.height = 480;
    }
    const tempCanvas = tempCanvasRef.current;
    const tempCtx = tempCanvas.getContext('2d');

    // Pure renderer — no scheduling side-effects
    const onResults = (results) => {
      const canvas = displayCanvasRef.current;
      if (!active || !canvas || !results.segmentationMask) return;

      const ctx = canvas.getContext('2d');
      const blurPx = blurModeRef.current === 'full' ? 20 : 8;

      // 1) Draw entire frame blurred → this is the background
      ctx.save();
      ctx.filter = `blur(${blurPx}px)`;
      ctx.drawImage(results.image, 0, 0, 640, 480);
      ctx.restore();

      // 2) Isolate the person with the segmentation mask
      tempCtx.clearRect(0, 0, 640, 480);
      tempCtx.drawImage(results.image, 0, 0, 640, 480);
      tempCtx.globalCompositeOperation = 'destination-in';
      tempCtx.drawImage(results.segmentationMask, 0, 0, 640, 480);
      tempCtx.globalCompositeOperation = 'source-over';

      // 3) Paint the sharp person on top of the blurred background
      ctx.drawImage(tempCanvas, 0, 0);
    };

    // The RAF loop — always schedules itself after each send(), regardless of onResults
    const sendFrame = async () => {
      if (!active) return;

      const video = videoElementRef.current;
      if (video && video.readyState >= 2 && segmentationRef.current) {
        try {
          await segmentationRef.current.send({ image: video });
        } catch {
          // ignore individual frame errors
        }
      }

      // Unconditionally schedule next frame — loop never dies
      if (active) requestAnimationFrame(sendFrame);
    };

    const init = async () => {
      // Use the global loaded from CDN (avoids Vite CJS/ESM bundling issues)
      if (!segmentationRef.current) {
        if (!window.SelfieSegmentation) {
          console.warn('MediaPipe SelfieSegmentation not available yet. Retrying...');
          if (active) setTimeout(init, 500);
          return;
        }
        const seg = new window.SelfieSegmentation({
          locateFile: (file) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@0.1.1632777926/${file}`,
        });
        seg.setOptions({ modelSelection: 1 });
        segmentationRef.current = seg;
      }

      // Always re-register onResults so it captures the current `active` flag
      segmentationRef.current.onResults(onResults);

      // Kick off the loop
      if (active) requestAnimationFrame(sendFrame);
    };

    init();

    return () => {
      active = false; // stops the RAF chain on next tick
    };
  }, [isVideoActive, blurMode]);

  return {
    videoStatus,
    isVideoActive,
    startVideo,
    stopVideo,
    videoRef,
    blurMode,
    setBlurMode,
    blurCanvasRef,
  };
}
