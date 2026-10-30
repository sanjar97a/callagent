"""Bitta qo'ng'iroq uchun Pipecat pipeline: STT -> Gemini -> Yandex TTS."""

import time
from datetime import datetime, timezone

import aiohttp
from loguru import logger

from pipecat.adapters.llm.schemas.direct_function import tool_options
from pipecat.adapters.llm.schemas.function_schema import FunctionSchema
from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.audio.vad.vad_analyzer import VADParams
from pipecat.frames.frames import (
    EndWorkerFrame,
    LLMRunFrame,
    OutputTransportMessageUrgentFrame,
    TTSSpeakFrame,
)
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.worker import PipelineParams, PipelineWorker
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import (
    LLMContextAggregatorPair,
    LLMUserAggregatorParams,
)
from pipecat.services.google.llm import GoogleLLMService
from pipecat.services.llm_service import FunctionCallParams
from pipecat.transports.base_transport import BaseTransport
from pipecat.workers.runner import WorkerRunner

from .backend import Backend
from .config import settings
from .yandex import YandexSTTService, YandexTTSService

SPEECH_RULES = """
Muhim qoidalar (ovozli suhbat):
- Javoblaring ovozga aylantiriladi: qisqa, 1-2 gapli, sodda o'zbek tilida (lotin yozuvi) gapir.
- Markdown, emoji, ro'yxat, qavs va maxsus belgilar ishlatma. Raqamlarni so'z bilan ayt.
- Bir vaqtda faqat bitta savol ber.
- Mijoz gapini tushunmasang, muloyim qayta so'ra (shovqin bo'lishi mumkin).
- Mijoz rus tilida gapirsa, rus tilida javob ber.
"""


def build_system_prompt(agent: dict) -> str:
    parts = [agent.get("system_prompt") or "Sen muloyim telefon operatorisan.", SPEECH_RULES]
    fields = agent.get("result_fields") or []
    if fields:
        names = ", ".join(f["name"] for f in fields)
        parts.append(
            f"Suhbat davomida quyidagi ma'lumotlarni aniqlab, save_result funksiyasi bilan saqla: {names}."
        )
    if agent.get("end_call_enabled", True):
        parts.append(
            "Suhbat tugaganda (mijoz xayrlashsa yoki maqsadga erishilsa) qisqa xayrlash "
            "va end_call funksiyasini chaqir."
        )
    return "\n".join(parts)


def make_stt(session: aiohttp.ClientSession, agent: dict):
    if settings.stt_provider == "google":
        from pipecat.services.google.stt import GoogleSTTService

        return GoogleSTTService(
            credentials_path=settings.google_stt_credentials_path,
            location=settings.google_stt_location,
            settings=GoogleSTTService.Settings(
                model=settings.google_stt_model,
                language_codes=[agent.get("language") or "uz-UZ"],
            ),
        )
    return YandexSTTService(
        api_key=settings.yandex_api_key,
        folder_id=settings.yandex_folder_id,
        session=session,
        language=agent.get("language") or "uz-UZ",
    )


async def run_call(
    *,
    transport: BaseTransport,
    agent: dict,
    backend: Backend,
    session: aiohttp.ClientSession,
    sample_rate: int,
    call_meta: dict,
    send_transcripts: bool = False,
):
    """Qo'ng'iroqni oxirigacha yuritadi va natijani backendga yozadi."""
    started = time.monotonic()
    call_id = None  # servislar tayyor bo'lgach backendda yaratiladi
    transcript: list[dict] = []
    result: dict = {}
    ended_by = {"value": "user"}

    stt = make_stt(session, agent)
    tts = YandexTTSService(
        api_key=settings.yandex_api_key,
        folder_id=settings.yandex_folder_id,
        session=session,
        voice=agent.get("voice") or "nigora",
        role=agent.get("voice_role") or None,
        speed=float(agent.get("speed") or 1.0),
    )
    llm = GoogleLLMService(
        api_key=settings.google_api_key,
        settings=GoogleLLMService.Settings(
            model=settings.gemini_model,
            system_instruction=build_system_prompt(agent),
        ),
    )

    # --- Tool'lar ---
    tools = []
    fields = agent.get("result_fields") or []
    if fields:

        async def save_result(params: FunctionCallParams):
            result.update({k: v for k, v in params.arguments.items() if v not in (None, "")})
            logger.info(f"[call {call_id}] natija: {result}")
            await params.result_callback({"saved": True})

        tools.append(
            FunctionSchema(
                name="save_result",
                description="Suhbatda aniqlangan ma'lumotlarni saqlash. Har safar yangi ma'lumot bilganda chaqir.",
                properties={
                    f["name"]: {"type": "string", "description": f.get("description") or f["name"]}
                    for f in fields
                },
                required=[],
                handler=save_result,
            )
        )

    if agent.get("end_call_enabled", True):

        @tool_options(cancel_on_interruption=False)
        async def end_call(params: FunctionCallParams):
            ended_by["value"] = "agent"
            await params.result_callback({"success": True})
            await params.llm.push_frame(EndWorkerFrame())

        tools.append(
            FunctionSchema(
                name="end_call",
                description="Qo'ng'iroqni tugatish. Avval qisqa xayrlash gapini ayt.",
                properties={},
                required=[],
                handler=end_call,
            )
        )

    context = LLMContext(tools=tools) if tools else LLMContext()
    user_agg, assistant_agg = LLMContextAggregatorPair(
        context,
        user_params=LLMUserAggregatorParams(
            vad_analyzer=SileroVADAnalyzer(params=VADParams(stop_secs=0.6, min_volume=0.5)),
        ),
    )

    pipeline = Pipeline(
        [transport.input(), stt, user_agg, llm, tts, transport.output(), assistant_agg]
    )
    worker = PipelineWorker(
        pipeline,
        params=PipelineParams(
            audio_in_sample_rate=sample_rate,
            audio_out_sample_rate=sample_rate,
            enable_metrics=True,
        ),
        idle_timeout_secs=120,
    )
    runner = WorkerRunner(handle_sigint=False)
    await runner.add_workers(worker)

    call = await backend.start_call({"agent_id": agent["id"], **call_meta})
    call_id = call["id"]

    async def push_transcript(role: str, text: str):
        transcript.append({"role": role, "text": text, "at": datetime.now(timezone.utc).isoformat()})
        if send_transcripts:
            await worker.queue_frames(
                [OutputTransportMessageUrgentFrame(message={"type": "transcript", "role": role, "text": text})]
            )

    @user_agg.event_handler("on_user_turn_message_added")
    async def _on_user(aggregator, message):
        if message.content:
            await push_transcript("user", message.content)

    @assistant_agg.event_handler("on_assistant_turn_stopped")
    async def _on_assistant(aggregator, message):
        if message.content:
            await push_transcript("assistant", message.content + (" [bo'lindi]" if message.interrupted else ""))

    @transport.event_handler("on_client_connected")
    async def _on_connected(transport, client):
        first = agent.get("first_message")
        if first:
            # TTSSpeakFrame matnni kontekstga o'zi qo'shadi; transkript assistant hodisasidan keladi
            await worker.queue_frames([TTSSpeakFrame(first)])
        else:
            context.add_message({"role": "developer", "content": "Mijozga salom berib, o'zingni tanishtir."})
            await worker.queue_frames([LLMRunFrame()])

    @transport.event_handler("on_client_disconnected")
    async def _on_disconnected(transport, client):
        await runner.cancel()

    status = "completed"
    try:
        await runner.run()
    except Exception as e:  # noqa: BLE001
        logger.exception(f"[call {call_id}] xato: {e}")
        status = "failed"
    finally:
        await backend.finish_call(
            call_id,
            {
                "status": status,
                "duration_sec": int(time.monotonic() - started),
                "transcript": transcript,
                "result": result,
                "ended_by": ended_by["value"],
                "contact_id": call_meta.get("contact_id"),
            },
        )
        logger.info(f"[call {call_id}] tugadi ({status}), {len(transcript)} replika")
