"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut, Palette, Volume2 } from "lucide-react";
import { PageHead } from "@/components/AppShell";
import { api } from "@/lib/api";
import { roleLabel, useAuth } from "@/lib/auth";
import { setSfx, sfx, sfxEnabled } from "@/lib/sfx";
import { useTheme } from "@/lib/theme";

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button role="switch" aria-checked={on} onClick={() => onChange(!on)} className="flex w-full items-center justify-between gap-3 py-1 text-start font-bold">
      {label}
      <span className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? "bg-primary" : "bg-line"}`}>
        <i className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition-all ${on ? "end-0.5" : "end-[1.4rem]"}`} />
      </span>
    </button>
  );
}

export default function Profile() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [sound, setSound] = useState(sfxEnabled);
  const [board, setBoard] = useState(true);

  return (
    <div className="space-y-5">
      <PageHead title="حسابي" />
      {user && (
        <div className="card p-5">
          <div className="text-lg font-extrabold">{user.full_name}</div>
          <div className="text-sm text-muted">{roleLabel[user.role]} · <span dir="ltr">{user.login}</span></div>
        </div>
      )}
      <div className="card space-y-3 p-5">
        <div className="flex items-center gap-2 font-extrabold"><Palette size={20} className="text-accent" /> الواجهة</div>
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-tint p-1.5">
          {([["men", "رجال"], ["women", "نساء"]] as const).map(([id, l]) => (
            <button key={id} onClick={() => setTheme(id)} className={`min-h-11 rounded-xl font-bold transition ${theme === id ? "bg-primary text-primary-ink shadow" : "text-muted"}`}>{l}</button>
          ))}
        </div>
      </div>
      <div className="card space-y-2 p-5">
        <div className="mb-1 flex items-center gap-2 font-extrabold"><Volume2 size={20} className="text-accent" /> الأصوات والتحفيز</div>
        <Switch label="أصوات الإنجازات" on={sound} onChange={(v) => { setSound(v); setSfx(v); if (v) sfx.points(); }} />
        {user?.role === "student" && (
          <Switch
            label="الظهور في لوحة المتصدرين"
            on={board}
            onChange={(v) => { setBoard(v); void api("/me/settings", { method: "PATCH", body: { show_in_leaderboard: v } }).catch(() => setBoard(!v)); }}
          />
        )}
        {user?.role === "student" && <p className="text-xs text-muted">عند الإيقاف يظهر اسمك لزملائك «طالب مجهول»، وتستمر نقاطك وشاراتك.</p>}
      </div>
      <button className="btn btn-ghost w-full text-bad" onClick={() => { logout(); router.replace("/login/"); }}>
        <LogOut size={20} /> تسجيل الخروج
      </button>
    </div>
  );
}
