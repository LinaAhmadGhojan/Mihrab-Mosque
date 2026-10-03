"""Fill a running API with demo data:  python scripts/seed_demo.py [base_url]"""
import sys

import httpx

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8010"
PW = "demo1234"


def client(login=None, pw=None):
    c = httpx.Client(base_url=BASE, timeout=20)
    if login:
        r = c.post("/auth/login", json={"login": login, "password": pw})
        r.raise_for_status()
        c.headers["Authorization"] = f"Bearer {r.json()['token']}"
    return c


def post(c, path, **body):
    r = c.post(path, json=body)
    if r.status_code == 409:
        return None
    r.raise_for_status()
    return r.json()


admin = client("admin@mihrab.local", "admin1234")
post(admin, "/supervisors", full_name="الشيخ محمود الدمشقي", login="supervisor@demo", password=PW, license_no="أوقاف-1024", mosque_name="مسجد العفيف", address="دمشق", phone="0933000001")

sup = client("supervisor@demo", PW)
t_m = post(sup, "/teachers", full_name="الأستاذ عمر الحلبي", login="teacher@demo", password=PW, gender="male", age=34, certificates="إجازة برواية حفص")
t_f = post(sup, "/teachers", full_name="الأستاذة هدى الشامي", login="teacher.f@demo", password=PW, gender="female", age=29, certificates="إجازة برواية حفص")
teachers = {t["login"]: t for t in sup.get("/teachers").json()}
h1 = post(sup, "/halaqas", name="حلقة الفاتحة", teacher_id=teachers["teacher@demo"]["id"])
h2 = post(sup, "/halaqas", name="حلقة النور (بنات)", teacher_id=teachers["teacher.f@demo"]["id"])
halaqas = {h["name"]: h["id"] for h in sup.get("/halaqas").json()}

tm = client("teacher@demo", PW)
for i, (n, age) in enumerate([("أحمد الصالح", 9), ("عبد الرحمن نور", 11), ("يوسف الحمصي", 8)]):
    post(tm, "/students", full_name=n, login=f"ahmad{i}@demo", password=PW, age=age, father_name="خالد", mother_name="سمر", education_stage="ابتدائي", grade="الرابع", halaqa_id=halaqas["حلقة الفاتحة"])

tf = client("teacher.f@demo", PW)
post(tf, "/students", full_name="فاطمة الصالح", login="fatima@demo", password=PW, gender="female", age=10, education_stage="ابتدائي", halaqa_id=halaqas["حلقة النور (بنات)"])

students = tm.get("/students").json()
s = students[0]
rec = post(tm, "/recitations", student_id=s["id"], kind="quran", start_page=582, end_page=583, grade="ممتاز")
post(tm, f"/recitations/{rec['id']}/notes", page=582, ayah=4, text="انتبه لمدّ الصلة")
post(tm, "/recitations", student_id=s["id"], kind="hadith", start_page=1, end_page=1, grade="جيد جداً")
post(tm, "/homework", student_id=s["id"], text="حفظ سورة النبأ من ١ إلى ١٦", due="2026-10-10")
post(tm, "/attendance", student_id=s["id"], present=True)
post(admin, "/announcements", kind="general", title="ختمة جماعية في رمضان", body="فُتح باب التسجيل في الختمة الجماعية، يرجى مراجعة المشرف.")
post(sup, "/announcements", kind="admin", title="موعد المراجعة الأسبوعية", body="تُعقد المراجعة يوم الخميس بعد صلاة العصر.")
from datetime import date, timedelta

today = date.today()
def t(kind, group, title, icon, points, **kw):
    return {"kind": kind, "group": group, "title": title, "icon": icon, "points": points, **kw}


comp = post(
    sup, "/competitions", name="مسابقة ترتيل", description="مسابقة لتحفيز الطلاب على الحفظ والمراجعة والالتزام.",
    start_date=str(today - timedelta(days=3)), end_date=str(today + timedelta(days=14)), scope="mosque", show_ranking=True,
    tasks=[
        t("check", "الصلوات", "صلاة الفجر في الجماعة", "🌅", 10),
        t("check", "الصلوات", "صلاة الظهر في الجماعة", "☀️", 10),
        t("check", "الصلوات", "صلاة العصر في الجماعة", "🌤️", 10),
        t("check", "الصلوات", "صلاة المغرب في الجماعة", "🌇", 10),
        t("check", "الصلوات", "صلاة العشاء في الجماعة", "🌙", 10),
        t("count", "الأذكار", "الصلاة على النبي ﷺ", "🤍", 5, per_units=100, unit="مرة", target=500),
        t("count", "الأذكار", "الاستغفار", "🤲", 5, per_units=100, unit="مرة", target=300),
        t("count", "القرآن", "قراءة القرآن", "📗", 10, per_units=5, unit="صفحة", target=20),
        t("check", "أعمال صالحة", "بر الوالدين", "❤️", 20),
        t("check", "أعمال صالحة", "صدقة اليوم", "🎁", 10),
        t("attendance", "تلقائي", "حضور الحلقة", "🕌", 5),
        t("recitation_pages", "تلقائي", "تسميع صفحة", "📖", 2),
        t("homework", "تلقائي", "إكمال الواجب", "📝", 10),
    ],
)
if comp:
    sup.post(f"/competitions/{comp['id']}/publish").raise_for_status()
for st in students:
    post(tm, "/attendance", student_id=st["id"], present=True)
post(tm, "/recitations", student_id=students[1]["id"], kind="quran", start_page=560, end_page=566, grade="جيد جداً")
print("seeded. logins (password: demo1234): supervisor@demo, teacher@demo, teacher.f@demo, ahmad0@demo, fatima@demo")
