# FacultyFlow
AI-assisted attendance, internal marks (CIE), deficit detection, advisories and reports. **AI only drafts; the teacher decides.**

## Run it
```bash
cd backend
python -m venv venv && source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                 # set SECRET_KEY, AI provider
python -m app.seed                                   # DUMMY data + demo logins
uvicorn app.main:app --reload
```
Open http://localhost:8000 (app) or http://localhost:8000/docs (API docs).

Demo logins: `hod@college.edu / admin123`, `meera@college.edu / faculty123`, `asha@college.edu / student123`

## AI providers (.env)
`AI_PROVIDER=mock` (default, no key), `gemini`, `openai` or `ollama` (local, best for privacy).
If the AI fails, a template draft is used. Only first name, course, attendance %, CIE % and issue are sent.

## Tests
`cd backend && pytest`

## Layout
- `app/models.py` tables, `schemas.py` validation, `auth.py` JWT + role/ownership checks
- `app/services/` analytics (rule engine), uploads (Pandas), ai, reports (PDF/Excel)
- `app/routers/` REST endpoints, `app/seed.py` dummy data
- `frontend/index.html` no-build UI (Tailwind + Chart.js)
