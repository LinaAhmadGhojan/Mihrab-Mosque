"""Attendance, recitations (+notes) and homework."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import services
from ..clock import today
from ..db import get_db
from ..deps import current_user, get_or_404, require, student_or_403
from ..models import Attendance, Homework, Note, Recitation, Role, User
from ..schemas import (
    AttendanceIn,
    AttendanceOut,
    HomeworkIn,
    HomeworkOut,
    HomeworkUpdate,
    NoteIn,
    NoteOut,
    NoteUpdate,
    RecitationIn,
    RecitationOut,
    RecitationUpdate,
)

router = APIRouter()
teacher_only = require(Role.teacher)


def _own(me: User, obj):
    if obj.teacher_id != me.id:
        raise HTTPException(403, "لا تملك صلاحية على هذا السجل")


def _pages_ok(start: int, end: int):
    if end < start:
        raise HTTPException(422, "صفحة النهاية قبل صفحة البداية")


# ---------- attendance ----------
@router.post("/attendance", response_model=AttendanceOut, tags=["attendance"])
def mark_attendance(body: AttendanceIn, me: User = Depends(teacher_only), db: Session = Depends(get_db)):
    student_or_403(db, me, body.student_id)
    day = body.day or today()
    row = db.scalar(select(Attendance).where(Attendance.student_id == body.student_id, Attendance.day == day))
    if row:
        row.present = body.present
    else:
        row = Attendance(student_id=body.student_id, day=day, present=body.present)
        db.add(row)
    db.flush()
    services.on_attendance(db, db.get(User, body.student_id), row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/students/{sid}/attendance", response_model=list[AttendanceOut], tags=["attendance"])
def student_attendance(sid: int, me: User = Depends(current_user), db: Session = Depends(get_db)):
    student_or_403(db, me, sid)
    return db.scalars(select(Attendance).where(Attendance.student_id == sid).order_by(Attendance.day.desc())).all()


# ---------- recitations ----------
@router.post("/recitations", response_model=RecitationOut, status_code=201, tags=["recitations"])
def add_recitation(body: RecitationIn, me: User = Depends(teacher_only), db: Session = Depends(get_db)):
    student_or_403(db, me, body.student_id)
    _pages_ok(body.start_page, body.end_page)
    r = Recitation(**body.model_dump(), teacher_id=me.id)
    db.add(r)
    db.flush()
    services.on_recitation(db, db.get(User, r.student_id), r, r.id)
    db.commit()
    db.refresh(r)
    return r


@router.get("/students/{sid}/recitations", response_model=list[RecitationOut], tags=["recitations"])
def student_recitations(sid: int, me: User = Depends(current_user), db: Session = Depends(get_db)):
    student_or_403(db, me, sid)
    return db.scalars(select(Recitation).where(Recitation.student_id == sid).order_by(Recitation.created_at.desc())).all()


@router.patch("/recitations/{rid}", response_model=RecitationOut, tags=["recitations"])
def edit_recitation(rid: int, body: RecitationUpdate, me: User = Depends(teacher_only), db: Session = Depends(get_db)):
    r = get_or_404(db, Recitation, rid)
    _own(me, r)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(r, k, v)
    _pages_ok(r.start_page, r.end_page)
    services.on_recitation(db, db.get(User, r.student_id), r, r.id)
    db.commit()
    db.refresh(r)
    return r


@router.delete("/recitations/{rid}", status_code=204, tags=["recitations"])
def delete_recitation(rid: int, me: User = Depends(teacher_only), db: Session = Depends(get_db)):
    r = get_or_404(db, Recitation, rid)
    _own(me, r)
    services.on_recitation(db, db.get(User, r.student_id), None, r.id, deleted=True)
    db.delete(r)
    db.commit()


# ---------- notes on a recitation ----------
@router.post("/recitations/{rid}/notes", response_model=NoteOut, status_code=201, tags=["notes"])
def add_note(rid: int, body: NoteIn, me: User = Depends(teacher_only), db: Session = Depends(get_db)):
    r = get_or_404(db, Recitation, rid)
    _own(me, r)
    n = Note(recitation_id=rid, **body.model_dump())
    db.add(n)
    db.commit()
    db.refresh(n)
    return n


def _note(db: Session, me: User, nid: int) -> Note:
    n = get_or_404(db, Note, nid)
    _own(me, get_or_404(db, Recitation, n.recitation_id))
    return n


@router.patch("/notes/{nid}", response_model=NoteOut, tags=["notes"])
def edit_note(nid: int, body: NoteUpdate, me: User = Depends(teacher_only), db: Session = Depends(get_db)):
    n = _note(db, me, nid)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(n, k, v)
    db.commit()
    db.refresh(n)
    return n


@router.delete("/notes/{nid}", status_code=204, tags=["notes"])
def delete_note(nid: int, me: User = Depends(teacher_only), db: Session = Depends(get_db)):
    db.delete(_note(db, me, nid))
    db.commit()


# ---------- homework ----------
@router.post("/homework", response_model=HomeworkOut, status_code=201, tags=["homework"])
def add_homework(body: HomeworkIn, me: User = Depends(teacher_only), db: Session = Depends(get_db)):
    student_or_403(db, me, body.student_id)
    h = Homework(**body.model_dump(), teacher_id=me.id)
    db.add(h)
    db.commit()
    db.refresh(h)
    return h


@router.get("/students/{sid}/homework", response_model=list[HomeworkOut], tags=["homework"])
def student_homework(sid: int, me: User = Depends(current_user), db: Session = Depends(get_db)):
    student_or_403(db, me, sid)
    return db.scalars(select(Homework).where(Homework.student_id == sid).order_by(Homework.created_at.desc())).all()


@router.patch("/homework/{hid}", response_model=HomeworkOut, tags=["homework"])
def edit_homework(hid: int, body: HomeworkUpdate, me: User = Depends(teacher_only), db: Session = Depends(get_db)):
    h = get_or_404(db, Homework, hid)
    _own(me, h)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(h, k, v)
    db.commit()
    db.refresh(h)
    return h


@router.post("/homework/{hid}/done", response_model=HomeworkOut, tags=["homework"])
def mark_done(hid: int, done: bool = True, me: User = Depends(teacher_only), db: Session = Depends(get_db)):
    h = get_or_404(db, Homework, hid)
    _own(me, h)
    h.done = done
    services.on_homework(db, db.get(User, h.student_id), h.id, done)
    db.commit()
    db.refresh(h)
    return h


@router.delete("/homework/{hid}", status_code=204, tags=["homework"])
def delete_homework(hid: int, me: User = Depends(teacher_only), db: Session = Depends(get_db)):
    h = get_or_404(db, Homework, hid)
    _own(me, h)
    services.on_homework(db, db.get(User, h.student_id), h.id, False)
    db.delete(h)
    db.commit()
