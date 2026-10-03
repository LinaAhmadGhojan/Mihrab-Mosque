"use client";

import { useCallback, useEffect, useState } from "react";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8010";
const TOKEN_KEY = "mihrab-token";
const USER_KEY = "mihrab-user";

export type Role = "admin" | "supervisor" | "teacher" | "student";

export type User = {
  id: number;
  role: Role;
  login: string;
  full_name: string;
  gender: "male" | "female";
  father_name?: string | null;
  mother_name?: string | null;
  age?: number | null;
  education_stage?: string | null;
  grade?: string | null;
  address?: string | null;
  phone?: string | null;
  license_no?: string | null;
  certificates?: string | null;
  mosque_id?: number | null;
  halaqa_id?: number | null;
};

export type Halaqa = { id: number; name: string; mosque_id: number; supervisor_id: number; teacher_id: number | null; teacher_name: string | null; students: User[] };
export type Note = { id: number; recitation_id: number; page: number; ayah: number | null; text: string };
export type Recitation = { id: number; student_id: number; kind: "quran" | "hadith"; start_page: number; end_page: number; grade: string | null; created_at: string; notes: Note[] };
export type Homework = { id: number; student_id: number; text: string; due: string | null; done: boolean; created_at: string };
export type Attendance = { id: number; student_id: number; day: string; present: boolean };
export type Announcement = { id: number; author_id: number; kind: "halaqa" | "admin" | "general"; halaqa_id: number | null; title: string; body: string; image_url: string | null; created_at: string };

export const storage = {
  token: () => safe(() => localStorage.getItem(TOKEN_KEY)),
  user: (): User | null => {
    const raw = safe(() => localStorage.getItem(USER_KEY));
    try {
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      return null;
    }
  },
  save: (token: string, user: User) => {
    safe(() => {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    });
  },
  saveUser: (user: User) => safe(() => localStorage.setItem(USER_KEY, JSON.stringify(user))),
  clear: () => {
    safe(() => {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    });
  },
};

function safe<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch {
    return null;
  }
}

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = storage.token();
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: opts.method ?? "GET",
      headers: {
        ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError("تعذّر الاتصال بالخادم، تحقق من الإنترنت", 0);
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && path !== "/auth/login") {
      storage.clear();
      if (typeof window !== "undefined") window.location.href = "/login/";
    }
    const d = data?.detail;
    throw new ApiError(typeof d === "string" ? d : "تحقق من صحة الحقول المُدخلة", res.status);
  }
  return data as T;
}

export function useFetch<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(path !== null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (path === null) return;
    let alive = true;
    api<T>(path)
      .then((d) => alive && (setData(d), setError("")))
      .catch((e: Error) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [path, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, reload };
}

export const ar = (n: number) => n.toLocaleString("ar-EG");
export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("ar", { day: "numeric", month: "long" });

// ---------- gamification ----------
export type LevelInfo = { level: number; name: string; icon: string; xp: number; level_start: number; next_at: number | null; progress: number };
export type RankMe = { rank: number | null; points: number; of: number; to_next: { points: number; rank: number } | null } | null;
export type Dashboard = {
  level: LevelInfo;
  streak: { current: number; longest: number };
  goals: { key: string; label: string; done: boolean }[];
  competition: { id: number; name: string; ends: string; days_left: number; me: RankMe } | null;
  badges_count: number;
  last_badge: { name: string; icon: string; description: string } | null;
  metrics: Record<string, number>;
};
export type CompTask = { id: number; kind: "attendance" | "recitation_pages" | "homework" | "check" | "count"; group: string; title: string; icon: string; points: number; per_units: number; unit: string | null; target: number | null; max_per_event: number | null; earned?: number };
export type Competition = { id: number; name: string; description: string | null; start_date: string; end_date: string; scope: "mosque" | "halaqas"; halaqa_ids: number[]; show_ranking: boolean; status: "draft" | "scheduled" | "active" | "ended" | "finalized"; tasks: CompTask[] };
export type Leaderboard = {
  competition: Competition;
  ranking_visible: boolean;
  top: { rank: number; name: string; points: number; halaqa: string; is_me: boolean }[];
  me: RankMe;
  halaqas: { name: string; points: number }[];
};
export type BadgeInfo = { code: string; name: string; description: string; icon: string; category: string; earned: boolean; progress: number; value: number; threshold: number };
export type HalaqaBoard = {
  halaqa: { name: string; teacher: string | null; count: number } | null;
  members: { name: string; pages_today: number; xp_today: number; present: boolean; is_me: boolean }[];
  highlights: { pages?: { name: string; value: number } | null; xp?: { name: string; value: number } | null };
  totals: { present?: number; pages?: number; recited?: number };
};
export type Notice = { id: number; kind: "points" | "badge" | "level"; title: string; body: string; payload: Record<string, unknown> | null };
export type LogState = { day: string; entries: Record<string, { done: boolean; amount: number; points: number }>; auto: Record<string, number>; day_points: number; total: number; gained?: number };

export const statusLabel = { draft: "مسودة", scheduled: "قادمة", active: "جارية", ended: "منتهية", finalized: "اعتُمدت النتائج" } as const;
