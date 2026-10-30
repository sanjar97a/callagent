import os

from dotenv import load_dotenv

load_dotenv()


class Settings:
    backend_url = os.getenv("BACKEND_URL", "http://localhost:4000")
    internal_token = os.getenv("INTERNAL_TOKEN", "change-me")
    # Internetdan ko'rinadigan manzil: "auto" = Cloudflare tunnel'dan avtomatik
    public_url = os.getenv("PUBLIC_URL", "auto")
    tunnel_metrics_url = os.getenv("TUNNEL_METRICS_URL", "http://localhost:2000")

    stt_provider = os.getenv("STT_PROVIDER", "yandex")  # yandex | google
    yandex_api_key = os.getenv("YANDEX_API_KEY", "")
    yandex_folder_id = os.getenv("YANDEX_FOLDER_ID") or None

    google_api_key = os.getenv("GOOGLE_API_KEY", "")
    gemini_model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    # gemini_live = faqat Gemini (eshitadi va gapiradi); yandex = Yandex STT/TTS + Gemini matn
    engine = (os.getenv("AGENT_ENGINE") or "gemini_live").strip().lower()
    gemini_live_model = os.getenv("GEMINI_LIVE_MODEL") or "models/gemini-3.8-live"
    if not gemini_live_model.startswith("models/"):
        gemini_live_model = "models/" + gemini_live_model
    transcribe_langs = os.getenv("TRANSCRIBE_LANGS", "uz-UZ,ru-RU")
    google_stt_credentials_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    google_stt_location = os.getenv("GOOGLE_STT_LOCATION", "us-central1")
    google_stt_model = os.getenv("GOOGLE_STT_MODEL", "chirp_2")

    twilio_account_sid = os.getenv("TWILIO_ACCOUNT_SID")
    twilio_auth_token = os.getenv("TWILIO_AUTH_TOKEN")


settings = Settings()
