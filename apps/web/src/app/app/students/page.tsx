"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { PageHead } from "@/components/AppShell";
import { UserForm } from "@/components/UserForm";
import { Avatar, Empty, ErrorBox, Loading } from "@/components/ui";
import { ar, useFetch, type Halaqa, type User } from "@/lib/api";

export default function Students() {
  const [q, setQ] = useState("");
  const [add, setAdd] = useState(false);
  const { data, loading, error, reload } = useFetch<User[]>(`/students?q=${encodeURIComponent(q)}`);
  const halaqas = useFetch<Halaqa[]>("/halaqas");

  return (
    <div className="space-y-4">
      <PageHead
        title="الطلاب"
        action={
          <button className="btn !min-h-11" onClick={() => setAdd(true)} disabled={!halaqas.data?.length}>
            <Plus size={18} /> إضافة
          </button>
        }
      />
      <div className="relative">
        <Search className="absolute start-4 top-1/2 -translate-y-1/2 text-muted" size={20} />
        <input value={q} onChange={(e) => setQ(e.target.value)} className="field ps-12" placeholder="ابحث عن طالب" />
      </div>
      <ErrorBox message={error} />
      {loading && !data ? <Loading /> : !data?.length ? <Empty text={q ? "لا توجد نتائج" : "لا يوجد طلاب بعد."} /> : (
        <div className="space-y-3">
          {data.map((s) => (
            <Link key={s.id} href={`/app/student/?id=${s.id}`} className="card flex items-center gap-4 p-4">
              <Avatar name={s.full_name} />
              <div className="flex-1">
                <div className="font-bold">{s.full_name}</div>
                <div className="text-sm text-muted">{[s.education_stage, s.age ? `${ar(s.age)} سنة` : null].filter(Boolean).join(" · ") || s.login}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
      {add && <UserForm kind="student" halaqas={halaqas.data ?? []} onClose={() => setAdd(false)} onDone={reload} />}
    </div>
  );
}
