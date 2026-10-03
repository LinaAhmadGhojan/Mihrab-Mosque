"use client";

import { useState } from "react";
import { api, type Halaqa, type User } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { ErrorBox, Field, Sheet, useAction } from "./ui";

type Kind = "supervisor" | "teacher" | "student";
const path = { supervisor: "/supervisors", teacher: "/teachers", student: "/students" } as const;
const title = { supervisor: "مشرف", teacher: "معلم/ة", student: "طالب" } as const;
const stages = ["ابتدائي", "إعدادي", "ثانوي", "جامعي", "أخرى"];

/** Create or edit a supervisor / teacher / student. Fields follow the SRS per role. */
export function UserForm({
  kind,
  initial,
  halaqas = [],
  defaultHalaqa,
  onClose,
  onDone,
}: {
  kind: Kind;
  initial?: User;
  halaqas?: Halaqa[];
  defaultHalaqa?: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const { theme } = useTheme();
  const editing = !!initial;
  const { busy, error, run, setError } = useAction();
  const [mosque, setMosque] = useState("");
  const [halaqa, setHalaqa] = useState<number | "">(initial?.halaqa_id ?? defaultHalaqa ?? halaqas[0]?.id ?? "");

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const val = (k: string) => (String(f.get(k) ?? "").trim() || null);
    const age = val("age");
    const body: Record<string, unknown> = {
      full_name: val("full_name"),
      father_name: val("father_name"),
      mother_name: val("mother_name"),
      age: age ? Number(age) : null,
      education_stage: val("education_stage"),
      grade: val("grade"),
      address: val("address"),
      phone: val("phone"),
      certificates: val("certificates"),
      license_no: val("license_no"),
    };
    const pw = val("password");
    if (editing) {
      if (pw) body.password = pw;
      if (kind === "student" && halaqa !== "") body.halaqa_id = halaqa;
    } else {
      body.login = val("login");
      body.password = pw;
      body.gender = theme === "women" ? "female" : "male";
      if (kind === "supervisor") body.mosque_name = mosque.trim() || null;
      if (kind === "student") {
        if (halaqa === "") return setError("اختر الحلقة أولاً");
        body.halaqa_id = halaqa;
      }
    }
    // PATCH must not send nulls for fields the user left blank
    if (editing) for (const k of Object.keys(body)) if (body[k] === null) delete body[k];

    run(async () => {
      await api(editing ? `${path[kind]}/${initial!.id}` : path[kind], { method: editing ? "PATCH" : "POST", body });
      onDone();
      onClose();
    });
  };

  const d = initial;
  return (
    <Sheet title={`${editing ? "تعديل" : "إضافة"} ${title[kind]}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="الاسم الكامل">
          <input name="full_name" required minLength={2} className="field" defaultValue={d?.full_name} />
        </Field>

        {kind !== "supervisor" && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="اسم الأب">
              <input name="father_name" className="field" defaultValue={d?.father_name ?? ""} />
            </Field>
            <Field label="اسم الأم">
              <input name="mother_name" className="field" defaultValue={d?.mother_name ?? ""} />
            </Field>
            <Field label="العمر">
              <input name="age" type="number" min={3} max={100} className="field" defaultValue={d?.age ?? ""} />
            </Field>
            <Field label="المرحلة الدراسية">
              <select name="education_stage" className="field" defaultValue={d?.education_stage ?? ""}>
                <option value="">—</option>
                {stages.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
          </div>
        )}

        {kind === "student" && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="الصف الدراسي">
              <input name="grade" className="field" defaultValue={d?.grade ?? ""} />
            </Field>
            <Field label="الحلقة">
              <select className="field" value={halaqa} onChange={(e) => setHalaqa(Number(e.target.value))} required>
                {halaqas.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        )}

        {kind === "supervisor" && (
          <>
            <Field label="رقم ترخيص الأوقاف">
              <input name="license_no" required={!editing} className="field" defaultValue={d?.license_no ?? ""} />
            </Field>
            {!editing && (
              <Field label="اسم المسجد">
                <input className="field" required value={mosque} onChange={(e) => setMosque(e.target.value)} />
              </Field>
            )}
          </>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="العنوان">
            <input name="address" className="field" defaultValue={d?.address ?? ""} />
          </Field>
          <Field label="رقم الهاتف">
            <input name="phone" type="tel" dir="ltr" className="field text-start" defaultValue={d?.phone ?? ""} />
          </Field>
        </div>

        {kind !== "supervisor" && (
          <Field label={kind === "teacher" ? "شهادات التسميع / الإجازة" : "شهادات التسميع (إن وجدت)"}>
            <textarea name="certificates" rows={2} className="field py-3" defaultValue={d?.certificates ?? ""} />
          </Field>
        )}

        {!editing && (
          <Field label="اسم الدخول (بريد أو رقم هاتف)">
            <input name="login" required minLength={3} dir="ltr" className="field text-start" />
          </Field>
        )}
        <Field label={editing ? "كلمة سر جديدة (اتركها فارغة للإبقاء)" : "كلمة السر"}>
          <input name="password" type="password" required={!editing} minLength={6} dir="ltr" className="field text-start" />
        </Field>

        <ErrorBox message={error} />
        <button className="btn w-full" disabled={busy}>
          {busy ? "جارٍ الحفظ…" : "حفظ"}
        </button>
      </form>
    </Sheet>
  );
}
