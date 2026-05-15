import os
from elevenlabs import ElevenLabs, VoiceSettings

client = ElevenLabs(api_key=os.getenv("ELEVENLABS_API_KEY"))

AVAILABLE_VOICES = [
    {"id": "pNInz6obpgDQGcFmaJgB", "name": "Adam", "gender": "Male", "accent": "American", "tone": "Professional, versatile"},
    {"id": "21m00Tcm4TlvDq8ikWAM", "name": "Rachel", "gender": "Female", "accent": "American", "tone": "Professional, articulate"},
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
        voice_settings=VoiceSettings(
            stability=0.4,
            similarity_boost=0.75,
            speed=1.2,
        ),
    )

    chunks = []
    for chunk in audio_iterator:
        chunks.append(chunk)
    return b"".join(chunks)
