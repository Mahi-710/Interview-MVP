from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional
from services.gemini import build_system_prompt, chat, generate_evaluation
from services.elevenlabs_tts import text_to_speech, get_available_voices

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
    try:
        evaluation = generate_evaluation(req.candidateName, req.jobTitle, req.transcript)
        return {"evaluation": evaluation}
    except Exception as e:
        print(f"Evaluation error: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate evaluation")
