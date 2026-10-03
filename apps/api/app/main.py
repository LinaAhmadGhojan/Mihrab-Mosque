import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from .db import Base, SessionLocal, engine
from .models import Gender, Role, User
from .routers import announcements, halaqas, people, play, work
from .security import hash_password
from .services import seed_badges


def seed_admin():
    """The system manager account is fixed (SRS #12). Credentials come from env."""
    login = os.getenv("ADMIN_LOGIN", "admin@mihrab.local")
    password = os.getenv("ADMIN_PASSWORD", "admin1234")
    with SessionLocal() as db:
        if not db.scalar(select(User).where(User.role == Role.admin)):
            db.add(User(role=Role.admin, login=login, password_hash=hash_password(password), full_name="مدير المنظومة", gender=Gender.male))
            db.commit()


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(engine)
    seed_admin()
    with SessionLocal() as db:
        seed_badges(db)
    yield


app = FastAPI(title="Mihrab API", version="0.1.0", lifespan=lifespan)

# Capacitor (Android) serves the app from https://localhost; browsers use the web origin.
origins = os.getenv("CORS_ORIGINS", "http://localhost:3010,http://localhost:3000,https://localhost,capacitor://localhost,http://localhost").split(",")
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["*"], allow_headers=["*"])

for r in (people.router, halaqas.router, work.router, announcements.router, play.router):
    app.include_router(r)


@app.get("/health")
def health():
    return {"ok": True}
