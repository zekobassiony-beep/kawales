/**
 * جدولة المهام غير الحاسمة (مثل إشعار تليجرام) بعد إرسال الاستجابة إلى المتصفح،
 * لتقليل زمن انتظار المستخدم بشكل كبير (لا تحجب الواجهة).
 *
 * نستخدم `after()` من Next عند توفّره (سياق طلب حقيقي)، وإلا نُشغّل المهمة بلا انتظار
 * (fire-and-forget). في الحالتين لا يُسقط فشل المهمة العملية الأساسية أبدًا.
 *
 * ملاحظة: الاستيراد هنا **ديناميكي** لأن `next/server` غير قابل للاستيراد في بيئة
 * Node العادية (اختبارات الوحدة) — وهذا يحفظ قابلية اختبار مسارات الحجز.
 */

type BackgroundTask = () => Promise<void>

export async function runInBackground(task: BackgroundTask, label: string): Promise<"after" | "inline"> {
  const guarded: BackgroundTask = async () => {
    try {
      await task()
    } catch (error) {
      console.error(`[background] ${label}: ${error instanceof Error ? error.message : error}`)
    }
  }

  try {
    const { after } = await import("next/server")
    after(guarded)
    return "after"
  } catch (error) {
    console.warn(
      `[background] ${label}: سياق after غير متاح (${error instanceof Error ? error.message : error}) — تشغيل مباشر بلا انتظار.`,
    )
    void guarded()
    return "inline"
  }
}
