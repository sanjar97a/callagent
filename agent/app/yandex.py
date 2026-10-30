"""Yandex SpeechKit STT va TTS servislari (Pipecat uchun).

STT: API v1 sinxron tanib olish (stt:recognize). Har bir gap VAD bo'yicha
alohida segment sifatida yuboriladi (max 30 soniya / 1 MB).

TTS: API v3 REST (utteranceSynthesis). O'zbekcha ovozlar: nigora, zamira,
yulduz. v1 o'zbek tilini qo'llab-quvvatlamaydi, shuning uchun v3 ishlatiladi.
"""

import base64
import json
from collections.abc import AsyncGenerator
from dataclasses import dataclass

import aiohttp
from loguru import logger

from pipecat.frames.frames import ErrorFrame, Frame, TranscriptionFrame, TTSStoppedFrame
from pipecat.services.settings import STTSettings, TTSSettings
from pipecat.services.stt_service import SegmentedSTTService
from pipecat.services.tts_service import TTSService
from pipecat.utils.time import time_now_iso8601

STT_URL = "https://stt.api.cloud.yandex.net/speech/v1/stt:recognize"
TTS_URL = "https://tts.api.cloud.yandex.net/tts/v3/utteranceSynthesis"


def _auth_headers(api_key: str, folder_id: str | None) -> dict:
    headers = {"Authorization": f"Api-Key {api_key}"}
    if folder_id:
        headers["x-folder-id"] = folder_id
    return headers


@dataclass
class YandexSTTSettings(STTSettings):
    pass


class YandexSTTService(SegmentedSTTService):
    """Yandex SpeechKit v1 sinxron STT (VAD segmentlari bilan)."""

    Settings = YandexSTTSettings
    _settings: Settings

    def __init__(
        self,
        *,
        api_key: str,
        session: aiohttp.ClientSession,
        folder_id: str | None = None,
        language: str = "uz-UZ",
        topic: str = "general",
        **kwargs,
    ):
        super().__init__(settings=self.Settings(model=None, language=None), **kwargs)
        self._api_key = api_key
        self._folder_id = folder_id
        self._lang = language
        self._topic = topic
        self._session = session

    @property
    def wants_wav_segments(self) -> bool:
        # Yandex lpcm formatida WAV sarlavhasiz xom PCM kutadi
        return False

    def can_generate_metrics(self) -> bool:
        return True

    async def run_stt(self, audio: bytes) -> AsyncGenerator[Frame, None]:
        params = {
            "lang": self._lang,
            "topic": self._topic,
            "format": "lpcm",
            "sampleRateHertz": str(self.sample_rate),
        }
        if self._folder_id:
            params["folderId"] = self._folder_id
        # 30 soniya / 1 MB chegarasi: oxirgi qismni kesib tashlamaslik uchun boshidan olamiz
        max_bytes = min(1_000_000, self.sample_rate * 2 * 29)
        if len(audio) > max_bytes:
            logger.warning("STT segmenti juda uzun, 29 soniyagacha qisqartirildi")
            audio = audio[:max_bytes]
        try:
            await self.start_processing_metrics()
            async with self._session.post(
                STT_URL,
                params=params,
                data=audio,
                headers=_auth_headers(self._api_key, None),
            ) as resp:
                body = await resp.text()
                await self.stop_processing_metrics()
                if resp.status != 200:
                    yield ErrorFrame(error=f"Yandex STT xatosi {resp.status}: {body[:300]}")
                    return
                text = (json.loads(body).get("result") or "").strip()
            if text:
                logger.debug(f"STT: [{text}]")
                await self._handle_transcription(text, True, self._lang)
                yield TranscriptionFrame(text, self._user_id, time_now_iso8601())
        except Exception as e:  # noqa: BLE001
            yield ErrorFrame(error=f"Yandex STT kutilmagan xato: {e}")


@dataclass
class YandexTTSSettings(TTSSettings):
    pass


class YandexTTSService(TTSService):
    """Yandex SpeechKit v3 REST TTS."""

    Settings = YandexTTSSettings
    _settings: Settings

    def __init__(
        self,
        *,
        api_key: str,
        session: aiohttp.ClientSession,
        folder_id: str | None = None,
        voice: str = "nigora",
        role: str | None = None,
        speed: float = 1.0,
        **kwargs,
    ):
        super().__init__(
            push_start_frame=True,
            push_stop_frames=True,
            settings=self.Settings(model=None, voice=voice, language=None),
            **kwargs,
        )
        self._api_key = api_key
        self._folder_id = folder_id
        self._role = role
        self._speed = speed
        self._session = session

    def can_generate_metrics(self) -> bool:
        return True

    async def run_tts(self, text: str, context_id: str) -> AsyncGenerator[Frame, None]:
        hints = [{"voice": self._settings.voice}, {"speed": str(self._speed)}]
        if self._role:
            hints.append({"role": self._role})
        payload = {
            "text": text,
            "hints": hints,
            "outputAudioSpec": {
                "rawAudio": {
                    "audioEncoding": "LINEAR16_PCM",
                    "sampleRateHertz": str(self.sample_rate),
                }
            },
            "loudnessNormalizationType": "LUFS",
        }
        try:
            async with self._session.post(
                TTS_URL,
                json=payload,
                headers=_auth_headers(self._api_key, self._folder_id),
            ) as resp:
                if resp.status != 200:
                    err = await resp.text()
                    yield ErrorFrame(error=f"Yandex TTS xatosi {resp.status}: {err[:300]}")
                    yield TTSStoppedFrame(context_id=context_id)
                    return
                await self.start_tts_usage_metrics(text)
                async for frame in self._stream_audio_frames_from_iterator(
                    _iter_audio_chunks(resp),
                    in_sample_rate=self.sample_rate,
                    context_id=context_id,
                ):
                    await self.stop_ttfb_metrics()
                    yield frame
        except Exception as e:  # noqa: BLE001
            yield ErrorFrame(error=f"Yandex TTS kutilmagan xato: {e}")
        finally:
            await self.stop_ttfb_metrics()


async def _iter_audio_chunks(resp: aiohttp.ClientResponse):
    """Javob qatorma-qator JSON obyektlar oqimi: {"result":{"audioChunk":{"data":"..."}}}."""
    decoder = json.JSONDecoder()
    buf = ""
    async for raw in resp.content.iter_any():
        buf += raw.decode("utf-8", errors="ignore")
        while True:
            buf = buf.lstrip()
            if not buf:
                break
            try:
                obj, idx = decoder.raw_decode(buf)
            except json.JSONDecodeError:
                break  # obyekt hali to'liq kelmagan
            buf = buf[idx:]
            if "error" in obj:
                raise RuntimeError(f"Yandex TTS: {obj['error']}")
            data = obj.get("result", {}).get("audioChunk", {}).get("data")
            if data:
                yield base64.b64decode(data)
