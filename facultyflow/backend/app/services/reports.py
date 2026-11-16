"""PDF (ReportLab) and Excel (openpyxl) report generation."""
import io
from datetime import date

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from ..models import Course, Mark
from .analytics import course_summary, fmt


def build_report(db, course: Course, kind: str, date_from=None, date_to=None, status=None):
    rows = course_summary(db, course.course_id, date_from, date_to)
    if kind == "attendance":
        if status:
            rows = [r for r in rows if r["attendance_status"].lower() == status.lower()]
        title = "Class-wise Attendance Report"
        headers = ["USN", "Name", "Attended", "Total", "Attendance %", "Status"]
        body = [[r["usn"], r["name"], r["attended"], r["total_classes"],
                 fmt(r["attendance_pct"]), r["attendance_status"]] for r in rows]
    elif kind == "cie":
        names = []
        for m in db.query(Mark).filter(Mark.course_id == course.course_id).order_by(Mark.mark_id):
            if m.assessment_name not in names:
                names.append(m.assessment_name)
        by = {}
        for m in db.query(Mark).filter(Mark.course_id == course.course_id):
            by[(m.student_id, m.assessment_name)] = m
        title = "CIE Performance Report"
        headers = ["USN", "Name"] + names + ["CIE %"]
        body = []
        for r in rows:
            cells = []
            for n in names:
                m = by.get((r["student_id"], n))
                cells.append("-" if m is None else "AB" if m.is_absent
                             else f"{m.marks_obtained:g}/{m.max_marks:g}")
            body.append([r["usn"], r["name"]] + cells + [fmt(r["cie_pct"])])
    elif kind == "deficit":
        flagged = [r for r in rows if r["reasons"]]
        flagged.sort(key=lambda r: -r["_score"])
        rows = flagged
        title = "Deficit / Follow-up Report"
        headers = ["USN", "Name", "Attendance %", "CIE %", "Priority", "Why flagged"]
        body = [[r["usn"], r["name"], fmt(r["attendance_pct"]), fmt(r["cie_pct"]),
                 r["priority"], "; ".join(r["reasons"])] for r in rows]
    else:
        raise ValueError("Unknown report type")

    counts = {s: sum(1 for r in rows if r["attendance_status"] == s)
              for s in ("Critical", "Advisory", "Safe")}
    summary = [("Course", f"{course.course_name} ({course.course_code})"),
               ("Faculty", course.faculty.name),
               ("Generated on", date.today().isoformat()),
               ("Students in report", str(len(rows)))]
    if kind != "cie":
        summary.append(("Critical / Advisory / Safe",
                        f"{counts['Critical']} / {counts['Advisory']} / {counts['Safe']}"))
    if date_from or date_to:
        summary.append(("Date range", f"{date_from or 'start'} to {date_to or 'today'}"))
    return {"title": title, "headers": headers, "rows": body, "summary": summary}


def to_excel(rep) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "Report"
    ws["A1"] = rep["title"]
    ws["A1"].font = Font(bold=True, size=14)
    r = 2
    for k, v in rep["summary"]:
        ws.cell(r, 1, k).font = Font(bold=True)
        ws.cell(r, 2, v)
        r += 1
    r += 1
    for c, h in enumerate(rep["headers"], 1):
        cell = ws.cell(r, c, h)
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = PatternFill("solid", fgColor="14213D")
    for row in rep["rows"]:
        r += 1
        for c, v in enumerate(row, 1):
            ws.cell(r, c, v).alignment = Alignment(wrap_text=True, vertical="top")
    for c in range(1, len(rep["headers"]) + 1):
        width = max(len(str(ws.cell(i, c).value or "")) for i in range(1, ws.max_row + 1))
        ws.column_dimensions[get_column_letter(c)].width = min(max(width + 2, 10), 60)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def to_pdf(rep) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=landscape(A4), leftMargin=24, rightMargin=24,
                            topMargin=24, bottomMargin=24, title=rep["title"])
    st = getSampleStyleSheet()
    small = st["BodyText"].clone("small")
    small.fontSize = 8
    small.leading = 10
    story = [Paragraph(rep["title"], st["Title"])]
    for k, v in rep["summary"]:
        story.append(Paragraph(f"<b>{k}:</b> {v}", st["BodyText"]))
    story.append(Spacer(1, 12))
    data = [[Paragraph(f"<b>{h}</b>", small) for h in rep["headers"]]]
    data += [[Paragraph(str(c), small) for c in row] for row in rep["rows"]]
    t = Table(data, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#DCE3EE")),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F5F7FA")]),
    ]))
    story.append(t)
    doc.build(story)
    return buf.getvalue()
