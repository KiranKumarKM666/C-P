# FacultyFlow: Build and Integration Prompt for Antigravity

## 1. Role and goal

You are a senior full-stack engineer. Build and wire together **FacultyFlow**, a role-based web platform that helps college teachers manage attendance and internal marks (CIE), find at-risk students early, draft AI-assisted advisory messages, and generate PDF/Excel reports.

**Guiding principle: AI only drafts; the teacher always decides.** No advisory message is saved as final or sent until a faculty member has read, edited and clicked **Approve**.

Work in small, verifiable steps. After each phase, run the app or the tests and confirm it works before moving on. Use only dummy student data.

## 2. Starting point

A working starter project exists in `facultyflow/` (unzip `facultyflow.zip` into the workspace). **Extend it. Do not rewrite it from scratch.**

```
facultyflow/
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI app, CORS, serves ../frontend
│   │   ├── config.py          # env vars, thresholds (SETTINGS dict)
│   │   ├── database.py        # SQLAlchemy engine/session
│   │   ├── models.py          # users, courses, students, attendance, marks, advisories
│   │   ├── schemas.py         # Pydantic validation
│   │   ├── auth.py            # bcrypt, JWT, require_role, ownership check
│   │   ├── seed.py            # dummy data + demo logins
│   │   ├── services/          # analytics, uploads, ai, reports
│   │   └── routers/           # auth_routes, courses, attendance, marks, advisories, reports
│   ├── tests/test_app.py
│   ├── requirements.txt
│   └── .env.example
└── frontend/index.html        # no-build UI: Tailwind CDN + Chart.js + vanilla JS
```

First task: install dependencies, run `python -m app.seed`, run `pytest`, start `uvicorn app.main:app --reload`, and confirm http://localhost:8000 loads and the demo logins work.

## 3. Tech stack

| Layer | Tools |
|---|---|
| Front end | HTML, CSS, JavaScript, Tailwind CSS, Chart.js (optional upgrade to React, see Phase 6) |
| Back end | Python, FastAPI, Uvicorn, SQLAlchemy |
| Auth | JWT (PyJWT), bcrypt password hashes |
| Files | Pandas, openpyxl |
| Database | SQLite for development, PostgreSQL for deployment |
| AI | Gemini, OpenAI or Ollama (local), behind one `generate_draft()` function |
| Reports | ReportLab (PDF), openpyxl (Excel) |
| Tests | pytest, FastAPI TestClient |

## 4. Users and roles

| Role | Can do |
|---|---|
| `faculty` | Manage only their own courses: attendance, marks, deficit list, draft and approve advisories, download reports |
| `admin` (HOD) | Everything faculty can do for all courses, plus create users and courses, change thresholds, department dashboard |
| `student` | View only their own attendance, CIE and **approved** advisories |

Roles and course ownership are checked **on the server for every request**, not just by hiding buttons.

## 5. Business rules (do not change without asking)

- Attendance % = attended ÷ classes held × 100. Zero classes means "No Data".
- **Below 75%** is Critical. **75% to 85% inclusive** is Advisory. **Above 85%** is Safe.
- Low CIE: CIE % below **40%**. Sudden drop: a fall of more than **20 points** between consecutive assessments.
- All four thresholds live in `config.SETTINGS` and are editable by the admin through `PUT /settings`.
- Students flagged on both attendance and marks are ranked highest priority. Every flag shows its reason.
- Marks must be between 0 and the maximum. Maximum must be greater than 0. One entry per student per assessment. Absent is stored as AB, never as zero.
- Attendance status must be Present or Absent. Dates cannot be in the future. One row per student, course and date.

## 6. Database schema

`users(user_id, name, email unique, password_hash, role)`
`courses(course_id, course_name, course_code unique, semester, faculty_id → users)`
`students(student_id, usn unique, name, email, course_id → courses)`
`attendance(attendance_id, student_id, course_id, date, status)` with a unique constraint on `(student_id, course_id, date)`
`marks(mark_id, student_id, course_id, assessment_name, max_marks, marks_obtained, is_absent)` with a unique constraint on `(student_id, course_id, assessment_name)`
`advisories(advisory_id, student_id, course_id, issue_type, ai_draft, final_message, faculty_approved, created_at, approved_at)`

Keep `ai_draft` and `final_message` as separate columns. This is the audit trail. Add indexes on `student_id` and `course_id`.

## 7. API contract (front end and back end must agree on this)

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/auth/login` | Returns `{token, user}` |
| GET | `/auth/me` | Current user |
| GET / POST | `/users` | Admin: list and create users |
| GET / POST | `/courses` | List own courses (admin: all); admin creates |
| GET / POST | `/courses/{id}/students` | List and add students |
| DELETE | `/courses/{id}/students/{sid}` | Remove student and their records |
| POST | `/courses/{id}/students/upload` | CSV/XLSX class list |
| POST | `/attendance` | Save attendance for a date |
| GET | `/courses/{id}/attendance?date=` | Prefill the attendance screen |
| POST | `/attendance/upload?course_id=` | CSV/XLSX bulk attendance |
| POST | `/marks` | Save marks for one assessment |
| GET | `/courses/{id}/marks` | Marks table across assessments |
| GET | `/courses/{id}/summary` | Per-student attendance %, CIE %, status |
| GET | `/courses/{id}/deficits` | Students needing attention, ranked |
| POST | `/advisories/draft` | Create an AI draft (not final) |
| POST | `/advisories/{id}/approve` | Save the approved final message |
| GET | `/courses/{id}/advisories` | Approved messages only |
| GET | `/reports/{attendance\|cie\|deficit}?course_id=&format=pdf\|xlsx&date_from=&date_to=&status=` | File download |
| GET | `/student/me` | Student's own records and approved advisories |
| GET / PUT | `/settings` | Read thresholds; admin updates |
| GET | `/dashboard` | Per-course counts of Critical, Advisory, low CIE |
| GET | `/templates/{students\|attendance}` | CSV templates |

Errors use `{"detail": "..."}`. Validation errors from Pydantic return 422 with a list in `detail`. The front end must turn both into readable messages such as "Marks cannot exceed 25".

## 8. How the pieces integrate

### 8.1 Front end to back end
- The back end serves `frontend/` as static files at `/`, so the UI and API share one origin (no CORS problems in development). CORS is still enabled for a separately hosted front end.
- After login, store the JWT in `sessionStorage` and send `Authorization: Bearer <token>` on every request. On a 401, clear the session and return to the login screen.
- One shared `api()` helper handles headers, JSON, error formatting and file downloads. Do not scatter `fetch` calls with their own error handling.
- File uploads use `FormData` (do not set `Content-Type` manually). Show the returned `{imported, updated, errors[]}` with the row number and reason for each rejected row.
- Report downloads: `fetch` with the token, read the response as a `Blob`, then trigger a download through a temporary `<a>` element. A plain link will not send the token.

### 8.2 Authentication and authorization
- `POST /auth/login` verifies the bcrypt hash and returns a signed JWT (`sub` = user id, `role`, `exp`).
- `require_role(...)` is a FastAPI dependency on every protected route.
- `get_course_for_user()` enforces ownership: faculty requesting another faculty's course get **403 "Access denied"**.
- Students are linked to their records by matching `users.email` to `students.email`.

### 8.3 Data ingestion (Pandas)
- Accept `.csv` and `.xlsx` only. Normalize column names to lowercase.
- Validate **each row** and collect `{row, error}` entries. Import the valid rows and report the rest. Never fail silently.
- Detect duplicates inside the file with a set, and against the database with a dict lookup.
- Provide downloadable templates for the students and attendance files.

### 8.4 AI drafting
- `services/ai.py` exposes `generate_draft(name, course, attendance, cie, issue_type)`. The provider is chosen by `AI_PROVIDER` in `.env`: `mock` (default, no key), `gemini`, `openai` or `ollama`.
- **Data minimization.** Send only: first name, course name, attendance %, CIE %, and issue. Never send email, USN or unrelated records.
- Use this prompt template:

```text
You are an academic support assistant for a college.
Write a polite, confidential, motivating message to a student.
Student name: {name}
Course: {course}
Attendance percentage: {attendance}
CIE percentage: {cie}
Issue: {attendance shortage / low internal marks}
Rules:
- Do not blame the student.
- Be respectful and specific.
- Suggest practical next steps.
- Keep it under 120 words.
- Do not invent marks or attendance data.
```

- Use timeouts. If the provider fails, fall back to the built-in template draft and say so in the response (`provider` field).
- After generating, run `check_draft()`: warn if the draft is over 120 words or quotes a percentage that does not match the dashboard.
- Flow: faculty click **Draft message** → `POST /advisories/draft` (stores `ai_draft`, `faculty_approved = false`) → UI shows an **editable** text box next to the dashboard numbers → faculty click **Approve** → `POST /advisories/{id}/approve` stores `final_message`. Students never see unapproved drafts.
- API keys live only in environment variables. The browser never calls an AI service directly.

### 8.5 Reports
- Three reports: class-wise attendance, CIE performance, deficit/follow-up. Each is available as PDF and Excel.
- Filters: course, date range, attendance status. Each report includes course, faculty, generation date, a summary and the table.
- PDF totals must match the dashboard exactly.

## 9. Build phases

Complete and verify one phase before starting the next.

1. **Run and verify the starter.** Install, seed, test, start. Fix anything broken. Confirm all three demo logins work.
2. **Harden the back end.** Add Alembic migrations, structured error handling, request logging that never logs passwords, a rate limit on `/auth/login`, and a `/health` endpoint. Keep SQLite in development.
3. **Polish the front end.** Add loading states, empty states, inline validation messages, a confirm dialog on destructive actions, keyboard-accessible controls, and a layout that works on a phone. Add a trend chart (attendance over time) on the deficits screen.
4. **Marks upload.** Add `POST /marks/upload` (columns: usn, assessment, max_marks, marks, with AB for absent), using the same row-by-row validation pattern as attendance.
5. **AI providers.** Test each of `gemini`, `openai` and `ollama` against the same interface. Add a test that mocks the HTTP call and checks the fallback path.
6. **Optional: React front end.** Rebuild `frontend/` as a Vite + React + Tailwind app that talks to the **same API contract**. One component per screen: Login, Dashboard, Students, Attendance, Marks, Deficits (with the advisory review modal), Reports, Admin, StudentPortal. Keep one `api.js` module. Do not change any endpoint.
7. **Deploy.** Switch `DATABASE_URL` to PostgreSQL, add a `Dockerfile`, serve over HTTPS, set a long random `SECRET_KEY`, restrict CORS to the real front-end origin, and deploy to Render or Railway.

## 10. Security and privacy checklist

- Passwords are hashed with bcrypt, never stored or logged in plain text.
- HTTPS in deployment. Secrets in environment variables, never committed. `.env` is in `.gitignore`.
- Every request is role-checked on the server.
- The AI sees only the minimum data. Offer Ollama for colleges that do not want student data to leave their network.
- Real student data is never used in development or tests.

## 11. Tests that must pass

| Area | Cases |
|---|---|
| Validation | Marks of -5; 105 out of 100; text instead of a number; empty fields; future attendance date; invalid status |
| Calculations | Exactly 75% and exactly 85%; a student with zero classes; 42 of 50 equals 84% |
| Access control | Faculty A opening Faculty B's course returns 403; no token returns 401; a student calling faculty endpoints returns 403 |
| Upload | Wrong columns; blank rows; duplicate USNs; unknown USN; non-CSV/XLSX file |
| AI | Draft is under 120 words; numbers match the dashboard; a draft cannot reach a student without approval |
| Reports | PDF totals equal dashboard totals; Excel opens correctly |

Run `pytest` after every phase. Add tests for new features in `backend/tests/`.

## 12. Definition of done

The following demo runs end to end without errors:

1. Log in as faculty and open a course.
2. Upload an attendance sheet (or mark attendance) and see the percentages update.
3. Open the deficit list and see Critical and Advisory flags with reasons.
4. Select a student, generate an AI draft, edit it, and click **Approve**.
5. Log in as that student and see only the approved message.
6. Download the PDF and Excel reports and check the totals against the dashboard.
7. Log in as admin, change a threshold, and see the flags change.

## 13. Working rules for the agent

- Extend the existing code. Do not rename endpoints or tables without asking.
- Keep functions small. Put business rules in `services/`, not in routers.
- Explain each change in a short summary and list the files touched.
- If a requirement is unclear, ask one focused question instead of guessing.
- Finish by updating `README.md` with setup, `.env` variables, demo logins and how to run the tests.
