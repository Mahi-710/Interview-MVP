from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from services.video_analysis import (
    analyze_frame,
    get_latest_status,
    start_analysis,
    stop_analysis,
)

router = APIRouter(prefix="/api/video")


class FramePayload(BaseModel):
    frame: str  # base64-encoded image from browser canvas


@router.post("/start")
async def start_camera():
    """Mark analysis as active (webcam is captured client-side)."""
    start_analysis()
    return {"status": "started"}


@router.post("/stop")
async def stop_camera():
    """Mark analysis as inactive."""
    stop_analysis()
    return {"status": "stopped"}


@router.post("/analyze")
async def analyze(payload: FramePayload):
    """Receive a base64 frame from the browser, run analysis, return results."""
    result = analyze_frame(payload.frame)
    return JSONResponse(content=result)


@router.get("/status")
async def video_status():
    """Current emotion + eye tracking data (polled by frontend)."""
    return JSONResponse(content=get_latest_status())
