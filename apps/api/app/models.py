import enum
from datetime import date, datetime

from sqlalchemy import JSON, Boolean, Date, DateTime, Enum, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .clock import today
from .db import Base


class Role(str, enum.Enum):
    admin = "admin"  # مدير المنظومة
    supervisor = "supervisor"  # المشرف
    teacher = "teacher"  # المعلم/ة
    student = "student"  # الطالب


class Gender(str, enum.Enum):
    male = "male"
    female = "female"


class RecitationKind(str, enum.Enum):
    quran = "quran"
    hadith = "hadith"


class AnnouncementKind(str, enum.Enum):
    halaqa = "halaqa"  # خاص بالحلقة
    admin = "admin"  # إداري
    general = "general"  # عام


class UserStatus(str, enum.Enum):
    active = "active"
    inactive = "inactive"
    transferred = "transferred"
    graduated = "graduated"
    left = "left"


class Mosque(Base):
    __tablename__ = "mosques"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), unique=True)


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    role: Mapped[Role] = mapped_column(Enum(Role), index=True)
    login: Mapped[str] = mapped_column(String(120), unique=True, index=True)  # email or phone
    password_hash: Mapped[str] = mapped_column(String(100))
    gender: Mapped[Gender] = mapped_column(Enum(Gender), default=Gender.male)
    full_name: Mapped[str] = mapped_column(String(200))
    father_name: Mapped[str | None] = mapped_column(String(100))
    mother_name: Mapped[str | None] = mapped_column(String(100))
    age: Mapped[int | None]
    education_stage: Mapped[str | None] = mapped_column(String(60))  # المرحلة الدراسية
    grade: Mapped[str | None] = mapped_column(String(60))  # الصف الدراسي
    address: Mapped[str | None] = mapped_column(String(300))
    phone: Mapped[str | None] = mapped_column(String(30))
    license_no: Mapped[str | None] = mapped_column(String(100))  # ترخيص الأوقاف (المشرف)
    certificates: Mapped[str | None] = mapped_column(Text)  # شهادات التسميع / الإجازة
    mosque_id: Mapped[int | None] = mapped_column(ForeignKey("mosques.id"))
    halaqa_id: Mapped[int | None] = mapped_column(ForeignKey("halaqas.id"))  # للطالب
    status: Mapped[UserStatus] = mapped_column(Enum(UserStatus), default=UserStatus.active)
    show_in_leaderboard: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    mosque: Mapped[Mosque | None] = relationship()


class Halaqa(Base):
    __tablename__ = "halaqas"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    mosque_id: Mapped[int] = mapped_column(ForeignKey("mosques.id"))
    supervisor_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    teacher_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))


class Attendance(Base):
    __tablename__ = "attendance"
    __table_args__ = (UniqueConstraint("student_id", "day"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    day: Mapped[date] = mapped_column(Date)
    present: Mapped[bool] = mapped_column(Boolean, default=True)


class Recitation(Base):
    __tablename__ = "recitations"
    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    teacher_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    kind: Mapped[RecitationKind] = mapped_column(Enum(RecitationKind))
    start_page: Mapped[int]
    end_page: Mapped[int]
    grade: Mapped[str | None] = mapped_column(String(30))
    day: Mapped[date] = mapped_column(Date, default=today)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    notes: Mapped[list["Note"]] = relationship(cascade="all, delete-orphan")


class Note(Base):
    __tablename__ = "notes"
    id: Mapped[int] = mapped_column(primary_key=True)
    recitation_id: Mapped[int] = mapped_column(ForeignKey("recitations.id"))
    page: Mapped[int]
    ayah: Mapped[int | None]
    text: Mapped[str] = mapped_column(Text)


class Announcement(Base):
    __tablename__ = "announcements"
    id: Mapped[int] = mapped_column(primary_key=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    kind: Mapped[AnnouncementKind] = mapped_column(Enum(AnnouncementKind))
    halaqa_id: Mapped[int | None] = mapped_column(ForeignKey("halaqas.id"))
    mosque_id: Mapped[int | None] = mapped_column(ForeignKey("mosques.id"))
    title: Mapped[str] = mapped_column(String(200))
    body: Mapped[str] = mapped_column(Text)
    image_url: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Homework(Base):
    __tablename__ = "homework"
    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    teacher_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    text: Mapped[str] = mapped_column(Text)
    due: Mapped[date | None] = mapped_column(Date)
    done: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


# ---------- gamification ----------
class PointTxn(Base):
    """Ledger. kind='xp' (level progress) or 'points' (competition). Edits reverse, never overwrite."""

    __tablename__ = "point_txns"
    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    mosque_id: Mapped[int | None] = mapped_column(ForeignKey("mosques.id"), index=True)
    kind: Mapped[str] = mapped_column(String(10))
    amount: Mapped[int]
    source_type: Mapped[str] = mapped_column(String(20), index=True)
    source_id: Mapped[int] = mapped_column(index=True)
    competition_id: Mapped[int | None] = mapped_column(ForeignKey("competitions.id"), index=True)
    task_id: Mapped[int | None] = mapped_column(ForeignKey("competition_tasks.id"))
    reason: Mapped[str] = mapped_column(String(200))
    day: Mapped[date] = mapped_column(Date, default=today)
    reversed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Badge(Base):
    __tablename__ = "badges"
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(40), unique=True)
    name: Mapped[str] = mapped_column(String(80))
    description: Mapped[str] = mapped_column(String(200))
    icon: Mapped[str] = mapped_column(String(10))
    category: Mapped[str] = mapped_column(String(20))
    metric: Mapped[str] = mapped_column(String(30))  # evaluated by services.metrics(); 'special' = awarded by code
    threshold: Mapped[int]
    hidden: Mapped[bool] = mapped_column(Boolean, default=False)


class StudentBadge(Base):
    __tablename__ = "student_badges"
    __table_args__ = (UniqueConstraint("student_id", "badge_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    badge_id: Mapped[int] = mapped_column(ForeignKey("badges.id"))
    earned_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Notification(Base):
    __tablename__ = "notifications"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    kind: Mapped[str] = mapped_column(String(20))  # points | badge | level | claim
    title: Mapped[str] = mapped_column(String(200))
    body: Mapped[str] = mapped_column(String(400), default="")
    payload: Mapped[dict | None] = mapped_column(JSON)
    seen: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


# ---------- competitions ----------
class Competition(Base):
    __tablename__ = "competitions"
    id: Mapped[int] = mapped_column(primary_key=True)
    mosque_id: Mapped[int] = mapped_column(ForeignKey("mosques.id"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)
    scope: Mapped[str] = mapped_column(String(10), default="mosque")  # mosque | halaqas
    show_ranking: Mapped[bool] = mapped_column(Boolean, default=True)
    draft: Mapped[bool] = mapped_column(Boolean, default=True)
    finalized: Mapped[bool] = mapped_column(Boolean, default=False)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))

    tasks: Mapped[list["CompetitionTask"]] = relationship(cascade="all, delete-orphan", order_by="CompetitionTask.id")
    halaqas: Mapped[list["CompetitionHalaqa"]] = relationship(cascade="all, delete-orphan")


class CompetitionHalaqa(Base):
    __tablename__ = "competition_halaqas"
    id: Mapped[int] = mapped_column(primary_key=True)
    competition_id: Mapped[int] = mapped_column(ForeignKey("competitions.id"))
    halaqa_id: Mapped[int] = mapped_column(ForeignKey("halaqas.id"))


class CompetitionTask(Base):
    """kind: attendance | recitation_pages | homework (automatic) | check | count (student logs them daily)."""

    __tablename__ = "competition_tasks"
    id: Mapped[int] = mapped_column(primary_key=True)
    competition_id: Mapped[int] = mapped_column(ForeignKey("competitions.id"))
    kind: Mapped[str] = mapped_column(String(20))
    group: Mapped[str] = mapped_column(String(60), default="عام")  # card the task appears in
    title: Mapped[str] = mapped_column(String(200))
    icon: Mapped[str] = mapped_column(String(10), default="⭐")
    points: Mapped[int]  # per occurrence (check) / per `per_units` units (count) / per page
    per_units: Mapped[int] = mapped_column(default=1)  # count tasks: points granted per this many units
    unit: Mapped[str | None] = mapped_column(String(20))
    target: Mapped[int | None]  # display goal, e.g. 500
    max_per_event: Mapped[int | None]  # cap on units counted per event/day
    requires_approval: Mapped[bool] = mapped_column(Boolean, default=False)


class TaskClaim(Base):
    __tablename__ = "task_claims"
    __table_args__ = (UniqueConstraint("task_id", "student_id", "day"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("competition_tasks.id"))
    competition_id: Mapped[int] = mapped_column(ForeignKey("competitions.id"))
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    day: Mapped[date] = mapped_column(Date, default=today)
    amount: Mapped[int] = mapped_column(default=1)  # 1 for check tasks, the count for count tasks
    status: Mapped[str] = mapped_column(String(10), default="approved")
    decided_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
