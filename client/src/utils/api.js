const BASE_URL = '/api';
const RECRUITER_BASE_URL = '/recruiter-api';

export async function parseResumePDF(file) {
  const formData = new FormData();
  formData.append('resume', file);
  const res = await fetch(`${BASE_URL}/resume/parse`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to parse resume');
  }
  const data = await res.json();
  return data.text;
}

export async function sendInterviewMessage({
  candidateName, jobTitle, resumeText, jobDescription, conversationHistory, userMessage, interviewerName, focusArea,
}) {
  const res = await fetch(`${BASE_URL}/interview/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      candidateName, jobTitle, resumeText, jobDescription, conversationHistory, userMessage, interviewerName, focusArea,
    }),
  });
  if (!res.ok) throw new Error('Failed to get interview response');
  return res.json();
}

export async function fetchVoices() {
  const res = await fetch(`${BASE_URL}/interview/voices`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.voices;
}

export async function getTextToSpeech(text, voiceId = null) {
  const body = { text };
  if (voiceId) body.voiceId = voiceId;
  const res = await fetch(`${BASE_URL}/interview/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null; // null signals fallback to browser TTS
  return res.blob();
}

export async function getEvaluation({ candidateName, jobTitle, transcript, token = null, conversationHistory = null }) {
  const body = { candidateName, jobTitle, transcript };
  if (token) body.token = token;
  if (conversationHistory) body.conversationHistory = conversationHistory;
  const res = await fetch(`${BASE_URL}/interview/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Failed to get evaluation');
  return res.json();
}

// ── Recruited interview (token-based) ──────────────────────────────────────

export async function fetchInterviewSession(token) {
  const res = await fetch(`${RECRUITER_BASE_URL}/api/interview/session/${token}`);
  if (res.status === 404) throw new Error('SESSION_NOT_FOUND');
  if (res.status === 410) throw new Error('SESSION_EXPIRED');
  if (!res.ok) throw new Error('SESSION_ERROR');
  return res.json();
}

export async function startInterviewSession(token) {
  try {
    await fetch(`${BASE_URL}/session/${token}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    // Non-blocking — interview continues even if status update fails
  }
}
