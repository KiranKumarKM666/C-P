from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from ..auth import get_course_for_user, require_role
from ..database import get_db
from ..models import Mark, Student, User
from ..schemas import MarksIn
from ..services import uploads
from ..services.analytics import cie_pct

router = APIRouter(tags=["marks"])
STAFF = ("faculty", "admin")


@router.post("/marks")
def save_marks(body: MarksIn, db: Session = Depends(get_db),
               user: User = Depends(require_role(*STAFF))):
    get_course_for_user(db, user, body.course_id)
    valid = {s for (s,) in db.query(Student.student_id).filter(Student.course_id == body.course_id)}
    ids = [r.student_id for r in body.records]
    bad = [i for i in ids if i not in valid]
    if bad:
        raise HTTPException(400, f"Student(s) {bad} are not in this course")
    top_name = (body.assessment_name or "").strip()
    saved = 0
    for r in body.records:
        name = (r.assessment_name or top_name or "").strip()
        if not name:
            raise HTTPException(400, "assessment_name is required")
        eff_max = r.max_marks or body.max_marks
        if not eff_max or eff_max <= 0:
            raise HTTPException(400, "max_marks must be > 0")
        is_absent = r.eff_absent
        obtained = None if is_absent else r.marks_obtained
        existing = db.query(Mark).filter(
            Mark.course_id == body.course_id,
            Mark.student_id == r.student_id,
            Mark.assessment_name == name,
        ).first()
        if existing:
            existing.max_marks = eff_max
            existing.marks_obtained = obtained
            existing.is_absent = is_absent
        else:
            db.add(Mark(student_id=r.student_id, course_id=body.course_id,
                        assessment_name=name, max_marks=eff_max,
                        marks_obtained=obtained, is_absent=is_absent))
        saved += 1
    db.commit()
    return {"saved": saved, "assessment": top_name or "mixed"}


@router.get("/courses/{course_id}/marks")
def marks_table(course_id: int, db: Session = Depends(get_db),
                user: User = Depends(require_role(*STAFF))):
    get_course_for_user(db, user, course_id)
    marks = db.query(Mark).filter(Mark.course_id == course_id).order_by(Mark.mark_id).all()
    assessments = []
    for m in marks:
        if m.assessment_name not in assessments:
            assessments.append(m.assessment_name)
    by = {}
    for m in marks:
        by.setdefault(m.student_id, {})[m.assessment_name] = m
    rows = []
    for s in db.query(Student).filter(Student.course_id == course_id).order_by(Student.usn):
        mine = by.get(s.student_id, {})
        scored = [m for m in mine.values() if not m.is_absent]
        rows.append({
            "student_id": s.student_id, "usn": s.usn, "name": s.name,
            "cells": {n: (None if n not in mine else "AB" if mine[n].is_absent
                          else f"{mine[n].marks_obtained:g}/{mine[n].max_marks:g}")
                      for n in assessments},
            "cie_pct": cie_pct(sum(m.marks_obtained for m in scored),
                               sum(m.max_marks for m in scored)) if scored else None,
        })
    return {"assessments": assessments, "rows": rows}


@router.post("/marks/upload")
def upload_marks(course_id: int, file: UploadFile = File(...), db: Session = Depends(get_db),
                 user: User = Depends(require_role(*STAFF))):
    course = get_course_for_user(db, user, course_id)
    df = uploads.read_table(file.file.read(), file.filename)
    return uploads.import_marks(db, course, df)

