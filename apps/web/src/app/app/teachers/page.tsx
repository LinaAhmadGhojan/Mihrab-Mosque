"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { PageHead } from "@/components/AppShell";
import { UserForm } from "@/components/UserForm";
import { Avatar, Empty, ErrorBox, Loading, confirmDelete, useAction } from "@/components/ui";
import { api, useFetch, type User } from "@/lib/api";

export default function Teachers() {
  const { data, loading, error, reload } = useFetch<User[]>("/teachers");
  const [form, setForm] = useState<User | "new" | null>(null);
  const act = useAction();

  return (
    <div>
      <PageHead
        title="المعلمون"
        action={
          <button className="btn !min-h-11" onClick={() => setForm("new")}>
            <Plus size={18} /> إضافة
          </button>
        }
      />
      <ErrorBox message={error || act.error} />
      {loading ? <Loading /> : !data?.length ? <Empty text="لم تُضف أي معلم بعد." /> : (
        <div className="space-y-3">
          {data.map((t) => (
            <div key={t.id} className="card flex items-center gap-3 p-4">
              <Avatar name={t.full_name} />
              <div className="flex-1">
                <div className="font-bold">{t.full_name}</div>
                <div className="text-sm text-muted">{t.phone ?? t.login}</div>
              </div>
              <button onClick={() => setForm(t)} className="grid size-10 place-items-center rounded-xl bg-tint text-primary" aria-label="تعديل"><Pencil size={18} /></button>
              <button
                aria-label="حذف"
                className="grid size-10 place-items-center rounded-xl bg-bad/10 text-bad"
                onClick={() => confirmDelete(`المعلم ${t.full_name}`) && act.run(async () => { await api(`/teachers/${t.id}`, { method: "DELETE" }); reload(); })}
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>
      )}
      {form && <UserForm kind="teacher" initial={form === "new" ? undefined : form} onClose={() => setForm(null)} onDone={reload} />}
    </div>
  );
}
