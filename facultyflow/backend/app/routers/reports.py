import datetime as dt
from typing import Literal

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from ..auth import get_course_for_user, require_role
from ..database import get_db
from ..models import User
from ..services.reports import build_report, to_excel, to_pdf

router = APIRouter(tags=["reports"])


@router.get("/reports/{kind}")
def report(kind: Literal["attendance", "cie", "deficit"], course_id: int,
           format: Literal["pdf", "xlsx"] = "pdf",
           date_from: dt.date | None = None, date_to: dt.date | None = None,
           status: str | None = Query(None, description="Critical, Advisory or Safe"),
           db: Session = Depends(get_db),
           user: User = Depends(require_role("faculty", "admin"))):
    course = get_course_for_user(db, user, course_id)
    rep = build_report(db, course, kind, date_from, date_to, status)
    name = f"{course.course_code}_{kind}_{dt.date.today().isoformat()}.{format}"
    if format == "pdf":
        data, mime = to_pdf(rep), "application/pdf"
    else:
        data = to_excel(rep)
        mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    return Response(data, media_type=mime,
                    headers={"Content-Disposition": f'attachment; filename="{name}"'})
