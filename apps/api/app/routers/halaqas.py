from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import get_or_404, require
from ..models import Halaqa, Role, User, UserStatus
from ..schemas import HalaqaDetail, HalaqaIn, HalaqaOut

router = APIRouter(prefix="/halaqas", tags=["halaqas"])


def _check_teacher(db: Session, me: User, teacher_id: int | None):
    if teacher_id is None:
        return
    t = db.get(User, teacher_id)
    if not t or t.role != Role.teacher or t.mosque_id != me.mosque_id:
        raise HTTPException(422, "المعلم غير موجود ضمن مسجدك")


def _detail(db: Session, h: Halaqa) -> dict:
    teacher = db.get(User, h.teacher_id) if h.teacher_id else None
    students = db.scalars(select(User).where(User.halaqa_id == h.id, User.role == Role.student, User.status == UserStatus.active)).all()
    return {**HalaqaOut.model_validate(h).model_dump(), "teacher_name": teacher.full_name if teacher else None, "students": students}


@router.post("", response_model=HalaqaOut, status_code=201)
def create(body: HalaqaIn, me: User = Depends(require(Role.supervisor)), db: Session = Depends(get_db)):
    _check_teacher(db, me, body.teacher_id)
    h = Halaqa(name=body.name, teacher_id=body.teacher_id, mosque_id=me.mosque_id, supervisor_id=me.id)
    db.add(h)
    db.commit()
    db.refresh(h)
    return h


@router.get("", response_model=list[HalaqaDetail])
def list_all(me: User = Depends(require(Role.supervisor, Role.teacher)), db: Session = Depends(get_db)):
    q = select(Halaqa)
    q = q.where(Halaqa.mosque_id == me.mosque_id) if me.role == Role.supervisor else q.where(Halaqa.teacher_id == me.id)
    return [_detail(db, h) for h in db.scalars(q)]


@router.patch("/{hid}", response_model=HalaqaOut)
def update(hid: int, body: HalaqaIn, me: User = Depends(require(Role.supervisor)), db: Session = Depends(get_db)):
    h = get_or_404(db, Halaqa, hid)
    if h.mosque_id != me.mosque_id:
        raise HTTPException(403, "هذه الحلقة ليست ضمن مسجدك")
    _check_teacher(db, me, body.teacher_id)
    h.name, h.teacher_id = body.name, body.teacher_id
    db.commit()
    db.refresh(h)
    return h
