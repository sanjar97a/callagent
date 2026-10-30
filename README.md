# CallAgent — o'zbekcha ovozli AI agentlar

**Jonli demo:** https://sanjar97a.github.io/callagent/ — brauzerda agent bilan gaplashing (faqat Gemini API kaliti kerak, server shart emas).

Telefon qo'ng'iroqlariga AI javob beradigan va o'zi qo'ng'iroq qiladigan tizim. Har bir agentga vazifa (prompt), ovoz va yig'iladigan ma'lumotlar beriladi. Suhbat matni va natijasi (masalan NPS bahosi) bazaga yoziladi.

```
Telefon / Brauzer ──audio──▶ Agent ishchisi (Python, Pipecat)
                               │  Yandex STT  → nutq matnga
                               │  Gemini      → javob + tool'lar
                               │  Yandex TTS  → matn ovozga
                               ▼
                     Node.js API (Express) ◀──▶ MySQL
                               ▲
                     React dashboard (agentlar, qo'ng'iroqlar, kampaniyalar)
```

| Papka | Nima | Texnologiya |
| --- | --- | --- |
| `agent/` | Real vaqtda suhbat yurituvchi ishchi | Python 3.12, Pipecat 1.15, FastAPI |
| `server/` | API, kampaniya dialeri, Twilio webhook | Node.js 22, Express, mysql2 |
| `web/` | Boshqaruv paneli | React 18, Vite |
| `db/` | Sxema va namunaviy 2 ta agent | MySQL 8 |

## Imkoniyatlar

- **Agentlar:** prompt, birinchi gap, ovoz (nigora, zamira, yulduz), ohang, tezlik, kiruvchi/chiquvchi, yoqish/o'chirish.
- **Ma'lumot yig'ish:** agentga maydonlar berasiz (`nps`, `ism`, `vaqt`…), u suhbatda aniqlab `save_result` tool'i bilan saqlaydi.
- **Go'shakni o'zi qo'yish:** suhbat tugaganda `end_call` tool'i.
- **Gapni bo'lish (barge-in):** mijoz gapirsa agent darhol jim bo'ladi (Silero VAD).
- **Brauzerda sinash:** dashboarddagi “Sinab ko'rish” — mikrofon orqali telefonsiz gaplashish.
- **Kiruvchi qo'ng'iroqlar:** agentga raqam biriktirasiz, shu raqamga kelgan qo'ng'iroqqa u javob beradi.
- **Kampaniyalar:** raqamlar ro'yxati, bir vaqtda nechta qo'ng'iroq, qayta urinishlar soni, jonli jarayon.
- **Tarix:** har bir qo'ng'iroqning transkripti, natijasi, davomiyligi.

## Brauzer demosi (`index.html`)

Repo ildizidagi `index.html` — serversiz ishlaydigan demo. U Gemini Live API'ga brauzerdan to'g'ridan-to'g'ri ulanadi: mikrofon ovozini yuboradi, agent ovozini ijro etadi, gapni bo'lishni (interrupt) qo'llaydi va `save_result` / `end_call` tool'larini bajaradi. Uchta tayyor agent bor: NPS so'rovchi, qabulxona, sartaroshxona navbati. Prompt, ovoz va yig'iladigan maydonlarni sahifada o'zgartirsa bo'ladi.

- Kalit faqat foydalanuvchi brauzerida saqlanadi. Shuning uchun bu sahifa shaxsiy sinov va mijozlarga ko'rsatish uchun mos, ommaviy xizmat uchun emas.
- Telefon qo'ng'iroqlari, tarix va kampaniyalar faqat to'liq tizimda (pastda).
- Lokal ochish: `python3 -m http.server` va `http://localhost:8000` (mikrofon `file://` da ishlamaydi).

## 1. Kalitlarni olish

**Yandex SpeechKit** (o'zbekcha STT va TTS):
1. [Yandex Cloud](https://console.yandex.cloud) da papka (folder) oching, billing ulang.
2. Servis akkaunt yarating, rollar: `ai.speechkit-stt.user`, `ai.speechkit-tts.user`.
3. Shu akkaunt uchun **API kalit** yarating → `YANDEX_API_KEY`. Papka ID → `YANDEX_FOLDER_ID`.

**Google Gemini:** [aistudio.google.com](https://aistudio.google.com/apikey) → `GOOGLE_API_KEY`.

**Twilio** (faqat haqiqiy telefon uchun; brauzerda sinash uchun shart emas): Account SID, Auth Token va ovozli raqam → `TWILIO_*`.

## 2. Ishga tushirish (Docker)

```bash
cp .env.example .env      # qiymatlarni to'ldiring
docker compose up -d --build
```

Dashboard: `http://localhost:8080`. `.env` dagi `ADMIN_EMAIL` / `ADMIN_PASSWORD` bilan kiring. Bazada ikkita namunaviy agent bor: “Aziza - NPS aniqlovchi” va “Qabulxona”. Kartadagi **Sinab ko'rish** tugmasini bosing.

> Lokal sinovda `.env` da `PUBLIC_API_URL=http://localhost:8080` va `AGENT_PUBLIC_WS_URL=ws://localhost:8080` qo'ying. Brauzer mikrofonni faqat `localhost` yoki `https` da beradi.

## 3. Docker'siz (dasturlash rejimi)

```bash
# MySQL
mysql -uroot -p < db/schema.sql && mysql -uroot -p < db/seed.sql

# API
cd server && npm install && npm run dev            # :4000

# Agent ishchisi
cd agent && python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --port 8000 --reload          # :8000

# Dashboard
cd web && npm install && npm run dev               # :5173
```

Har biri `.env` faylini o'z papkasida yoki ildizda o'qiydi (`server/.env`, `agent/.env`). Lokal rejimda `AGENT_PUBLIC_WS_URL=ws://localhost:8000`.

## 4. Telefonga ulash (Twilio)

Serverda HTTPS domen kerak (Twilio `wss://` ga ulanadi). Masalan Caddy yoki Nginx + Let's Encrypt bilan `web` konteynerining 8080 portini domenga chiqaring.

**Kiruvchi:** Twilio Console → raqam → *A call comes in* → Webhook `POST https://SIZNING-DOMEN/twilio/incoming`. Dashboardda agentga aynan shu raqamni (`+1…` formatida) yozing va “Kiruvchi” ni yoqing.

**Chiquvchi (kampaniya):** agentda “Kampaniyalarda o'zi qo'ng'iroq qiladi” ni yoqing → Kampaniyalar → raqamlarni qo'ying → **Boshlash**. Dialer har 5 soniyada bo'sh joyga qarab qo'ng'iroq qiladi; band yoki javob bermaganlarni qayta navbatga qo'yadi.

> O'zbekiston raqamlariga qo'ng'iroq uchun Twilio'da *Geo Permissions → Uzbekistan* ni yoqing. Mahalliy raqam kerak bo'lsa, mahalliy operatordan SIP trunk olib, uni Twilio Elastic SIP Trunking yoki quyidagi SIP yo'li orqali ulang.

## 5. Mahalliy SIP (Asterisk) — eksperimental

Agent ishchisida xom audio uchun endpoint bor:

```
ws://agent:8000/ws/raw?agent_id=1&token=INTERNAL_TOKEN&sample_rate=8000&from_number=...&to_number=...
```

Protokol: binary xabarlar — 16-bit PCM mono (`sample_rate` bo'yicha) ikkala yo'nalishda; agentdan `{"type":"clear"}` kelsa ijro buferini tozalang; `{"type":"hangup"}` yuborsangiz qo'ng'iroq tugaydi. Asterisk'dagi qo'ng'iroqni shu WebSocket'ga uzatadigan ko'prik (masalan ARI + externalMedia yoki `chan_websocket`) alohida yoziladi — bu qism haqiqiy trunk bilan hali sinalmagan.

## Agent qanday ishlaydi

`agent/app/bot.py` — har qo'ng'iroq uchun pipeline:

```
transport.input → STT → user aggregator (VAD) → Gemini → Yandex TTS → transport.output → assistant aggregator
```

- Promptga avtomatik ovozli suhbat qoidalari qo'shiladi: qisqa gap, emoji va ro'yxatsiz, raqamlarni so'z bilan.
- `result_fields` dan `save_result` tool'i yasaladi; har maydon — LLM to'ldiradigan string parametr.
- Qo'ng'iroq boshlanishida API'da yozuv ochiladi, tugaganda transkript, natija va davomiylik yoziladi.

Ichki API (`/internal/*`, `X-Internal-Token` bilan): agentni olish, raqam bo'yicha topish, qo'ng'iroqni ochish/yopish.

## Cheklovlar va keyingi qadamlar

- **STT kechikishi:** Yandex v1 sinxron API ishlatiladi — har gap tugagach yuboriladi (≈0.5–1 s qo'shimcha). Tezroq variant: Yandex v3 gRPC streaming servisini yozish.
- **Yandex STT o'zbek tilini v1 da qanchalik yaxshi tanishini** o'z audiongizda sinab ko'ring. Yoqmasa `STT_PROVIDER=google` (Chirp) ga o'ting.
- Qo'ng'iroq audiosini yozib saqlash (S3/disk) hali yo'q — Pipecat `AudioBufferProcessor` bilan qo'shiladi.
- Bitta admin foydalanuvchi; rollar va bir nechta kompaniya (multi-tenant) qo'shilmagan.
