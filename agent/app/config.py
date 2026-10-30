import os

from dotenv import load_dotenv

load_dotenv()


class Settings:
    backend_url = os.getenv("BACKEND_URL", "http://localhost:4000")
    internal_token = os.getenv("INTERNAL_TOKEN", "change-me")
    # Twilio media stream ulanadigan ommaviy manzil, masalan wss://agent.example.uz
    public_ws_url = os.getenv("AGENT_PUBLIC_WS_URL", "ws://localhost:8000")

    stt_provider = os.getenv("STT_PROVIDER", "yandex")  # yandex | google
    yandex_api_key = os.getenv("YANDEX_API_KEY", "")
    yandex_folder_id = os.getenv("YANDEX_FOLDER_ID") or None

    google_api_key = os.getenv("GOOGLE_API_KEY", "")
    gemini_model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    google_stt_credentials_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    google_stt_location = os.getenv("GOOGLE_STT_LOCATION", "us-central1")
    google_stt_model = os.getenv("GOOGLE_STT_MODEL", "chirp_2")

    twilio_account_sid = os.getenv("TWILIO_ACCOUNT_SID")
    twilio_auth_token = os.getenv("TWILIO_AUTH_TOKEN")


settings = Settings()
