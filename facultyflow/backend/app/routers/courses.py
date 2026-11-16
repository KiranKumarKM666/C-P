from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile
from sqlalchemy.orm import Session

from ..auth import get_course_for_user, require_role
from ..database import get_db
from ..models import Advisory, Attendance, Course, Mark, Student, User
from ..schemas import CourseCreate, StudentCreate
from ..services import uploads
from ..services.analytics import course_summary, detect_deficits, strip_internal

router = APIRouter(tags=["courses"])
STAFF = ("faculty", "admin")


def course_dict(c: Course, db: Session):
    return {"course_id": c.course_id, "course_name": c.course_name,
            "course_code": c.course_code, "semester": c.semester,
            "faculty_id": c.faculty_id, "faculty_name": c.faculty.name,
            "student_count": db.query(Student).filter(Student.course_id == c.course_id).count()}


@router.get("/courses")
def list_courses(db: Session = Depends(get_db), user: User = Depends(require_role(*STAFF))):
    q = db.query(Course)
    if user.role == "faculty":
        q = q.filter(Course.faculty_id == user.user_id)
    return [course_dict(c, db) for c in q.order_by(Course.course_code)]


@router.post("/courses", status_code=201)
def create_course(body: CourseCreate, db: Session = Depends(get_db),
                  _: User = Depends(require_role("admin"))):
    teacher = db.get(User, body.faculty_id)
    if not teacher or teacher.role not in STAFF:
        raise HTTPException(400, "Choose a valid faculty member")
    if db.query(Course).filter(Course.course_code == body.course_code.strip()).first():
        raise HTTPException(409, "Course code already exists")
    c = Course(course_name=body.course_name.strip(), course_code=body.course_code.strip(),
               semester=body.semester, faculty_id=body.faculty_id)
    db.add(c)
    db.commit()
    return course_dict(c, db)


@router.get("/courses/{course_id}/students")
def list_students(course_id: int, db: Session = Depends(get_db),
                  user: User = Depends(require_role(*STAFF))):
    get_course_for_user(db, user, course_id)
    rows = db.query(Student).filter(Student.course_id == course_id).order_by(Student.usn).all()
    return [{"student_id": s.student_id, "usn": s.usn, "name": s.name, "email": s.email}
            for s in rows]


@router.post("/courses/{course_id}/students", status_code=201)
def add_student(course_id: int, body: StudentCreate, db: Session = Depends(get_db),
                user: User = Depends(require_role(*STAFF))):
    get_course_for_user(db, user, course_id)
    usn = body.usn.strip().upper()
    if db.query(Student).filter(Student.usn == usn).first():
        raise HTTPException(409, f"USN {usn} already exists")
    s = Student(usn=usn, name=body.name.strip(), email=(body.email or None), course_id=course_id)
    db.add(s)
    db.commit()
    return {"student_id": s.student_id, "usn": s.usn, "name": s.name}


@router.delete("/courses/{course_id}/students/{student_id}")
def delete_student(course_id: int, student_id: int, db: Session = Depends(get_db),
                   user: User = Depends(require_role(*STAFF))):
    get_course_for_user(db, user, course_id)
    s = db.get(Student, student_id)
    if not s or s.course_id != course_id:
        raise HTTPException(404, "Student not found in this course")
    for model in (Attendance, Mark, Advisory):
        db.query(model).filter(model.student_id == student_id).delete()
    db.delete(s)
    db.commit()
    return {"deleted": student_id}


@router.post("/courses/{course_id}/students/upload")
def upload_students(course_id: int, file: UploadFile = File(...), db: Session = Depends(get_db),
                    user: User = Depends(require_role(*STAFF))):
    course = get_course_for_user(db, user, course_id)
    df = uploads.read_table(file.file.read(), file.filename)
    return uploads.import_students(db, course, df)


@router.get("/courses/{course_id}/summary")
def summary(course_id: int, db: Session = Depends(get_db),
            user: User = Depends(require_role(*STAFF))):
    get_course_for_user(db, user, course_id)
    return strip_internal(course_summary(db, course_id))


@router.get("/courses/{course_id}/deficits")
def deficits(course_id: int, db: Session = Depends(get_db),
             user: User = Depends(require_role(*STAFF))):
    get_course_for_user(db, user, course_id)
    return detect_deficits(db, course_id)


@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db), user: User = Depends(require_role(*STAFF))):
    q = db.query(Course)
    if user.role == "faculty":
        q = q.filter(Course.faculty_id == user.user_id)
    out = []
    for c in q.order_by(Course.course_code):
        rows = course_summary(db, c.course_id)
        out.append({**course_dict(c, db),
                    "critical": sum(r["attendance_status"] == "Critical" for r in rows),
                    "advisory": sum(r["attendance_status"] == "Advisory" for r in rows),
                    "safe": sum(r["attendance_status"] == "Safe" for r in rows),
                    "low_cie": sum(any("CIE" in x and "cutoff" in x for x in r["reasons"])
                                   for r in rows),
                    "flagged": sum(bool(r["reasons"]) for r in rows)})
    return out


TEMPLATES = {
    "students": "usn,name,email\n1XX23CS001,Asha Rao,asha@example.com\n",
    "attendance": "usn,date,status\n1XX23CS001,2026-11-10,Present\n1XX23CS002,2026-11-10,Absent\n",
    "marks": "usn,assessment,max_marks,marks\n1XX23CS001,Test 1,25,22.5\n1XX23CS002,Test 1,25,AB\n",
}


@router.get("/templates/{kind}")
def template(kind: str):
    if kind not in TEMPLATES:
        raise HTTPException(404, "Unknown template")
    return Response(TEMPLATES[kind], media_type="text/csv",
                    headers={"Content-Disposition": f"attachment; filename={kind}_template.csv"})
