"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Minus, Plus, Save } from "lucide-react";
import { api, ar, useFetch, type CompTask, type Competition, type LogState } from "@/lib/api";
import { sfx } from "@/lib/sfx";
import { ErrorBox, Loading, useAction } from "./ui";

type Entry = { done: boolean; amount: number };
type Entries = Record<number, Entry>;

const iso = (d: Date) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
};
const addDays = (s: string, n: number) => iso(new Date(new Date(s + "T12:00:00").getTime() + n * 864e5));
const pointsOf = (t: CompTask, amount: number) => {
  const units = t.max_per_event ? Math.min(amount, t.max_per_event) : amount;
  return Math.floor(units / Math.max(1, t.per_units)) * t.points;
};

/** Daily participation: swipeable cards of tasks, pick them (with sound), then save. */
export function Participation({ comp, onSaved }: { comp: Competition; onSaved: () => void }) {
  const today = iso(new Date());
  const last = comp.end_date < today ? comp.end_date : today;
  const [day, setDay] = useState(last);
  const { data, loading, reload } = useFetch<LogState>(`/competitions/${comp.id}/log?day=${day}`);
  const [entries, setEntries] = useState<Entries>({});
  const [open, setOpen] = useState<number | null>(null);
  const [active, setActive] = useState(0);
  const [saved, setSaved] = useState(false);
  const act = useAction();
  const scroller = useRef<HTMLDivElement>(null);

  // load the server state for the selected day
  useEffect(() => {
    if (!data) return;
    const next: Entries = {};
    for (const [tid, e] of Object.entries(data.entries)) next[Number(tid)] = { done: e.done, amount: e.amount };
    setEntries(next);
    setSaved(false);
  }, [data]);

  const selfTasks = comp.tasks.filter((t) => t.kind === "check" || t.kind === "count");
  const autoTasks = comp.tasks.filter((t) => t.kind !== "check" && t.kind !== "count");
  const cards = useMemo(() => {
    const g: { name: string; tasks: CompTask[]; auto?: boolean }[] = [];
    for (const t of selfTasks) {
      const card = g.find((x) => x.name === t.group && !x.auto);
      card ? card.tasks.push(t) : g.push({ name: t.group, tasks: [t] });
    }
    if (autoTasks.length) g.push({ name: "تلقائي من الحلقة", tasks: autoTasks, auto: true });
    return g;
  }, [selfTasks, autoTasks]);

  const server = data?.entries ?? {};
  const dirty = selfTasks.some((t) => {
    const cur = entries[t.id];
    const was = server[t.id];
    return (cur?.done ?? false) !== (was?.done ?? false) || (cur?.done && was && cur.amount !== was.amount);
  });

  const autoPoints = Object.values(data?.auto ?? {}).reduce((a, b) => a + b, 0);
  const preview = autoPoints + selfTasks.reduce((n, t) => (entries[t.id]?.done ? n + pointsOf(t, entries[t.id].amount) : n), 0);
  const digits = String(preview).split("");

  const set = (t: CompTask, patch: Partial<Entry>) => setEntries((e) => ({ ...e, [t.id]: { ...(e[t.id] ?? { done: false, amount: t.kind === "check" ? 1 : 0 }), ...patch } }));

  const toggle = (t: CompTask) => {
    const cur = entries[t.id];
    if (t.kind === "count") {
      setOpen(open === t.id ? null : t.id);
      if (!cur?.done) {
        sfx.select();
        set(t, { done: true, amount: cur?.amount || Math.max(1, t.per_units) });
      }
      return;
    }
    const on = !cur?.done;
    (on ? sfx.select : sfx.unselect)();
    set(t, { done: on, amount: 1 });
  };

  const bump = (t: CompTask, n: number) => {
    sfx.tick();
    const amount = Math.max(0, (entries[t.id]?.amount ?? 0) + n);
    set(t, { amount, done: amount > 0 });
  };

  const save = () =>
    act.run(async () => {
      const body = { day, entries: selfTasks.map((t) => ({ task_id: t.id, done: !!entries[t.id]?.done, amount: entries[t.id]?.amount ?? 0 })) };
      const r = await api<LogState>(`/competitions/${comp.id}/log`, { method: "PUT", body });
      setSaved(true);
      reload();
      onSaved();
      if ((r.gained ?? 0) > 0) window.dispatchEvent(new Event("mihrab:celebrate"));
      else sfx.tap();
    });

  const goto = useCallback((i: number) => {
    const el = scroller.current?.children[i] as HTMLElement | undefined;
    setActive(i);
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, []);

  const onScroll = () => {
    const box = scroller.current;
    if (!box) return;
    const mid = box.getBoundingClientRect().left + box.clientWidth / 2;
    let best = 0, bestD = Infinity;
    Array.from(box.children).forEach((c, i) => {
      const r = (c as HTMLElement).getBoundingClientRect();
      const d = Math.abs(r.left + r.width / 2 - mid);
      if (d < bestD) (bestD = d), (best = i);
    });
    setActive(best);
  };

  const canPrev = day > comp.start_date;
  const canNext = day < last;
  const dt = new Date(day + "T12:00:00");

  return (
    <section className="space-y-4">
      {/* day navigator */}
      <div className="card mx-auto flex max-w-sm items-center justify-between rounded-full p-1.5 shadow-sm">
        <button disabled={!canPrev} onClick={() => { sfx.tick(); setDay(addDays(day, -1)); }} className="grid size-12 place-items-center rounded-full bg-primary text-primary-ink disabled:bg-line disabled:text-muted" aria-label="اليوم السابق">
          <ChevronRight size={22} />
        </button>
        <div className="text-center leading-tight">
          <div className="font-bold">{dt.toLocaleDateString("ar", { weekday: "long" })}</div>
          <div className="text-sm text-muted" dir="ltr">{day.replaceAll("-", "/")}</div>
        </div>
        <button disabled={!canNext} onClick={() => { sfx.tick(); setDay(addDays(day, 1)); }} className="grid size-12 place-items-center rounded-full bg-primary text-primary-ink disabled:bg-line disabled:text-muted" aria-label="اليوم التالي">
          <ChevronLeft size={22} />
        </button>
      </div>

      {/* today's points as stars */}
      <div className="flex justify-center gap-2" dir="ltr" aria-label={`نقاط اليوم ${preview}`}>
        {digits.map((d, i) => (
          <span key={`${i}-${d}`} className="star-badge pop !size-14 text-2xl" style={{ background: "color-mix(in srgb, var(--accent) 55%, #ffe27a)", color: "#5a3d00", animationDelay: `${i * 60}ms` }}>
            {ar(Number(d))}
          </span>
        ))}
      </div>

      {loading && !data ? <Loading /> : (
        <>
          {/* swipeable cards */}
          <div ref={scroller} onScroll={onScroll} className="-mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-[7%] pb-12 pt-1 [scrollbar-width:none] md:mx-0 md:px-[5%] [&::-webkit-scrollbar]:hidden">
            {cards.map((card) => (
              <div key={card.name} className="card relative w-[86%] shrink-0 snap-center p-4 shadow-md md:w-[70%]">
                <h3 className="mb-3 text-center text-xl font-extrabold">{card.name}</h3>
                <div className="max-h-[22rem] space-y-2.5 overflow-y-auto pb-6">
                  {card.tasks.map((t) => {
                    const e = entries[t.id];
                    const done = card.auto ? (data?.auto[t.id] ?? 0) > 0 : !!e?.done;
                    const pts = card.auto ? (data?.auto[t.id] ?? t.points) : t.kind === "count" ? pointsOf(t, e?.amount ?? 0) || t.points : t.points;
                    return (
                      <div key={t.id} className={`rounded-[28px] border-[1.5px] transition ${done ? "border-primary bg-tint" : "border-line bg-surface"}`}>
                        <button disabled={card.auto} onClick={() => toggle(t)} className="flex w-full items-center gap-3 p-2.5 ps-3 text-start">
                          <span className={`grid size-7 shrink-0 place-items-center rounded-full border-2 transition ${done ? "border-primary bg-primary text-primary-ink" : "border-line"}`}>{done && <Check size={16} className="pop" />}</span>
                          <span className="flex-1 leading-tight">
                            <span className="block font-bold">{t.icon} {t.title}</span>
                            <span className="text-xs text-muted">
                              {card.auto ? "تلقائي" : t.kind === "count" ? `كل ${ar(t.per_units)} ${t.unit ?? "مرة"} = ${ar(t.points)} نقاط` : "اضغط عند الإنجاز"}
                            </span>
                          </span>
                          <span key={`${t.id}-${pts}-${done}`} className={`star-badge ${done ? "pop" : "opacity-70"}`}>{ar(pts)}</span>
                        </button>
                        {t.kind === "count" && open === t.id && !card.auto && (
                          <div className="space-y-2 border-t border-line px-3 pb-3 pt-2">
                            <div className="flex items-center gap-2">
                              <button onClick={() => bump(t, -Math.max(1, t.per_units))} className="grid size-11 place-items-center rounded-xl border border-line" aria-label="إنقاص"><Minus size={18} /></button>
                              <input
                                type="number" min={0} inputMode="numeric" dir="ltr"
                                value={e?.amount ?? 0}
                                onChange={(ev) => { const n = Math.max(0, Number(ev.target.value) || 0); set(t, { amount: n, done: n > 0 }); }}
                                className="field !min-h-11 text-center text-lg font-extrabold"
                                aria-label={`عدد ${t.title}`}
                              />
                              <button onClick={() => bump(t, Math.max(1, t.per_units))} className="grid size-11 place-items-center rounded-xl bg-primary text-primary-ink" aria-label="زيادة"><Plus size={18} /></button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {[10, 50, 100, 500].map((n) => (
                                <button key={n} onClick={() => bump(t, n)} className="rounded-full bg-surface px-3 py-1.5 text-sm font-bold text-primary ring-1 ring-line">+{ar(n)}</button>
                              ))}
                            </div>
                            {t.target && <div className="bar"><i style={{ width: `${Math.min(100, ((e?.amount ?? 0) / t.target) * 100)}%` }} /></div>}
                            {t.target && <p className="text-center text-xs text-muted">{ar(e?.amount ?? 0)} من {ar(t.target)}</p>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* page dots + arrows */}
          {cards.length > 1 && (
            <div className="-mt-9 flex items-center justify-center gap-3">
              <button onClick={() => goto(Math.max(0, active - 1))} className="grid size-9 place-items-center rounded-full bg-tint text-primary" aria-label="البطاقة السابقة"><ChevronRight size={18} /></button>
              <div className="flex gap-1.5">
                {cards.map((c, i) => <i key={c.name} className={`h-2 rounded-full transition-all ${i === active ? "w-6 bg-primary" : "w-2 bg-line"}`} />)}
              </div>
              <button onClick={() => goto(Math.min(cards.length - 1, active + 1))} className="grid size-9 place-items-center rounded-full bg-tint text-primary" aria-label="البطاقة التالية"><ChevronLeft size={18} /></button>
            </div>
          )}

          <ErrorBox message={act.error} />
          <div className="flex justify-center">
            <button
              onClick={save}
              disabled={!dirty || act.busy}
              className={`grid size-24 place-items-center rounded-full text-lg font-extrabold shadow-xl transition active:scale-95 ${dirty ? "bg-primary text-primary-ink ring-8 ring-primary/15" : "bg-line text-muted"}`}
            >
              <span className="flex flex-col items-center gap-0.5">
                {saved && !dirty ? <Check size={26} className="pop" /> : <Save size={24} />}
                {act.busy ? "…" : saved && !dirty ? "تم" : "حفظ"}
              </span>
            </button>
          </div>
        </>
      )}
    </section>
  );
}
