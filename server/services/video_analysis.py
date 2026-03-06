import cv2
import numpy as np
import math
import threading
from deepface import DeepFace
import mediapipe as mp

# ─── Shared state ───
latest_result = {
    "emotion": "neutral",
    "scores": {"happy": 0, "sad": 0, "angry": 0, "neutral": 100, "fear": 0},
    "eye_status": "on_screen",
    "eye_direction": "center",
    "gaze_x": 0.5,
    "gaze_y": 0.5,
    "face_detected": False,
}
result_lock = threading.Lock()

# Camera
cap = None
camera_active = False
processing_thread = None

EMOTIONS_KEEP = ["happy", "sad", "angry", "neutral", "fear"]

# ─── MediaPipe Face Mesh for iris tracking ───
mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(
    max_num_faces=1,
    refine_landmarks=True,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5,
)

# Landmark indices
L_EYE_LEFT = 33
L_EYE_RIGHT = 133
L_EYE_TOP = [159, 158, 160]
L_EYE_BOT = [145, 144, 153]

R_EYE_LEFT = 362
R_EYE_RIGHT = 263
R_EYE_TOP = [386, 387, 385]
R_EYE_BOT = [374, 373, 380]

L_IRIS_CENTER = 468
R_IRIS_CENTER = 473

L_IRIS = [468, 469, 470, 471, 472]
R_IRIS = [473, 474, 475, 476, 477]

NOSE_TIP = 1
FOREHEAD = 10
CHIN = 152
LEFT_CHEEK = 234
RIGHT_CHEEK = 454

# ─── Gaze smoothing ───
gaze_buffer_x = []
gaze_buffer_y = []
GAZE_BUFFER_SIZE = 5

# Emotion smoothing
smooth_scores = {e: 0.0 for e in EMOTIONS_KEEP}
ALPHA = 0.35


def get_camera():
    global cap
    if cap is None or not cap.isOpened():
        cap = cv2.VideoCapture(0)
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    return cap


def dist(p1, p2):
    return math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2)


def analyze_gaze_mediapipe(frame):
    """Use MediaPipe Face Mesh iris landmarks for accurate gaze tracking."""
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    results = face_mesh.process(rgb)

    if not results.multi_face_landmarks:
        return "unknown", "center", 0.5, 0.5

    lm = results.multi_face_landmarks[0].landmark

    if len(lm) < 478:
        return "unknown", "center", 0.5, 0.5

    # ── Left eye iris position ──
    l_iris = lm[L_IRIS_CENTER]
    l_left = lm[L_EYE_LEFT]
    l_right = lm[L_EYE_RIGHT]
    l_top = np.mean([lm[i].y for i in L_EYE_TOP])
    l_bot = np.mean([lm[i].y for i in L_EYE_BOT])

    l_eye_w = l_right.x - l_left.x
    l_ratio_x = (l_iris.x - l_left.x) / l_eye_w if abs(l_eye_w) > 0.001 else 0.5

    l_eye_h = l_bot - l_top
    l_ratio_y = (l_iris.y - l_top) / l_eye_h if abs(l_eye_h) > 0.001 else 0.5

    # ── Right eye iris position ──
    r_iris = lm[R_IRIS_CENTER]
    r_left = lm[R_EYE_LEFT]
    r_right = lm[R_EYE_RIGHT]
    r_top = np.mean([lm[i].y for i in R_EYE_TOP])
    r_bot = np.mean([lm[i].y for i in R_EYE_BOT])

    r_eye_w = r_right.x - r_left.x
    r_ratio_x = (r_iris.x - r_left.x) / r_eye_w if abs(r_eye_w) > 0.001 else 0.5

    r_eye_h = r_bot - r_top
    r_ratio_y = (r_iris.y - r_top) / r_eye_h if abs(r_eye_h) > 0.001 else 0.5

    # Average both eyes
    avg_x = (l_ratio_x + r_ratio_x) / 2
    avg_y = (l_ratio_y + r_ratio_y) / 2

    # ── Head pose compensation ──
    face_center_x = (lm[LEFT_CHEEK].x + lm[RIGHT_CHEEK].x) / 2
    face_center_y = (lm[FOREHEAD].y + lm[CHIN].y) / 2

    head_yaw = (lm[NOSE_TIP].x - face_center_x) * 2.5
    head_pitch = (lm[NOSE_TIP].y - face_center_y) * 1.8

    gaze_x = avg_x + head_yaw
    gaze_y = avg_y + head_pitch

    # ── Temporal smoothing ──
    gaze_buffer_x.append(gaze_x)
    gaze_buffer_y.append(gaze_y)
    if len(gaze_buffer_x) > GAZE_BUFFER_SIZE:
        gaze_buffer_x.pop(0)
        gaze_buffer_y.pop(0)

    smooth_x = sum(gaze_buffer_x) / len(gaze_buffer_x)
    smooth_y = sum(gaze_buffer_y) / len(gaze_buffer_y)

    # ── Direction classification ──
    H_THRESH = 0.28
    V_THRESH = 0.25

    h_dir = "center"
    v_dir = ""

    if smooth_x < 0.5 - H_THRESH:
        h_dir = "left"
    elif smooth_x > 0.5 + H_THRESH:
        h_dir = "right"

    if smooth_y < 0.5 - V_THRESH:
        v_dir = "up"
    elif smooth_y > 0.5 + V_THRESH:
        v_dir = "down"

    if v_dir and h_dir != "center":
        direction = f"{v_dir}-{h_dir}"
    elif v_dir:
        direction = v_dir
    else:
        direction = h_dir

    # ── On-screen check ──
    on_screen = abs(smooth_x - 0.5) < H_THRESH and abs(smooth_y - 0.5) < V_THRESH
    status = "on_screen" if on_screen else "off_screen"

    out_x = max(0.0, min(1.0, smooth_x))
    out_y = max(0.0, min(1.0, smooth_y))

    return status, direction, out_x, out_y


def process_frames():
    """Background thread: emotion + eye analysis."""
    global smooth_scores
    cam = get_camera()
    frame_count = 0

    while camera_active:
        ret, frame = cam.read()
        if not ret:
            continue

        frame = cv2.flip(frame, 1)
        frame_count += 1

        result = {
            "emotion": "neutral",
            "scores": {e: 0 for e in EMOTIONS_KEEP},
            "eye_status": "unknown",
            "eye_direction": "center",
            "gaze_x": 0.5,
            "gaze_y": 0.5,
            "face_detected": False,
        }

        # ── Eye tracking every frame (fast with MediaPipe) ──
        try:
            eye_status, eye_dir, gx, gy = analyze_gaze_mediapipe(frame)
            result["eye_status"] = eye_status
            result["eye_direction"] = eye_dir
            result["gaze_x"] = round(gx, 3)
            result["gaze_y"] = round(gy, 3)
            if eye_status != "unknown":
                result["face_detected"] = True
        except Exception:
            pass

        # ── Emotion analysis every 3 frames (heavier) ──
        if frame_count % 3 == 0:
            try:
                analyses = DeepFace.analyze(
                    frame,
                    actions=["emotion"],
                    enforce_detection=False,
                    silent=True,
                    detector_backend="opencv",
                )

                if analyses and len(analyses) > 0:
                    analysis = analyses[0]
                    raw_emotions = analysis.get("emotion", {})

                    filtered = {}
                    for emo in EMOTIONS_KEEP:
                        filtered[emo] = raw_emotions.get(emo, 0)

                    total = sum(filtered.values())
                    if total > 0:
                        for emo in EMOTIONS_KEEP:
                            filtered[emo] = (filtered[emo] / total) * 100

                    for emo in EMOTIONS_KEEP:
                        smooth_scores[emo] = smooth_scores[emo] * (1 - ALPHA) + filtered[emo] * ALPHA

                    dominant = max(smooth_scores, key=smooth_scores.get)
                    result["emotion"] = dominant
                    result["scores"] = {e: round(smooth_scores[e], 1) for e in EMOTIONS_KEEP}
                    result["face_detected"] = True

            except Exception:
                pass
        else:
            # Keep previous emotion scores between analysis frames
            with result_lock:
                result["emotion"] = latest_result["emotion"]
                result["scores"] = latest_result["scores"]

        with result_lock:
            latest_result.update(result)


def gen_frames():
    """MJPEG stream for video feed."""
    cam = get_camera()
    while camera_active:
        ret, frame = cam.read()
        if not ret:
            continue
        frame = cv2.flip(frame, 1)
        _, buffer = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
        yield b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + buffer.tobytes() + b"\r\n"


def start_video_processing():
    """Start the camera and background processing thread."""
    global camera_active, processing_thread, smooth_scores, gaze_buffer_x, gaze_buffer_y
    if camera_active:
        return
    # Reset state
    smooth_scores = {e: 0.0 for e in EMOTIONS_KEEP}
    gaze_buffer_x.clear()
    gaze_buffer_y.clear()
    camera_active = True
    get_camera()
    processing_thread = threading.Thread(target=process_frames, daemon=True)
    processing_thread.start()


def stop_video_processing():
    """Stop the camera and release resources."""
    global camera_active, cap, processing_thread
    camera_active = False
    if processing_thread is not None:
        processing_thread.join(timeout=2)
        processing_thread = None
    if cap is not None and cap.isOpened():
        cap.release()
        cap = None


def get_latest_status():
    """Thread-safe read of the latest analysis result."""
    with result_lock:
        return dict(latest_result)
