import os
import re
import requests
import psycopg2


def get_db_connection():
    return psycopg2.connect(
        user=os.getenv("POSTGRESQL_USERNAME"),
        password=os.getenv("POSTGRESQL_PASSWORD"),
        dbname=os.getenv("POSTGRESQL_DB"),
        host=os.getenv("POSTGRESQL_HOST", "localhost"),
        port=int(os.getenv("POSTGRESQL_PORT", 5432)),
    )


def _parse_recommendation(evaluation: str):
    """Extract ###RECOMMENDATION:selected### or ###RECOMMENDATION:rejected### tag."""
    match = re.search(r'###RECOMMENDATION:(selected|rejected)###', evaluation)
    return match.group(1) if match else None


def _strip_recommendation_tag(evaluation: str) -> str:
    """Remove the machine-readable tag before storing human-readable markdown."""
    return re.sub(r'\s*###RECOMMENDATION:(selected|rejected)###\s*$', '', evaluation).strip()


def _notify_recruiter(application_id: int, recommendation: str, session_id: int):
    """Call the Recruiter service webhook to sync completion status."""
    recruiter_url = os.getenv("RECRUITER_API_URL", "http://localhost:5000")
    internal_key = os.getenv("INTERNAL_API_KEY", "")
    url = f"{recruiter_url}/api/interview/{application_id}/complete"
    try:
        response = requests.patch(
            url,
            json={"recommendation": recommendation, "session_id": session_id},
            headers={"X-Internal-Key": internal_key},
            timeout=10,
        )
        if response.status_code == 200:
            print(f"Recruiter notified: application {application_id} → {recommendation}")
        else:
            print(f"Recruiter webhook returned {response.status_code}: {response.text}")
    except Exception as e:
        print(f"Recruiter webhook failed (interview still saved locally): {e}")


def save_interview_to_db(token: str, conversation_history: list, evaluation: str):
    """Save transcript + evaluation to DB, parse recommendation, then notify Recruiter service."""
    import traceback
    conn = None
    recommendation = None
    application_id = None
    session_id = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute(
            "SELECT id, application_id FROM interview_sessions WHERE token = %s",
            (token,)
        )
        row = cur.fetchone()
        if not row:
            print(f"save_interview_to_db: token {token} not found in DB")
            return

        session_id, application_id = row

        # Parse and strip the recommendation tag from the evaluation text
        recommendation = _parse_recommendation(evaluation)
        clean_evaluation = _strip_recommendation_tag(evaluation)

        if not recommendation:
            print(f"Warning: no recommendation tag found in evaluation for session {session_id}")

        # Save each conversation turn
        if conversation_history:
            for i, msg in enumerate(conversation_history):
                cur.execute(
                    """INSERT INTO interview_transcripts (session_id, role, text, sequence_num)
                       VALUES (%s, %s, %s, %s)""",
                    (session_id, msg.get("role"), msg.get("text"), i + 1)
                )

        # Save clean evaluation + recommendation (upsert in case called twice)
        cur.execute(
            """INSERT INTO interview_evaluations (session_id, raw_markdown, recommendation)
               VALUES (%s, %s, %s)
               ON CONFLICT (session_id) DO UPDATE
                 SET raw_markdown = EXCLUDED.raw_markdown,
                     recommendation = EXCLUDED.recommendation""",
            (session_id, clean_evaluation, recommendation)
        )

        # Mark session completed
        cur.execute(
            """UPDATE interview_sessions
               SET status = 'completed', completed_at = NOW(), updated_at = NOW()
               WHERE token = %s""",
            (token,)
        )

        conn.commit()
        cur.close()
        print(f"Interview saved to DB: session {session_id}, recommendation: {recommendation}")

    except Exception as e:
        if conn:
            conn.rollback()
        print(f"ERROR in save_interview_to_db: {e}")
        traceback.print_exc()
        raise  # Re-raise so the caller can see the failure
    finally:
        if conn:
            conn.close()

    # Notify Recruiter service AFTER DB commit — failure here doesn't roll back the interview data
    if recommendation and application_id and session_id:
        _notify_recruiter(application_id, recommendation, session_id)
