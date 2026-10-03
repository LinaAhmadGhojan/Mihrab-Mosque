"use client";

import { Flame } from "lucide-react";
import { PageHead } from "@/components/AppShell";
import { ErrorBox, Loading } from "@/components/ui";
import { ar, useFetch, type BadgeInfo, type Dashboard } from "@/lib/api";

const cats: Record<string, string> = { memorize: "📖 الحفظ", attendance: "🕌 الحضور", work: "🎯 الإنجاز", streak: "🔥 السلاسل", competition: "🏆 المسابقات", secret: "👀 شارات سرية" };

export default function Achievements() {
  const dash = useFetch<Dashboard>("/me/dashboard");
  const badges = useFetch<BadgeInfo[]>("/me/badges");
  const d = dash.data;

  const groups = (badges.data ?? []).reduce<Record<string, BadgeInfo[]>>((g, b) => ((g[b.category] ??= []).push(b), g), {});

  return (
    <div className="space-y-5">
      <PageHead title="إنجازاتي" />
      <ErrorBox message={dash.error || badges.error} />
      {!d ? <Loading /> : (
        <>
          <section className="hero rise rounded-[28px] p-6 text-center shadow-lg">
            <div className="text-6xl">{d.level.icon}</div>
            <h2 className="mt-1 text-2xl font-extrabold">{d.level.name}</h2>
            <p className="flex justify-center gap-2 text-sm opacity-80">
              <span>المستوى {ar(d.level.level)}</span>
              <span aria-hidden>•</span>
              <span>{ar(d.level.xp)} نقطة خبرة</span>
            </p>
            <div className="bar mt-4"><i style={{ width: `${d.level.progress * 100}%` }} /></div>
            <p className="mt-1.5 text-xs opacity-80">{d.level.next_at ? `باقي ${ar(d.level.next_at - d.level.xp)} للمستوى التالي` : "أعلى مستوى 👑"}</p>
          </section>

          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              [<Flame key="f" className="mx-auto text-accent" />, ar(d.streak.current), "سلسلة حالية"],
              ["🏅", ar(d.badges_count), "شارة"],
              ["📖", ar(d.metrics.pages ?? 0), "صفحة مسمّعة"],
            ].map(([icon, v, l], i) => (
              <div key={i} className="card p-3">
                <div className="text-2xl">{icon}</div>
                <div className="text-xl font-extrabold">{v}</div>
                <div className="text-xs text-muted">{l}</div>
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-muted">أطول سلسلة لك: {ar(d.streak.longest)} يوم 🔥 (إنجازك السابق لا يضيع)</p>
        </>
      )}

      {Object.entries(groups).map(([cat, list]) => (
        <section key={cat}>
          <h2 className="mb-3 text-lg font-extrabold">{cats[cat] ?? cat}</h2>
          <div className="grid grid-cols-2 gap-3">
            {list.map((b) => (
              <div key={b.code} className={`card p-4 text-center ${b.earned ? "" : "opacity-70"}`}>
                <div className={`text-4xl ${b.earned ? "" : "grayscale"}`}>{b.earned ? b.icon : "🔒"}</div>
                <div className="mt-1 font-extrabold">{b.name}</div>
                <div className="text-xs text-muted">{b.description}</div>
                {!b.earned && b.threshold > 0 && (
                  <>
                    <div className="bar mt-3"><i style={{ width: `${b.progress * 100}%` }} /></div>
                    <div className="mt-1 text-xs text-muted">{ar(Math.min(b.value, b.threshold))} / {ar(b.threshold)}</div>
                  </>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
