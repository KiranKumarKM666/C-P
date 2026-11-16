from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import (create_token, get_current_user, hash_password, require_role,
                    verify_password)
from ..config import SETTINGS
from ..database import get_db
from ..models import User
from ..schemas import LoginIn, SettingsIn, UserCreate

router = APIRouter(tags=["auth"])


def user_dict(u: User):
    return {"user_id": u.user_id, "name": u.name, "email": u.email, "role": u.role}


@router.post("/auth/login")
def login(body: LoginIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email.strip().lower()).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Incorrect email or password")
    return {"token": create_token(user), "user": user_dict(user)}


@router.get("/auth/me")
def me(user: User = Depends(get_current_user)):
    return user_dict(user)


@router.get("/users")
def list_users(role: str | None = None, db: Session = Depends(get_db),
               _: User = Depends(require_role("admin"))):
    q = db.query(User)
    if role:
        q = q.filter(User.role == role)
    return [user_dict(u) for u in q.order_by(User.name)]


@router.post("/users", status_code=201)
def create_user(body: UserCreate, db: Session = Depends(get_db),
                _: User = Depends(require_role("admin"))):
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(409, "A user with this email already exists")
    u = User(name=body.name.strip(), email=body.email, role=body.role,
             password_hash=hash_password(body.password))
    db.add(u)
    db.commit()
    return user_dict(u)


@router.get("/settings")
def get_settings(_: User = Depends(get_current_user)):
    return SETTINGS


@router.put("/settings")
def update_settings(body: SettingsIn, _: User = Depends(require_role("admin"))):
    SETTINGS.update(body.model_dump())
    return SETTINGS
