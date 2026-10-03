"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api, ar, type Notice } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { sfx } from "@/lib/sfx";

const COLORS = ["var(--accent)", "var(--primary)", "#f2c14e", "#ffffff", "#e8a0b4"];

/** Shows rewards earned since the student's last visit: points, badges, level-ups (with sound). */
export function CelebrationHost() {
  const { user } = useAuth();
  const path = usePathname();
  const [queue, setQueue] = useState<Notice[]>([]);
  const current = queue[0];

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const on = () => setTick((t) => t + 1);
    window.addEventListener("mihrab:celebrate", on); // fired after the student saves a participation log
    return () => window.removeEventListener("mihrab:celebrate", on);
  }, []);

  useEffect(() => {
    if (user?.role !== "student") return;
    let alive = true;
    api<Notice[]>("/notifications?unseen=true")
      .then((list) => {
        const all = list.filter((n) => ["points", "badge", "level"].includes(n.kind)).reverse();
        // one "points" card for everything earned in this batch, then badges / level-ups
        const pts = all.filter((n) => n.kind === "points");
        const merged: Notice[] = pts.length
          ? [{ ...pts[0], payload: { xp: pts.reduce((a, n) => a + Number(n.payload?.xp ?? 0), 0), points: pts.reduce((a, n) => a + Number(n.payload?.points ?? 0), 0) } }]
          : [];
        const shown = [...merged, ...all.filter((n) => n.kind !== "points")];
        if (!alive || !shown.length) return;
        setQueue((q) => [...q, ...shown]);
        void api("/notifications/seen", { method: "POST" });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [user, path, tick]);

  useEffect(() => {
    if (!current) return;
    (current.kind === "badge" ? sfx.badge : current.kind === "level" ? sfx.level : sfx.points)();
  }, [current]);

  const pieces = useMemo(
    () => Array.from({ length: 26 }, (_, i) => ({ left: `${(i * 37) % 100}%`, delay: `${(i % 9) * 0.12}s`, color: COLORS[i % COLORS.length], rot: (i * 53) % 360 })),
    [],
  );

  if (!current) return null;
  const p = current.payload ?? {};
  const big = current.kind === "badge" || current.kind === "level";

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/55 p-6" role="dialog" aria-label="مكافأة">
      <div className="confetti pointer-events-none absolute inset-0 overflow-hidden" key={current.id}>
        {pieces.map((c, i) => (
          <i key={i} style={{ left: c.left, animationDelay: c.delay, background: c.color, transform: `rotate(${c.rot}deg)` }} />
        ))}
      </div>
      <div className="pop hero relative w-full max-w-sm rounded-[32px] p-8 text-center shadow-2xl" key={`c${current.id}`}>
        <div className="text-7xl">{current.kind === "badge" ? (p.icon as string) : current.kind === "level" ? (p.icon as string) : "✨"}</div>
        <h2 className="mt-3 text-2xl font-extrabold">{current.title}</h2>
        {current.kind === "points" && (
          <div className="mt-4 flex justify-center gap-3 text-3xl font-extrabold">
            {Number(p.xp) > 0 && <span className="rounded-2xl bg-white/15 px-4 py-2"><bdi dir="ltr">+{ar(Number(p.xp))}</bdi> ⭐</span>}
            {Number(p.points) > 0 && <span className="rounded-2xl bg-white/15 px-4 py-2"><bdi dir="ltr">+{ar(Number(p.points))}</bdi> 🏆</span>}
          </div>
        )}
        {big && <p className="mt-2 opacity-90">{current.body}</p>}
        <button
          className="btn mt-6 w-full !bg-white !text-primary"
          onClick={() => {
            sfx.tap();
            setQueue((q) => q.slice(1));
          }}
        >
          {queue.length > 1 ? `رائع! (${ar(queue.length - 1)} أخرى)` : "رائع!"}
        </button>
      </div>
    </div>
  );
}
