"""Gamification + competition engine.

Teachers only record educational work (attendance, recitation, homework). Every such
event calls `reconcile()` with the *desired* points for that source; the engine reverses
whatever was previously granted for it and writes the new ledger rows. Editing or deleting
a record therefore never double-counts.

Points are motivational game points, not a measure of reward from God.
"""

from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .clock import hour, today
from .models import (
    Attendance,
    Badge,
    Competition,
    CompetitionHalaqa,
    Homework,
    Notification,
    PointTxn,
    Recitation,
    Role,
    StudentBadge,
    User,
    UserStatus,
)

XP_ATTENDANCE = 5
XP_HOMEWORK = 10


def xp_recitation(pages: int) -> int:
    return min(60, 10 + 2 * pages)


LEVELS = [
    (0, "البداية", "🌱"),
    (100, "المجتهد", "📚"),
    (250, "المثابر", "🔥"),
    (500, "المتقدم", "⭐"),
    (900, "المتقن", "💎"),
    (1500, "المتميز", "🏆"),
    (2400, "النجم", "🌟"),
    (3600, "القدوة", "👑"),
]


def level_info(xp: int) -> dict:
    idx = max(i for i, (need, _, _) in enumerate(LEVELS) if xp >= need)
    need, name, icon = LEVELS[idx]
    nxt = LEVELS[idx + 1][0] if idx + 1 < len(LEVELS) else None
    return {
        "level": idx + 1,
        "name": name,
        "icon": icon,
        "xp": xp,
        "level_start": need,
        "next_at": nxt,
        "progress": 1.0 if nxt is None else round((xp - need) / (nxt - need), 3),
    }


BADGES = [
    # code, name, description, icon, category, metric, threshold, hidden
    ("first_pages", "بداية الطريق", "سمّعت أول ٥ صفحات", "🌱", "memorize", "pages", 5, False),
    ("pages_20", "أول جزء", "سمّعت ٢٠ صفحة", "📗", "memorize", "pages", 20, False),
    ("pages_60", "حافظ مثابر", "سمّعت ٦٠ صفحة", "📘", "memorize", "pages", 60, False),
    ("pages_100", "حافظ مجتهد", "سمّعت ١٠٠ صفحة", "📙", "memorize", "pages", 100, False),
    ("pages_300", "تاج الحفظ", "سمّعت ٣٠٠ صفحة", "👑", "memorize", "pages", 300, False),
    ("first_recitation", "أول تسميع", "أكملت أول جلسة تسميع", "🎙️", "memorize", "recitations", 1, False),
    ("attend_7", "المواظب", "حضرت ٧ أيام", "🕌", "attendance", "attendance_days", 7, False),
    ("attend_14", "لا غياب", "حضرت ١٤ يوماً", "🔥", "attendance", "attendance_days", 14, False),
    ("attend_30", "الملتزم", "حضرت ٣٠ يوماً", "🌟", "attendance", "attendance_days", 30, False),
    ("hw_1", "أول واجب", "أنجزت أول واجب", "🎯", "work", "homework_done", 1, False),
    ("hw_10", "طالب نشيط", "أنجزت ١٠ واجبات", "📚", "work", "homework_done", 10, False),
    ("hw_50", "المثابر", "أنجزت ٥٠ واجباً", "💎", "work", "homework_done", 50, False),
    ("streak_3", "سلسلة ٣ أيام", "٣ أيام متتالية من النشاط", "🔥", "streak", "streak", 3, False),
    ("streak_7", "سلسلة ٧ أيام", "أسبوع كامل من النشاط", "🔥", "streak", "streak", 7, False),
    ("streak_30", "سلسلة ٣٠ يوماً", "شهر من الالتزام", "🏅", "streak", "streak", 30, False),
    ("comp_join", "أول مشاركة", "شاركت في أول مسابقة", "🏆", "competition", "competitions_joined", 1, False),
    ("comp_3", "منافس قوي", "شاركت في ٣ مسابقات", "⚡", "competition", "competitions_joined", 3, False),
    ("comp_gold", "بطل المسابقة", "المركز الأول في مسابقة", "🥇", "competition", "special", 0, False),
    ("comp_silver", "متألق", "المركز الثاني في مسابقة", "🥈", "competition", "special", 0, False),
    ("comp_bronze", "منصة الشرف", "المركز الثالث في مسابقة", "🥉", "competition", "special", 0, False),
    ("early_bird", "همّة الصباح", "أنجزت نشاطك قبل الثامنة صباحاً", "🌙", "secret", "special", 0, True),
]


def seed_badges(db: Session):
    have = set(db.scalars(select(Badge.code)))
    for code, name, desc, icon, cat, metric, th, hidden in BADGES:
        if code not in have:
            db.add(Badge(code=code, name=name, description=desc, icon=icon, category=cat, metric=metric, threshold=th, hidden=hidden))
    db.commit()


# ---------- competitions ----------
def comp_status(c: Competition, now: date | None = None) -> str:
    now = now or today()
    if c.finalized:
        return "finalized"
    if c.draft:
        return "draft"
    if now < c.start_date:
        return "scheduled"
    if now > c.end_date:
        return "ended"
    return "active"


def covers(db: Session, c: Competition, halaqa_id: int | None) -> bool:
    if c.scope == "mosque":
        return True
    return halaqa_id is not None and any(h.halaqa_id == halaqa_id for h in c.halaqas)


def active_competitions(db: Session, student: User, day: date) -> list[Competition]:
    rows = db.scalars(select(Competition).where(Competition.mosque_id == student.mosque_id, Competition.draft == False, Competition.finalized == False))  # noqa: E712
    return [c for c in rows if c.start_date <= day <= c.end_date and covers(db, c, student.halaqa_id)]


def eligible_students(db: Session, c: Competition) -> list[User]:
    q = select(User).where(User.role == Role.student, User.mosque_id == c.mosque_id, User.status == UserStatus.active)
    students = db.scalars(q).all()
    return [s for s in students if covers(db, c, s.halaqa_id)]


def points_by_student(db: Session, comp_id: int) -> dict[int, int]:
    rows = db.execute(
        select(PointTxn.student_id, func.sum(PointTxn.amount)).where(PointTxn.competition_id == comp_id, PointTxn.kind == "points", PointTxn.reversed == False).group_by(PointTxn.student_id)  # noqa: E712
    ).all()
    return {sid: int(total or 0) for sid, total in rows}


# ---------- ledger ----------
def total_xp(db: Session, student_id: int) -> int:
    return int(db.scalar(select(func.coalesce(func.sum(PointTxn.amount), 0)).where(PointTxn.student_id == student_id, PointTxn.kind == "xp", PointTxn.reversed == False)) or 0)  # noqa: E712


def activity_days(db: Session, student_id: int) -> set[date]:
    return set(db.scalars(select(PointTxn.day).where(PointTxn.student_id == student_id, PointTxn.kind == "xp", PointTxn.reversed == False)))  # noqa: E712


def streaks(days: set[date], now: date | None = None) -> tuple[int, int]:
    """(current, longest). Current stays alive if the last activity was today or yesterday."""
    now = now or today()
    if not days:
        return 0, 0
    ordered = sorted(days)
    longest = run = 1
    for a, b in zip(ordered, ordered[1:]):
        run = run + 1 if (b - a).days == 1 else 1
        longest = max(longest, run)
    cur, d = 0, ordered[-1]
    if (now - d).days <= 1:
        cur = 1
        while (d - timedelta(days=cur)) in days:
            cur += 1
    return cur, longest


def metrics(db: Session, student_id: int) -> dict[str, int]:
    pages = db.scalar(select(func.coalesce(func.sum(Recitation.end_page - Recitation.start_page + 1), 0)).where(Recitation.student_id == student_id, Recitation.kind == "quran")) or 0
    cur, longest = streaks(activity_days(db, student_id))
    return {
        "pages": int(pages),
        "recitations": db.scalar(select(func.count()).select_from(Recitation).where(Recitation.student_id == student_id)) or 0,
        "attendance_days": db.scalar(select(func.count()).select_from(Attendance).where(Attendance.student_id == student_id, Attendance.present == True)) or 0,  # noqa: E712
        "homework_done": db.scalar(select(func.count()).select_from(Homework).where(Homework.student_id == student_id, Homework.done == True)) or 0,  # noqa: E712
        "streak": max(cur, longest),
        "competitions_joined": db.scalar(select(func.count(func.distinct(PointTxn.competition_id))).where(PointTxn.student_id == student_id, PointTxn.competition_id.is_not(None), PointTxn.reversed == False)) or 0,  # noqa: E712
    }


def notify(db: Session, user_id: int, kind: str, title: str, body: str = "", payload: dict | None = None):
    db.add(Notification(user_id=user_id, kind=kind, title=title, body=body, payload=payload))


def grant_badge(db: Session, student: User, code: str):
    badge = db.scalar(select(Badge).where(Badge.code == code))
    if not badge or db.scalar(select(StudentBadge.id).where(StudentBadge.student_id == student.id, StudentBadge.badge_id == badge.id)):
        return
    db.add(StudentBadge(student_id=student.id, badge_id=badge.id))
    notify(db, student.id, "badge", f"شارة جديدة: {badge.name}", badge.description, {"code": badge.code, "name": badge.name, "icon": badge.icon})


def check_badges(db: Session, student: User):
    m = metrics(db, student.id)
    for b in db.scalars(select(Badge).where(Badge.metric != "special")):
        if m.get(b.metric, 0) >= b.threshold:
            grant_badge(db, student, b.code)


def reconcile(db: Session, student: User, source_type: str, source_id: int, day: date, specs: list[dict]):
    """Make the ledger for (source_type, source_id) equal `specs`. Idempotent.

    spec: {"kind": "xp"|"points", "amount": int, "reason": str, "competition_id"?, "task_id"?}
    """
    old = db.scalars(select(PointTxn).where(PointTxn.source_type == source_type, PointTxn.source_id == source_id, PointTxn.reversed == False)).all()  # noqa: E712

    def key_old(t):
        return (t.kind, t.amount, t.competition_id, t.task_id)

    def key_new(s):
        return (s["kind"], s["amount"], s.get("competition_id"), s.get("task_id"))

    specs = [s for s in specs if s["amount"] != 0]
    if sorted(map(key_old, old), key=str) == sorted(map(key_new, specs), key=str):
        return
    xp_before = total_xp(db, student.id)
    for t in old:
        t.reversed = True
    for s in specs:
        db.add(PointTxn(student_id=student.id, mosque_id=student.mosque_id, kind=s["kind"], amount=s["amount"], source_type=source_type, source_id=source_id, competition_id=s.get("competition_id"), task_id=s.get("task_id"), reason=s["reason"], day=day))
    db.flush()

    xp_gain = sum(s["amount"] for s in specs if s["kind"] == "xp")
    pts_gain = sum(s["amount"] for s in specs if s["kind"] == "points")
    old_xp = sum(t.amount for t in old if t.kind == "xp")
    old_pts = sum(t.amount for t in old if t.kind == "points")
    if xp_gain > old_xp or pts_gain > old_pts:  # only celebrate net gains
        parts = []
        if xp_gain > old_xp:
            parts.append(f"+{xp_gain - old_xp} نقطة خبرة")
        if pts_gain > old_pts:
            parts.append(f"+{pts_gain - old_pts} نقطة مسابقة")
        notify(db, student.id, "points", "أحسنت! 🎉", "، ".join(parts), {"xp": max(0, xp_gain - old_xp), "points": max(0, pts_gain - old_pts)})
    check_badges(db, student)
    if hour() < 8 and xp_gain > old_xp:
        grant_badge(db, student, "early_bird")
    after = level_info(total_xp(db, student.id))
    if after["level"] > level_info(xp_before)["level"]:
        notify(db, student.id, "level", f"مستوى جديد: {after['name']}", f"وصلت إلى المستوى {after['level']}", {"level": after["level"], "name": after["name"], "icon": after["icon"]})


# ---------- event handlers (called from routers) ----------
def on_attendance(db: Session, student: User, att: Attendance):
    specs = []
    if att.present:
        specs.append({"kind": "xp", "amount": XP_ATTENDANCE, "reason": "حضور الحلقة"})
        for c in active_competitions(db, student, att.day):
            for t in c.tasks:
                if t.kind == "attendance":
                    specs.append({"kind": "points", "amount": t.points, "reason": t.title, "competition_id": c.id, "task_id": t.id})
    reconcile(db, student, "attendance", att.id, att.day, specs)


def on_recitation(db: Session, student: User, rec: Recitation | None, rec_id: int, deleted: bool = False):
    specs = []
    if rec and not deleted:
        pages = rec.end_page - rec.start_page + 1
        specs.append({"kind": "xp", "amount": xp_recitation(pages), "reason": "تسميع"})
        if rec.kind.value == "quran":
            for c in active_competitions(db, student, rec.day):
                for t in c.tasks:
                    if t.kind == "recitation_pages":
                        units = min(pages, t.max_per_event) if t.max_per_event else pages
                        specs.append({"kind": "points", "amount": units * t.points, "reason": t.title, "competition_id": c.id, "task_id": t.id})
    reconcile(db, student, "recitation", rec_id, rec.day if rec else today(), specs)


def on_homework(db: Session, student: User, hw_id: int, done: bool):
    specs = []
    if done:
        specs.append({"kind": "xp", "amount": XP_HOMEWORK, "reason": "إنجاز واجب"})
        for c in active_competitions(db, student, today()):
            for t in c.tasks:
                if t.kind == "homework":
                    specs.append({"kind": "points", "amount": t.points, "reason": t.title, "competition_id": c.id, "task_id": t.id})
    reconcile(db, student, "homework", hw_id, today(), specs)


def task_points(task, amount: int) -> int:
    units = min(amount, task.max_per_event) if task.max_per_event else amount
    return (units // max(1, task.per_units)) * task.points


def on_task_log(db: Session, student: User, claim, comp: Competition, task, present: bool):
    """Daily self-logged tasks (check/count). Unchecking reverses the points."""
    specs = []
    if present and claim.amount > 0:
        specs = [
            {"kind": "xp", "amount": 5, "reason": task.title},
            {"kind": "points", "amount": task_points(task, claim.amount), "reason": task.title, "competition_id": comp.id, "task_id": task.id},
        ]
    reconcile(db, student, "claim", claim.id, claim.day, specs)


def finalize(db: Session, comp: Competition):
    """Freeze the competition and award podium badges."""
    comp.finalized = True
    pts = points_by_student(db, comp.id)
    ranked = sorted(((p, sid) for sid, p in pts.items() if p > 0), reverse=True)
    for (p, sid), code in zip(ranked[:3], ["comp_gold", "comp_silver", "comp_bronze"]):
        s = db.get(User, sid)
        if s:
            grant_badge(db, s, code)
