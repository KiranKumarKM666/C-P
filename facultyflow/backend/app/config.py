import os
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me")
ALGORITHM = "HS256"
TOKEN_MINUTES = int(os.getenv("TOKEN_MINUTES", "480"))
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./facultyflow.db")

AI_PROVIDER = os.getenv("AI_PROVIDER", "mock").lower()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")
AI_TIMEOUT = float(os.getenv("AI_TIMEOUT", "20"))

# Configurable rule thresholds (admin can change via PUT /settings)
SETTINGS = {
    "critical_below": 75.0,   # attendance below this -> Critical
    "advisory_upto": 85.0,    # attendance up to this (inclusive) -> Advisory
    "cie_cutoff": 40.0,       # CIE % below this -> low marks
    "drop_points": 20.0,      # fall of more than this between assessments
}
