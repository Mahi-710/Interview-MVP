from fastapi import APIRouter, HTTPException
from services.db import get_db_connection

router = APIRouter(prefix="/api/session")


@router.post("/{token}/start")
def start_session(token: str):
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute(
            "SELECT id, application_id, status FROM interview_sessions WHERE token = %s",
            (token,)
        )
        row = cur.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Session not found")

        session_id, application_id, status = row

        if status == "completed":
            raise HTTPException(status_code=409, detail="Interview already completed")
        if status == "expired":
            raise HTTPException(status_code=410, detail="Interview link has expired")

        cur.execute(
            """UPDATE interview_sessions
               SET status = 'in_progress', started_at = NOW(), updated_at = NOW()
               WHERE token = %s""",
            (token,)
        )
        cur.execute(
            """UPDATE application
               SET interview_status = 'Interview In Progress', updated_at = NOW()
               WHERE id = %s""",
            (application_id,)
        )

        conn.commit()
        cur.close()
        return {"status": "started", "session_id": session_id}

    except HTTPException:
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"Session start error: {e}")
        raise HTTPException(status_code=500, detail="Failed to start session")
    finally:
        if conn:
            conn.close()
