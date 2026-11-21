import datetime as dt
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


class LoginIn(BaseModel):
    email: str
    password: str


class UserCreate(BaseModel):
    name: str = Field(min_length=1)
    email: str
    password: str = Field(min_length=6)
    role: Literal["faculty", "admin", "student"]

    @field_validator("email")
    @classmethod
    def valid_email(cls, v):
        v = v.strip().lower()
        if "@" not in v or "." not in v.split("@")[-1]:
            raise ValueError("Enter a valid email address")
        return v


class CourseCreate(BaseModel):
    course_name: str = Field(min_length=1)
    course_code: str = Field(min_length=1)
    semester: int = Field(ge=1, le=12)
    faculty_id: int


class StudentCreate(BaseModel):
    usn: str = Field(min_length=1)
    name: str = Field(min_length=1)
    email: Optional[str] = None


class AttendanceRecord(BaseModel):
    student_id: int
    status: Literal["Present", "Absent"]


class AttendanceIn(BaseModel):
    course_id: int
    date: dt.date
    records: List[AttendanceRecord] = Field(min_length=1)

    @field_validator("date")
    @classmethod
    def not_future(cls, v):
        if v > dt.date.today():
            raise ValueError("Date cannot be in the future")
        return v


class MarkRecord(BaseModel):
    student_id: int
    marks_obtained: Optional[float] = None
    is_absent: bool = False
    # Legacy field alias
    absent: Optional[bool] = None
    # Per-record assessment (React frontend sends these per-row)
    assessment_name: Optional[str] = None
    max_marks: Optional[float] = None

    @property
    def eff_absent(self) -> bool:
        return self.is_absent or bool(self.absent)


class MarksIn(BaseModel):
    course_id: int
    assessment_name: Optional[str] = None  # top-level (old format)
    max_marks: Optional[float] = None      # top-level (old format)
    records: List[MarkRecord] = Field(min_length=1)

    @model_validator(mode="after")
    def check_marks(self):
        for r in self.records:
            eff_max = r.max_marks or self.max_marks or 0
            if eff_max <= 0:
                raise ValueError("max_marks must be > 0")
            if r.eff_absent:
                continue
            if r.marks_obtained is None:
                raise ValueError("Enter marks or tick AB for every student")
            if r.marks_obtained < 0:
                raise ValueError("Marks cannot be negative")
            if r.marks_obtained > eff_max:
                raise ValueError(f"Marks cannot exceed {eff_max:g}")
        return self


class DraftIn(BaseModel):
    student_id: int
    course_id: int
    # Accept both short codes and free-form strings from the React frontend
    issue_type: str = Field(min_length=1)

    @field_validator("issue_type")
    @classmethod
    def normalise_issue(cls, v: str) -> str:
        v = v.strip().lower()
        if "attendance" in v:
            return "attendance"
        if "mark" in v or "cie" in v or "low" in v:
            return "marks"
        return v  # pass through; AI handles it


class ApproveIn(BaseModel):
    final_message: str = Field(min_length=1)


class SettingsIn(BaseModel):
    critical_below: float = Field(ge=0, le=100)
    advisory_upto: float = Field(ge=0, le=100)
    cie_cutoff: float = Field(ge=0, le=100)
    drop_points: float = Field(ge=0, le=100)

    @model_validator(mode="after")
    def order(self):
        if self.critical_below > self.advisory_upto:
            raise ValueError("Critical threshold cannot be higher than the advisory threshold")
        return self
