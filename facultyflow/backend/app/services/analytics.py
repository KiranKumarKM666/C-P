"""Attendance %, CIE %, rule engine and deficit detection."""
from collections import defaultdict

from sqlalchemy import case, func
from sqlalchemy.orm import Session

from ..config import SETTINGS
from ..models import Attendance, Mark, Student


def attendance_pct(attended: int, total: int):
    """Attendance % = attended / total * 100. None when no classes held."""
    if not total:
        return None
    return round(100.0 * attended / total, 2)


def classify(pct):
    """Rule engine: explicit if-then thresholds (configurable)."""
    if pct is None:
        return "No Data"
    if pct < SETTINGS["critical_below"]:
        return "Critical"
    if pct <= SETTINGS["advisory_upto"]:
        return "Advisory"
    return "Safe"


def cie_pct(obtained: float, maximum: float):
    if not maximum or maximum <= 0:
        return None
    return round(100.0 * obtained / maximum, 2)


def fmt(p):
    return "N/A" if p is None else f"{p:g}"


def attendance_stats(db: Session, course_id: int, date_from=None, date_to=None):
    q = db.query(
        Attendance.student_id,
        func.count(Attendance.attendance_id),
        func.sum(case((Attendance.status == "Present", 1), else_=0)),
    ).filter(Attendance.course_id == course_id)
    if date_from:
        q = q.filter(Attendance.date >= date_from)
    if date_to:
        q = q.filter(Attendance.date <= date_to)
    q = q.group_by(Attendance.student_id)
    return {sid: (int(att or 0), int(total)) for sid, total, att in q.all()}


def course_summary(db: Session, course_id: int, date_from=None, date_to=None):
    """One row per student with attendance, CIE, flags, reasons and priority."""
    students = (db.query(Student).filter(Student.course_id == course_id)
                .order_by(Student.usn).all())
    att = attendance_stats(db, course_id, date_from, date_to)
    marks = defaultdict(list)
    for m in (db.query(Mark).filter(Mark.course_id == course_id)
              .order_by(Mark.mark_id).all()):
        marks[m.student_id].append(m)

    rows = []
    for s in students:
        attended, total = att.get(s.student_id, (0, 0))
        pct = attendance_pct(attended, total)
        status = classify(pct)

        scored = [m for m in marks.get(s.student_id, []) if not m.is_absent]
        cpct = cie_pct(sum(m.marks_obtained for m in scored),
                       sum(m.max_marks for m in scored)) if scored else None
        per = [100.0 * m.marks_obtained / m.max_marks for m in scored]
        names = [m.assessment_name for m in scored]

        reasons, score = [], 0
        att_flag = status in ("Critical", "Advisory")
        if status == "Critical":
            reasons.append(f"Attendance {fmt(pct)}% is below {SETTINGS['critical_below']:g}% (Critical)")
            score += 3
        elif status == "Advisory":
            reasons.append(f"Attendance {fmt(pct)}% is in the advisory band")
            score += 1

        marks_flag = False
        if cpct is not None and cpct < SETTINGS["cie_cutoff"]:
            reasons.append(f"CIE {fmt(cpct)}% is below the {SETTINGS['cie_cutoff']:g}% cutoff")
            score += 2
            marks_flag = True
        for i in range(len(per) - 1):
            fall = per[i] - per[i + 1]
            if fall > SETTINGS["drop_points"]:
                reasons.append(f"Dropped {fall:.0f} points from {names[i]} to {names[i + 1]}")
                score += 2
                marks_flag = True
                break

        if att_flag and marks_flag:
            priority = "High"
            score += 10
        elif status == "Critical" or marks_flag:
            priority = "Medium"
        elif att_flag:
            priority = "Low"
        else:
            priority = "None"

        rows.append({
            "student_id": s.student_id, "usn": s.usn, "name": s.name, "email": s.email,
            "attended": attended, "total_classes": total,
            "attendance_pct": pct, "attendance_status": status,
            "cie_pct": cpct, "assessments": len(scored),
            "reasons": reasons, "priority": priority, "_score": score,
        })
    return rows


def detect_deficits(db: Session, course_id: int):
    """Students needing attention, highest priority first."""
    rows = [r for r in course_summary(db, course_id) if r["reasons"]]
    rows.sort(key=lambda r: (-r["_score"],
                             r["attendance_pct"] if r["attendance_pct"] is not None else 101))
    for r in rows:
        r.pop("_score", None)
    return rows


def strip_internal(rows):
    for r in rows:
        r.pop("_score", None)
    return rows
