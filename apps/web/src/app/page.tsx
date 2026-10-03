"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";

export default function Splash() {
  const router = useRouter();
  useEffect(() => {
    const t = setTimeout(() => {
      const has = localStorage.getItem("mihrab-theme");
      router.replace(has ? "/login/" : "/welcome/");
    }, 1600);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <div className="hero grid min-h-dvh place-items-center">
      <div className="rise flex flex-col items-center gap-6">
        <Logo light size={92} />
        <p className="quran text-xl opacity-80">وَرَتِّلِ الْقُرْآنَ تَرْتِيلًا</p>
      </div>
    </div>
  );
}
