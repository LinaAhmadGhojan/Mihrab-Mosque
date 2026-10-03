"use client";

import { useCallback, useSyncExternalStore } from "react";

export type Theme = "men" | "women";
const KEY = "mihrab-theme";

function read(): Theme | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "men" || v === "women" ? v : null;
  } catch {
    return null;
  }
}

const listeners = new Set<() => void>();

export function setTheme(t: Theme) {
  try {
    localStorage.setItem(KEY, t);
  } catch {}
  document.documentElement.dataset.theme = t;
  listeners.forEach((l) => l());
}

export function useTheme() {
  const theme = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => null,
  );
  return { theme, setTheme: useCallback(setTheme, []) };
}

// Runs before paint so there is no flash of the wrong theme.
export const themeBootScript = `try{var t=localStorage.getItem('${KEY}');if(t==='men'||t==='women')document.documentElement.dataset.theme=t}catch(e){}`;
