"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-bold text-muted">{label}</span>
      {children}
    </label>
  );
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 md:items-center" onClick={onClose}>
      <div
        className="rise max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[28px] bg-bg p-5 md:rounded-[28px]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={title}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-extrabold">{title}</h2>
          <button onClick={onClose} className="grid size-10 place-items-center rounded-full bg-tint text-primary" aria-label="إغلاق">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Loading() {
  return (
    <div className="grid place-items-center py-16 text-muted">
      <Loader2 className="animate-spin" />
    </div>
  );
}

export function ErrorBox({ message }: { message: string }) {
  if (!message) return null;
  return <p className="rounded-xl bg-bad/10 px-4 py-3 text-sm font-bold text-bad">{message}</p>;
}

export function Empty({ text }: { text: string }) {
  return <p className="card px-4 py-10 text-center text-muted">{text}</p>;
}

export function Avatar({ name, size = 48 }: { name: string; size?: number }) {
  return (
    <span className="grid shrink-0 place-items-center rounded-full bg-tint font-extrabold text-primary" style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {name.trim()[0]}
    </span>
  );
}

/** Runs an async action with pending + error state. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    setBusy(true);
    setError("");
    try {
      return await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run, setError };
}

export function confirmDelete(what: string) {
  return window.confirm(`هل أنت متأكد من حذف ${what}؟ لا يمكن التراجع.`);
}
