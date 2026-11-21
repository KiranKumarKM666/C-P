from datetime import datetime, timezone

from sqlalchemy import (Boolean, Column, Date, DateTime, Float, ForeignKey, Index,
                        Integer, String, Text, UniqueConstraint)
from sqlalchemy.orm import relationship

from .database import Base


class User(Base):
    __tablename__ = "users"
    user_id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    email = Column(String(120), unique=True, nullable=False, index=True)
    password_hash = Column(String(200), nullable=False)
    role = Column(String(20), nullable=False)  # faculty | admin | student
    courses = relationship("Course", back_populates="faculty")


class Course(Base):
    __tablename__ = "courses"
    course_id = Column(Integer, primary_key=True)
    course_name = Column(String(150), nullable=False)
    course_code = Column(String(30), unique=True, nullable=False)
    semester = Column(Integer, nullable=False)
    faculty_id = Column(Integer, ForeignKey("users.user_id"), nullable=False, index=True)
    faculty = relationship("User", back_populates="courses")
    students = relationship("Student", back_populates="course")


class Student(Base):
    __tablename__ = "students"
    student_id = Column(Integer, primary_key=True)
    usn = Column(String(30), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(120))
    course_id = Column(Integer, ForeignKey("courses.course_id"), nullable=False, index=True)
    course = relationship("Course", back_populates="students")


class Attendance(Base):
    __tablename__ = "attendance"
    attendance_id = Column(Integer, primary_key=True)
    student_id = Column(Integer, ForeignKey("students.student_id"), nullable=False)
    course_id = Column(Integer, ForeignKey("courses.course_id"), nullable=False)
    date = Column(Date, nullable=False)
    status = Column(String(10), nullable=False)  # Present | Absent
    reason = Column(String(240))
    __table_args__ = (
        UniqueConstraint("student_id", "course_id", "date", name="uq_attendance_day"),
        Index("ix_attendance_student_course", "student_id", "course_id"),
    )


class Mark(Base):
    __tablename__ = "marks"
    mark_id = Column(Integer, primary_key=True)
    student_id = Column(Integer, ForeignKey("students.student_id"), nullable=False)
    course_id = Column(Integer, ForeignKey("courses.course_id"), nullable=False)
    assessment_name = Column(String(80), nullable=False)
    max_marks = Column(Float, nullable=False)
    marks_obtained = Column(Float)            # None when absent
    is_absent = Column(Boolean, default=False, nullable=False)
    __table_args__ = (
        UniqueConstraint("student_id", "course_id", "assessment_name", name="uq_mark_assessment"),
        Index("ix_marks_student_course", "student_id", "course_id"),
    )


class Advisory(Base):
    __tablename__ = "advisories"
    advisory_id = Column(Integer, primary_key=True)
    student_id = Column(Integer, ForeignKey("students.student_id"), nullable=False)
    course_id = Column(Integer, ForeignKey("courses.course_id"), nullable=False)
    issue_type = Column(String(30), nullable=False)
    ai_draft = Column(Text, nullable=False)
    final_message = Column(Text)              # filled only on approval
    faculty_approved = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    approved_at = Column(DateTime)


class PasswordResetRequest(Base):
    __tablename__ = "password_reset_requests"
    request_id = Column(Integer, primary_key=True)
    email = Column(String(120), nullable=False, index=True)
    reason = Column(String(240))
    status = Column(String(20), default="Pending", nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
