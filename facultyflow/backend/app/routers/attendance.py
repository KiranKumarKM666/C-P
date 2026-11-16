import datetime as dt

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from ..auth import get_course_for_user, require_role
from ..database import get_db
from ..models import Attendance, Student, User
from ..schemas import AttendanceIn
from ..services import uploads

router = APIRouter(tags=["attendance"])
STAFF = ("faculty", "admin")


@router.post("/attendance")
def save_attendance(body: AttendanceIn, db: Session = Depends(get_db),
                    user: User = Depends(require_role(*STAFF))):
    get_course_for_user(db, user, body.course_id)
    valid = {s for (s,) in db.query(Student.student_id).filter(Student.course_id == body.course_id)}
    ids = [r.student_id for r in body.records]
    if len(set(ids)) != len(ids):
        raise HTTPException(400, "A student appears more than once")
    bad = [i for i in ids if i not in valid]
    if bad:
        raise HTTPException(400, f"Student(s) {bad} are not in this course")
    existing = {a.student_id: a for a in db.query(Attendance).filter(
        Attendance.course_id == body.course_id, Attendance.date == body.date)}
    for r in body.records:
        if r.student_id in existing:
            existing[r.student_id].status = r.status
        else:
            db.add(Attendance(student_id=r.student_id, course_id=body.course_id,
                              date=body.date, status=r.status))
    db.commit()
    return {"saved": len(body.records), "date": body.date.isoformat()}


@router.get("/courses/{course_id}/attendance")
def attendance_for_date(course_id: int, date: dt.date, db: Session = Depends(get_db),
                        user: User = Depends(require_role(*STAFF))):
    get_course_for_user(db, user, course_id)
    rows = db.query(Attendance).filter(Attendance.course_id == course_id,
                                       Attendance.date == date).all()
    return [{"student_id": a.student_id, "status": a.status} for a in rows]


@router.get("/courses/{course_id}/attendance-trend")
def attendance_trend(course_id: int, db: Session = Depends(get_db),
                     user: User = Depends(require_role(*STAFF))):
    get_course_for_user(db, user, course_id)
    records = (db.query(Attendance.date,
                        func.count(Attendance.attendance_id),
                        func.sum(case((Attendance.status == "Present", 1), else_=0)))
               .filter(Attendance.course_id == course_id)
               .group_by(Attendance.date)
               .order_by(Attendance.date.asc()).all())
    return [{"date": str(d), "total": int(tot), "present": int(att or 0),
             "percentage": round((att or 0) / tot * 100, 1) if tot else 0.0}
            for d, tot, att in records]



@router.post("/attendance/upload")
def upload_attendance(course_id: int, file: UploadFile = File(...), db: Session = Depends(get_db),
                      user: User = Depends(require_role(*STAFF))):
    course = get_course_for_user(db, user, course_id)
    df = uploads.read_table(file.file.read(), file.filename)
    return uploads.import_attendance(db, course, df)
