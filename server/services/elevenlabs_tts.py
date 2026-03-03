import os
from elevenlabs import ElevenLabs

client = ElevenLabs(api_key=os.getenv("ELEVENLABS_API_KEY"))

AVAILABLE_VOICES = [
    {"id": "pNInz6obpgDQGcFmaJgB", "name": "Adam", "gender": "Male", "accent": "American", "tone": "Professional, versatile"},
    {"id": "N2lVS1w4EtoT3dr4eOWO", "name": "Callum", "gender": "Male", "accent": "British", "tone": "Sophisticated, warm"},
    {"id": "flq6f7yk4E4fJM5XTYuZ", "name": "Michael", "gender": "Male", "accent": "American", "tone": "Balanced, natural"},
    {"id": "pqHfZKP75CvOlQylNhV4", "name": "Bill", "gender": "Male", "accent": "American", "tone": "Clear, confident"},
    {"id": "21m00Tcm4TlvDq8ikWAM", "name": "Rachel", "gender": "Female", "accent": "American", "tone": "Professional, articulate"},
    {"id": "XB0fDUnXU5powFXDhCwa", "name": "Charlotte", "gender": "Female", "accent": "British", "tone": "Warm, friendly"},
    {"id": "LcfcDJNUP1GQjkzn1xUU", "name": "Emily", "gender": "Female", "accent": "American", "tone": "Youthful, conversational"},
    {"id": "jsCqWAovK2LkecY7zXl4", "name": "Freya", "gender": "Female", "accent": "Scandinavian", "tone": "Warm, natural"},
]

DEFAULT_VOICE_ID = "pNInz6obpgDQGcFmaJgB"


def get_available_voices():
    return AVAILABLE_VOICES


def text_to_speech(text: str, voice_id: str = None) -> bytes:
    clean_text = text.replace("###INTERVIEW_COMPLETE###", "").strip()
    vid = voice_id or DEFAULT_VOICE_ID

    audio_iterator = client.text_to_speech.convert(
        voice_id=vid,
        text=clean_text,
        model_id="eleven_multilingual_v2",
        output_format="mp3_44100_128",
        voice_settings={
            "stability": 0.4,
            "similarity_boost": 0.75,
            "speed": 1.2,
        },
    )

    chunks = []
    for chunk in audio_iterator:
        chunks.append(chunk)
    return b"".join(chunks)
