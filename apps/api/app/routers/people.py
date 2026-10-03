"""Auth + user management: supervisors (admin), teachers (supervisor), students (teacher/supervisor)."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import current_user, get_or_404, require, student_or_403
from ..models import Halaqa, Mosque, Role, User, UserStatus
from ..schemas import LoginIn, TokenOut, UserCreate, UserOut, UserUpdate
from ..security import hash_password, make_token, verify_password

router = APIRouter()


# ---------- auth ----------
@router.post("/auth/login", response_model=TokenOut, tags=["auth"])
def login(body: LoginIn, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.login == body.login))
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "بيانات الدخول غير صحيحة")
    if user.status != UserStatus.active:
        raise HTTPException(403, "هذا الحساب غير فعّال")
    return {"token": make_token(user.id), "user": user}


@router.get("/auth/me", response_model=UserOut, tags=["auth"])
def me(user: User = Depends(current_user)):
    return user


# ---------- helpers ----------
def _save(db: Session, user: User) -> User:
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "اسم الدخول مستخدم مسبقاً")
    db.refresh(user)
    return user


def _apply_update(user: User, body: UserUpdate):
    data = body.model_dump(exclude_unset=True)
    pw = data.pop("password", None)
    data.pop("halaqa_id", None)  # handled by callers (needs permission checks)
    for k, v in data.items():
        setattr(user, k, v)
    if pw:
        user.password_hash = hash_password(pw)


def _managed(db: Session, me: User, role: Role, user_id: int) -> User:
    target = get_or_404(db, User, user_id)
    if target.role != role:
        raise HTTPException(404, "غير موجود")
    if me.role == Role.supervisor and target.mosque_id != me.mosque_id:
        raise HTTPException(403, "لا تملك صلاحية على هذا الحساب")
    return target


# ---------- supervisors (admin only) ----------
@router.post("/supervisors", response_model=UserOut, status_code=201, tags=["supervisors"])
def add_supervisor(body: UserCreate, me: User = Depends(require(Role.admin)), db: Session = Depends(get_db)):
    if not body.mosque_name:
        raise HTTPException(422, "اسم المسجد مطلوب")
    mosque = db.scalar(select(Mosque).where(Mosque.name == body.mosque_name)) or Mosque(name=body.mosque_name)
    db.add(mosque)
    db.flush()
    data = body.model_dump(exclude={"password", "mosque_name", "halaqa_id"})
    user = User(**data, role=Role.supervisor, mosque_id=mosque.id, created_by=me.id, password_hash=hash_password(body.password))
    return _save(db, user)


@router.get("/supervisors", response_model=list[UserOut], tags=["supervisors"])
def list_supervisors(_: User = Depends(require(Role.admin)), db: Session = Depends(get_db)):
    return db.scalars(select(User).where(User.role == Role.supervisor)).all()


@router.patch("/supervisors/{uid}", response_model=UserOut, tags=["supervisors"])
def edit_supervisor(uid: int, body: UserUpdate, me: User = Depends(require(Role.admin)), db: Session = Depends(get_db)):
    user = _managed(db, me, Role.supervisor, uid)
    _apply_update(user, body)
    return _save(db, user)


@router.delete("/supervisors/{uid}", status_code=204, tags=["supervisors"])
def delete_supervisor(uid: int, me: User = Depends(require(Role.admin)), db: Session = Depends(get_db)):
    user = _managed(db, me, Role.supervisor, uid)
    if db.scalar(select(Halaqa.id).where(Halaqa.supervisor_id == uid)):
        raise HTTPException(409, "لدى المشرف حلقات؛ انقلها أو احذفها أولاً")
    db.delete(user)
    db.commit()


# ---------- teachers (supervisor) ----------
@router.post("/teachers", response_model=UserOut, status_code=201, tags=["teachers"])
def add_teacher(body: UserCreate, me: User = Depends(require(Role.supervisor)), db: Session = Depends(get_db)):
    data = body.model_dump(exclude={"password", "mosque_name", "halaqa_id", "license_no"})
    user = User(**data, role=Role.teacher, mosque_id=me.mosque_id, created_by=me.id, password_hash=hash_password(body.password))
    return _save(db, user)


@router.get("/teachers", response_model=list[UserOut], tags=["teachers"])
def list_teachers(me: User = Depends(require(Role.supervisor, Role.admin)), db: Session = Depends(get_db)):
    q = select(User).where(User.role == Role.teacher)
    if me.role == Role.supervisor:
        q = q.where(User.mosque_id == me.mosque_id)
    return db.scalars(q).all()


@router.patch("/teachers/{uid}", response_model=UserOut, tags=["teachers"])
def edit_teacher(uid: int, body: UserUpdate, me: User = Depends(require(Role.supervisor)), db: Session = Depends(get_db)):
    user = _managed(db, me, Role.teacher, uid)
    _apply_update(user, body)
    return _save(db, user)


@router.delete("/teachers/{uid}", status_code=204, tags=["teachers"])
def delete_teacher(uid: int, me: User = Depends(require(Role.supervisor)), db: Session = Depends(get_db)):
    user = _managed(db, me, Role.teacher, uid)
    for h in db.scalars(select(Halaqa).where(Halaqa.teacher_id == uid)):
        h.teacher_id = None
    db.delete(user)
    db.commit()


# ---------- students (teacher / supervisor) ----------
def _halaqa_for(db: Session, me: User, halaqa_id: int | None) -> Halaqa:
    if halaqa_id is None:
        raise HTTPException(422, "يجب تحديد الحلقة")
    h = get_or_404(db, Halaqa, halaqa_id)
    ok = (me.role == Role.teacher and h.teacher_id == me.id) or (
        me.role == Role.supervisor and h.mosque_id == me.mosque_id
    )
    if not ok:
        raise HTTPException(403, "هذه الحلقة ليست ضمن صلاحياتك")
    return h


@router.post("/students", response_model=UserOut, status_code=201, tags=["students"])
def add_student(body: UserCreate, me: User = Depends(require(Role.teacher, Role.supervisor)), db: Session = Depends(get_db)):
    h = _halaqa_for(db, me, body.halaqa_id)
    data = body.model_dump(exclude={"password", "mosque_name", "halaqa_id", "license_no"})
    user = User(**data, role=Role.student, mosque_id=h.mosque_id, halaqa_id=h.id, created_by=me.id, password_hash=hash_password(body.password))
    return _save(db, user)


@router.get("/students", response_model=list[UserOut], tags=["students"])
def list_students(
    halaqa_id: int | None = None,
    q: str | None = None,
    me: User = Depends(require(Role.teacher, Role.supervisor, Role.admin)),
    db: Session = Depends(get_db),
):
    stmt = select(User).where(User.role == Role.student, User.status == UserStatus.active)
    if me.role == Role.teacher:
        stmt = stmt.where(User.halaqa_id.in_(select(Halaqa.id).where(Halaqa.teacher_id == me.id)))
    elif me.role == Role.supervisor:
        stmt = stmt.where(User.mosque_id == me.mosque_id)
    if halaqa_id:
        stmt = stmt.where(User.halaqa_id == halaqa_id)
    if q:
        stmt = stmt.where(User.full_name.contains(q))
    return db.scalars(stmt.order_by(User.full_name)).all()


@router.get("/students/{uid}", response_model=UserOut, tags=["students"])
def get_student(uid: int, me: User = Depends(current_user), db: Session = Depends(get_db)):
    return student_or_403(db, me, uid)


@router.patch("/students/{uid}", response_model=UserOut, tags=["students"])
def edit_student(uid: int, body: UserUpdate, me: User = Depends(require(Role.teacher, Role.supervisor)), db: Session = Depends(get_db)):
    user = student_or_403(db, me, uid)
    _apply_update(user, body)
    if body.halaqa_id is not None:
        user.halaqa_id = _halaqa_for(db, me, body.halaqa_id).id
    return _save(db, user)


@router.delete("/students/{uid}", status_code=204, tags=["students"])
def archive_student(uid: int, status: UserStatus = UserStatus.left, me: User = Depends(require(Role.teacher, Role.supervisor)), db: Session = Depends(get_db)):
    """Soft delete: the student's learning history is kept (inactive/transferred/graduated/left)."""
    user = student_or_403(db, me, uid)
    user.status = status
    db.commit()


@router.get("/mosques", tags=["mosques"])
def list_mosques(_: User = Depends(require(Role.admin)), db: Session = Depends(get_db)):
    return [{"id": m.id, "name": m.name} for m in db.scalars(select(Mosque))]
