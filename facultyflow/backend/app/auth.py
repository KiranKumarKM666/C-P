from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .config import ALGORITHM, SECRET_KEY, TOKEN_MINUTES
from .database import get_db
from .models import Course, User

bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except ValueError:
        return False


def create_token(user: User) -> str:
    payload = {
        "sub": str(user.user_id),
        "role": user.role,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=TOKEN_MINUTES),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    if creds is None:
        raise HTTPException(401, "Not logged in")
    try:
        data = jwt.decode(creds.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user = db.get(User, int(data["sub"]))
    except (jwt.PyJWTError, KeyError, ValueError):
        raise HTTPException(401, "Session expired. Log in again.")
    if user is None:
        raise HTTPException(401, "User no longer exists")
    return user


def require_role(*roles):
    """Dependency: the role is checked on the server for every request."""
    def checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(403, "Access denied")
        return user
    return checker


def get_course_for_user(db: Session, user: User, course_id: int) -> Course:
    """Ownership check: faculty may only touch their own courses."""
    course = db.get(Course, course_id)
    if course is None:
        raise HTTPException(404, "Course not found")
    if user.role == "admin":
        return course
    if user.role == "faculty" and course.faculty_id == user.user_id:
        return course
    raise HTTPException(403, "Access denied")
