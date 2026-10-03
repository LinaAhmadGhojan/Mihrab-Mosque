import os
import tempfile

os.environ["DATABASE_URL"] = f"sqlite:///{tempfile.mkdtemp()}/p.db"

from datetime import timedelta  # noqa: E402

from fastapi.testclient import TestClient  # noqa: E402

from app.clock import today  # noqa: E402
from app.main import app  # noqa: E402


def auth(c, login, pw="secret1"):
    r = c.post("/auth/login", json={"login": login, "password": pw})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


def person(**kw):
    return {"full_name": "اسم تجريبي", "password": "secret1", **kw}


def setup_mosque(c, admin, tag, mosque):
    c.post("/supervisors", headers=admin, json=person(login=f"sup-{tag}", license_no="L", mosque_name=mosque))
    sup = auth(c, f"sup-{tag}")
    t = c.post("/teachers", headers=sup, json=person(login=f"t-{tag}")).json()
    h = c.post("/halaqas", headers=sup, json={"name": f"حلقة {tag}", "teacher_id": t["id"]}).json()
    teach = auth(c, f"t-{tag}")
    stu = c.post("/students", headers=teach, json=person(login=f"s-{tag}", full_name=f"طالب {tag}", halaqa_id=h["id"])).json()
    return sup, teach, auth(c, f"s-{tag}"), h["id"], stu["id"]


def comp_body(**kw):
    d = today()
    body = {
        "name": "مسابقة ترتيل",
        "start_date": str(d - timedelta(days=1)),
        "end_date": str(d + timedelta(days=7)),
        "scope": "mosque",
        "tasks": [
            {"kind": "attendance", "title": "حضور الحلقة", "points": 5},
            {"kind": "recitation_pages", "title": "تسميع صفحة", "points": 2},
            {"kind": "homework", "title": "إكمال الواجب", "points": 10},
            {"kind": "check", "group": "أعمال صالحة", "title": "بر الوالدين", "icon": "❤️", "points": 20},
            {"kind": "count", "group": "الأذكار", "title": "الصلاة على النبي", "icon": "🤍", "points": 5, "per_units": 100, "unit": "مرة", "target": 500},
        ],
    }
    return {**body, **kw}


def pts(c, headers):
    return c.get("/me/dashboard", headers=headers).json()["competition"]["me"]["points"]


def test_gamification_and_isolation():
    with TestClient(app) as c:
        admin = auth(c, "admin@mihrab.local", "admin1234")
        supA, teachA, stuA, hA, sidA = setup_mosque(c, admin, "a", "مسجد أ")
        supB, teachB, stuB, hB, sidB = setup_mosque(c, admin, "b", "مسجد ب")

        # a second student in mosque A so rankings have two people
        s2 = c.post("/students", headers=teachA, json=person(login="s-a2", full_name="طالب أ٢", halaqa_id=hA)).json()
        stu2 = auth(c, "s-a2")

        # supervisor builds + publishes a competition
        r = c.post("/competitions", headers=supA, json=comp_body())
        assert r.status_code == 201, r.text
        cid = r.json()["id"]
        assert r.json()["status"] == "draft"
        assert c.get("/competitions", headers=stuA).json() == []  # drafts hidden from students
        assert c.post(f"/competitions/{cid}/publish", headers=supA).json()["status"] == "active"
        assert len(c.get("/competitions", headers=stuA).json()) == 1

        # --- mosque isolation ---
        assert c.get("/competitions", headers=stuB).json() == []
        assert c.get(f"/competitions/{cid}", headers=stuB).status_code == 403
        assert c.get(f"/competitions/{cid}/leaderboard", headers=stuB).status_code == 403
        assert c.post(f"/competitions/{cid}/publish", headers=supB).status_code == 403
        assert c.get(f"/students/{sidA}", headers=teachB).status_code == 403
        assert c.get(f"/students/{sidA}", headers=stuB).status_code == 403

        # --- attendance: xp + competition points, idempotent and reversible ---
        c.post("/attendance", headers=teachA, json={"student_id": sidA, "present": True})
        c.post("/attendance", headers=teachA, json={"student_id": sidA, "present": True})  # again: no double count
        d = c.get("/me/dashboard", headers=stuA).json()
        assert d["level"]["xp"] == 5
        assert pts(c, stuA) == 5
        c.post("/attendance", headers=teachA, json={"student_id": sidA, "present": False})
        assert c.get("/me/dashboard", headers=stuA).json()["level"]["xp"] == 0  # reversed
        c.post("/attendance", headers=teachA, json={"student_id": sidA, "present": True})

        # --- recitation: pages * points, edit corrects (no double award) ---
        rec = c.post("/recitations", headers=teachA, json={"student_id": sidA, "kind": "quran", "start_page": 1, "end_page": 10, "grade": "ممتاز"}).json()
        d = c.get("/me/dashboard", headers=stuA).json()
        assert pts(c, stuA) == 5 + 20  # 10 pages * 2
        assert d["level"]["xp"] == 5 + 30  # 10 + 2*10
        c.patch(f"/recitations/{rec['id']}", headers=teachA, json={"end_page": 5})
        d = c.get("/me/dashboard", headers=stuA).json()
        assert pts(c, stuA) == 5 + 10
        assert d["level"]["xp"] == 5 + 20
        assert d["metrics"]["pages"] == 5

        # --- badges (data-driven) ---
        badges = {b["code"]: b for b in c.get("/me/badges", headers=stuA).json()}
        assert badges["first_pages"]["earned"] and badges["first_recitation"]["earned"] and badges["comp_join"]["earned"]
        assert not badges["pages_20"]["earned"] and 0 < badges["pages_20"]["progress"] < 1

        # --- homework ---
        hw = c.post("/homework", headers=teachA, json={"student_id": sidA, "text": "حفظ"}).json()
        c.post(f"/homework/{hw['id']}/done", headers=teachA)
        assert pts(c, stuA) == 5 + 10 + 10

        # --- daily self-logged tasks: check + count (no approval step) ---
        comp = c.get(f"/competitions/{cid}", headers=stuA).json()
        check = next(t for t in comp["tasks"] if t["kind"] == "check")
        count = next(t for t in comp["tasks"] if t["kind"] == "count")
        assert check["group"] == "أعمال صالحة" and count["per_units"] == 100
        before = pts(c, stuA)
        day = str(today())
        r = c.put(f"/competitions/{cid}/log", headers=stuA, json={"day": day, "entries": [{"task_id": check["id"]}, {"task_id": count["id"], "amount": 550}]})
        assert r.status_code == 200, r.text
        assert r.json()["gained"] == 20 + 25  # 550 // 100 * 5
        assert pts(c, stuA) == before + 45
        # saving the same log again does not double count
        c.put(f"/competitions/{cid}/log", headers=stuA, json={"day": day, "entries": [{"task_id": check["id"]}, {"task_id": count["id"], "amount": 550}]})
        assert pts(c, stuA) == before + 45
        # changing the count corrects the points; unchecking removes them
        c.put(f"/competitions/{cid}/log", headers=stuA, json={"day": day, "entries": [{"task_id": count["id"], "amount": 200}, {"task_id": check["id"], "done": False}]})
        assert pts(c, stuA) == before + 10
        assert c.get(f"/competitions/{cid}/log?day={day}", headers=stuA).json()["entries"][str(count["id"])]["amount"] == 200
        # rules: future days and automatic tasks are rejected; other mosque's student can't log
        assert c.put(f"/competitions/{cid}/log", headers=stuA, json={"day": str(today() + timedelta(days=1)), "entries": []}).status_code == 422
        auto = next(t for t in comp["tasks"] if t["kind"] == "attendance")
        assert c.put(f"/competitions/{cid}/log", headers=stuA, json={"day": day, "entries": [{"task_id": auto["id"]}]}).status_code == 422
        assert c.put(f"/competitions/{cid}/log", headers=stuB, json={"day": day, "entries": []}).status_code == 403
        assert c.put(f"/competitions/{cid}/log", headers=teachA, json={"day": day, "entries": []}).status_code == 403

        # --- leaderboard: rank, gap to next, privacy ---
        c.post("/attendance", headers=teachA, json={"student_id": s2["id"], "present": True})
        lb = c.get(f"/competitions/{cid}/leaderboard", headers=stu2).json()
        assert lb["me"]["rank"] == 2 and lb["me"]["to_next"]["rank"] == 1 and lb["me"]["to_next"]["points"] > 0
        assert lb["top"][0]["name"] == "طالب a" and len(lb["top"]) == 2
        c.patch("/me/settings", headers=stuA, json={"show_in_leaderboard": False})
        assert c.get(f"/competitions/{cid}/leaderboard", headers=stu2).json()["top"][0]["name"] == "طالب مجهول"
        mine = c.get(f"/competitions/{cid}/leaderboard", headers=stuA).json()
        assert mine["top"][0]["name"] == "طالب a"  # you still see yourself

        # --- classmates board is halaqa-only ---
        mates = c.get("/me/halaqa", headers=stu2).json()
        assert mates["halaqa"]["name"] == "حلقة a" and len(mates["members"]) == 2
        assert [m["name"] for m in c.get("/me/halaqa", headers=stuB).json()["members"]] == ["طالب b"]

        # --- finalize freezes and awards podium ---
        assert c.post(f"/competitions/{cid}/finalize", headers=supA).json()["status"] == "finalized"
        assert {b["code"]: b for b in c.get("/me/badges", headers=stuA).json()}["comp_gold"]["earned"]
        before = c.get(f"/competitions/{cid}/leaderboard", headers=stuA).json()["me"]["points"]
        c.post("/attendance", headers=teachA, json={"student_id": sidA, "present": False})
        c.post("/attendance", headers=teachA, json={"student_id": sidA, "present": True})
        assert c.get(f"/competitions/{cid}/leaderboard", headers=stuA).json()["me"]["points"] <= before

        # --- notifications drive the celebration UI ---
        notes = c.get("/notifications?unseen=true", headers=stuA).json()
        assert any(n["kind"] == "points" for n in notes) and any(n["kind"] == "badge" for n in notes)
        c.post("/notifications/seen", headers=stuA)
        assert c.get("/notifications?unseen=true", headers=stuA).json() == []

        # --- soft delete keeps history ---
        assert c.delete(f"/students/{sidA}", headers=teachA).status_code == 204
        assert all(s["id"] != sidA for s in c.get("/students", headers=teachA).json())
        assert c.get(f"/students/{sidA}/recitations", headers=teachA).json()  # history kept
        assert c.post("/auth/login", json={"login": "s-a", "password": "secret1"}).status_code == 403
