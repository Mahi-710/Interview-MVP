from fastapi import APIRouter
from fastapi.responses import StreamingResponse, JSONResponse
from services.video_analysis import (
    gen_frames,
    get_latest_status,
    start_video_processing,
    stop_video_processing,
)

router = APIRouter(prefix="/api/video")


@router.post("/start")
async def start_camera():
    """Start the camera and background processing thread."""
    start_video_processing()
    return {"status": "started"}


@router.post("/stop")
async def stop_camera():
    """Stop the camera and release resources."""
    stop_video_processing()
    return {"status": "stopped"}


@router.get("/feed")
async def video_feed():
    """MJPEG stream for the video feed."""
    return StreamingResponse(
        gen_frames(),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )


@router.get("/status")
async def video_status():
    """Current emotion + eye tracking data (polled by frontend)."""
    return JSONResponse(content=get_latest_status())
