"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Rocket, Trash2, Trophy } from "lucide-react";
import { Participation } from "@/components/Participation";
import { ErrorBox, Loading, confirmDelete, useAction } from "@/components/ui";
import { api, ar, fmtDate, statusLabel, useFetch, type Competition, type Leaderboard } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <Detail />
    </Suspense>
  );
}

const kindHint = { attendance: "تلقائي عند تسجيل حضورك", recitation_pages: "تلقائي لكل صفحة تسمّعها", homework: "تلقائي عند إنجاز الواجب", check: "يسجّلها الطالب يومياً", count: "عدّاد يومي يسجّله الطالب" } as const;

function Detail() {
  const { user } = useAuth();
  const id = Number(useSearchParams().get("id"));
  const comp = useFetch<Competition>(id ? `/competitions/${id}` : null);
  const lb = useFetch<Leaderboard>(id && comp.data && comp.data.status !== "draft" ? `/competitions/${id}/leaderboard` : null);
  const act = useAction();

  if (comp.loading) return <Loading />;
  const c = comp.data;
  if (!c) return <ErrorBox message={comp.error || "غير موجودة"} />;
  const isSup = user?.role === "supervisor";
  const isStudent = user?.role === "student";
  const refresh = () => (comp.reload(), lb.reload());

  const post = (path: string) => act.run(async () => { await api(path, { method: "POST" }); refresh(); });
  const me = lb.data?.me;

  return (
    <div className="space-y-5">
      <section className="hero rise rounded-3xl p-4 shadow-md">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-lg font-extrabold">🏆 {c.name}</h1>
          <span className="shrink-0 rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-bold">{statusLabel[c.status]}</span>
        </div>
        <p className="mt-0.5 text-xs opacity-80">{fmtDate(c.start_date)} – {fmtDate(c.end_date)}</p>
        {isStudent && me && (
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-baseline gap-2"><span className="text-xs opacity-80">نقاطك</span><span className="text-2xl font-extrabold">{ar(me.points)}</span></div>
            {me.rank && <div className="flex items-baseline gap-2"><span className="text-xs opacity-80">ترتيبك</span><span className="text-2xl font-extrabold"><bdi dir="ltr">#{ar(me.rank)}</bdi></span></div>}
          </div>
        )}
        {isStudent && me?.to_next && <p className="mt-2 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-bold">🎯 باقي {ar(me.to_next.points)} نقطة للمركز {ar(me.to_next.rank)}</p>}
      </section>

      <ErrorBox message={act.error} />

      {isSup && (
        <div className="flex flex-wrap gap-2">
          {c.status === "draft" && <button className="btn flex-1" onClick={() => post(`/competitions/${c.id}/publish`)}><Rocket size={18} /> نشر المسابقة</button>}
          {c.status !== "draft" && c.status !== "finalized" && (
            <button className="btn flex-1" onClick={() => window.confirm("اعتماد النتائج يوقف احتساب النقاط ويمنح شارات المراكز الأولى. متابعة؟") && post(`/competitions/${c.id}/finalize`)}><Trophy size={18} /> اعتماد النتائج</button>
          )}
          {c.status === "draft" && <button className="btn btn-ghost text-bad" onClick={() => confirmDelete("المسودة") && act.run(async () => { await api(`/competitions/${c.id}`, { method: "DELETE" }); history.back(); })}><Trash2 size={18} /></button>}
        </div>
      )}

      {isStudent && c.status === "active" ? (
        <Participation comp={c} onSaved={refresh} />
      ) : (
        <section>
          <h2 className="mb-3 text-lg font-extrabold">🎯 المهام</h2>
          <div className="space-y-3">
            {c.tasks.map((t) => (
              <div key={t.id} className="card flex items-center gap-3 p-3">
                <span className="star-badge text-lg">{t.icon}</span>
                <div className="flex-1">
                  <div className="font-bold">{t.title}</div>
                  <div className="text-sm text-muted">{t.group} · {kindHint[t.kind]}</div>
                </div>
                <div className="text-center">
                  <div className="font-extrabold text-primary"><bdi dir="ltr">+{ar(t.points)}</bdi></div>
                  {isStudent && t.earned ? <div className="text-xs text-ok">حصلت {ar(t.earned)}</div> : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {lb.data && (
        <section>
          <h2 className="mb-3 text-lg font-extrabold">🥇 المتصدرون</h2>
          {!lb.data.ranking_visible ? (
            <p className="card p-5 text-center text-muted">أخفت إدارة المسابقة الترتيب. تابع نقاطك وشاراتك!</p>
          ) : !lb.data.top.length ? (
            <p className="card p-5 text-center text-muted">لا توجد نقاط بعد.</p>
          ) : (
            <div className="space-y-3">
              {lb.data.top.map((r) => (
                <div key={r.rank} className={`flex items-stretch overflow-hidden rounded-2xl border ${r.is_me ? "border-primary bg-tint" : "border-line bg-surface"}`}>
                  <div className="hero grid w-14 place-items-center text-2xl font-extrabold">{ar(r.rank)}</div>
                  <div className="flex flex-1 items-center justify-between gap-3 p-3">
                    <div>
                      <div className="font-bold">{r.name}{r.is_me && " (أنت)"}</div>
                      <div className="text-xs text-muted">{r.halaqa}</div>
                    </div>
                    <div className="text-lg font-extrabold text-primary">{ar(r.points)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {lb.data.halaqas.length > 1 && (
            <div className="card mt-4 p-4">
              <h3 className="mb-3 font-extrabold">🕌 الحلقات</h3>
              {(() => {
                const max = Math.max(1, ...lb.data.halaqas.map((h) => h.points));
                return lb.data.halaqas.map((h) => (
                  <div key={h.name} className="mb-3 last:mb-0">
                    <div className="mb-1 flex justify-between text-sm font-bold"><span>{h.name}</span><span>{ar(h.points)}</span></div>
                    <div className="bar"><i style={{ width: `${(h.points / max) * 100}%` }} /></div>
                  </div>
                ));
              })()}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
