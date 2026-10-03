"""Competitions, leaderboards, student dashboard, badges, notifications."""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import services as svc
from ..clock import today
from ..db import get_db
from ..deps import current_user, get_or_404, require
from ..models import (
    Attendance,
    Badge,
    Competition,
    CompetitionHalaqa,
    CompetitionTask,
    Halaqa,
    Homework,
    Notification,
    PointTxn,
    Recitation,
    Role,
    StudentBadge,
    TaskClaim,
    User,
    UserStatus,
)

router = APIRouter()
ANON = "طالب مجهول"

TASK_KINDS = {"attendance", "recitation_pages", "homework", "check", "count"}
SELF_LOGGED = {"check", "count"}


# ---------- schemas ----------
class TaskIn(BaseModel):
    kind: str
    group: str = "عام"
    title: str = Field(min_length=2)
    icon: str = "⭐"
    points: int = Field(ge=1, le=1000)
    per_units: int = Field(1, ge=1, le=100000)
    unit: str | None = None
    target: int | None = Field(None, ge=1)
    max_per_event: int | None = Field(None, ge=1)


class CompetitionIn(BaseModel):
    name: str = Field(min_length=2)
    description: str | None = None
    start_date: date
    end_date: date
    scope: str = "mosque"  # mosque | halaqas
    halaqa_ids: list[int] = []
    show_ranking: bool = True
    tasks: list[TaskIn] = Field(min_length=1)


def _task_out(t: CompetitionTask) -> dict:
    return {"id": t.id, "kind": t.kind, "group": t.group, "title": t.title, "icon": t.icon, "points": t.points, "per_units": t.per_units, "unit": t.unit, "target": t.target, "max_per_event": t.max_per_event}


def _comp_out(c: Competition) -> dict:
    return {
        "id": c.id, "name": c.name, "description": c.description, "start_date": c.start_date, "end_date": c.end_date,
        "scope": c.scope, "halaqa_ids": [h.halaqa_id for h in c.halaqas], "show_ranking": c.show_ranking,
        "status": svc.comp_status(c), "tasks": [_task_out(t) for t in c.tasks],
    }


def _visible(db: Session, me: User, c: Competition) -> bool:
    if me.role == Role.admin:
        return True
    if c.mosque_id != me.mosque_id:  # mosque isolation
        return False
    if me.role == Role.supervisor:
        return True
    if c.draft:
        return False
    if me.role == Role.student:
        return svc.covers(db, c, me.halaqa_id)
    hids = set(db.scalars(select(Halaqa.id).where(Halaqa.teacher_id == me.id)))
    return c.scope == "mosque" or any(h.halaqa_id in hids for h in c.halaqas)


def _comp_or_403(db: Session, me: User, cid: int) -> Competition:
    c = get_or_404(db, Competition, cid)
    if not _visible(db, me, c):
        raise HTTPException(403, "لا تملك صلاحية على هذه المسابقة")
    return c


def _own_comp(db: Session, me: User, cid: int) -> Competition:
    c = get_or_404(db, Competition, cid)
    if c.mosque_id != me.mosque_id:
        raise HTTPException(403, "لا تملك صلاحية على هذه المسابقة")
    return c


# ---------- competitions ----------
@router.post("/competitions", status_code=201, tags=["competitions"])
def create_competition(body: CompetitionIn, me: User = Depends(require(Role.supervisor)), db: Session = Depends(get_db)):
    if body.end_date < body.start_date:
        raise HTTPException(422, "تاريخ النهاية قبل البداية")
    if body.scope not in ("mosque", "halaqas"):
        raise HTTPException(422, "نطاق غير صالح")
    if any(t.kind not in TASK_KINDS for t in body.tasks):
        raise HTTPException(422, "نوع مهمة غير صالح")
    if body.scope == "halaqas":
        valid = set(db.scalars(select(Halaqa.id).where(Halaqa.mosque_id == me.mosque_id)))
        if not body.halaqa_ids or not set(body.halaqa_ids) <= valid:
            raise HTTPException(422, "اختر حلقات من مسجدك")
    c = Competition(mosque_id=me.mosque_id, created_by=me.id, name=body.name, description=body.description, start_date=body.start_date, end_date=body.end_date, scope=body.scope, show_ranking=body.show_ranking)
    c.tasks = [CompetitionTask(**t.model_dump()) for t in body.tasks]
    if body.scope == "halaqas":
        c.halaqas = [CompetitionHalaqa(halaqa_id=h) for h in body.halaqa_ids]
    db.add(c)
    db.commit()
    db.refresh(c)
    return _comp_out(c)


@router.get("/competitions", tags=["competitions"])
def list_competitions(me: User = Depends(current_user), db: Session = Depends(get_db)):
    q = select(Competition).order_by(Competition.start_date.desc())
    if me.role != Role.admin:
        q = q.where(Competition.mosque_id == me.mosque_id)
    return [_comp_out(c) for c in db.scalars(q) if _visible(db, me, c)]


@router.get("/competitions/{cid}", tags=["competitions"])
def get_competition(cid: int, me: User = Depends(current_user), db: Session = Depends(get_db)):
    c = _comp_or_403(db, me, cid)
    out = _comp_out(c)
    if me.role == Role.student:
        mine = db.execute(select(PointTxn.task_id, func.sum(PointTxn.amount)).where(PointTxn.student_id == me.id, PointTxn.competition_id == cid, PointTxn.reversed == False).group_by(PointTxn.task_id)).all()  # noqa: E712
        earned = {tid: int(v) for tid, v in mine}
        for t in out["tasks"]:
            t["earned"] = earned.get(t["id"], 0)
    return out


@router.post("/competitions/{cid}/publish", tags=["competitions"])
def publish(cid: int, me: User = Depends(require(Role.supervisor)), db: Session = Depends(get_db)):
    c = _own_comp(db, me, cid)
    c.draft = False
    db.commit()
    return _comp_out(c)


@router.post("/competitions/{cid}/finalize", tags=["competitions"])
def finalize_competition(cid: int, me: User = Depends(require(Role.supervisor)), db: Session = Depends(get_db)):
    c = _own_comp(db, me, cid)
    if c.draft:
        raise HTTPException(409, "المسابقة لم تُنشر بعد")
    if not c.finalized:
        svc.finalize(db, c)
        db.commit()
    return _comp_out(c)


@router.delete("/competitions/{cid}", status_code=204, tags=["competitions"])
def delete_competition(cid: int, me: User = Depends(require(Role.supervisor)), db: Session = Depends(get_db)):
    c = _own_comp(db, me, cid)
    if not c.draft:
        raise HTTPException(409, "لا يمكن حذف مسابقة منشورة")
    db.delete(c)
    db.commit()


# ---------- leaderboard ----------
@router.get("/competitions/{cid}/leaderboard", tags=["competitions"])
def leaderboard(cid: int, me: User = Depends(current_user), db: Session = Depends(get_db)):
    c = _comp_or_403(db, me, cid)
    pts = svc.points_by_student(db, cid)
    students = svc.eligible_students(db, c)
    halaqa_name = {h.id: h.name for h in db.scalars(select(Halaqa).where(Halaqa.mosque_id == c.mosque_id))}
    rows = sorted(({"id": s.id, "name": s.full_name, "points": pts.get(s.id, 0), "halaqa": halaqa_name.get(s.halaqa_id, ""), "visible": s.show_in_leaderboard} for s in students), key=lambda r: (-r["points"], r["name"]))
    for i, r in enumerate(rows, 1):
        r["rank"] = i

    is_student = me.role == Role.student
    ranking_visible = c.show_ranking or not is_student
    top = []
    if ranking_visible:
        for r in rows[:10]:
            hidden = is_student and not r["visible"] and r["id"] != me.id
            top.append({"rank": r["rank"], "name": ANON if hidden else r["name"], "points": r["points"], "halaqa": r["halaqa"], "is_me": r["id"] == me.id})
    mine = next((r for r in rows if r["id"] == me.id), None) if is_student else None
    me_out = None
    if mine:
        ahead = rows[mine["rank"] - 2] if mine["rank"] > 1 else None
        me_out = {"rank": mine["rank"] if ranking_visible else None, "points": mine["points"], "of": len(rows), "to_next": {"points": ahead["points"] - mine["points"] + 1, "rank": ahead["rank"]} if ahead and ranking_visible else None}

    halaqa_totals: dict[str, int] = {}
    for r in rows:
        halaqa_totals[r["halaqa"]] = halaqa_totals.get(r["halaqa"], 0) + r["points"]
    return {
        "competition": _comp_out(c),
        "ranking_visible": ranking_visible,
        "top": top,
        "me": me_out,
        "halaqas": sorted(({"name": n, "points": p} for n, p in halaqa_totals.items() if n), key=lambda x: -x["points"]) if ranking_visible else [],
    }


# ---------- daily participation log (check / count tasks) ----------
class LogEntry(BaseModel):
    task_id: int
    done: bool = True
    amount: int = Field(1, ge=0, le=1_000_000)


class LogIn(BaseModel):
    day: date
    entries: list[LogEntry]


def _log_state(db: Session, me: User, c: Competition, day: date) -> dict:
    claims = {cl.task_id: cl for cl in db.scalars(select(TaskClaim).where(TaskClaim.student_id == me.id, TaskClaim.competition_id == c.id, TaskClaim.day == day))}
    tasks = {t.id: t for t in c.tasks}
    entries = {tid: {"done": True, "amount": cl.amount, "points": svc.task_points(tasks[tid], cl.amount)} for tid, cl in claims.items() if tid in tasks}
    auto = dict(db.execute(select(PointTxn.task_id, func.sum(PointTxn.amount)).where(PointTxn.student_id == me.id, PointTxn.competition_id == c.id, PointTxn.day == day, PointTxn.kind == "points", PointTxn.reversed == False, PointTxn.source_type != "claim").group_by(PointTxn.task_id)).all())  # noqa: E712
    day_points = sum(e["points"] for e in entries.values()) + sum(int(v or 0) for v in auto.values())
    return {"day": day, "entries": entries, "auto": {k: int(v or 0) for k, v in auto.items()}, "day_points": day_points, "total": svc.points_by_student(db, c.id).get(me.id, 0)}


@router.get("/competitions/{cid}/log", tags=["participation"])
def get_log(cid: int, day: date | None = None, me: User = Depends(require(Role.student)), db: Session = Depends(get_db)):
    c = _comp_or_403(db, me, cid)
    return _log_state(db, me, c, day or today())


@router.put("/competitions/{cid}/log", tags=["participation"])
def save_log(cid: int, body: LogIn, me: User = Depends(require(Role.student)), db: Session = Depends(get_db)):
    c = _comp_or_403(db, me, cid)
    if svc.comp_status(c) != "active":
        raise HTTPException(409, "المسابقة غير فعّالة حالياً")
    if not (c.start_date <= body.day <= min(c.end_date, today())):
        raise HTTPException(422, "لا يمكن التسجيل لهذا اليوم")
    before = svc.points_by_student(db, c.id).get(me.id, 0)
    tasks = {t.id: t for t in c.tasks}
    for e in body.entries:
        t = tasks.get(e.task_id)
        if not t or t.kind not in SELF_LOGGED:
            raise HTTPException(422, "بند غير صالح")
        cl = db.scalar(select(TaskClaim).where(TaskClaim.task_id == t.id, TaskClaim.student_id == me.id, TaskClaim.day == body.day))
        keep = e.done and (e.amount > 0 if t.kind == "count" else True)
        if keep:
            if not cl:
                cl = TaskClaim(task_id=t.id, competition_id=c.id, student_id=me.id, day=body.day)
                db.add(cl)
            cl.amount = e.amount if t.kind == "count" else 1
            cl.status = "approved"
            db.flush()
            svc.on_task_log(db, me, cl, c, t, True)
        elif cl:
            svc.on_task_log(db, me, cl, c, t, False)
            db.delete(cl)
    db.commit()
    state = _log_state(db, me, c, body.day)
    state["gained"] = state["total"] - before
    return state


# ---------- student: dashboard, badges, halaqa, notifications ----------
@router.get("/me/dashboard", tags=["student"])
def dashboard(me: User = Depends(require(Role.student)), db: Session = Depends(get_db)):
    xp = svc.total_xp(db, me.id)
    cur, longest = svc.streaks(svc.activity_days(db, me.id))
    day = today()
    att = db.scalar(select(Attendance).where(Attendance.student_id == me.id, Attendance.day == day))
    recited = db.scalar(select(func.count()).select_from(Recitation).where(Recitation.student_id == me.id, Recitation.day == day)) or 0
    pending_hw = db.scalar(select(func.count()).select_from(Homework).where(Homework.student_id == me.id, Homework.done == False)) or 0  # noqa: E712
    goals = [
        {"key": "attendance", "label": "حضور الحلقة", "done": bool(att and att.present)},
        {"key": "recitation", "label": "تسميع اليوم", "done": recited > 0},
        {"key": "homework", "label": "إكمال الواجبات", "done": pending_hw == 0},
    ]
    comp = None
    for c in svc.active_competitions(db, me, day):
        lb = leaderboard(c.id, me, db)
        comp = {"id": c.id, "name": c.name, "ends": c.end_date, "days_left": (c.end_date - day).days, "me": lb["me"]}
        break
    last = db.execute(select(Badge).join(StudentBadge, StudentBadge.badge_id == Badge.id).where(StudentBadge.student_id == me.id).order_by(StudentBadge.earned_at.desc())).scalars().first()
    return {
        "level": svc.level_info(xp),
        "streak": {"current": cur, "longest": longest},
        "goals": goals,
        "competition": comp,
        "badges_count": db.scalar(select(func.count()).select_from(StudentBadge).where(StudentBadge.student_id == me.id)) or 0,
        "last_badge": {"name": last.name, "icon": last.icon, "description": last.description} if last else None,
        "metrics": svc.metrics(db, me.id),
    }


@router.get("/me/badges", tags=["student"])
def my_badges(me: User = Depends(require(Role.student)), db: Session = Depends(get_db)):
    earned = {sb.badge_id: sb.earned_at for sb in db.scalars(select(StudentBadge).where(StudentBadge.student_id == me.id))}
    m = svc.metrics(db, me.id)
    out = []
    for b in db.scalars(select(Badge).order_by(Badge.id)):
        got = b.id in earned
        if b.hidden and not got:
            continue  # secret badges stay secret until earned
        value = m.get(b.metric, 0)
        out.append({"code": b.code, "name": b.name if got or not b.hidden else "???", "description": b.description, "icon": b.icon, "category": b.category, "earned": got, "progress": min(1.0, value / b.threshold) if b.threshold else (1.0 if got else 0.0), "value": value, "threshold": b.threshold})
    return out


@router.get("/me/halaqa", tags=["student"])
def my_halaqa(me: User = Depends(require(Role.student)), db: Session = Depends(get_db)):
    """Classmates only (same halaqa). Never exposes other halaqas or mosques."""
    h = db.get(Halaqa, me.halaqa_id) if me.halaqa_id else None
    if not h:
        return {"halaqa": None, "members": [], "highlights": {}, "totals": {}}
    day = today()
    mates = db.scalars(select(User).where(User.halaqa_id == h.id, User.role == Role.student, User.status == UserStatus.active)).all()
    pages = dict(db.execute(select(Recitation.student_id, func.sum(Recitation.end_page - Recitation.start_page + 1)).where(Recitation.day == day, Recitation.kind == "quran", Recitation.student_id.in_([m.id for m in mates])).group_by(Recitation.student_id)).all())
    xp_today = dict(db.execute(select(PointTxn.student_id, func.sum(PointTxn.amount)).where(PointTxn.day == day, PointTxn.kind == "xp", PointTxn.reversed == False, PointTxn.student_id.in_([m.id for m in mates])).group_by(PointTxn.student_id)).all())  # noqa: E712
    present = {a.student_id for a in db.scalars(select(Attendance).where(Attendance.day == day, Attendance.present == True, Attendance.student_id.in_([m.id for m in mates])))}  # noqa: E712
    members = []
    for m in mates:
        hidden = not m.show_in_leaderboard and m.id != me.id
        members.append({"name": ANON if hidden else m.full_name, "pages_today": int(pages.get(m.id, 0)), "xp_today": int(xp_today.get(m.id, 0)), "present": m.id in present, "is_me": m.id == me.id})
    members.sort(key=lambda r: (-r["pages_today"], -r["xp_today"], r["name"]))
    best = lambda key: next(({"name": r["name"], "value": r[key]} for r in sorted(members, key=lambda r: -r[key]) if r[key] > 0), None)  # noqa: E731
    teacher = db.get(User, h.teacher_id) if h.teacher_id else None
    return {
        "halaqa": {"name": h.name, "teacher": teacher.full_name if teacher else None, "count": len(mates)},
        "members": members,
        "highlights": {"pages": best("pages_today"), "xp": best("xp_today")},
        "totals": {"present": len(present), "pages": int(sum(pages.values())), "recited": len([1 for m in mates if pages.get(m.id)])},
    }


class Settings(BaseModel):
    show_in_leaderboard: bool


@router.patch("/me/settings", tags=["student"])
def my_settings(body: Settings, me: User = Depends(require(Role.student)), db: Session = Depends(get_db)):
    me.show_in_leaderboard = body.show_in_leaderboard
    db.commit()
    return {"show_in_leaderboard": me.show_in_leaderboard}


@router.get("/notifications", tags=["notifications"])
def notifications(unseen: bool = False, me: User = Depends(current_user), db: Session = Depends(get_db)):
    q = select(Notification).where(Notification.user_id == me.id).order_by(Notification.created_at.desc()).limit(50)
    if unseen:
        q = q.where(Notification.seen == False)  # noqa: E712
    return [{"id": n.id, "kind": n.kind, "title": n.title, "body": n.body, "payload": n.payload, "seen": n.seen, "created_at": n.created_at} for n in db.scalars(q)]


@router.post("/notifications/seen", status_code=204, tags=["notifications"])
def mark_seen(me: User = Depends(current_user), db: Session = Depends(get_db)):
    for n in db.scalars(select(Notification).where(Notification.user_id == me.id, Notification.seen == False)):  # noqa: E712
        n.seen = True
    db.commit()
