import os
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.interview import router as interview_router
from routes.resume import router as resume_router
from routes.video import router as video_router

app = FastAPI(title="AI Interview Practice API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(interview_router)
app.include_router(resume_router)
app.include_router(video_router)


@app.get("/api/health")
def health():
    gemini_key = os.getenv("GEMINI_API_KEY")
    eleven_key = os.getenv("ELEVENLABS_API_KEY")
    return {
        "status": "ok",
        "gemini": "configured" if gemini_key else "MISSING",
        "elevenlabs": "configured" if eleven_key and eleven_key != "your_elevenlabs_api_key_here" else "PLACEHOLDER",
    }


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", 3001))
    print(f"Server running on http://localhost:{port}")
    print(f"Gemini API key: {'configured' if os.getenv('GEMINI_API_KEY') else 'MISSING'}")
    eleven = os.getenv("ELEVENLABS_API_KEY")
    print(f"ElevenLabs API key: {'configured' if eleven and eleven != 'your_elevenlabs_api_key_here' else 'PLACEHOLDER — update .env'}")
    uvicorn.run(app, host="0.0.0.0", port=port)
