"use client";

import { useState } from "react";
import { Plus, Sparkles, Trash2 } from "lucide-react";
import { api, useFetch, type CompTask, type Halaqa } from "@/lib/api";
import { ErrorBox, Field, Sheet, useAction } from "./ui";

type Draft = { kind: CompTask["kind"]; group: string; title: string; icon: string; points: number; per_units: number; unit: string | null; target: number | null };

const kindLabel: Record<CompTask["kind"], string> = {
  check: "بند «تم» يسجّله الطالب يومياً",
  count: "عدّاد يسجّله الطالب (مثل ٥٠٠ صلاة على النبي)",
  attendance: "حضور الحلقة (تلقائي)",
  recitation_pages: "صفحات التسميع (تلقائي)",
  homework: "إكمال الواجب (تلقائي)",
};

const d = (kind: Draft["kind"], group: string, title: string, icon: string, points: number, extra: Partial<Draft> = {}): Draft => ({ kind, group, title, icon, points, per_units: 1, unit: null, target: null, ...extra });

const TEMPLATE: Draft[] = [
  d("check", "الصلوات", "صلاة الفجر في الجماعة", "🌅", 10),
  d("check", "الصلوات", "صلاة الظهر في الجماعة", "☀️", 10),
  d("check", "الصلوات", "صلاة العصر في الجماعة", "🌤️", 10),
  d("check", "الصلوات", "صلاة المغرب في الجماعة", "🌇", 10),
  d("check", "الصلوات", "صلاة العشاء في الجماعة", "🌙", 10),
  d("count", "الأذكار", "الصلاة على النبي ﷺ", "🤍", 5, { per_units: 100, unit: "مرة", target: 500 }),
  d("count", "الأذكار", "الاستغفار", "🤲", 5, { per_units: 100, unit: "مرة", target: 300 }),
  d("count", "القرآن", "قراءة القرآن", "📗", 10, { per_units: 5, unit: "صفحة", target: 20 }),
  d("check", "أعمال صالحة", "بر الوالدين", "❤️", 20),
  d("check", "أعمال صالحة", "صدقة اليوم", "🎁", 10),
  d("attendance", "تلقائي", "حضور الحلقة", "🕌", 5),
  d("recitation_pages", "تلقائي", "تسميع صفحة", "📖", 2),
  d("homework", "تلقائي", "إكمال الواجب", "📝", 10),
];

const iso = (x: Date) => x.toISOString().slice(0, 10);

export function CompetitionBuilder({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const halaqas = useFetch<Halaqa[]>("/halaqas");
  const { busy, error, run, setError } = useAction();
  const [tasks, setTasks] = useState<Draft[]>(TEMPLATE);
  const [scope, setScope] = useState<"mosque" | "halaqas">("mosque");
  const [picked, setPicked] = useState<number[]>([]);
  const upd = (i: number, patch: Partial<Draft>) => setTasks((t) => t.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const self = (k: Draft["kind"]) => k === "check" || k === "count";

  return (
    <Sheet title="مسابقة جديدة" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          if (scope === "halaqas" && !picked.length) return setError("اختر حلقة واحدة على الأقل");
          run(async () => {
            await api("/competitions", {
              method: "POST",
              body: {
                name: f.get("name"),
                description: f.get("description") || null,
                start_date: f.get("start"),
                end_date: f.get("end"),
                scope,
                halaqa_ids: scope === "halaqas" ? picked : [],
                show_ranking: f.get("ranking") === "on",
                tasks: tasks.map((t) => ({ ...t, group: self(t.kind) ? t.group || "عام" : "تلقائي", unit: t.kind === "count" ? t.unit : null, per_units: t.kind === "count" ? Math.max(1, t.per_units) : 1, target: t.kind === "count" ? t.target : null })),
              },
            });
            onDone();
            onClose();
          });
        }}
      >
        <Field label="اسم المسابقة">
          <input name="name" required minLength={2} className="field" defaultValue="مسابقة ترتيل" />
        </Field>
        <Field label="الوصف">
          <textarea name="description" rows={2} className="field py-3" defaultValue="مسابقة لتحفيز الطلاب على الحفظ والمراجعة والالتزام." />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="تبدأ"><input name="start" type="date" required className="field" defaultValue={iso(new Date())} /></Field>
          <Field label="تنتهي"><input name="end" type="date" required className="field" defaultValue={iso(new Date(Date.now() + 14 * 864e5))} /></Field>
        </div>

        <div>
          <span className="mb-1.5 block text-sm font-bold text-muted">المشاركون</span>
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-tint p-1.5">
            {([["mosque", "كل حلقات المسجد"], ["halaqas", "حلقات محددة"]] as const).map(([k, l]) => (
              <button type="button" key={k} onClick={() => setScope(k)} className={`min-h-11 rounded-xl font-bold transition ${scope === k ? "bg-primary text-primary-ink shadow" : "text-muted"}`}>{l}</button>
            ))}
          </div>
          {scope === "halaqas" && (
            <div className="mt-3 space-y-2">
              {halaqas.data?.map((h) => (
                <label key={h.id} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5 font-bold">
                  <input type="checkbox" className="size-5 accent-[var(--primary)]" checked={picked.includes(h.id)} onChange={(e) => setPicked((p) => (e.target.checked ? [...p, h.id] : p.filter((x) => x !== h.id)))} />
                  {h.name}
                </label>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-bold text-muted">البنود (كل مجموعة تظهر كبطاقة قابلة للتحريك)</span>
            <button type="button" onClick={() => setTasks(TEMPLATE)} className="flex shrink-0 items-center gap-1 text-sm font-bold text-primary"><Sparkles size={15} /> قالب ترتيل</button>
          </div>
          <div className="space-y-2">
            {tasks.map((t, i) => (
              <div key={i} className="card space-y-2 p-3">
                <div className="flex gap-2">
                  <input className="field !min-h-11 !w-14 text-center" value={t.icon} onChange={(e) => upd(i, { icon: e.target.value })} aria-label="أيقونة" />
                  <input className="field !min-h-11" value={t.title} onChange={(e) => upd(i, { title: e.target.value })} aria-label="العنوان" />
                  <button type="button" onClick={() => setTasks((x) => x.filter((_, j) => j !== i))} className="grid size-11 shrink-0 place-items-center rounded-xl bg-bad/10 text-bad" aria-label="حذف البند"><Trash2 size={17} /></button>
                </div>
                <select className="field !min-h-11" value={t.kind} onChange={(e) => upd(i, { kind: e.target.value as Draft["kind"] })}>
                  {Object.entries(kindLabel).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  {self(t.kind) && <input className="field !min-h-11" placeholder="اسم البطاقة (مثل: الأذكار)" value={t.group} onChange={(e) => upd(i, { group: e.target.value })} aria-label="البطاقة" />}
                  <label className="flex items-center gap-2 text-sm font-bold text-muted">
                    نقاط
                    <input type="number" min={1} max={1000} className="field !min-h-11 text-center" value={t.points} onChange={(e) => upd(i, { points: Number(e.target.value) })} />
                  </label>
                  {t.kind === "count" && (
                    <>
                      <label className="flex items-center gap-2 text-sm font-bold text-muted">
                        لكل
                        <input type="number" min={1} className="field !min-h-11 text-center" value={t.per_units} onChange={(e) => upd(i, { per_units: Number(e.target.value) })} />
                      </label>
                      <input className="field !min-h-11" placeholder="الوحدة (مرة، صفحة)" value={t.unit ?? ""} onChange={(e) => upd(i, { unit: e.target.value })} aria-label="الوحدة" />
                      <label className="col-span-2 flex items-center gap-2 text-sm font-bold text-muted">
                        الهدف اليومي
                        <input type="number" min={1} className="field !min-h-11 text-center" value={t.target ?? ""} onChange={(e) => upd(i, { target: Number(e.target.value) || null })} />
                      </label>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
          <button type="button" className="btn btn-ghost mt-2 w-full !min-h-11" onClick={() => setTasks((t) => [...t, d("check", "عام", "", "⭐", 10)])}>
            <Plus size={18} /> إضافة بند
          </button>
          <p className="mt-2 text-xs text-muted">النقاط تحفيزية داخل التطبيق، وليست قياساً للأجر والثواب عند الله.</p>
        </div>

        <label className="flex items-center gap-3 font-bold">
          <input name="ranking" type="checkbox" defaultChecked className="size-5 accent-[var(--primary)]" /> إظهار الترتيب للطلاب
        </label>
        <ErrorBox message={error} />
        <button className="btn w-full" disabled={busy || !tasks.length}>{busy ? "جارٍ الحفظ…" : "حفظ كمسودة"}</button>
      </form>
    </Sheet>
  );
}
