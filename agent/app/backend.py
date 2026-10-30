"""Node.js backend bilan ichki API orqali bog'lanish."""

import aiohttp
from loguru import logger

from .config import settings


class Backend:
    def __init__(self, session: aiohttp.ClientSession):
        self._s = session
        self._base = settings.backend_url.rstrip("/") + "/internal"
        self._headers = {"X-Internal-Token": settings.internal_token}

    async def _req(self, method: str, path: str, **kw):
        async with self._s.request(method, self._base + path, headers=self._headers, **kw) as r:
            if r.status == 404:
                return None
            if r.status >= 400:
                text = await r.text()
                raise RuntimeError(f"Backend {method} {path} -> {r.status}: {text[:200]}")
            return await r.json()

    async def get_agent(self, agent_id: int | str) -> dict | None:
        return await self._req("GET", f"/agents/{agent_id}")

    async def get_agent_by_number(self, number: str) -> dict | None:
        return await self._req("GET", "/agents/by-number", params={"number": number})

    async def start_call(self, data: dict) -> dict:
        return await self._req("POST", "/calls", json=data)

    async def finish_call(self, call_id: int, data: dict):
        try:
            await self._req("PATCH", f"/calls/{call_id}", json=data)
        except Exception as e:  # noqa: BLE001
            logger.error(f"Qo'ng'iroq natijasini saqlab bo'lmadi: {e}")
