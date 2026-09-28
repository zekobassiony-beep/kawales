/**
 * أدوات زمنية لتقييد أي عملية شبكية بمهلة قصوى، حتى لا يتعلّق الحجز أو الويب هوك
 * على تبعية بطيئة (Supabase Storage / Postgres / Telegram).
 *
 * ملاحظة: `withTimeout` لا يُلغي العملية الأصلية (بعض الـ SDK لا يدعم الإلغاء)،
 * لكنه يضمن ألا ينتظر الطلب أكثر من المهلة المحددة — وهو ما يمنع «التهنيج».
 */

/** خطأ مهلة صريح (يُسجَّل باسم العملية ومدّتها لتسهيل التشخيص). */
export class TimeoutError extends Error {
  readonly label: string
  readonly ms: number

  constructor(label: string, ms: number) {
    super(`انتهت مهلة «${label}» بعد ${Math.round(ms / 1000)} ثانية`)
    this.name = "TimeoutError"
    this.label = label
    this.ms = ms
  }
}

/** ينفّذ الوعد بمهلة قصوى ويرمي `TimeoutError` عند تجاوزها. */
export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(label, ms)), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

/**
 * ينفّذ الوعد بمهلة قصوى، ويعيد `fallback` (مع لوج مختصر) عند انتهاء المهلة أو الفشل —
 * مفيد للخطوات غير الحاسمة (مثل رفع صورة الإيصال) التي لا يصح أن تُسقط الحجز.
 */
export async function withTimeoutFallback<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
  fallback: T,
): Promise<T> {
  try {
    return await withTimeout(promise, ms, label)
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    console.warn(`[timeout] ${label}: ${reason}`)
    return fallback
  }
}

/** `fetch` بمهلة قصوى (يحترم أي `AbortSignal` مُمرَّر بدلًا من إشارة المهلة). */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  ms: number,
  label = "fetch",
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    return await fetch(url, { ...init, signal: init.signal ?? controller.signal })
  } catch (error) {
    if (controller.signal.aborted) throw new TimeoutError(label, ms)
    throw error
  } finally {
    clearTimeout(timer)
  }
}
