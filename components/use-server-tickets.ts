"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { listMyTickets } from "@/app/actions/tickets"
import { POLL_BASE_MS, POLL_MAX_MS, POLL_WINDOW_MS, shouldPollTickets } from "@/lib/ticket-poll"
import { syncTicketStatusesFromServer, type Ticket } from "@/lib/tickets"

/**
 * قراءة تذاكر المستخدم من السيرفر + استطلاع **مقتصد** لقرارات الإدارة.
 *
 * الاستطلاع ليس مجانيًا: كل نبضة = نداء دالة + استعلام قاعدة بيانات (+ نقل بيانات).
 * ولا معنى له حين لا ينتظر المستخدم شيئًا. لذا:
 *  - يبدأ فقط عند وجود تذكرة معلّقة، أو مقبولة بلا صورة QR بعد.
 *  - **يتوقف تلقائيًا** حين لا يبقى شيء ينتظره (لا شبكة بلا سبب).
 *  - الفاصل يتباعد تدريجيًا: ٦ ثوانٍ ← ١٢ ← ١٨ ← ٢٤ ← ٣٠ كسقف.
 *  - يتجاهل التبويب المخفي، ويُزامن فورًا عند عودة المستخدم للصفحة.
 *  - بسقف زمني كامل (١٥ دقيقة) بعدها يكفي زر «تحديث البيانات».
 *
 * القواعد نفسها في وحدة نقية مُختبَرة: `lib/ticket-poll.ts`.
 */

/** يُعاد التصدير للتوافق مع المستوردين القدامى. */
export { POLL_BASE_MS, POLL_MAX_MS, POLL_WINDOW_MS, shouldPollTickets }

export function useServerTickets(
  customerId?: string,
  options?: {
    /**
     * `undefined` = الاستطلاع الذكي المتوقف ذاتيًا (المستخدم العادي).
     * رقم       = فاصل ثابت بالمللي ثانية (لوحات الإدارة: تحديث هادئ).
     * `null`    = بلا استطلاع إطلاقًا (تحديث يدوي فقط).
     */
    pollIntervalMs?: number | null
  },
): {
  tickets: Ticket[]
  loading: boolean
  reload: () => Promise<void>
} {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  /** أحدث قائمة للاستطلاع بلا إعادة تشغيل المؤقّت مع كل قراءة. */
  const ticketsRef = useRef<Ticket[]>([])
  const pollIntervalMs = options?.pollIntervalMs

  /** قراءة التذاكر من الخادم (`silent` = بلا مؤشر تحميل، للاستطلاع الدوري). */
  const load = useCallback(
    async (silent: boolean) => {
      if (!silent) setLoading(true)
      try {
        const rows = await listMyTickets(customerId)
        ticketsRef.current = rows
        setTickets(rows)
      } catch {
        // نتجاهل الفشل ونُبقي آخر قراءة ناجحة.
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [customerId],
  )

  /** إعادة تحميل الحجوزات يدويًا (زر «تحديث البيانات» في اللوحات). */
  const reload = useCallback(async () => {
    await load(false)
  }, [load])

  useEffect(() => {
    let cancelled = false

    void load(false).then(() => {
      if (cancelled) return
    })

    if (pollIntervalMs === null) {
      return () => {
        cancelled = true
      }
    }

    const startedAt = Date.now()
    let timer: number | undefined
    let currentInterval = pollIntervalMs ?? POLL_BASE_MS
    let inFlight = false

    /** جدولة النبضة التالية (بلا تراكم مؤقّتات). */
    const schedule = (delay: number): void => {
      if (cancelled) return
      timer = window.setTimeout(() => void tick(), delay)
    }

    const tick = async (): Promise<void> => {
      if (cancelled || inFlight) return

      // تبويب مخفي ⇒ لا نستهلك شبكة؛ نُعيد الجدولة وننتظر عودة المستخدم.
      if (typeof document !== "undefined" && document.hidden) {
        schedule(POLL_BASE_MS)
        return
      }

      if (Date.now() - startedAt > POLL_WINDOW_MS) return

      inFlight = true
      try {
        await syncTicketStatusesFromServer()
        await load(true)
      } finally {
        inFlight = false
      }
      if (cancelled) return

      // الاستطلاع الذكي: بلا شيء ينتظر ⇒ توقف تمامًا (الزر اليدوي يكفي).
      if (pollIntervalMs === undefined && !shouldPollTickets(ticketsRef.current)) return

      if (pollIntervalMs === undefined) {
        // تباعد تدريجي: كل دقيقة تمرّ تزيد الفاصل خطوة حتى السقف.
        const step = Math.floor((Date.now() - startedAt) / 60_000)
        currentInterval = Math.min(POLL_MAX_MS, POLL_BASE_MS * (step + 1))
      }
      schedule(currentInterval)
    }

    // عودة المستخدم للصفحة ⇒ مزامنة فورية بدل انتظار المؤقّت.
    const onVisibilityChange = (): void => {
      if (cancelled || document.hidden) return
      if (timer) window.clearTimeout(timer)
      void tick()
    }
    document.addEventListener("visibilitychange", onVisibilityChange)

    schedule(currentInterval)

    return () => {
      cancelled = true
      if (timer) window.clearTimeout(timer)
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [load, pollIntervalMs])

  return { tickets, loading, reload }
}


