"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, ChevronLeft, Landmark, Megaphone, Plus, ShieldCheck, Users, X } from "lucide-react";
import { StudentHome } from "@/components/StudentHome";
import { Avatar, Empty, ErrorBox, Loading, useAction } from "@/components/ui";
import { api, ar, useFetch, type Announcement, type Halaqa, type User } from "@/lib/api";
import { roleLabel, useAuth } from "@/lib/auth";

export default function Home() {
  const { user } = useAuth();
  if (!user) return null;
  if (user.role === "student") return <StudentHome user={user} />;
  return (
    <div className="space-y-6">
      <section className="hero rise rounded-[28px] p-6 shadow-lg">
        <p className="text-sm opacity-80">السلام عليكم ورحمة الله — {roleLabel[user.role]}</p>
        <h1 className="mt-1 text-2xl font-extrabold">{user.full_name}</h1>
        <Hero user={user} />
      </section>
      {user.role === "admin" && <AdminHome />}
      {user.role === "supervisor" && <SupervisorHome />}
      {user.role === "teacher" && <TeacherHome />}
      <LatestNews />
    </div>
  );
}

function Stat({ icon: Icon, value, label }: { icon: typeof Users; value: number | string; label: string }) {
  return (
    <div>
      <div className="flex items-center gap-2 text-3xl font-extrabold">
        <Icon size={22} className="text-accent" />
        {typeof value === "number" ? ar(value) : value}
      </div>
      <div className="text-sm opacity-80">{label}</div>
    </div>
  );
}

function Hero({ user }: { user: User }) {
  const sup = useFetch<User[]>(user.role === "admin" ? "/supervisors" : null);
  const hal = useFetch<Halaqa[]>(user.role === "supervisor" || user.role === "teacher" ? "/halaqas" : null);
  const tea = useFetch<User[]>(user.role === "supervisor" ? "/teachers" : null);
  const students = hal.data?.reduce((n, h) => n + h.students.length, 0) ?? 0;

  return (
    <div className="mt-5 flex items-center justify-between gap-4">
      {user.role === "admin" && <Stat icon={ShieldCheck} value={sup.data?.length ?? "…"} label="مشرف" />}
      {user.role === "supervisor" && (
        <>
          <Stat icon={Landmark} value={hal.data?.length ?? "…"} label="حلقة" />
          <Stat icon={Users} value={tea.data?.length ?? "…"} label="معلم" />
          <Stat icon={Users} value={students} label="طالب" />
        </>
      )}
      {user.role === "teacher" && (
        <>
          <Stat icon={Landmark} value={hal.data?.length ?? "…"} label="حلقة" />
          <Stat icon={Users} value={students} label="طالب" />
        </>
      )}
    </div>
  );
}

function AdminHome() {
  return (
    <Link href="/app/supervisors/" className="btn w-full">
      <Plus size={22} /> إدارة المشرفين
    </Link>
  );
}

function SupervisorHome() {
  const { data, loading, error } = useFetch<Halaqa[]>("/halaqas");
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Link href="/app/halaqas/" className="btn">
          <Plus size={20} /> حلقة جديدة
        </Link>
        <Link href="/app/students/" className="btn btn-ghost">
          <Users size={20} /> كل الطلاب
        </Link>
      </div>
      <section>
        <h2 className="mb-3 text-lg font-extrabold">الحلقات</h2>
        {loading ? <Loading /> : error ? <ErrorBox message={error} /> : !data?.length ? <Empty text="لا توجد حلقات بعد. أنشئ أول حلقة." /> : (
          <div className="space-y-3">
            {data.map((h) => (
              <Link key={h.id} href="/app/halaqas/" className="card flex items-center gap-4 p-4">
                <Avatar name={h.name} />
                <div className="flex-1">
                  <div className="font-bold">{h.name}</div>
                  <div className="text-sm text-muted">{h.teacher_name ?? "بدون معلم"} · {ar(h.students.length)} طالب</div>
                </div>
                <ChevronLeft className="text-muted" />
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function TeacherHome() {
  const { data, loading, error } = useFetch<Halaqa[]>("/halaqas");
  const students = data?.flatMap((h) => h.students) ?? [];
  const [marked, setMarked] = useState<Record<number, boolean>>({});
  const act = useAction();

  const mark = (id: number, present: boolean) =>
    act.run(async () => {
      await api("/attendance", { method: "POST", body: { student_id: id, present } });
      setMarked((m) => ({ ...m, [id]: present }));
    });

  return (
    <>
      <Link href="/app/recitation/" className="btn w-full">
        <Plus size={22} /> تسجيل تسميع جديد
      </Link>
      <section>
        <h2 className="mb-3 text-lg font-extrabold">تحضير اليوم</h2>
        <ErrorBox message={act.error} />
        {loading ? <Loading /> : error ? <ErrorBox message={error} /> : !students.length ? <Empty text="لا يوجد طلاب في حلقاتك بعد." /> : (
          <div className="card divide-y divide-line">
            {students.map((s) => (
              <div key={s.id} className="flex items-center gap-3 p-3">
                <Avatar name={s.full_name} size={44} />
                <Link href={`/app/student/?id=${s.id}`} className="flex-1 font-bold">{s.full_name}</Link>
                <button onClick={() => mark(s.id, true)} aria-label="حاضر" className={`grid size-11 place-items-center rounded-xl border-[1.5px] transition ${marked[s.id] === true ? "border-ok bg-ok text-white" : "border-line text-muted"}`}>
                  <Check size={20} />
                </button>
                <button onClick={() => mark(s.id, false)} aria-label="غائب" className={`grid size-11 place-items-center rounded-xl border-[1.5px] transition ${marked[s.id] === false ? "border-bad bg-bad text-white" : "border-line text-muted"}`}>
                  <X size={20} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function LatestNews() {
  const { data } = useFetch<Announcement[]>("/announcements");
  if (!data?.length) return null;
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-extrabold"><Megaphone size={20} className="text-accent" /> آخر الإعلانات</h2>
        <Link href="/app/announcements/" className="text-sm font-bold text-primary">عرض الكل</Link>
      </div>
      <div className="space-y-3">
        {data.slice(0, 2).map((a) => (
          <article key={a.id} className="card p-4">
            <div className="font-extrabold">{a.title}</div>
            <p className="line-clamp-2 text-muted">{a.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
