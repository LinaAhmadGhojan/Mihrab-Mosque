"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Check } from "lucide-react";
import { PageHead } from "@/components/AppShell";
import { Empty, ErrorBox, Field, Loading, useAction } from "@/components/ui";
import { api, useFetch, type User } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const grades = ["ممتاز", "جيد جداً", "جيد", "يحتاج إعادة"];

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <Recitation />
    </Suspense>
  );
}

function Recitation() {
  const router = useRouter();
  const { user } = useAuth();
  const preset = useSearchParams().get("student");
  const students = useFetch<User[]>(user?.role === "teacher" ? "/students" : null);
  const [kind, setKind] = useState<"quran" | "hadith">("quran");
  const [grade, setGrade] = useState("ممتاز");
  const { busy, error, run } = useAction();
  const [done, setDone] = useState<number | null>(null);

  if (user && user.role !== "teacher") return <Empty text="تسجيل التسميع متاح للمعلمين فقط." />;
  if (students.loading) return <Loading />;
  if (done !== null)
    return (
      <div className="rise grid place-items-center gap-4 py-24 text-center">
        <span className="grid size-20 place-items-center rounded-full bg-primary text-primary-ink"><Check size={40} /></span>
        <h2 className="text-2xl font-extrabold">تم حفظ التسميع</h2>
        <div className="flex gap-3">
          <button className="btn" onClick={() => router.push(`/app/student/?id=${done}`)}>ملف الطالب</button>
          <button className="btn btn-ghost" onClick={() => setDone(null)}>تسميع آخر</button>
        </div>
      </div>
    );
  if (!students.data?.length) return <Empty text="أضف طلاباً إلى حلقتك أولاً." />;

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const sid = Number(f.get("student"));
        run(async () => {
          await api("/recitations", {
            method: "POST",
            body: { student_id: sid, kind, start_page: Number(f.get("start")), end_page: Number(f.get("end")), grade },
          });
          setDone(sid);
        });
      }}
    >
      <PageHead title="تسميع جديد" />
      <div className="card space-y-4 p-5">
        <Field label="الطالب">
          <select name="student" className="field" defaultValue={preset ?? ""} required>
            {students.data.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </select>
        </Field>
        <div>
          <span className="mb-1.5 block text-sm font-bold text-muted">النوع</span>
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-tint p-1.5">
            {([["quran", "قرآن"], ["hadith", "حديث"]] as const).map(([k, l]) => (
              <button type="button" key={k} onClick={() => setKind(k)} className={`min-h-11 rounded-xl font-bold transition ${kind === k ? "bg-primary text-primary-ink shadow" : "text-muted"}`}>{l}</button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="من صفحة"><input name="start" type="number" min={1} max={604} required className="field" /></Field>
          <Field label="إلى صفحة"><input name="end" type="number" min={1} max={604} required className="field" /></Field>
        </div>
        <div>
          <span className="mb-1.5 block text-sm font-bold text-muted">التقييم</span>
          <div className="grid grid-cols-2 gap-2">
            {grades.map((g) => (
              <button type="button" key={g} onClick={() => setGrade(g)} className={`min-h-12 rounded-xl border-[1.5px] font-bold transition ${grade === g ? "border-primary bg-primary text-primary-ink" : "border-line text-muted"}`}>{g}</button>
            ))}
          </div>
        </div>
      </div>
      <ErrorBox message={error} />
      <button className="btn w-full" disabled={busy}>{busy ? "جارٍ الحفظ…" : "حفظ التسميع"}</button>
      <p className="text-center text-sm text-muted">الملاحظات على الآيات تُضاف من ملف الطالب بعد الحفظ.</p>
    </form>
  );
}
