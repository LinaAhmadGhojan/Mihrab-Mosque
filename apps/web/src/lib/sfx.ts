"use client";

// Small synthesized sound effects (no audio files). Calm, short, and switchable.
const KEY = "mihrab-sfx";
let ctx: AudioContext | null = null;

export const sfxEnabled = () => {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
};
export const setSfx = (on: boolean) => {
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {}
};

function audio(): AudioContext | null {
  if (typeof window === "undefined" || !sfxEnabled()) return null;
  try {
    ctx ??= new (window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(a: AudioContext, freq: number, at: number, dur: number, gain = 0.12, type: OscillatorType = "sine") {
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, a.currentTime + at);
  g.gain.exponentialRampToValueAtTime(gain, a.currentTime + at + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + at + dur);
  o.connect(g).connect(a.destination);
  o.start(a.currentTime + at);
  o.stop(a.currentTime + at + dur + 0.05);
}

const seq = (notes: number[], step: number, dur: number, type?: OscillatorType) => {
  const a = audio();
  if (a) notes.forEach((f, i) => tone(a, f, i * step, dur, 0.12, type));
};

export const sfx = {
  points: () => seq([988, 1319], 0.09, 0.22),
  badge: () => seq([523, 659, 784, 1047], 0.11, 0.35, "triangle"),
  level: () => seq([392, 494, 587, 784, 988, 1175], 0.12, 0.4, "triangle"),
  tap: () => seq([740], 0, 0.08),
  select: () => seq([660, 990], 0.06, 0.12),
  unselect: () => seq([440], 0, 0.1),
  tick: () => seq([880], 0, 0.04),
};
