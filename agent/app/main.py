"""Agent ishchisi: FastAPI + WebSocket endpointlar.

/ws/browser  - dashboarddagi "Sinab ko'rish" (mikrofon) uchun
/ws/twilio   - Twilio Media Streams (kiruvchi va chiquvchi qo'ng'iroqlar)
/ws/raw      - xom PCM (Asterisk yoki boshqa SIP shlyuz uchun)
/twilio/incoming - Twilio raqamiga kelgan qo'ng'iroq uchun TwiML
"""

import hashlib
import hmac
import time
from contextlib import asynccontextmanager
from xml.sax.saxutils import escape

import aiohttp
from fastapi import FastAPI, Form, Query, WebSocket
from fastapi.responses import Response
from loguru import logger

from pipecat.runner.utils import parse_telephony_websocket
from pipecat.serializers.twilio import TwilioFrameSerializer
from pipecat.transports.websocket.fastapi import FastAPIWebsocketParams, FastAPIWebsocketTransport

from .backend import Backend
from .bot import run_call
from .config import settings
from .raw_serializer import RawPCMSerializer

state: dict = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    state["session"] = aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=30))
    state["backend"] = Backend(state["session"])
    yield
    await state["session"].close()


app = FastAPI(title="CallAgent worker", lifespan=lifespan)


def verify_ticket(ticket: str, agent_id: str) -> bool:
    """Ticket = "<exp>.<hmac>"; backend /api/agents/:id/test-session beradi."""
    try:
        exp_s, sig = ticket.split(".", 1)
        if int(exp_s) < time.time():
            return False
        expected = hmac.new(
            settings.internal_token.encode(), f"{agent_id}.{exp_s}".encode(), hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(expected, sig)
    except Exception:  # noqa: BLE001
        return False


def ws_params(serializer, sample_rate: int) -> FastAPIWebsocketParams:
    return FastAPIWebsocketParams(
        audio_in_enabled=True,
        audio_out_enabled=True,
        add_wav_header=False,
        serializer=serializer,
        audio_in_sample_rate=sample_rate,
        audio_out_sample_rate=sample_rate,
    )


async def safe_run_call(websocket: WebSocket, **kwargs):
    """Sozlash xatosi (masalan API kalit yo'q) bo'lsa ulanishni toza yopadi."""
    try:
        await run_call(**kwargs)
    except Exception as e:  # noqa: BLE001
        logger.exception(f"Qo'ng'iroqni boshlab bo'lmadi: {e}")
        try:
            await websocket.close(code=1011, reason=str(e)[:120])
        except Exception:  # noqa: BLE001
            pass


@app.get("/health")
async def health():
    return {"ok": True}


@app.websocket("/ws/browser")
async def ws_browser(
    websocket: WebSocket,
    agent_id: str = Query(...),
    ticket: str = Query(...),
    sample_rate: int = Query(16000),
):
    await websocket.accept()
    if not verify_ticket(ticket, agent_id):
        await websocket.close(code=4401, reason="ticket yaroqsiz")
        return
    agent = await state["backend"].get_agent(agent_id)
    if not agent:
        await websocket.close(code=4404, reason="agent topilmadi")
        return
    transport = FastAPIWebsocketTransport(
        websocket=websocket, params=ws_params(RawPCMSerializer(sample_rate), sample_rate)
    )
    await safe_run_call(
        websocket,
        transport=transport,
        agent=agent,
        backend=state["backend"],
        session=state["session"],
        sample_rate=sample_rate,
        call_meta={"direction": "inbound", "channel": "browser", "from_number": "brauzer"},
        send_transcripts=True,
    )


@app.websocket("/ws/raw")
async def ws_raw(
    websocket: WebSocket,
    agent_id: str = Query(...),
    token: str = Query(...),
    sample_rate: int = Query(8000),
    from_number: str = Query(""),
    to_number: str = Query(""),
):
    await websocket.accept()
    if not hmac.compare_digest(token, settings.internal_token):
        await websocket.close(code=4401)
        return
    agent = await state["backend"].get_agent(agent_id)
    if not agent:
        await websocket.close(code=4404)
        return
    transport = FastAPIWebsocketTransport(
        websocket=websocket, params=ws_params(RawPCMSerializer(sample_rate), sample_rate)
    )
    await safe_run_call(
        websocket,
        transport=transport,
        agent=agent,
        backend=state["backend"],
        session=state["session"],
        sample_rate=sample_rate,
        call_meta={
            "direction": "inbound",
            "channel": "sip",
            "from_number": from_number,
            "to_number": to_number,
        },
    )


@app.post("/twilio/incoming")
async def twilio_incoming(From: str = Form(""), To: str = Form("")):
    """Twilio raqamining Voice webhook'i shu manzilga qo'yiladi."""
    url = settings.public_ws_url.rstrip("/") + "/ws/twilio"
    twiml = (
        '<?xml version="1.0" encoding="UTF-8"?><Response><Connect>'
        f'<Stream url="{escape(url)}">'
        '<Parameter name="direction" value="inbound"/>'
        f'<Parameter name="from_number" value="{escape(From)}"/>'
        f'<Parameter name="to_number" value="{escape(To)}"/>'
        "</Stream></Connect></Response>"
    )
    return Response(content=twiml, media_type="application/xml")


@app.websocket("/ws/twilio")
async def ws_twilio(websocket: WebSocket):
    await websocket.accept()
    provider, call_data = await parse_telephony_websocket(websocket)
    if provider != "twilio":
        await websocket.close(code=4400)
        return
    body = call_data.get("body", {}) or {}
    backend: Backend = state["backend"]
    direction = body.get("direction", "inbound")

    if body.get("agent_id"):
        agent = await backend.get_agent(body["agent_id"])
    else:
        agent = await backend.get_agent_by_number(body.get("to_number", ""))
    if not agent:
        logger.warning(f"Agent topilmadi: {body}")
        await websocket.close(code=4404)
        return

    serializer = TwilioFrameSerializer(
        stream_sid=call_data["stream_id"],
        call_sid=call_data["call_id"],
        account_sid=settings.twilio_account_sid,
        auth_token=settings.twilio_auth_token,
    )
    transport = FastAPIWebsocketTransport(websocket=websocket, params=ws_params(serializer, 8000))
    await safe_run_call(
        websocket,
        transport=transport,
        agent=agent,
        backend=backend,
        session=state["session"],
        sample_rate=8000,
        call_meta={
            "direction": direction,
            "channel": "twilio",
            "from_number": body.get("from_number", ""),
            "to_number": body.get("to_number", ""),
            "provider_call_id": call_data["call_id"],
            "campaign_id": body.get("campaign_id") or None,
            "contact_id": body.get("contact_id") or None,
        },
    )
