"""Gemini Live rejimi: bitta model o'zi eshitadi, o'ylaydi va gapiradi (Yandex kerak emas).

Pipecat'ning GeminiLiveLLMService'iga ikkita o'zbekcha tuzatish:
- nutq yozuvi (transkripsiya) tilini uz-UZ / ru-RU ga qat'iy belgilaymiz, aks holda
  model o'zbekchani golland yoki koreys deb yozib qo'yadi;
- ovoz uchun language_code yubormaymiz (standart en-US bo'lib qolmasin) — model
  tilni suhbatdan o'zi aniqlaydi, brauzer demosida ham shunday ishlaydi.
"""

import pipecat.services.google.gemini_live.llm as _gl
from pipecat.services.google.gemini_live.llm import GeminiLiveLLMService

from .config import settings

_OrigTranscription = _gl.AudioTranscriptionConfig
_OrigSpeech = _gl.SpeechConfig


def _transcription_config(*args, **kwargs):
    langs = [x.strip() for x in settings.transcribe_langs.split(",") if x.strip()]
    if langs:
        kwargs.setdefault("language_codes", langs)
    return _OrigTranscription(*args, **kwargs)


def _speech_config(*args, **kwargs):
    kwargs.pop("language_code", None)
    return _OrigSpeech(*args, **kwargs)


_gl.AudioTranscriptionConfig = _transcription_config
_gl.SpeechConfig = _speech_config

# Dashboard'dagi (Yandex) ovoz nomlarini Gemini ovozlariga moslash
VOICE_MAP = {"nigora": "Kore", "zamira": "Aoede", "yulduz": "Leda"}


def make_gemini_live(agent: dict, system_instruction: str, tools: list) -> GeminiLiveLLMService:
    voice = agent.get("voice") or "nigora"
    return GeminiLiveLLMService(
        api_key=settings.google_api_key,
        tools=tools or None,
        settings=GeminiLiveLLMService.Settings(
            model=settings.gemini_live_model,
            voice=VOICE_MAP.get(voice, voice),
            system_instruction=system_instruction,
        ),
    )
