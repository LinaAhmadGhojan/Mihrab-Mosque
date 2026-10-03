"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Award, Bell, BookOpenCheck, Home, Landmark, Megaphone, ShieldCheck, Trophy, UserRound, Users, GraduationCap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { CelebrationHost } from "./Celebrate";
import { Logo } from "./Logo";
import { useAuth } from "@/lib/auth";
import type { Role } from "@/lib/api";

type Item = { href: string; label: string; icon: LucideIcon };

const home: Item = { href: "/app/", label: "الرئيسية", icon: Home };
const comps: Item = { href: "/app/competitions/", label: "المسابقات", icon: Trophy };
const me: Item = { href: "/app/profile/", label: "حسابي", icon: UserRound };

const nav: Record<Role, Item[]> = {
  admin: [home, { href: "/app/supervisors/", label: "المشرفون", icon: ShieldCheck }, { href: "/app/announcements/", label: "الإعلانات", icon: Megaphone }, me],
  supervisor: [
    home,
    { href: "/app/halaqas/", label: "الحلقات", icon: Landmark },
    { href: "/app/teachers/", label: "المعلمون", icon: GraduationCap },
    comps,
    me,
  ],
  teacher: [
    home,
    { href: "/app/students/", label: "الطلاب", icon: Users },
    { href: "/app/recitation/", label: "التسميع", icon: BookOpenCheck },
    comps,
    me,
  ],
  student: [
    home,
    comps,
    { href: "/app/my-halaqa/", label: "حلقتي", icon: Users },
    { href: "/app/achievements/", label: "إنجازاتي", icon: Award },
    me,
  ],
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { user, ready } = useAuth();

  useEffect(() => {
    if (ready && !user) router.replace("/login/");
  }, [ready, user, router]);

  if (!user) return <div className="hero min-h-dvh" />;

  const items = nav[user.role];
  const active = (href: string) => (href === "/app/" ? path === "/app/" : path.startsWith(href));

  return (
    <div className="min-h-dvh md:flex">
      <aside className="hero hidden w-72 shrink-0 flex-col p-6 md:flex">
        <Logo light size={46} />
        <nav className="mt-10 flex flex-col gap-1.5">
          {items.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 font-medium transition ${active(href) ? "bg-white/15" : "opacity-80 hover:bg-white/10"}`}
            >
              <Icon size={20} /> {label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="mx-auto w-full max-w-xl pb-28 md:max-w-3xl md:pb-10">
        <header className="hero sticky top-0 z-20 flex items-center justify-between rounded-b-[28px] px-5 pb-5 pt-6 md:hidden">
          <Logo light size={34} />
          <Link href="/app/announcements/" className="grid size-11 place-items-center rounded-full bg-white/15" aria-label="الإعلانات">
            <Bell size={20} />
          </Link>
        </header>
        <main className="px-5 pt-6 md:px-8 md:pt-10">{children}</main>
      </div>

      <CelebrationHost />
      <nav className="fixed inset-x-3 bottom-3 z-30 flex justify-around rounded-[26px] border border-line bg-surface/95 p-1.5 shadow-[0_10px_30px_-8px_rgba(0,0,0,.25)] backdrop-blur md:hidden">
        {items.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex min-w-14 flex-col items-center gap-0.5 rounded-2xl px-2.5 py-2 text-[0.72rem] font-bold transition ${active(href) ? "bg-primary text-primary-ink" : "text-muted"}`}
          >
            <Icon size={22} />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function ProgressRing({ value, size = 84, label }: { value: number; size?: number; label?: string }) {
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.2)" strokeWidth="8" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--accent)" strokeWidth="8" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} />
      </svg>
      <span className="absolute text-lg font-extrabold" dir="ltr">
        {label ?? `${Math.round(v)}%`}
      </span>
    </div>
  );
}

export function PageHead({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h1 className="text-2xl font-extrabold">{title}</h1>
      {action}
    </div>
  );
}
