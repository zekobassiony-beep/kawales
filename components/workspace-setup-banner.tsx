"use client"

import { AlertTriangle, CheckCircle2, Database } from "lucide-react"
import { useWorkspaceSyncStatus } from "@/lib/productions-sync"

/** رابط SQL Editor لمشروع كواليس (لتشغيل ملف الجداول بضغطة). */
const SCHEMA_URL = "https://supabase.com/dashboard/project/yvixrtlonpubbjxhprld/sql/new"

/**
 * بانر حالة الحفظ الدائم لمساحة العمل.
 *
 * كان أي حفظ (عمل مسرحي/معرض صور/طاقم/أودشن) يقع بصمت في `localStorage` إذا كانت
 * جداول Supabase غير مُنشأة، فيظن المستخدم أن التعديل «لم يتغيّر». هذا البانر
 * يقول الحقيقة بوضوح ويحمل رابط تشغيل الملف المطلوب.
 */
export function WorkspaceSetupBanner() {
  const status = useWorkspaceSyncStatus()

  if (!status.tableReady) {
    return (
      <div className="rounded-2xl border border-amber-500/50 bg-amber-500/10 p-4 text-xs leading-relaxed text-amber-100">
        <p className="flex items-center gap-2 font-semibold">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          الحفظ الدائم غير مُفعَّل — تعديلاتك محفوظة في متصفحك فقط (تضيع عند تغيير الجهاز)
        </p>
        <p className="mt-2">
          لتثبيت الأعمال المسرحية والأودشنات ودعوات الطاقم في قاعدة البيانات: افتح SQL Editor وشغّل ملف{" "}
          <code className="rounded bg-background/40 px-1 font-mono">scripts/productions-schema.sql</code> مرة واحدة،
          ثم أعد تحميل الصفحة.
        </p>
        {status.lastError && (
          <p className="mt-2 text-[11px] opacity-80" dir="ltr">
            {status.lastError}
          </p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <a
            href={SCHEMA_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full bg-amber-400 px-4 py-2 font-semibold text-zinc-950 transition-opacity hover:opacity-90"
          >
            <Database className="h-3.5 w-3.5" />
            افتح SQL Editor وشغّل الملف
          </a>
          <span className="rounded-full border border-amber-500/40 px-3 py-2 font-mono text-[11px]" dir="ltr">
            npm run db:productions
          </span>
        </div>
      </div>
    )
  }

  if (!status.lastSyncAt) return null

  const time = new Date(status.lastSyncAt).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })

  return (
    <p className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-2 text-[11px] text-emerald-200">
      <CheckCircle2 className="h-3.5 w-3.5" />
      الحفظ الدائم مفعّل — آخر مزامنة مع قاعدة البيانات {time}
    </p>
  )
}
