"""CSV/Excel ingestion with per-row validation (never fails silently)."""
import datetime as dt
import io

import pandas as pd
from fastapi import HTTPException
from sqlalchemy.orm import Session

from ..models import Attendance, Course, Mark, Student

STATUS_MAP = {"present": "Present", "p": "Present", "absent": "Absent", "a": "Absent"}


def read_table(raw: bytes, filename: str) -> pd.DataFrame:
    name = (filename or "").lower()
    try:
        if name.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(raw), dtype=str)
        elif name.endswith(".xlsx"):
            df = pd.read_excel(io.BytesIO(raw), dtype=str)
        else:
            raise HTTPException(400, "Only .csv and .xlsx files are accepted")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(400, "Could not read the file. Check that it is a valid CSV or Excel file.")
    df.columns = [str(c).strip().lower() for c in df.columns]
    return df.dropna(how="all")


def require_columns(df: pd.DataFrame, needed):
    missing = [c for c in needed if c not in df.columns]
    if missing:
        raise HTTPException(400, f"Missing column(s): {', '.join(missing)}. "
                                 f"Expected: {', '.join(needed)}")


def clean(v) -> str:
    return "" if pd.isna(v) else str(v).strip()


def import_students(db: Session, course: Course, df: pd.DataFrame):
    require_columns(df, ["usn", "name"])
    existing = {u.upper() for (u,) in db.query(Student.usn).all()}
    seen, errors, created = set(), [], 0
    for idx, row in df.iterrows():
        n = idx + 2  # spreadsheet row number (header is row 1)
        usn, name = clean(row.get("usn")).upper(), clean(row.get("name"))
        email = clean(row.get("email")) or None
        if not usn or not name:
            errors.append({"row": n, "error": "USN and name are required"})
        elif usn in seen:
            errors.append({"row": n, "error": f"Duplicate USN {usn} in file"})
        elif usn in existing:
            errors.append({"row": n, "error": f"USN {usn} already exists"})
        else:
            seen.add(usn)
            db.add(Student(usn=usn, name=name, email=email, course_id=course.course_id))
            created += 1
    db.commit()
    return {"imported": created, "updated": 0, "errors": errors}


def import_attendance(db: Session, course: Course, df: pd.DataFrame):
    require_columns(df, ["usn", "date", "status"])
    by_usn = {s.usn.upper(): s for s in course.students}
    existing = {(a.student_id, a.date): a for a in
                db.query(Attendance).filter(Attendance.course_id == course.course_id)}
    seen, errors, inserted, updated = set(), [], 0, 0
    today = dt.date.today()
    for idx, row in df.iterrows():
        n = idx + 2
        usn = clean(row.get("usn")).upper()
        status = STATUS_MAP.get(clean(row.get("status")).lower())
        d = pd.to_datetime(clean(row.get("date")), dayfirst=True, errors="coerce")
        if usn not in by_usn:
            errors.append({"row": n, "error": f"USN '{usn}' is not in this course"})
        elif pd.isna(d):
            errors.append({"row": n, "error": "Invalid date"})
        elif d.date() > today:
            errors.append({"row": n, "error": "Date cannot be in the future"})
        elif status is None:
            errors.append({"row": n, "error": "Status must be Present or Absent"})
        elif (usn, d.date()) in seen:
            errors.append({"row": n, "error": f"Duplicate entry for {usn} on {d.date()}"})
        else:
            seen.add((usn, d.date()))
            sid = by_usn[usn].student_id
            rec = existing.get((sid, d.date()))
            if rec:
                rec.status = status
                updated += 1
            else:
                db.add(Attendance(student_id=sid, course_id=course.course_id,
                                  date=d.date(), status=status))
                inserted += 1
    db.commit()
    return {"imported": inserted, "updated": updated, "errors": errors}


def import_marks(db: Session, course: Course, df: pd.DataFrame):
    require_columns(df, ["usn", "assessment", "max_marks", "marks"])
    by_usn = {s.usn.upper(): s for s in course.students}
    existing = {(m.student_id, m.assessment_name): m for m in
                db.query(Mark).filter(Mark.course_id == course.course_id)}
    seen, errors, inserted, updated = set(), [], 0, 0
    for idx, row in df.iterrows():
        n = idx + 2
        usn = clean(row.get("usn")).upper()
        assessment = clean(row.get("assessment"))
        raw_max = clean(row.get("max_marks"))
        raw_marks = clean(row.get("marks"))

        if usn not in by_usn:
            errors.append({"row": n, "error": f"USN '{usn}' is not in this course"})
            continue
        if not assessment:
            errors.append({"row": n, "error": "Assessment name is required"})
            continue

        try:
            max_m = float(raw_max)
            if max_m <= 0:
                raise ValueError
        except (ValueError, TypeError):
            errors.append({"row": n, "error": f"Invalid max_marks '{raw_max}' (must be > 0)"})
            continue

        is_absent = False
        obtained = None
        if raw_marks.upper() in ("AB", "ABSENT", "A"):
            is_absent = True
        else:
            try:
                obtained = float(raw_marks)
                if obtained < 0 or obtained > max_m:
                    errors.append({"row": n, "error": f"Marks {obtained} must be between 0 and {max_m}"})
                    continue
            except (ValueError, TypeError):
                errors.append({"row": n, "error": f"Invalid marks value '{raw_marks}' (must be a number or AB)"})
                continue

        if (usn, assessment) in seen:
            errors.append({"row": n, "error": f"Duplicate entry for {usn} in {assessment}"})
            continue

        seen.add((usn, assessment))
        sid = by_usn[usn].student_id
        rec = existing.get((sid, assessment))
        if rec:
            rec.max_marks = max_m
            rec.marks_obtained = obtained
            rec.is_absent = is_absent
            updated += 1
        else:
            db.add(Mark(student_id=sid, course_id=course.course_id,
                        assessment_name=assessment, max_marks=max_m,
                        marks_obtained=obtained, is_absent=is_absent))
            inserted += 1

    db.commit()
    return {"imported": inserted, "updated": updated, "errors": errors}

