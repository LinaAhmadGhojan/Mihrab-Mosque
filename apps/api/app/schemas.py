from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from .models import AnnouncementKind, Gender, RecitationKind, Role


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class LoginIn(BaseModel):
    login: str
    password: str


class TokenOut(BaseModel):
    token: str
    user: "UserOut"


class UserBase(BaseModel):
    full_name: str = Field(min_length=2, max_length=200)
    gender: Gender = Gender.male
    father_name: str | None = None
    mother_name: str | None = None
    age: int | None = Field(None, ge=3, le=100)
    education_stage: str | None = None
    grade: str | None = None
    address: str | None = None
    phone: str | None = None
    certificates: str | None = None


class UserCreate(UserBase):
    login: str = Field(min_length=3)
    password: str = Field(min_length=6)
    license_no: str | None = None
    mosque_name: str | None = None  # supervisors: mosque to create/join
    halaqa_id: int | None = None  # students


class UserUpdate(BaseModel):
    full_name: str | None = None
    father_name: str | None = None
    mother_name: str | None = None
    age: int | None = Field(None, ge=3, le=100)
    education_stage: str | None = None
    grade: str | None = None
    address: str | None = None
    phone: str | None = None
    certificates: str | None = None
    license_no: str | None = None
    password: str | None = Field(None, min_length=6)
    halaqa_id: int | None = None


class UserOut(ORM, UserBase):
    id: int
    role: Role
    login: str
    license_no: str | None = None
    mosque_id: int | None = None
    halaqa_id: int | None = None


class HalaqaIn(BaseModel):
    name: str = Field(min_length=2)
    teacher_id: int | None = None


class HalaqaOut(ORM):
    id: int
    name: str
    mosque_id: int
    supervisor_id: int
    teacher_id: int | None


class HalaqaDetail(HalaqaOut):
    teacher_name: str | None
    students: list[UserOut]


class AttendanceIn(BaseModel):
    student_id: int
    day: date | None = None
    present: bool = True


class AttendanceOut(ORM):
    id: int
    student_id: int
    day: date
    present: bool


class RecitationIn(BaseModel):
    student_id: int
    kind: RecitationKind
    start_page: int = Field(ge=1, le=604)
    end_page: int = Field(ge=1, le=604)
    grade: str | None = None


class RecitationUpdate(BaseModel):
    kind: RecitationKind | None = None
    start_page: int | None = Field(None, ge=1, le=604)
    end_page: int | None = Field(None, ge=1, le=604)
    grade: str | None = None


class NoteIn(BaseModel):
    page: int = Field(ge=1, le=604)
    ayah: int | None = Field(None, ge=1, le=286)
    text: str = Field(min_length=1)


class NoteUpdate(BaseModel):
    page: int | None = Field(None, ge=1, le=604)
    ayah: int | None = Field(None, ge=1, le=286)
    text: str | None = None


class NoteOut(ORM, NoteIn):
    id: int
    recitation_id: int


class RecitationOut(ORM):
    id: int
    student_id: int
    teacher_id: int
    kind: RecitationKind
    start_page: int
    end_page: int
    grade: str | None
    created_at: datetime
    notes: list[NoteOut] = []


class AnnouncementIn(BaseModel):
    kind: AnnouncementKind
    title: str = Field(min_length=2)
    body: str
    image_url: str | None = None
    halaqa_id: int | None = None


class AnnouncementOut(ORM):
    id: int
    author_id: int
    kind: AnnouncementKind
    halaqa_id: int | None
    title: str
    body: str
    image_url: str | None
    created_at: datetime


class HomeworkIn(BaseModel):
    student_id: int
    text: str = Field(min_length=1)
    due: date | None = None


class HomeworkUpdate(BaseModel):
    text: str | None = None
    due: date | None = None


class HomeworkOut(ORM):
    id: int
    student_id: int
    teacher_id: int
    text: str
    due: date | None
    done: bool
    created_at: datetime


TokenOut.model_rebuild()
