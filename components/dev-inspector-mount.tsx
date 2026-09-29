"use client"

/**
 * نقطة تحميل أداة التأشير.
 *
 * لماذا ملف منفصل؟ لأن Next يمنع `ssr: false` داخل مكوّنات السيرفر، وملف التصميم العام
 * مكوّن سيرفر. هذا المكوّن الصغير مكوّن عميل، فيه يتم التحميل المؤجّل بشكل صحيح.
 *
 * في النسخة المنشورة لا يُصيَّر شيء، وحزمة الأداة لا تُحمَّل إطلاقًا.
 */
import dynamic from "next/dynamic"

const DevInspector = dynamic(() => import("@/components/dev-inspector").then((mod) => mod.DevInspector), {
  ssr: false,
})

export function DevInspectorMount() {
  // حارس إضافي: لا شيء في غير وضع التطوير.
  if (process.env.NODE_ENV !== "development") return null
  return <DevInspector />
}
