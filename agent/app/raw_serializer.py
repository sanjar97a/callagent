"""Brauzer test sahifasi uchun oddiy WebSocket protokoli.

Kiruvchi:  binary = 16-bit PCM mono (sample rate ulanishda belgilanadi)
           text   = JSON boshqaruv xabari: {"type": "hangup"}
Chiquvchi: binary = 16-bit PCM mono (bot ovozi)
           text   = JSON: {"type": "clear"} (gap bo'lindi, ijroni to'xtat),
                    {"type": "transcript", "role": "user"|"assistant", "text": ...}
"""

import json

from pipecat.frames.frames import (
    EndFrame,
    Frame,
    InputAudioRawFrame,
    InterruptionFrame,
    OutputAudioRawFrame,
    OutputTransportMessageFrame,
    OutputTransportMessageUrgentFrame,
)
from pipecat.serializers.base_serializer import FrameSerializer


class RawPCMSerializer(FrameSerializer):
    def __init__(self, sample_rate: int = 16000, **kwargs):
        super().__init__(**kwargs)
        self._sample_rate = sample_rate

    async def serialize(self, frame: Frame) -> str | bytes | None:
        if isinstance(frame, OutputAudioRawFrame):
            return frame.audio
        if isinstance(frame, InterruptionFrame):
            return json.dumps({"type": "clear"})
        if isinstance(frame, (OutputTransportMessageFrame, OutputTransportMessageUrgentFrame)):
            if self.should_ignore_frame(frame):
                return None
            return json.dumps(frame.message, ensure_ascii=False)
        return None

    async def deserialize(self, data: str | bytes) -> Frame | None:
        if isinstance(data, bytes):
            if len(data) < 2:
                return None
            return InputAudioRawFrame(audio=data, sample_rate=self._sample_rate, num_channels=1)
        try:
            msg = json.loads(data)
        except json.JSONDecodeError:
            return None
        if msg.get("type") == "hangup":
            return EndFrame()
        return None
