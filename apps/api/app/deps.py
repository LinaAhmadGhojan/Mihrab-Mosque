from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .db import get_db
from .models import Halaqa, Role, User
from .security import read_token

bearer = HTTPBearer(auto_error=False)


def current_user(
    cred: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    uid = read_token(cred.credentials) if cred else None
    user = db.get(User, uid) if uid else None
    if not user:
        raise HTTPException(401, "يرجى تسجيل الدخول")
    return user


def require(*roles: Role):
    def dep(user: User = Depends(current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(403, "لا تملك صلاحية لهذه العملية")
        return user

    return dep


def get_or_404(db: Session, model, id: int):
    obj = db.get(model, id)
    if not obj:
        raise HTTPException(404, "غير موجود")
    return obj


def student_access(db: Session, me: User, student: User) -> bool:
    """Whether `me` may see this student's records."""
    if student.role != Role.student:
        return False
    if me.role == Role.admin:
        return True
    if me.role == Role.student:
        return me.id == student.id
    if me.role == Role.supervisor:
        return me.mosque_id is not None and me.mosque_id == student.mosque_id
    if me.role == Role.teacher:
        h = db.get(Halaqa, student.halaqa_id) if student.halaqa_id else None
        return bool(h and h.teacher_id == me.id)
    return False


def student_or_403(db: Session, me: User, student_id: int) -> User:
    student = get_or_404(db, User, student_id)
    if not student_access(db, me, student):
        raise HTTPException(403, "لا تملك صلاحية على هذا الطالب")
    return student
