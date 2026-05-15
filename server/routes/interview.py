from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from services.gemini import build_system_prompt, chat, generate_evaluation
from services.elevenlabs_tts import text_to_speech, get_available_voices
from services.db import save_interview_to_db

router = APIRouter(prefix="/api/interview")


class ChatRequest(BaseModel):
    candidateName: str
    jobTitle: str
    resumeText: str
    jobDescription: str
    conversationHistory: list = []
    userMessage: str
    interviewerName: Optional[str] = "Alex"
    focusArea: Optional[str] = "full_screening"


class TTSRequest(BaseModel):
    text: str
    voiceId: Optional[str] = None


class EvaluateRequest(BaseModel):
    candidateName: str
    jobTitle: str
    transcript: str
    # Present only in recruited (token) mode — used to persist results to DB
    token: Optional[str] = None
    conversationHistory: Optional[List[Dict[str, Any]]] = None


@router.get("/voices")
async def list_voices():
    return {"voices": get_available_voices()}


@router.post("/chat")
async def interview_chat(req: ChatRequest):
    try:
        system_prompt = build_system_prompt(
            req.candidateName, req.jobTitle, req.resumeText, req.jobDescription, req.interviewerName, req.focusArea
        )
        reply = chat(system_prompt, req.conversationHistory, req.userMessage)
        is_complete = "###INTERVIEW_COMPLETE###" in reply
        clean_reply = reply.replace("###INTERVIEW_COMPLETE###", "").strip()
        return {"reply": clean_reply, "isComplete": is_complete}
    except Exception as e:
        print(f"Interview chat error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get interview response")


@router.post("/tts")
async def interview_tts(req: TTSRequest):
    try:
        if not req.text:
            raise HTTPException(status_code=400, detail="No text provided")
        audio_bytes = text_to_speech(req.text, voice_id=req.voiceId)
        return Response(
            content=audio_bytes,
            media_type="audio/mpeg",
            headers={"Content-Length": str(len(audio_bytes))},
        )
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"TTS error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="TTS failed")


@router.post("/evaluate")
async def interview_evaluate(req: EvaluateRequest):
    # Step 1: Generate evaluation (must succeed — raises 500 if it fails)
    try:
        evaluation = generate_evaluation(req.candidateName, req.jobTitle, req.transcript)
    except Exception as e:
        print(f"Evaluation generation error: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate evaluation")

    # Step 2: Persist to DB (best-effort — candidate always gets their evaluation)
    if req.token:
        try:
            save_interview_to_db(
                token=req.token,
                conversation_history=req.conversationHistory or [],
                evaluation=evaluation,
            )
        except Exception as e:
            import traceback
            print(f"DB persistence failed for token {req.token}: {e}")
            traceback.print_exc()

    return {"evaluation": evaluation}
