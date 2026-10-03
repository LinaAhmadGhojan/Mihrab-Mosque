// Captures every screen of every role, on a phone and on a laptop, into docs/screenshots/{mobile,desktop}.
// Needs: API on :8010 with a FRESH database seeded by apps/api/scripts/seed_demo.py,
//        web dev/prod server on :3010, and Microsoft Edge installed.
//   node scripts/screenshots.mjs
import { chromium } from "playwright-core";
import { mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const WEB = process.env.WEB_URL ?? "http://localhost:3010";
const API = process.env.API_URL ?? "http://localhost:8010";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../../docs/screenshots");
const PW = "demo1234";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(path, { token, method = "GET", body } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}
const login = (l, p = PW) => api("/auth/login", { method: "POST", body: { login: l, password: p } });

const browser = await chromium.launch({ channel: "msedge" });
const failures = [];

async function newPage({ as, theme = "men", desktop }) {
  const ctx = await browser.newContext({
    viewport: desktop ? { width: 1366, height: 820 } : { width: 390, height: 844 },
    deviceScaleFactor: desktop ? 1 : 2,
    isMobile: !desktop,
    hasTouch: !desktop,
    locale: "ar",
  });
  const session = as ? await login(...(Array.isArray(as) ? as : [as])) : null;
  await ctx.addInitScript(([t, s]) => {
    if (t) localStorage.setItem("mihrab-theme", t);
    if (s) {
      localStorage.setItem("mihrab-token", s.token);
      localStorage.setItem("mihrab-user", JSON.stringify(s.user));
    }
  }, [theme, session]);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => console.warn("page error:", e.message));
  return { p, ctx };
}

async function runVariant(v) {
  const dir = join(ROOT, v.name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  let n = 0;

  const go = async (p, path, wait = 900) => {
    await p.goto(WEB + path, { waitUntil: "networkidle" });
    await sleep(wait);
  };
  // full = whole scrollable page (laptop only; phone keeps its fixed bottom bar in view)
  const shot = async (p, name, { full = v.desktop } = {}) => {
    const file = `${String(++n).padStart(2, "0")}-${name}.png`;
    await p.screenshot({ path: join(dir, file), fullPage: full });
    console.log(v.name, file);
  };
  const step = async (name, fn) => {
    try {
      await fn();
    } catch (e) {
      failures.push(`${v.name}/${name}: ${e.message.split("\n")[0]}`);
      console.warn("FAILED", v.name, name, e.message.split("\n")[0]);
    }
  };
  const scrollTop = (p, y) => p.evaluate((yy) => window.scrollTo(0, yy), y).then(() => sleep(300));
  const dismiss = async (p) => {
    for (let i = 0; i < 12; i++) {
      const b = p.getByRole("button", { name: /رائع/ });
      if (!(await b.count())) break;
      await b.first().click();
      await sleep(250);
    }
  };
  const sheet = async (p, btn, name) => {
    await p.getByRole("button", { name: btn }).first().click();
    await sleep(800);
    await shot(p, name, { full: false });
    await p.keyboard.press("Escape");
    await sleep(300);
  };
  const focusCards = async (p) => {
    await p.evaluate(() => {
      document.querySelector(".snap-mandatory")?.scrollIntoView({ block: "start" });
      if (window.innerWidth < 768) window.scrollBy(0, -330);
      else window.scrollBy(0, -140);
    });
    await sleep(400);
  };

  // ---------- public ----------
  await step("public", async () => {
    const { p, ctx } = await newPage({ theme: "men", desktop: v.desktop });
    await p.goto(WEB + "/", { waitUntil: "domcontentloaded" });
    await sleep(700);
    await shot(p, "public-splash", { full: false });
    await p.evaluate(() => localStorage.removeItem("mihrab-theme"));
    await go(p, "/welcome/");
    await shot(p, "public-welcome-theme-choice");
    await p.evaluate(() => localStorage.setItem("mihrab-theme", "men"));
    await go(p, "/login/");
    await shot(p, "public-login");
    await ctx.close();
  });

  // ---------- prep: give the student something to celebrate ----------
  const teacher = await login("teacher@demo");
  const students = await api("/students", { token: teacher.token });
  const ahmad = students.find((s) => s.login === "ahmad0@demo");
  const me = students.find((s) => s.login === v.student);
  await api("/recitations", { token: teacher.token, method: "POST", body: { student_id: me.id, kind: "quran", start_page: 584, end_page: 586, grade: "ممتاز" } });

  // ---------- student (men theme) ----------
  await step("student", async () => {
    const { p, ctx } = await newPage({ as: v.student, desktop: v.desktop });
    await go(p, "/app/", 1500);
    await shot(p, "student-celebration", { full: false });
    await dismiss(p);
    await sleep(400);
    await shot(p, "student-home");
    if (!v.desktop) {
      await scrollTop(p, 640);
      await shot(p, "student-home-competition-and-halaqa");
    }

    await go(p, "/app/competition/?id=1", 1200);
    await dismiss(p);
    await scrollTop(p, 0);
    await shot(p, "student-competition-top");
    for (const t of ["صلاة الفجر", "صلاة الظهر", "صلاة العصر"]) {
      const row = p.getByRole("button", { name: new RegExp(t) }).first();
      if (!(await row.evaluate((el) => el.parentElement.className.includes("bg-tint")))) await row.click();
      await sleep(150);
    }
    await focusCards(p);
    await shot(p, "student-competition-prayers-card", { full: false });
    await p.getByRole("button", { name: "البطاقة التالية" }).click();
    await sleep(900);
    await p.getByRole("button", { name: /الصلاة على النبي/ }).first().click();
    await sleep(300);
    await p.getByLabel(/عدد الصلاة على النبي/).fill("500");
    await sleep(500);
    await focusCards(p);
    await shot(p, "student-competition-counter-card", { full: false });
    await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await sleep(500);
    await shot(p, "student-competition-save-and-leaderboard", { full: false });
    await p.getByRole("button", { name: /^\s*حفظ\s*$/ }).last().click();
    await sleep(1500);
    await shot(p, "student-competition-saved-celebration", { full: false });
    await dismiss(p);
    await sleep(500);
    await shot(p, "student-competition-after-save");

    await go(p, "/app/competitions/");
    await shot(p, "student-competitions-list");
    await go(p, "/app/achievements/", 1200);
    await shot(p, "student-achievements");
    if (!v.desktop) {
      await scrollTop(p, 700);
      await shot(p, "student-achievements-badges");
    }
    await go(p, "/app/my-halaqa/");
    await shot(p, "student-my-halaqa");
    await go(p, "/app/student/");
    await shot(p, "student-my-record");
    await go(p, "/app/homework/");
    await shot(p, "student-homework");
    await go(p, "/app/announcements/");
    await shot(p, "student-announcements");
    await go(p, "/app/profile/");
    await shot(p, "student-profile-settings");
    await ctx.close();
  });

  // ---------- student (women theme) ----------
  await step("women", async () => {
    const { p, ctx } = await newPage({ as: "fatima@demo", theme: "women", desktop: v.desktop });
    await go(p, "/app/", 1500);
    await dismiss(p);
    await shot(p, "women-theme-student-home");
    await go(p, "/app/competition/?id=1", 1200);
    await dismiss(p);
    await scrollTop(p, 0);
    await focusCards(p);
    await shot(p, "women-theme-competition", { full: false });
    await go(p, "/app/achievements/", 1000);
    await shot(p, "women-theme-achievements");
    await ctx.close();
  });

  // ---------- teacher ----------
  await step("teacher", async () => {
    const { p, ctx } = await newPage({ as: "teacher@demo", desktop: v.desktop });
    await go(p, "/app/", 1200);
    await shot(p, "teacher-home-attendance");
    await go(p, "/app/students/");
    await shot(p, "teacher-students");
    await sheet(p, /^\s*إضافة\s*$/, "teacher-add-student-form");
    await go(p, `/app/student/?id=${ahmad.id}`, 1200);
    await shot(p, "teacher-student-profile");
    if (!v.desktop) {
      await scrollTop(p, 760);
      await shot(p, "teacher-student-history");
    }
    await sheet(p, /^\s*واجب\s*$/, "teacher-add-homework-form");
    await sheet(p, /ملاحظة/, "teacher-add-note-form");
    await go(p, "/app/recitation/");
    await shot(p, "teacher-new-recitation");
    await go(p, "/app/competitions/");
    await shot(p, "teacher-competitions-list");
    await go(p, "/app/competition/?id=1", 1200);
    await shot(p, "teacher-competition-leaderboard");
    await go(p, "/app/announcements/");
    await shot(p, "teacher-announcements");
    await sheet(p, /نشر/, "teacher-publish-announcement-form");
    await go(p, "/app/profile/");
    await shot(p, "teacher-profile");
    await ctx.close();
  });

  // ---------- supervisor ----------
  await step("supervisor", async () => {
    const { p, ctx } = await newPage({ as: "supervisor@demo", desktop: v.desktop });
    await go(p, "/app/", 1200);
    await shot(p, "supervisor-home");
    await go(p, "/app/halaqas/");
    await shot(p, "supervisor-halaqas");
    await sheet(p, /حلقة جديدة/, "supervisor-new-halaqa-form");
    await go(p, "/app/teachers/");
    await shot(p, "supervisor-teachers");
    await sheet(p, /^\s*إضافة\s*$/, "supervisor-add-teacher-form");
    await go(p, "/app/students/");
    await shot(p, "supervisor-all-students");
    await go(p, "/app/competitions/");
    await shot(p, "supervisor-competitions");
    await p.getByRole("button", { name: /مسابقة/ }).first().click();
    await sleep(900);
    await shot(p, "supervisor-competition-builder", { full: false });
    await p.evaluate(() => document.querySelector("[role=dialog]")?.scrollTo(0, 650));
    await sleep(400);
    await shot(p, "supervisor-competition-builder-tasks", { full: false });
    await p.keyboard.press("Escape");
    await sleep(300);
    await go(p, "/app/competition/?id=2", 1200);
    await shot(p, "supervisor-draft-competition-publish");
    await go(p, "/app/competition/?id=1", 1200);
    await shot(p, "supervisor-active-competition");
    await go(p, "/app/announcements/");
    await shot(p, "supervisor-announcements");
    await go(p, "/app/profile/");
    await shot(p, "supervisor-profile");
    await ctx.close();
  });

  // ---------- admin ----------
  await step("admin", async () => {
    const { p, ctx } = await newPage({ as: ["admin@mihrab.local", "admin1234"], desktop: v.desktop });
    await go(p, "/app/", 1200);
    await shot(p, "admin-home");
    await go(p, "/app/supervisors/");
    await shot(p, "admin-supervisors");
    await sheet(p, /^\s*إضافة\s*$/, "admin-add-supervisor-form");
    await go(p, "/app/announcements/");
    await shot(p, "admin-announcements");
    await sheet(p, /نشر/, "admin-publish-announcement-form");
    await ctx.close();
  });
}

// a draft competition for the supervisor screens
const sup = await login("supervisor@demo");
const d = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
await api("/competitions", {
  token: sup.token,
  method: "POST",
  body: {
    name: "مسابقة الأذكار (مسودة)", description: "مسابقة أسبوعية", start_date: d(1), end_date: d(8), scope: "mosque", show_ranking: true,
    tasks: [{ kind: "count", group: "الأذكار", title: "الاستغفار", icon: "🤲", points: 5, per_units: 100, unit: "مرة", target: 300 }, { kind: "check", group: "عام", title: "بر الوالدين", icon: "❤️", points: 20 }],
  },
});

await runVariant({ name: "mobile", desktop: false, student: "ahmad0@demo" });
await runVariant({ name: "desktop", desktop: true, student: "ahmad1@demo" });
await browser.close();
if (failures.length) {
  console.log("\nFAILED STEPS:\n" + failures.join("\n"));
  process.exitCode = 1;
}
