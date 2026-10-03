"use client";

import { Check } from "lucide-react";
import { PageHead } from "@/components/AppShell";
import { Avatar, Empty, ErrorBox, Loading } from "@/components/ui";
import { ar, useFetch, type HalaqaBoard } from "@/lib/api";

export default function MyHalaqa() {
  const { data, loading, error } = useFetch<HalaqaBoard>("/me/halaqa");
  if (loading) return <Loading />;
  if (!data?.halaqa) return <><ErrorBox message={error} /><Empty text="لم تُضف إلى حلقة بعد." /></>;
  const { halaqa, members, highlights, totals } = data;

  return (
    <div className="space-y-5">
      <PageHead title="حلقتي" />
      <section className="hero rise rounded-[28px] p-6 shadow-lg">
        <h2 className="text-2xl font-extrabold">{halaqa.name}</h2>
        <p className="text-sm opacity-80">{halaqa.teacher ? `المعلم/ة: ${halaqa.teacher} · ` : ""}{ar(halaqa.count)} طالب</p>
        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          {[["حضروا اليوم", totals.present ?? 0], ["سمّعوا", totals.recited ?? 0], ["صفحة اليوم", totals.pages ?? 0]].map(([l, v]) => (
            <div key={l as string} className="rounded-2xl bg-white/12 py-3">
              <div className="text-2xl font-extrabold">{ar(v as number)}</div>
              <div className="text-xs opacity-80">{l}</div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-center text-sm font-bold opacity-90">🌟 ننجز معاً، وكل صفحة تقرّبنا من الهدف</p>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-extrabold">🌟 إنجازات اليوم</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="card p-4 text-center">
            <div className="text-3xl">📖</div>
            <div className="text-xs text-muted">أكثر من سمّع</div>
            <div className="font-extrabold">{highlights.pages?.name ?? "—"}</div>
            {highlights.pages && <div className="text-sm text-primary">{ar(highlights.pages.value)} صفحة</div>}
          </div>
          <div className="card p-4 text-center">
            <div className="text-3xl">⭐</div>
            <div className="text-xs text-muted">أكثر نقاط خبرة</div>
            <div className="font-extrabold">{highlights.xp?.name ?? "—"}</div>
            {highlights.xp && <div className="text-sm text-primary">{ar(highlights.xp.value)} نقطة</div>}
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-extrabold">👥 زملائي</h2>
        <div className="card divide-y divide-line">
          {members.map((m, i) => (
            <div key={i} className={`flex items-center gap-3 p-3 ${m.is_me ? "bg-tint" : ""}`}>
              <Avatar name={m.name} size={42} />
              <div className="flex-1">
                <div className="font-bold">{m.name}{m.is_me && " (أنت)"}</div>
                <div className="text-xs text-muted">{m.present ? "حاضر اليوم" : "لم يُسجَّل حضوره"}</div>
              </div>
              {m.present && <Check size={18} className="text-ok" />}
              <div className="text-end">
                <div className="font-extrabold text-primary">{ar(m.pages_today)} <span className="text-xs font-normal text-muted">صفحة</span></div>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-center text-xs text-muted">تظهر هنا معلومات زملاء حلقتك فقط.</p>
      </section>
    </div>
  );
}
