# Antigravity Prompt: Integrate FacultyFlow Frontend with Its FastAPI Backend

## Mission

Work in the existing FacultyFlow repository. The React frontend already exists and is the source of truth for UI behavior and API requests. Inspect it first, then implement or adjust the FastAPI backend so the frontend works end to end.

Do not redesign or replace the frontend. Do not invent a second API contract, seed production with demo data, expose secrets, or deploy/push changes unless the repository owner separately asks. Keep changes small, testable, and local.

## Repository map

```text
facultyflow/
  backend/
    app/
      main.py                   # FastAPI app, /api router prefix, SPA fallback, health
      config.py                 # environment-backed configuration and thresholds
      database.py               # SQLAlchemy engine and request-scoped sessions
      models.py                 # users, courses, students, attendance, marks, advisories
      schemas.py                # Pydantic request validation
      auth.py                   # JWT auth, roles, course ownership checks
      routers/                  # auth_routes, courses, attendance, marks, advisories, reports
      services/                 # analytics, uploads, AI drafts, reports
    tests/test_app.py
    requirements.txt
  frontend-react/
    src/api.js                  # authoritative frontend API paths and request wrapper
    src/App.jsx                 # routes and protected views
    src/context/CourseContext.jsx
    src/pages/                  # Login, Dashboard, Students, Attendance, Marks,
                                # Deficits, Reports, Admin, StudentPortal
  frontend/                     # Vite build output served by FastAPI
antigravity_prompt.md           # this integration prompt
```

## Start by verifying the existing contract

1. Read `frontend-react/src/api.js` and each page that calls an API before changing backend code.
2. The frontend defaults to `VITE_API_BASE=/api`. Every application endpoint listed below is therefore mounted under `/api`; for example, the browser calls `/api/auth/login` and `/api/dashboard`.
3. Keep `/dashboard`, `/attendance`, `/marks`, `/students`, `/reports`, `/admin`, and `/student` available as frontend SPA routes. They are not API endpoints. FastAPI serves the built frontend for browser navigation and refreshes.
4. Preserve current response fields used by components. If a necessary response change is unavoidable, update the frontend and backend together and add a focused test.
5. Inspect current migrations/models and existing tests before modifying tables. Do not assume student USNs are globally unique: the same USN may be enrolled in different courses; uniqueness is `(usn, course_id)`.

## Current frontend API contract

The shared fetch wrapper in `frontend-react/src/api.js` sends JSON with `Content-Type: application/json`, sends uploaded files as `FormData` without manually setting the content type, attaches `Authorization: Bearer <token>`, and redirects to `/login` on `401`. Error responses should use FastAPI's readable `{"detail": "..."}` shape. Keep file responses as downloads with a `Content-Disposition` filename.

| Method | API path (prefix `/api`) | Frontend use |
|---|---|---|
| POST | `/auth/login` | Body `{email, password}`; returns `{token, user:{user_id,name,email,role}}` |
| GET | `/auth/me` | Returns the current user object |
| PUT | `/auth/me` | Updates the current user's name/email and optionally password |
| POST | `/auth/forgot-password` | Body `{email, reason?}`; creates a password-help request for HOD/Admin |
| GET | `/auth/password-requests` | Admin list; each row includes `request_id,email,reason,status,created_at` |
| POST | `/auth/password-requests/{request_id}/resolve` | Admin body `{new_password}` |
| GET / POST | `/users` | Admin list/create; create body `{name,email,password,role}` |
| PUT / DELETE | `/users/{user_id}` | Admin edit/delete user |
| GET / POST | `/courses` | List permitted courses / admin creates `{course_name,course_code,semester,faculty_id}` |
| GET / POST | `/courses/{course_id}/students` | List/add `{usn,name,email?}` within the course |
| PUT / DELETE | `/courses/{course_id}/students/{student_id}` | Edit/remove a student and course-scoped records |
| POST | `/courses/{course_id}/students/upload` | Multipart field `file`; CSV/XLSX student roster |
| GET | `/dashboard` | Returns course rows with course metadata, `student_count`, `critical`, `advisory`, `safe`, `low_cie`, and `flagged` |
| GET | `/courses/{course_id}/attendance?date=YYYY-MM-DD` | Attendance entries for the selected date |
| POST | `/attendance` | `{course_id,date,records:[{student_id,status,reason?}]}` |
| POST | `/attendance/upload?course_id={id}` | Multipart field `file`; CSV/XLSX attendance |
| GET | `/courses/{course_id}/attendance-trend` | `{rows,labels,values}` for the attendance trend chart |
| GET | `/courses/{course_id}/marks` | `{assessments,rows}`; each row has student fields, `cells`, and `cie_pct` |
| POST | `/marks` | `{course_id,assessment_name,max_marks,records:[{student_id,marks_obtained,is_absent}]}` |
| POST | `/marks/upload?course_id={id}` | Multipart field `file`; CSV/XLSX marks |
| GET | `/courses/{course_id}/summary` | Per-student attendance/CIE metrics, status, reasons, priority |
| GET | `/courses/{course_id}/deficits` | Flagged students, ranked by priority |
| POST | `/advisories/draft` | `{student_id,course_id,issue_type}`; creates an unapproved draft |
| POST | `/advisories/{advisory_id}/approve` | `{final_message}`; persists teacher-approved message |
| GET | `/courses/{course_id}/advisories` | Approved advisories for faculty |
| GET | `/student/me` | `{courses:[...]}` for the signed-in student, including approved messages only |
| GET / PUT | `/settings` | Read/update thresholds; see exact frontend field names below |
| GET | `/templates/{students\|attendance\|marks}` | Downloads a CSV template |
| GET | `/reports/{attendance\|cie\|deficit}?course_id={id}&format=pdf\|xlsx&date_from=&date_to=&status=` | Authenticated PDF/XLSX file download |

### Settings field names

The Admin page reads and submits exactly these JSON properties:

```json
{
  "attendance_critical": 75,
  "attendance_advisory": 85,
  "cie_low": 40,
  "cie_drop": 20
}
```

The analytics service may retain its internal names (`critical_below`, `advisory_upto`, `cie_cutoff`, `drop_points`), but the API must translate at the boundary. Preserve compatibility with those internal/legacy names if they are already accepted.

### Upload formats

- Students: `usn,name,email`
- Attendance: `usn,date,status,reason`
- Marks: `usn,assessment,max_marks,marks`; use `AB` for absent.
- Accept `.csv` and `.xlsx`, validate each row, and return `{imported,updated,errors:[{row,error}]}`. Reject unsupported formats and oversized inputs explicitly.
- Attendance accepts Present/Absent (and documented short aliases in upload parsing), disallows future dates, and retains absence reasons.
- Marks must be between zero and the row's maximum. An absent score is stored as absent, not as zero.

## Authorization and data rules

- The API uses a JWT in the `Authorization` header. Login returns a token and a safe user object; never return a password hash.
- Enforce roles and course ownership on every protected API request. `faculty` can access only their own courses; `admin` can access department courses and admin functions; `student` can access only `/student/me`.
- Link student accounts to course roster entries by email. A student response must never include another student's records or an unapproved advisory.
- Admin functions include user/course management, settings, and password-help resolution. Faculty can manage their permitted course rosters, attendance, marks, advisories and reports.
- Keep each data operation scoped to `course_id`; never use a global-USN lookup when course context is available.
- Do not enable destructive demo seeding in production. Keep secrets in environment variables; never write credentials into code, docs, logs, or test output.

## Academic rules already represented by the app

- Attendance percent is attended classes divided by recorded classes. No records means `null`/No Data, not 0%.
- Default attendance categories: below 75% Critical, 75–85% inclusive Advisory, above 85% Safe.
- Low CIE is below 40%; a consecutive assessment drop greater than 20 points is a warning.
- Thresholds are adjustable by an admin and must immediately affect analytics.
- Attendance is unique per student, course and date. Marks are unique per student, course and assessment.
- AI output is a draft only. A faculty member must review and approve the final message before it appears in the student portal.
- Minimize data sent to AI providers; never send student email or USN. Set strict HTTP timeouts and use a safe template fallback.

## Implementation and verification workflow

1. Inspect the current backend routes, models, schemas, services, config and tests. Identify real mismatches against the API calls in `frontend-react/src/api.js`; do not recreate working routes.
2. Implement the smallest backend changes that make the real UI work. Add/adjust frontend code only when the request/response contract itself must change.
3. Add focused API tests for each changed behavior, especially request/response shapes, authorization, validation and the settings/UI contract.
4. From `facultyflow/backend`, run:

   ```powershell
   python -m pytest -q
   ```

5. From `facultyflow/frontend-react`, run:

   ```powershell
   npm run build
   ```

6. If routes or bundled UI were changed, verify that `/dashboard` returns the frontend HTML on browser navigation and `/api/dashboard` remains an authenticated JSON API.
7. Summarize changed files, behavior, and test/build results. Do not push commits, modify hosted production data, or deploy unless explicitly authorized.

## Definition of done

- The existing React app can sign in and refresh protected SPA routes without confusing frontend routes with API routes.
- The dashboard, course selector, course roster CRUD, attendance/reasons, marks, deficits/trend, advisory approval, student portal, reports, templates, Admin user/course controls, password-help queue, and thresholds all exchange the shapes expected by the current UI.
- Role checks and course ownership are enforced server-side.
- New or fixed behavior has focused passing tests, and the frontend production build succeeds when relevant.
