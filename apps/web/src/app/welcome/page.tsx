"use client";

import { useRouter } from "next/navigation";
import { LogoMark } from "@/components/Logo";
import { setTheme, type Theme } from "@/lib/theme";

const options: { id: Theme; title: string; sub: string; a: string; b: string; accent: string }[] = [
  { id: "men", title: "حلقات الرجال", sub: "أخضر زمردي وذهبي", a: "#0a3427", b: "#176650", accent: "#b88a2e" },
  { id: "women", title: "حلقات النساء", sub: "عنابي وذهبي وردي", a: "#4a1d41", b: "#844072", accent: "#c0806f" },
];

export default function Welcome() {
  const router = useRouter();
  const pick = (t: Theme) => {
    setTheme(t);
    router.push("/login/");
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-5 py-10">
      <div className="rise mb-8 text-center">
        <h1 className="text-3xl font-extrabold">أهلاً بك في محراب</h1>
        <p className="mt-2 text-muted">اختر الواجهة المناسبة لك للمتابعة</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {options.map((o, i) => (
          <button
            key={o.id}
            onClick={() => pick(o.id)}
            className="rise group overflow-hidden rounded-3xl text-start text-white shadow-lg transition active:scale-[.98]"
            style={{ background: `linear-gradient(160deg, ${o.a}, ${o.b})`, animationDelay: `${i * 120}ms` }}
          >
            <div className="flex h-44 items-center justify-center" style={{ color: "#fff", ["--accent" as string]: o.accent, ["--bg" as string]: o.a }}>
              <LogoMark size={86} />
            </div>
            <div className="bg-black/20 px-5 py-4">
              <div className="text-xl font-extrabold">{o.title}</div>
              <div className="text-sm opacity-80">{o.sub}</div>
            </div>
          </button>
        ))}
      </div>
      <p className="mt-6 text-center text-sm text-muted">يمكنك تغيير الواجهة لاحقاً من صفحة حسابي</p>
    </div>
  );
}
