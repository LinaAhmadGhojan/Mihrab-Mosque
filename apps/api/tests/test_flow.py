import os
import tempfile

os.environ["DATABASE_URL"] = f"sqlite:///{tempfile.mkdtemp()}/t.db"

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


def auth(c, login, pw):
    r = c.post("/auth/login", json={"login": login, "password": pw})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


def person(**kw):
    return {"full_name": "اسم تجريبي", "password": "secret1", **kw}


def test_full_flow_and_permissions():
    with TestClient(app) as c:
        admin = auth(c, "admin@mihrab.local", "admin1234")

        # admin -> supervisor (SRS 1)
        r = c.post("/supervisors", headers=admin, json=person(login="sup1", license_no="L-1", mosque_name="مسجد العفيف"))
        assert r.status_code == 201, r.text
        sup = auth(c, "sup1", "secret1")

        # supervisor -> teacher (13), halaqa (14)
        t = c.post("/teachers", headers=sup, json=person(login="teach1", gender="female")).json()
        teach = auth(c, "teach1", "secret1")
        h = c.post("/halaqas", headers=sup, json={"name": "حلقة الفاتحة", "teacher_id": t["id"]})
        assert h.status_code == 201, h.text
        hid = h.json()["id"]

        # teacher -> student (2)
        s = c.post("/students", headers=teach, json=person(login="stu1", halaqa_id=hid, age=9, father_name="أبو أحمد")).json()
        stu = auth(c, "stu1", "secret1")

        # roles are enforced server-side
        assert c.post("/supervisors", headers=sup, json=person(login="x", mosque_name="m")).status_code == 403
        assert c.post("/teachers", headers=teach, json=person(login="y")).status_code == 403
        assert c.post("/recitations", headers=stu, json={"student_id": s["id"], "kind": "quran", "start_page": 1, "end_page": 2}).status_code == 403
        assert c.get("/students", headers=stu).status_code == 403

        # teacher outside the halaqa can't touch the student
        other_t = c.post("/teachers", headers=sup, json=person(login="teach2")).json()
        other = auth(c, "teach2", "secret1")
        assert c.get(f"/students/{s['id']}", headers=other).status_code == 403

        # attendance (6), recitation (10) + note (11), homework (16-18)
        assert c.post("/attendance", headers=teach, json={"student_id": s["id"]}).json()["present"] is True
        rec = c.post("/recitations", headers=teach, json={"student_id": s["id"], "kind": "quran", "start_page": 582, "end_page": 583, "grade": "ممتاز"})
        assert rec.status_code == 201, rec.text
        rid = rec.json()["id"]
        assert c.post("/recitations", headers=teach, json={"student_id": s["id"], "kind": "quran", "start_page": 5, "end_page": 2}).status_code == 422
        assert c.post(f"/recitations/{rid}/notes", headers=teach, json={"page": 582, "ayah": 4, "text": "مدّ"}).status_code == 201
        hw = c.post("/homework", headers=teach, json={"student_id": s["id"], "text": "حفظ النبأ"}).json()
        assert c.post(f"/homework/{hw['id']}/done", headers=teach).json()["done"] is True

        # student sees own records only
        assert len(c.get(f"/students/{s['id']}/recitations", headers=stu).json()[0]["notes"]) == 1
        assert len(c.get(f"/students/{s['id']}/homework", headers=stu).json()) == 1

        # announcements (7-9)
        assert c.post("/announcements", headers=admin, json={"kind": "general", "title": "إعلان", "body": "نص"}).status_code == 201
        assert c.post("/announcements", headers=teach, json={"kind": "general", "title": "xx", "body": "y"}).status_code == 403
        assert c.post("/announcements", headers=teach, json={"kind": "halaqa", "title": "مراجعة", "body": "غداً", "halaqa_id": hid}).status_code == 201
        assert len(c.get("/announcements", headers=stu).json()) == 2
        assert len(c.get("/announcements", headers=other).json()) == 1  # not their halaqa

        # search (5) and halaqa overview (15)
        assert len(c.get("/students?q=تجريبي", headers=teach).json()) == 1
        det = c.get("/halaqas", headers=sup).json()[0]
        assert det["teacher_name"] and len(det["students"]) == 1

        # no token -> 401; bad password -> 401
        assert c.get("/students").status_code == 401
        assert c.post("/auth/login", json={"login": "stu1", "password": "nope"}).status_code == 401
