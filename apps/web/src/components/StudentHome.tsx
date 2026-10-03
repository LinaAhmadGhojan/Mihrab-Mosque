"use client";

import Link from "next/link";
import { Award, Check, ClipboardList, Trophy, Users } from "lucide-react";
import { Empty } from "@/components/ui";
import { ar, fmtDate, useFetch, type Announcement, type Dashboard, type HalaqaBoard, type Homework, type User } from "@/lib/api";

export function StudentHome({ user }: { user: User }) {
  const dash = useFetch<Dashboard>("/me/dashboard");
  const board = useFetch<HalaqaBoard>("/me/halaqa");
  const hw = useFetch<Homework[]>(`/students/${user.id}/homework`);
  const news = useFetch<Announcement[]>("/announcements");
  const d = dash.data;
  const pending = hw.data?.filter((h) => !h.done) ?? [];
  const doneGoals = d?.goals.filter((g) => g.done).length ?? 0;
  const first = user.full_name.split(" ")[0];

  return (
    <div className="space-y-5">
      <section className="hero rise rounded-[28px] p-6 shadow-lg">
        <p className="text-sm opacity-80">السلام عليكم يا {first} 🌷</p>
        {!d ? (
          <div className="h-32" />
        ) : (
          <>
            <div className="mt-2 flex items-center justify-between">
              <div>
                <div className="text-sm opacity-80">مستواك</div>
                <h1 className="text-3xl font-extrabold">
                  {d.level.icon} {d.level.name}
                </h1>
                <div className="mt-1 flex gap-2 text-sm opacity-90">
                  <span>المستوى {ar(d.level.level)}</span>
                  <span aria-hidden>•</span>
                  <span>{ar(d.level.xp)} نقطة خبرة</span>
                </div>
              </div>
              <div className="text-center">
                <div className="flame text-4xl">🔥</div>
                <div className="text-xl font-extrabold">{ar(d.streak.current)}</div>
                <div className="text-xs opacity-80">يوم متتالي</div>
              </div>
            </div>
            <div className="bar mt-4">
              <i style={{ width: `${d.level.progress * 100}%` }} />
            </div>
            <div className="mt-1.5 flex justify-between text-xs opacity-80">
              <span>{ar(d.level.level_start)}</span>
              <span>{d.level.next_at ? `باقي ${ar(d.level.next_at - d.level.xp)} للمستوى التالي` : "أعلى مستوى 👑"}</span>
            </div>
          </>
        )}
      </section>

      {d && (
        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-extrabold">🎯 هدف اليوم</h2>
            <span className="font-bold text-primary">
              {ar(doneGoals)} / {ar(d.goals.length)}
            </span>
          </div>
          <div className="bar mb-4">
            <i style={{ width: `${(doneGoals / d.goals.length) * 100}%` }} />
          </div>
          <div className="space-y-2">
            {d.goals.map((g) => (
              <div key={g.key} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${g.done ? "bg-tint" : "border border-line"}`}>
                <span className={`grid size-7 place-items-center rounded-full ${g.done ? "bg-ok text-white" : "border-2 border-line"}`}>{g.done && <Check size={16} />}</span>
                <span className={`font-bold ${g.done ? "text-primary" : "text-muted"}`}>{g.label}</span>
              </div>
            ))}
          </div>
          {doneGoals === d.goals.length && <p className="pop mt-3 text-center font-extrabold text-primary">🎉 أنجزت هدف اليوم! استمر غداً</p>}
        </section>
      )}

      {d?.competition && (
        <Link href={`/app/competition/?id=${d.competition.id}`} className="card block p-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-extrabold">
              <Trophy size={20} className="text-accent" /> {d.competition.name}
            </h2>
            <span className="text-sm text-muted">باقي {ar(d.competition.days_left)} يوم</span>
          </div>
          {d.competition.me && (
            <div className="mt-3 flex items-end justify-between">
              <div>
                <div className="text-sm text-muted">نقاطك</div>
                <div className="text-3xl font-extrabold text-primary">{ar(d.competition.me.points)}</div>
              </div>
              {d.competition.me.rank && (
                <div className="text-end">
                  <div className="text-sm text-muted">ترتيبك</div>
                  <div className="text-3xl font-extrabold"><bdi dir="ltr">#{ar(d.competition.me.rank)}</bdi></div>
                </div>
              )}
            </div>
          )}
          {d.competition.me?.to_next && (
            <p className="mt-3 rounded-xl bg-tint px-3 py-2 text-sm font-bold text-primary">
              🎯 باقي {ar(d.competition.me.to_next.points)} نقطة للوصول للمركز {ar(d.competition.me.to_next.rank)}
            </p>
          )}
        </Link>
      )}

      {board.data?.halaqa && (
        <Link href="/app/my-halaqa/" className="card block p-5">
          <h2 className="mb-2 flex items-center gap-2 text-lg font-extrabold">
            <Users size={20} className="text-accent" /> {board.data.halaqa.name}
          </h2>
          {board.data.highlights.pages ? (
            <p className="text-muted">
              🥇 أكثر من سمّع اليوم: <b className="text-ink">{board.data.highlights.pages.name}</b> ({ar(board.data.highlights.pages.value)} صفحة)
            </p>
          ) : (
            <p className="text-muted">لم يسمّع أحد اليوم بعد. كن الأول! 🌟</p>
          )}
        </Link>
      )}

      {d?.last_badge && (
        <Link href="/app/achievements/" className="card flex items-center gap-4 p-4">
          <span className="text-4xl">{d.last_badge.icon}</span>
          <div className="flex-1">
            <div className="text-sm text-muted">آخر إنجاز</div>
            <div className="font-extrabold">{d.last_badge.name}</div>
          </div>
          <span className="flex items-center gap-1 text-sm font-bold text-primary">
            <Award size={16} /> {ar(d.badges_count)} شارة
          </span>
        </Link>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-extrabold">
            <ClipboardList size={20} className="text-accent" /> واجباتي
          </h2>
          <Link href="/app/student/" className="text-sm font-bold text-primary">
            سجلي
          </Link>
        </div>
        {!pending.length ? (
          <Empty text="لا توجد واجبات حالياً. بارك الله فيك!" />
        ) : (
          <div className="card divide-y divide-line">
            {pending.slice(0, 4).map((h) => (
              <div key={h.id} className="p-4">
                <div className="font-bold">{h.text}</div>
                {h.due && <div className="text-sm text-muted">التسليم: {fmtDate(h.due)}</div>}
              </div>
            ))}
          </div>
        )}
      </section>

      {news.data && news.data.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-extrabold">📢 آخر الإعلانات</h2>
            <Link href="/app/announcements/" className="text-sm font-bold text-primary">
              عرض الكل
            </Link>
          </div>
          {news.data.slice(0, 2).map((a) => (
            <article key={a.id} className="card mb-3 p-4">
              <div className="font-extrabold">{a.title}</div>
              <p className="line-clamp-2 text-muted">{a.body}</p>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
