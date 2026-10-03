"use client";

import { CheckCircle2, Circle } from "lucide-react";
import { PageHead } from "@/components/AppShell";
import { Empty, ErrorBox, Loading } from "@/components/ui";
import { fmtDate, useFetch, type Homework } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function HomeworkPage() {
  const { user } = useAuth();
  const { data, loading, error } = useFetch<Homework[]>(user?.role === "student" ? `/students/${user.id}/homework` : null);

  if (user && user.role !== "student") return <Empty text="الواجبات تُدار من ملف كل طالب." />;
  return (
    <div>
      <PageHead title="الواجبات" />
      <ErrorBox message={error} />
      {loading ? <Loading /> : !data?.length ? <Empty text="لا توجد واجبات." /> : (
        <div className="card divide-y divide-line">
          {data.map((h) => (
            <div key={h.id} className="flex items-center gap-3 p-4">
              {h.done ? <CheckCircle2 className="text-ok" /> : <Circle className="text-muted" />}
              <div className="flex-1">
                <div className={`font-bold ${h.done ? "text-muted line-through" : ""}`}>{h.text}</div>
                <div className="text-sm text-muted">{h.done ? "مكتمل" : h.due ? `موعد التسليم: ${fmtDate(h.due)}` : "قيد الإنجاز"}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
