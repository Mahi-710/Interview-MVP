const BASE_URL = '/api';

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

export async function getEvaluation({ candidateName, jobTitle, transcript }) {
  const res = await fetch(`${BASE_URL}/interview/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ candidateName, jobTitle, transcript }),
  });
  if (!res.ok) throw new Error('Failed to get evaluation');
  return res.json();
}
