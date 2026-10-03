"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus } from "lucide-react";
import { PageHead } from "@/components/AppShell";
import { Avatar, Empty, ErrorBox, Field, Loading, Sheet, useAction } from "@/components/ui";
import { api, ar, useFetch, type Halaqa, type User } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function Halaqas() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useFetch<Halaqa[]>("/halaqas");
  const teachers = useFetch<User[]>(user?.role === "supervisor" ? "/teachers" : null);
  const [form, setForm] = useState<Halaqa | "new" | null>(null);
  const isSup = user?.role === "supervisor";

  return (
    <div>
      <PageHead
        title="الحلقات"
        action={isSup && (
          <button className="btn !min-h-11" onClick={() => setForm("new")}>
            <Plus size={18} /> حلقة جديدة
          </button>
        )}
      />
      <ErrorBox message={error} />
      {loading ? <Loading /> : !data?.length ? <Empty text="لا توجد حلقات." /> : (
        <div className="space-y-4">
          {data.map((h) => (
            <section key={h.id} className="card p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-extrabold">{h.name}</h2>
                  <p className="text-sm text-muted">المعلم/ة: {h.teacher_name ?? "غير معيّن"} · {ar(h.students.length)} طالب</p>
                </div>
                {isSup && <button className="btn btn-ghost !min-h-10 !px-4 text-sm" onClick={() => setForm(h)}>تعديل</button>}
              </div>
              {h.students.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {h.students.map((s) => (
                    <Link key={s.id} href={`/app/student/?id=${s.id}`} className="flex items-center gap-2 rounded-full bg-tint py-1 pe-3 ps-1 text-sm font-bold text-primary">
                      <Avatar name={s.full_name} size={28} /> {s.full_name}
                    </Link>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
      {form && <HalaqaForm initial={form === "new" ? undefined : form} teachers={teachers.data ?? []} onClose={() => setForm(null)} onDone={reload} />}
    </div>
  );
}

function HalaqaForm({ initial, teachers, onClose, onDone }: { initial?: Halaqa; teachers: User[]; onClose: () => void; onDone: () => void }) {
  const { busy, error, run } = useAction();
  return (
    <Sheet title={initial ? "تعديل الحلقة" : "حلقة جديدة"} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const t = String(f.get("teacher"));
          run(async () => {
            await api(initial ? `/halaqas/${initial.id}` : "/halaqas", {
              method: initial ? "PATCH" : "POST",
              body: { name: f.get("name"), teacher_id: t ? Number(t) : null },
            });
            onDone();
            onClose();
          });
        }}
      >
        <Field label="اسم الحلقة">
          <input name="name" required minLength={2} className="field" defaultValue={initial?.name} />
        </Field>
        <Field label="المعلم/ة المسؤول">
          <select name="teacher" className="field" defaultValue={initial?.teacher_id ?? ""}>
            <option value="">— بدون —</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>{t.full_name}</option>
            ))}
          </select>
        </Field>
        <ErrorBox message={error} />
        <button className="btn w-full" disabled={busy}>{busy ? "جارٍ الحفظ…" : "حفظ"}</button>
      </form>
    </Sheet>
  );
}
