export function LogoMark({ size = 64, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={(size * 140) / 120}
      viewBox="0 0 120 140"
      fill="none"
      className={className}
      aria-hidden
    >
      {/* mihrab arch */}
      <path
        d="M14 134V64C14 36 38 18 60 6c22 12 46 30 46 58v70"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M27 134V66c0-21 17-35 33-44 16 9 33 23 33 44v68"
        stroke="var(--accent)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity=".9"
      />
      {/* eight-point star */}
      <g fill="var(--accent)">
        <rect x="51" y="43" width="18" height="18" rx="1.5" />
        <rect x="51" y="43" width="18" height="18" rx="1.5" transform="rotate(45 60 52)" />
      </g>
      {/* open Quran */}
      <path
        d="M60 118c-9-8-21-9-30-5V88c9-4 21-3 30 5 9-8 21-9 30-5v25c-9-4-21-3-30 5z"
        fill="currentColor"
      />
      <path d="M60 93v25" stroke="var(--bg)" strokeWidth="2" opacity=".55" />
    </svg>
  );
}

export function Logo({ size = 44, light = false }: { size?: number; light?: boolean }) {
  return (
    <div className={`flex items-center gap-3 ${light ? "text-white" : "text-primary"}`}>
      <LogoMark size={size} />
      <div className="leading-none">
        <div className="quran text-[1.7em] font-bold" style={{ fontSize: size * 0.62 }}>
          محراب
        </div>
        <div className="mt-1 text-[0.62rem] tracking-[0.28em] opacity-70" dir="ltr">
          MIHRAB
        </div>
      </div>
    </div>
  );
}
