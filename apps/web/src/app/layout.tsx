import type { Metadata, Viewport } from "next";
import { Amiri, Tajawal } from "next/font/google";
import { AuthProvider } from "@/lib/auth";
import { themeBootScript } from "@/lib/theme";
import "./globals.css";

const tajawal = Tajawal({ subsets: ["arabic", "latin"], weight: ["400", "500", "700", "800"], variable: "--font-tajawal" });
const amiri = Amiri({ subsets: ["arabic", "latin"], weight: ["400", "700"], variable: "--font-amiri" });

export const metadata: Metadata = {
  title: "محراب — إدارة حلقات التحفيظ",
  description: "منصة لإدارة حلقات القرآن ومتابعة الطلاب",
};
export const viewport: Viewport = { themeColor: "#0f4a36" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" data-theme="men" className={`${tajawal.variable} ${amiri.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
