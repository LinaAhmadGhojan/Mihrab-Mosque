"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Award, BookMarked, CalendarCheck, CheckCircle2, Circle, ClipboardList, NotebookPen, Pencil, Plus, Trash2 } from "lucide-react";
import { ProgressRing } from "@/components/AppShell";
import { UserForm } from "@/components/UserForm";
import { Empty, ErrorBox, Field, Loading, Sheet, confirmDelete, useAction } from "@/components/ui";
import { api, ar, fmtDate, useFetch, type Attendance, type Halaqa, type Homework, type Recitation, type User } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <StudentView />
    </Suspense>
  );
}

function StudentView() {
  const { user } = useAuth();
  const qs = useSearchParams();
  const id = user?.role === "student" ? user.id : Number(qs.get("id"));
  const isTeacher = user?.role === "teacher";
  const staff = isTeacher || user?.role === "supervisor";

  const stu = useFetch<User>(id ? `/students/${id}` : null);
  const rec = useFetch<Recitation[]>(id ? `/students/${id}/recitations` : null);
  const hw = useFetch<Homework[]>(id ? `/students/${id}/homework` : null);
  const att = useFetch<Attendance[]>(id ? `/students/${id}/attendance` : null);
  const halaqas = useFetch<Halaqa[]>(staff ? "/halaqas" : null);
  const [edit, setEdit] = useState(false);
  const [hwForm, setHwForm] = useState(false);
  const [noteFor, setNoteFor] = useState<Recitation | null>(null);
  const act = useAction();

  if (!id) return <Empty text="لم يتم تحديد الطالب" />;
  if (stu.loading) return <Loading />;
  if (!stu.data) return <ErrorBox message={stu.error || "غير موجود"} />;
  const s = stu.data;

  const pages = rec.data?.filter((r) => r.kind === "quran").reduce((n, r) => n + (r.end_page - r.start_page + 1), 0) ?? 0;
  const present = att.data?.filter((a) => a.present).length ?? 0;
  const refreshAll = () => (rec.reload(), hw.reload(), att.reload());
  const del = (what: string, path: string) => confirmDelete(what) && act.run(async () => { await api(path, { method: "DELETE" }); refreshAll(); });

  return (
    <div className="space-y-5">
      <section className="hero rise rounded-[28px] p-6 text-center shadow-lg">
        <span className="mx-auto grid size-20 place-items-center rounded-full bg-white/15 text-3xl font-extrabold ring-4 ring-accent/70">{s.full_name.trim()[0]}</span>
        <h1 className="mt-3 text-2xl font-extrabold">{s.full_name}</h1>
        <p className="text-sm opacity-80">{[s.education_stage, s.grade, s.age ? `${ar(s.age)} سنة` : null].filter(Boolean).join(" · ")}</p>
        <div className="mt-5 flex items-center justify-around">
          <ProgressRing value={(pages / 604) * 100} label={ar(pages)} />
          <div className="text-start text-sm">
            <div className="flex items-center gap-2"><BookMarked size={18} className="text-accent" /> {ar(pages)} صفحة مسمّعة</div>
            <div className="mt-2 flex items-center gap-2"><CalendarCheck size={18} className="text-accent" /> حضر {ar(present)} من {ar(att.data?.length ?? 0)}</div>
          </div>
        </div>
      </section>

      <ErrorBox message={act.error} />

      {isTeacher && (
        <div className="grid grid-cols-2 gap-3">
          <Link href={`/app/recitation/?student=${id}`} className="btn"><BookMarked size={20} /> تسميع</Link>
          <button className="btn btn-ghost" onClick={() => setHwForm(true)}><ClipboardList size={20} /> واجب</button>
        </div>
      )}
      {staff && (
        <div className="grid grid-cols-2 gap-3">
          <button className="btn btn-ghost" onClick={() => setEdit(true)}><Pencil size={18} /> تعديل</button>
          <button className="btn btn-ghost text-bad" onClick={() => confirmDelete(`الطالب ${s.full_name}`) && act.run(async () => { await api(`/students/${id}`, { method: "DELETE" }); history.back(); })}>
            <Trash2 size={18} /> حذف
          </button>
        </div>
      )}

      <section className="card space-y-1 p-4 text-sm">
        {[["اسم الأب", s.father_name], ["اسم الأم", s.mother_name], ["الهاتف", s.phone], ["العنوان", s.address], ["الشهادات", s.certificates]].map(([k, v]) => v && (
          <div key={k as string} className="flex justify-between gap-4"><span className="text-muted">{k}</span><span className="font-bold">{v}</span></div>
        ))}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-extrabold">الواجبات</h2>
        {!hw.data?.length ? <Empty text="لا توجد واجبات." /> : (
          <div className="card divide-y divide-line">
            {hw.data.map((h) => (
              <div key={h.id} className="flex items-center gap-3 p-4">
                <button
                  disabled={!isTeacher}
                  aria-label="تم التنفيذ"
                  onClick={() => act.run(async () => { await api(`/homework/${h.id}/done?done=${!h.done}`, { method: "POST" }); hw.reload(); })}
                >
                  {h.done ? <CheckCircle2 className="text-ok" /> : <Circle className="text-muted" />}
                </button>
                <div className="flex-1">
                  <div className={`font-bold ${h.done ? "text-muted line-through" : ""}`}>{h.text}</div>
                  {h.due && <div className="text-sm text-muted">التسليم: {fmtDate(h.due)}</div>}
                </div>
                {isTeacher && <button aria-label="حذف" className="text-bad" onClick={() => del("الواجب", `/homework/${h.id}`)}><Trash2 size={18} /></button>}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-extrabold">سجل التسميع</h2>
        {rec.loading ? <Loading /> : !rec.data?.length ? <Empty text="لا يوجد تسميع بعد." /> : (
          <div className="space-y-3">
            {rec.data.map((r) => (
              <article key={r.id} className="card p-4">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-tint text-sm font-bold text-primary">{r.kind === "quran" ? "قرآن" : "حديث"}</span>
                  <div className="flex-1">
                    <div className="font-bold">من صفحة {ar(r.start_page)} إلى {ar(r.end_page)}</div>
                    <div className="text-sm text-muted">{fmtDate(r.created_at)}</div>
                  </div>
                  {r.grade && <span className="flex items-center gap-1 text-sm font-bold text-primary"><Award size={16} className="text-accent" />{r.grade}</span>}
                </div>
                {r.notes.map((n) => (
                  <div key={n.id} className="mt-3 flex items-start gap-2 rounded-xl bg-tint p-3 text-sm">
                    <NotebookPen size={16} className="mt-0.5 shrink-0 text-accent" />
                    <p className="flex-1"><b>ص {ar(n.page)}{n.ayah ? ` آية ${ar(n.ayah)}` : ""}:</b> {n.text}</p>
                    {isTeacher && <button aria-label="حذف الملاحظة" className="text-bad" onClick={() => del("الملاحظة", `/notes/${n.id}`)}><Trash2 size={15} /></button>}
                  </div>
                ))}
                {isTeacher && (
                  <div className="mt-3 flex gap-2">
                    <button className="btn btn-ghost !min-h-10 flex-1 text-sm" onClick={() => setNoteFor(r)}><Plus size={16} /> ملاحظة</button>
                    <button className="btn btn-ghost !min-h-10 text-sm text-bad" onClick={() => del("التسميع", `/recitations/${r.id}`)}><Trash2 size={16} /></button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      {edit && <UserForm kind="student" initial={s} halaqas={halaqas.data ?? []} onClose={() => setEdit(false)} onDone={stu.reload} />}
      {hwForm && <HomeworkForm studentId={id} onClose={() => setHwForm(false)} onDone={hw.reload} />}
      {noteFor && <NoteForm rec={noteFor} onClose={() => setNoteFor(null)} onDone={rec.reload} />}
    </div>
  );
}

function HomeworkForm({ studentId, onClose, onDone }: { studentId: number; onClose: () => void; onDone: () => void }) {
  const { busy, error, run } = useAction();
  return (
    <Sheet title="واجب جديد" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          run(async () => {
            await api("/homework", { method: "POST", body: { student_id: studentId, text: f.get("text"), due: f.get("due") || null } });
            onDone();
            onClose();
          });
        }}
      >
        <Field label="المطلوب"><textarea name="text" required rows={3} className="field py-3" placeholder="مثال: حفظ سورة النبأ من ١ إلى ١٦" /></Field>
        <Field label="موعد التسليم (اختياري)"><input name="due" type="date" className="field" /></Field>
        <ErrorBox message={error} />
        <button className="btn w-full" disabled={busy}>{busy ? "جارٍ الحفظ…" : "إضافة الواجب"}</button>
      </form>
    </Sheet>
  );
}

function NoteForm({ rec, onClose, onDone }: { rec: Recitation; onClose: () => void; onDone: () => void }) {
  const { busy, error, run } = useAction();
  return (
    <Sheet title="ملاحظة على التسميع" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const ayah = String(f.get("ayah"));
          run(async () => {
            await api(`/recitations/${rec.id}/notes`, { method: "POST", body: { page: Number(f.get("page")), ayah: ayah ? Number(ayah) : null, text: f.get("text") } });
            onDone();
            onClose();
          });
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="رقم الصفحة"><input name="page" type="number" min={1} max={604} required defaultValue={rec.start_page} className="field" /></Field>
          <Field label="رقم الآية"><input name="ayah" type="number" min={1} max={286} className="field" /></Field>
        </div>
        <Field label="الملاحظة"><textarea name="text" required rows={3} className="field py-3" /></Field>
        <ErrorBox message={error} />
        <button className="btn w-full" disabled={busy}>{busy ? "جارٍ الحفظ…" : "إضافة الملاحظة"}</button>
      </form>
    </Sheet>
  );
}
