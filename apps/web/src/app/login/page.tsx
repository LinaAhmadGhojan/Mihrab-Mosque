"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { Logo } from "@/components/Logo";
import { ErrorBox, useAction } from "@/components/ui";
import { useAuth } from "@/lib/auth";

export default function Login() {
  const router = useRouter();
  const { user, ready, login } = useAuth();
  const [show, setShow] = useState(false);
  const { busy, error, run } = useAction();

  useEffect(() => {
    if (ready && user) router.replace("/app/");
  }, [ready, user, router]);

  return (
    <div className="min-h-dvh md:grid md:grid-cols-2">
      <div className="hero flex flex-col items-center justify-center gap-4 rounded-b-[36px] px-6 pb-16 pt-14 md:rounded-none">
        <Logo light size={84} />
        <p className="quran text-lg opacity-80">إِنَّ هَٰذَا الْقُرْآنَ يَهْدِي لِلَّتِي هِيَ أَقْوَمُ</p>
      </div>
      <form
        className="rise mx-auto -mt-8 w-full max-w-md px-5 pb-10 md:mt-0 md:flex md:flex-col md:justify-center"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          run(async () => {
            await login(String(f.get("login")).trim(), String(f.get("password")));
            router.push("/app/");
          });
        }}
      >
        <div className="card space-y-4 p-6 shadow-sm">
          <h1 className="text-2xl font-extrabold">تسجيل الدخول</h1>
          <label className="block">
            <span className="mb-1.5 block text-sm font-bold text-muted">البريد الإلكتروني أو رقم الهاتف</span>
            <input name="login" required dir="ltr" autoComplete="username" className="field text-start" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-bold text-muted">كلمة المرور</span>
            <div className="relative">
              <input name="password" required type={show ? "text" : "password"} dir="ltr" autoComplete="current-password" className="field text-start" />
              <button type="button" onClick={() => setShow(!show)} className="absolute end-3 top-1/2 -translate-y-1/2 text-muted" aria-label="إظهار كلمة المرور">
                {show ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </label>
          <ErrorBox message={error} />
          <button className="btn w-full" disabled={busy}>
            <LogIn size={20} /> {busy ? "جارٍ الدخول…" : "دخول"}
          </button>
        </div>
        <p className="mt-4 text-center text-sm text-muted">الحسابات تُنشأ من قبل الإدارة فقط</p>
      </form>
    </div>
  );
}
