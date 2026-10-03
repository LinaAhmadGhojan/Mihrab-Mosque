from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import current_user, get_or_404
from ..models import Announcement, AnnouncementKind as K, Halaqa, Role, User
from ..schemas import AnnouncementIn, AnnouncementOut

router = APIRouter(prefix="/announcements", tags=["announcements"])


def _my_halaqa_ids(db: Session, me: User) -> list[int]:
    if me.role == Role.student:
        return [me.halaqa_id] if me.halaqa_id else []
    if me.role == Role.teacher:
        return list(db.scalars(select(Halaqa.id).where(Halaqa.teacher_id == me.id)))
    if me.role == Role.supervisor:
        return list(db.scalars(select(Halaqa.id).where(Halaqa.mosque_id == me.mosque_id)))
    return []


@router.post("", response_model=AnnouncementOut, status_code=201)
def publish(body: AnnouncementIn, me: User = Depends(current_user), db: Session = Depends(get_db)):
    if me.role == Role.student:
        raise HTTPException(403, "لا تملك صلاحية النشر")
    # admin: general/admin; supervisor/teacher: halaqa/admin only (per SRS #7)
    allowed = {Role.admin: {K.general, K.admin}, Role.supervisor: {K.halaqa, K.admin}, Role.teacher: {K.halaqa, K.admin}}
    if body.kind not in allowed[me.role]:
        raise HTTPException(403, "نوع الإعلان غير مسموح لدورك")
    if body.kind == K.halaqa:
        h = get_or_404(db, Halaqa, body.halaqa_id) if body.halaqa_id else None
        if not h or h.id not in _my_halaqa_ids(db, me):
            raise HTTPException(403, "هذه الحلقة ليست ضمن صلاحياتك")
    a = Announcement(**body.model_dump(), author_id=me.id, mosque_id=me.mosque_id)
    db.add(a)
    db.commit()
    db.refresh(a)
    return a


@router.get("", response_model=list[AnnouncementOut])
def feed(me: User = Depends(current_user), db: Session = Depends(get_db)):
    """General for everyone; halaqa-specific for members; admin-kind for staff."""
    cond = [Announcement.kind == K.general]
    if me.role == Role.admin:
        cond.append(Announcement.kind != K.general)
    else:
        hids = _my_halaqa_ids(db, me)
        if hids:
            cond.append((Announcement.kind == K.halaqa) & Announcement.halaqa_id.in_(hids))
        if me.role in (Role.supervisor, Role.teacher):
            cond.append((Announcement.kind == K.admin) & (Announcement.mosque_id == me.mosque_id))
    return db.scalars(select(Announcement).where(or_(*cond)).order_by(Announcement.created_at.desc())).all()


@router.delete("/{aid}", status_code=204)
def remove(aid: int, me: User = Depends(current_user), db: Session = Depends(get_db)):
    a = get_or_404(db, Announcement, aid)
    if me.role != Role.admin and a.author_id != me.id:
        raise HTTPException(403, "لا تملك صلاحية الحذف")
    db.delete(a)
    db.commit()
