"use client";

import { useState } from "react";
import { Megaphone, Plus, Trash2 } from "lucide-react";
import { PageHead } from "@/components/AppShell";
import { Empty, ErrorBox, Field, Loading, Sheet, confirmDelete, useAction } from "@/components/ui";
import { api, fmtDate, useFetch, type Announcement, type Halaqa } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const kindLabel = { halaqa: "خاص بالحلقة", admin: "إداري", general: "عام" } as const;

export default function Announcements() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useFetch<Announcement[]>("/announcements");
  const [form, setForm] = useState(false);
  const act = useAction();
  const canPost = user && user.role !== "student";

  return (
    <div>
      <PageHead
        title="الإعلانات"
        action={canPost && (
          <button className="btn !min-h-11" onClick={() => setForm(true)}><Plus size={18} /> نشر</button>
        )}
      />
      <ErrorBox message={error || act.error} />
      {loading ? <Loading /> : !data?.length ? <Empty text="لا توجد إعلانات." /> : (
        <div className="space-y-4">
          {data.map((a) => (
            <article key={a.id} className="card p-5">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 rounded-full bg-tint px-3 py-1 font-bold text-primary"><Megaphone size={14} />{kindLabel[a.kind]}</span>
                <span className="flex items-center gap-3 text-muted">
                  {fmtDate(a.created_at)}
                  {(user?.role === "admin" || a.author_id === user?.id) && (
                    <button aria-label="حذف" className="text-bad" onClick={() => confirmDelete("الإعلان") && act.run(async () => { await api(`/announcements/${a.id}`, { method: "DELETE" }); reload(); })}><Trash2 size={16} /></button>
                  )}
                </span>
              </div>
              <h2 className="mt-3 text-lg font-extrabold">{a.title}</h2>
              <p className="mt-1 whitespace-pre-line text-muted">{a.body}</p>
              {a.image_url && /* eslint-disable-next-line @next/next/no-img-element */ <img src={a.image_url} alt="" className="mt-3 w-full rounded-2xl" />}
            </article>
          ))}
        </div>
      )}
      {form && user && <PublishForm role={user.role} onClose={() => setForm(false)} onDone={reload} />}
    </div>
  );
}

function PublishForm({ role, onClose, onDone }: { role: string; onClose: () => void; onDone: () => void }) {
  const { busy, error, run } = useAction();
  // per SRS #7: admin publishes general/admin; supervisor & teacher publish halaqa/admin
  const kinds = role === "admin" ? (["general", "admin"] as const) : (["halaqa", "admin"] as const);
  const [kind, setKind] = useState<string>(kinds[0]);
  const halaqas = useFetch<Halaqa[]>(role === "admin" ? null : "/halaqas");

  return (
    <Sheet title="إعلان جديد" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          run(async () => {
            await api("/announcements", {
              method: "POST",
              body: { kind, title: f.get("title"), body: f.get("body"), image_url: f.get("image") || null, halaqa_id: kind === "halaqa" ? Number(f.get("halaqa")) : null },
            });
            onDone();
            onClose();
          });
        }}
      >
        <Field label="النوع">
          <select className="field" value={kind} onChange={(e) => setKind(e.target.value)}>
            {kinds.map((k) => <option key={k} value={k}>{kindLabel[k]}</option>)}
          </select>
        </Field>
        {kind === "halaqa" && (
          <Field label="الحلقة">
            <select name="halaqa" className="field" required>
              {halaqas.data?.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          </Field>
        )}
        <Field label="العنوان"><input name="title" required minLength={2} className="field" /></Field>
        <Field label="المضمون"><textarea name="body" required rows={4} className="field py-3" /></Field>
        <Field label="رابط صورة (اختياري)"><input name="image" type="url" dir="ltr" className="field text-start" /></Field>
        <ErrorBox message={error} />
        <button className="btn w-full" disabled={busy}>{busy ? "جارٍ النشر…" : "نشر"}</button>
      </form>
    </Sheet>
  );
}
