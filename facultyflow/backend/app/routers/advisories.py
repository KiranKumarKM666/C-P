from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import get_course_for_user, get_current_user, require_role
from ..database import get_db
from ..models import Advisory, Course, Student, User
from ..schemas import ApproveIn, DraftIn
from ..services import ai
from ..services.analytics import course_summary, strip_internal

router = APIRouter(tags=["advisories"])
STAFF = ("faculty", "admin")


@router.post("/advisories/draft", status_code=201)
def draft(body: DraftIn, db: Session = Depends(get_db),
          user: User = Depends(require_role(*STAFF))):
    course = get_course_for_user(db, user, body.course_id)
    student = db.get(Student, body.student_id)
    if not student or student.course_id != course.course_id:
        raise HTTPException(404, "Student not found in this course")
    row = next(r for r in course_summary(db, course.course_id)
               if r["student_id"] == student.student_id)
    result = ai.generate_draft(student.name, course.course_name,
                               row["attendance_pct"], row["cie_pct"], body.issue_type)
    adv = Advisory(student_id=student.student_id, course_id=course.course_id,
                   issue_type=body.issue_type, ai_draft=result["draft"])
    db.add(adv)
    db.commit()
    return {"advisory_id": adv.advisory_id, "ai_draft": result["draft"],
            "draft": result["draft"],
            "provider": result["provider"], "warnings": result["warnings"],
            "attendance_pct": row["attendance_pct"], "cie_pct": row["cie_pct"]}


@router.post("/advisories/{advisory_id}/approve")
def approve(advisory_id: int, body: ApproveIn, db: Session = Depends(get_db),
            user: User = Depends(require_role(*STAFF))):
    adv = db.get(Advisory, advisory_id)
    if not adv:
        raise HTTPException(404, "Advisory not found")
    get_course_for_user(db, user, adv.course_id)
    if not body.final_message.strip():
        raise HTTPException(400, "Message cannot be empty")
    adv.final_message = body.final_message.strip()   # AI draft kept separately (audit trail)
    adv.faculty_approved = True
    adv.approved_at = datetime.now(timezone.utc)
    db.commit()
    return {"advisory_id": adv.advisory_id, "approved": True}


@router.get("/courses/{course_id}/advisories")
def list_advisories(course_id: int, db: Session = Depends(get_db),
                    user: User = Depends(require_role(*STAFF))):
    get_course_for_user(db, user, course_id)
    rows = (db.query(Advisory, Student).join(Student, Student.student_id == Advisory.student_id)
            .filter(Advisory.course_id == course_id, Advisory.faculty_approved.is_(True))
            .order_by(Advisory.approved_at.desc()).all())
    return [{"advisory_id": a.advisory_id, "student": s.name, "usn": s.usn,
             "issue_type": a.issue_type, "final_message": a.final_message,
             "approved_at": a.approved_at.isoformat() if a.approved_at else None}
            for a, s in rows]


@router.get("/student/me")
def my_records(db: Session = Depends(get_db), user: User = Depends(require_role("student"))):
    """Students see only their own record and only approved advisories."""
    out = []
    for s in db.query(Student).filter(Student.email == user.email).all():
        summary_rows = strip_internal(course_summary(db, s.course_id))
        row = next((r for r in summary_rows if r["student_id"] == s.student_id), None)
        if not row:
            continue
        course = db.get(Course, s.course_id)
        advs = (db.query(Advisory).filter(Advisory.student_id == s.student_id,
                                          Advisory.faculty_approved.is_(True)).all())
        # Build CIE score details for the bar chart
        from ..models import Mark
        marks = db.query(Mark).filter(
            Mark.student_id == s.student_id,
            Mark.is_absent.is_(False),
        ).order_by(Mark.mark_id).all()
        cie_scores = []
        for m in marks:
            if m.marks_obtained is not None and m.max_marks:
                cie_scores.append({
                    "assessment_name": m.assessment_name,
                    "marks_obtained": m.marks_obtained,
                    "max_marks": m.max_marks,
                    "pct": round(m.marks_obtained / m.max_marks * 100, 1),
                })
        out.append({
            "course_id": course.course_id,
            "course_name": course.course_name,
            "course_code": course.course_code,
            "semester": course.semester,
            "attendance_pct": row["attendance_pct"],
            "attendance_status": row["attendance_status"],
            "attended": row["attended"],
            "total_classes": row["total_classes"],
            "cie_pct": row["cie_pct"],
            "cie_scores": cie_scores,
            "advisories": [
                {
                    "advisory_id": a.advisory_id,
                    "final_message": a.final_message,
                    "approved_at": a.approved_at.isoformat() if a.approved_at else None,
                }
                for a in advs
            ],
        })
    # Return in a wrapper the React StudentPortal expects: { courses: [...] }
    return {"courses": out}
