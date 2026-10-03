"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronLeft, Plus, Trophy } from "lucide-react";
import { PageHead } from "@/components/AppShell";
import { CompetitionBuilder } from "@/components/CompetitionBuilder";
import { Empty, ErrorBox, Loading } from "@/components/ui";
import { fmtDate, statusLabel, useFetch, type Competition } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const statusStyle = { draft: "bg-line text-muted", scheduled: "bg-tint text-primary", active: "bg-ok/15 text-ok", ended: "bg-warn/15 text-warn", finalized: "bg-primary text-primary-ink" } as const;

export default function Competitions() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useFetch<Competition[]>("/competitions");
  const [build, setBuild] = useState(false);

  return (
    <div>
      <PageHead
        title="المسابقات"
        action={user?.role === "supervisor" && (
          <button className="btn !min-h-11" onClick={() => setBuild(true)}>
            <Plus size={18} /> مسابقة
          </button>
        )}
      />
      <ErrorBox message={error} />
      {loading ? <Loading /> : !data?.length ? <Empty text={user?.role === "supervisor" ? "أنشئ أول مسابقة لتحفيز طلابك." : "لا توجد مسابقات حالياً."} /> : (
        <div className="space-y-3">
          {data.map((c) => (
            <Link key={c.id} href={`/app/competition/?id=${c.id}`} className="card flex items-center gap-4 p-4">
              <span className="grid size-12 place-items-center rounded-2xl bg-tint text-primary"><Trophy /></span>
              <div className="flex-1">
                <div className="font-extrabold">{c.name}</div>
                <div className="text-sm text-muted">{fmtDate(c.start_date)} – {fmtDate(c.end_date)}</div>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusStyle[c.status]}`}>{statusLabel[c.status]}</span>
              <ChevronLeft className="text-muted" />
            </Link>
          ))}
        </div>
      )}
      {build && <CompetitionBuilder onClose={() => setBuild(false)} onDone={reload} />}
    </div>
  );
}
