from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..auth import (create_token, get_current_user, hash_password, require_role,
                    verify_password)
from ..config import SETTINGS
from ..database import get_db
from ..models import PasswordResetRequest, User
from ..schemas import (LoginIn, PasswordResetResolveIn, PasswordResetRequestIn,
                       SettingsIn, UserCreate, UserUpdate)

router = APIRouter(tags=["auth"])


def user_dict(u: User):
    return {"user_id": u.user_id, "name": u.name, "email": u.email, "role": u.role}


def settings_dict():
    return {
        "attendance_critical": SETTINGS["critical_below"],
        "attendance_advisory": SETTINGS["advisory_upto"],
        "cie_low": SETTINGS["cie_cutoff"],
        "cie_drop": SETTINGS["drop_points"],
    }


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
def list_users(role: str | None = None,
               limit: int = Query(default=500, ge=1, le=500),
               offset: int = Query(default=0, ge=0),
               db: Session = Depends(get_db),
               _: User = Depends(require_role("admin"))):
    q = db.query(User)
    if role:
        q = q.filter(User.role == role)
    return [user_dict(u) for u in q.order_by(User.name).offset(offset).limit(limit)]


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


@router.put("/users/{user_id}")
def update_user(user_id: int, body: UserUpdate, db: Session = Depends(get_db),
                _: User = Depends(require_role("admin"))):
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(404, "User not found")
    if body.name is not None:
        u.name = body.name.strip()
    if body.email is not None:
        email = body.email.strip().lower()
        if db.query(User).filter(User.email == email, User.user_id != user_id).first():
            raise HTTPException(409, "A user with this email already exists")
        u.email = email
    if body.password is not None:
        u.password_hash = hash_password(body.password)
    if body.role is not None:
        u.role = body.role
    db.commit()
    db.refresh(u)
    return user_dict(u)


@router.delete("/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db),
                _: User = Depends(require_role("admin"))):
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(404, "User not found")
    if u.role == "admin" and db.query(User).filter(User.role == "admin").count() <= 1:
        raise HTTPException(400, "Cannot delete the final admin account")
    db.delete(u)
    db.commit()
    return {"deleted": user_id}


@router.put("/auth/me")
def update_profile(body: UserUpdate, db: Session = Depends(get_db),
                   current: User = Depends(get_current_user)):
    if body.email is not None:
        email = body.email.strip().lower()
        if db.query(User).filter(User.email == email, User.user_id != current.user_id).first():
            raise HTTPException(409, "A user with this email already exists")
        current.email = email
    if body.name is not None:
        current.name = body.name.strip()
    if body.password is not None:
        current.password_hash = hash_password(body.password)
    db.commit()
    db.refresh(current)
    return user_dict(current)


@router.post("/auth/forgot-password", status_code=202)
def forgot_password(body: PasswordResetRequestIn, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    request = PasswordResetRequest(email=email,
                                   reason=(body.reason or "").strip() or None,
                                   status="Pending")
    db.add(request)
    db.commit()
    return {"submitted": True, "message": "Your request was sent to the HOD/Admin."}


@router.get("/auth/password-requests")
def password_requests(db: Session = Depends(get_db),
                      _: User = Depends(require_role("admin"))):
    rows = db.query(PasswordResetRequest).order_by(PasswordResetRequest.created_at.desc()).all()
    return [{"request_id": r.request_id, "email": r.email, "reason": r.reason,
             "status": r.status,
             "created_at": r.created_at.isoformat() if r.created_at else None}
            for r in rows]


@router.post("/auth/password-requests/{request_id}/resolve")
def resolve_password_request(request_id: int, body: PasswordResetResolveIn,
                             db: Session = Depends(get_db),
                             _: User = Depends(require_role("admin"))):
    request = db.get(PasswordResetRequest, request_id)
    if not request:
        raise HTTPException(404, "Request not found")
    user = db.query(User).filter(User.email == request.email).first()
    if not user:
        request.status = "Account not found"
        db.commit()
        return {"resolved": False, "status": request.status}
    user.password_hash = hash_password(body.new_password)
    request.status = "Resolved"
    db.commit()
    return {"resolved": True, "status": "Resolved"}


@router.get("/settings")
def get_settings(_: User = Depends(get_current_user)):
    return settings_dict()


@router.put("/settings")
def update_settings(body: SettingsIn, _: User = Depends(require_role("admin"))):
    SETTINGS.update(body.model_dump())
    return settings_dict()
