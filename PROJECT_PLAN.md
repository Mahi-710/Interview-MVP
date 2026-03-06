# AI Interview Practice — Project Plan

## 1. Project Overview

A web application where candidates practice job interviews with an AI interviewer (Alex) via real-time audio conversation. Candidates upload their resume and job description, go through a 15-minute mock interview, and receive a downloadable PDF evaluation report.

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      CLIENT (React)                     │
│                   localhost:5173                         │
│                                                         │
│  LoginPage → SetupPage → InterviewPage → ReportPage     │
│                                                         │
│  Audio IN:  Web Speech API (browser mic → text)         │
│  Audio OUT: ElevenLabs (text → realistic AI voice)      │
│  PDF:       jsPDF (client-side generation)              │
│  Auth:      Google Identity Services                    │
└────────────────────┬────────────────────────────────────┘
                     │ /api/*
                     ▼
┌─────────────────────────────────────────────────────────┐
│                   SERVER (FastAPI/Python)                │
│                   localhost:3001                         │
│                                                         │
│  POST /api/interview/chat     → Gemini (conversation)   │
│  POST /api/interview/tts      → ElevenLabs (voice)      │
│  POST /api/interview/evaluate → Gemini (evaluation)     │
│  POST /api/resume/parse       → PyPDF2 + Tesseract      │
│  GET  /api/health             → status check            │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
   Google Gemini  ElevenLabs   Tesseract
   (AI brain)    (AI voice)   (OCR engine)
```

---

## 3. Current File Structure

```
Interview/
│
├── server/                              # FastAPI (Python) backend
│   ├── app.py                           # Entry point, CORS, route mounting
│   ├── requirements.txt                 # Python dependencies
│   ├── .env                             # API keys (gitignored)
│   │
│   ├── services/
│   │   ├── __init__.py
│   │   ├── gemini.py                    # Gemini API wrapper
│   │   │   ├── build_system_prompt()    #   Constructs interviewer persona + context
│   │   │   ├── chat()                   #   Multi-turn conversation
│   │   │   └── generate_evaluation()    #   Post-interview scoring
│   │   │
│   │   └── elevenlabs_tts.py            # ElevenLabs TTS wrapper
│   │       └── text_to_speech()         #   Text → MP3 audio bytes
│   │
│   └── routes/
│       ├── __init__.py
│       ├── interview.py                 # Interview API endpoints
│       │   ├── POST /chat               #   Send message, get AI reply
│       │   ├── POST /tts                #   Convert text to speech audio
│       │   └── POST /evaluate           #   Generate evaluation from transcript
│       │
│       └── resume.py                    # Resume parsing endpoint
│           └── POST /parse              #   PDF → text (fast) or PDF → OCR → text
│
├── client/                              # React (Vite) frontend
│   ├── package.json
│   ├── vite.config.js                   # Dev proxy: /api → localhost:3001
│   ├── index.html                       # Google Identity Services script tag
│   │
│   └── src/
│       ├── main.jsx                     # React entry, BrowserRouter
│       ├── App.jsx                      # Route definitions
│       ├── App.css                      # All styles (single file, light theme)
│       │
│       ├── context/
│       │   ├── AuthContext.jsx           # Google user state (name, email, picture)
│       │   └── InterviewContext.jsx      # Interview state (resume, JD, conversation, eval)
│       │
│       ├── hooks/
│       │   ├── useSpeechRecognition.js   # Browser mic → live text transcript
│       │   └── useAudioPlayer.js         # Plays ElevenLabs audio, fallback to browser TTS
│       │
│       ├── utils/
│       │   ├── api.js                    # Fetch wrappers for all server endpoints
│       │   └── pdfReport.js              # jsPDF report generator
│       │
│       └── pages/
│           ├── LoginPage.jsx             # Google Sign In
│           ├── SetupPage.jsx             # Resume + JD + Job Title form
│           ├── InterviewPage.jsx         # Mic calibration → audio interview → timer
│           └── ReportPage.jsx            # Evaluation display + PDF download
│
├── .gitignore
└── PROJECT_PLAN.md                      # This file
```

---

## 4. User Flow

```
[1. LOGIN]
   Google Sign In → extract name/email from JWT
        │
        ▼
[2. SETUP]
   Enter job title
   Upload resume PDF (OCR parsed) OR paste text
   Paste job description
        │
        ▼
[3. MIC CALIBRATION] ( Innovation) 
   Random phrase displayed → user reads aloud
   Word-level match comparison → need 80%+ to proceed
        │
        ▼
[4. INTERVIEW]  ←─── 15-minute countdown timer
   AI (Alex) or depends on voice that you choose , asks question → ElevenLabs speaks it
   Candidate speaks → Web Speech API captures text
   Answer sent to Gemini → next question
   10-13 exchanges (includes follow-ups)
   "End Interview" button available at any time
   Ends when: AI sends ###INTERVIEW_COMPLETE### OR timer hits 0:00 OR user quits
        │
        ▼
[5. EVALUATION]
   Gemini generates structured evaluation from transcript
        │
        ▼
[6. REPORT]
   Evaluation displayed on screen (proper markdown rendering)
   "Download PDF" → client-side PDF with transcript + evaluation
   "Start New Interview" → reset and go to Setup
```

---

## 5. Tech Stack Summary

| Layer          | Technology              | Purpose                          |
|----------------|-------------------------|----------------------------------|
| Frontend       | React 18 + Vite         | UI framework                     |
| Routing        | React Router DOM v6     | Page navigation                  |
| Styling        | Plain CSS (light theme) | Minimalist, no framework         |
| State          | React Context           | Auth + Interview state           |
| Voice IN       | Web Speech API          | Browser-native speech-to-text    |
| Voice OUT      | ElevenLabs API          | State-of-the-art AI TTS          |
| Voice fallback | Web Speech Synthesis    | Browser TTS if ElevenLabs fails  |
| Backend        | Python FastAPI          | REST API server                  |
| AI Engine      | Gemini 2.5 Flash        | Interview conversation + eval    |
| Resume Parse   | PyPDF2 + pytesseract    | Text extraction + OCR            |
| Image Convert  | pdf2image + Pillow      | PDF pages → images for OCR       |
| PDF Report     | jsPDF                   | Client-side PDF generation       |
| Auth           | Google Identity Services| OAuth sign-in                    |

---

## 6. Dependencies

### Server (Python — `server/requirements.txt`)

| Package              | Purpose                               |
|----------------------|---------------------------------------|
| fastapi              | Web framework (async, fast)           |
| uvicorn              | ASGI server to run FastAPI            |
| python-dotenv        | Load .env file                        |
| google-generativeai  | Gemini API SDK                        |
| elevenlabs           | ElevenLabs TTS SDK                    |
| python-multipart     | File upload handling in FastAPI       |
| PyPDF2               | Fast text extraction from PDFs        |
| pytesseract          | OCR engine (Python wrapper)           |
| pdf2image            | Convert PDF pages to images for OCR   |
| Pillow               | Image preprocessing before OCR        |

### Client (JavaScript — `client/package.json`)

| Package              | Purpose                               |
|----------------------|---------------------------------------|
| react                | UI framework                          |
| react-dom            | React DOM renderer                    |
| react-router-dom     | Page routing                          |
| jspdf                | PDF report generation                 |
| vite (dev)           | Dev server & bundler                  |
| @vitejs/plugin-react | Vite React plugin                     |

### System-Level (install on machine)

| Tool                          | Purpose                                |
|-------------------------------|----------------------------------------|
| Python 3.11+                  | Runtime for server                     |
| Node.js 18+                   | Runtime for client dev server          |
| Tesseract OCR                 | OCR engine (pytesseract wraps this)    |
| Poppler (for pdf2image)       | PDF to image conversion                |

---

## 7. API Keys Required

| Service     | Env Variable         | Where Used              |
|-------------|----------------------|-------------------------|
| Gemini      | GEMINI_API_KEY       | server/.env             |
| ElevenLabs  | ELEVENLABS_API_KEY   | server/.env             |
| Google OAuth| (hardcoded client_id)| client LoginPage.jsx    |

---

## 8. How to Run

```bash
# Terminal 1 — Python Server
cd server
pip install -r requirements.txt
python app.py

# Terminal 2 — React Client
cd client
npm install
npm run dev
```

Open http://localhost:5173 in Chrome.

---

## 9. Database Plan (Future)

### Recommended: PostgreSQL + SQLAlchemy ORM

PostgreSQL for structured relational data. SQLAlchemy + Alembic for Python-native ORM and migrations.

### Schema

```
┌──────────────────────┐
│        users          │
├──────────────────────┤
│ id          (UUID PK) │
│ google_id   (unique)  │
│ email       (unique)  │
│ name                  │
│ picture_url           │
│ created_at            │
│ last_login_at         │
└──────────┬───────────┘
           │ 1:many
           ▼
┌──────────────────────────┐
│       interviews          │
├──────────────────────────┤
│ id            (UUID PK)   │
│ user_id       (FK→users)  │
│ job_title                 │
│ job_description    (text) │
│ resume_text        (text) │
│ status (enum: in_progress │
│         / completed       │
│         / timed_out)      │
│ duration_seconds   (int)  │
│ question_count     (int)  │
│ started_at                │
│ completed_at              │
└──────────┬───────────────┘
           │ 1:many
           ▼
┌──────────────────────────┐
│       messages            │
├──────────────────────────┤
│ id            (UUID PK)   │
│ interview_id  (FK)        │
│ role   (enum: interviewer │
│         / candidate)      │
│ text           (text)     │
│ sequence_num   (int)      │
│ created_at                │
└──────────────────────────┘

┌──────────────────────────┐
│      evaluations          │
├──────────────────────────┤
│ id            (UUID PK)   │
│ interview_id  (FK, unique)│
│ raw_markdown   (text)     │
│ overall_score  (int 1-10) │
│ recommendation (enum:     │
│   strong_hire / hire /    │
│   lean_hire / lean_no /   │
│   no_hire)                │
│ created_at                │
└──────────────────────────┘
```

### What TO Store

| Data                  | Why                                                    |
|-----------------------|--------------------------------------------------------|
| User profile          | Track returning users, personalize experience          |
| Interview metadata    | Job title, duration, date — for history/dashboard      |
| Full transcript       | Users review past interviews, track improvement        |
| Evaluation + score    | Progress tracking over time, comparison charts         |
| Resume text           | Avoid re-upload if doing multiple interviews same role |
| Job description       | Context for review, reuse for re-interview             |








































### What NOT to Store

| Data                     | Why                                                 |
|--------------------------|-----------------------------------------------------|
| Audio recordings         | Huge storage cost, privacy liability, not needed    |
| Google auth tokens       | Short-lived, re-issued on each login                |
| ElevenLabs audio buffers | Ephemeral, regenerate if needed                     |
| Gemini API responses raw | Store the cleaned text, not raw API payloads        |
| PDF reports              | Generate on-demand from stored transcript + eval    |
| Resume PDF files         | Store extracted text only, not the binary file      |
| Passwords                | Google OAuth only — no password to store             |








































































### Future Tables (when adding features)

```
┌──────────────────────────┐
│    interview_settings     │  ← user preferences
├──────────────────────────┤
│ user_id        (FK)       │
│ default_duration (int)    │
│ voice_id       (string)   │  ← preferred ElevenLabs voice
│ difficulty     (enum)     │  ← easy / medium / hard
└──────────────────────────┘

┌──────────────────────────┐
│     skill_scores          │  ← per-interview breakdown
├──────────────────────────┤
│ interview_id   (FK)       │
│ category       (string)   │  ← "technical", "communication", "problem_solving"
│ score          (int 1-10) │
└──────────────────────────┘
```











































































### Migration Path (current → DB)

1. `pip install sqlalchemy alembic asyncpg` in server
2. Create `server/models.py` with SQLAlchemy models matching schema above
3. `alembic init alembic` → configure for PostgreSQL
4. `alembic revision --autogenerate` → `alembic upgrade head`
5. Update routes to save/read from DB instead of passing everything from client
6. Server becomes stateful: interview state lives in DB, client sends interview_id per turn instead of full history
7. Add `/api/interviews` endpoints: list history, view past interview, re-download report

---

## 10. Current Limitations (No DB)

- All state lost on page refresh
- No interview history
- No progress tracking across sessions
- Full conversation history sent with every API call (works fine but inefficient)
- No multi-device support (interview tied to browser tab)

These all get solved once the DB layer is added.
