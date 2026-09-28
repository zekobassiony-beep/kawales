"use client"

import { useCallback, useEffect, useState } from "react"
import { listMyTickets } from "@/app/actions/tickets"
import { syncTicketStatusesFromServer, type Ticket } from "@/lib/tickets"

/** الفاصل الزمني لاستطلاع قرارات الإدارة على تليجرام (ميلي ثانية). */
const POLL_INTERVAL_MS = 6000

/**
 * يقرأ تذاكر المستخدم حيًا من Supabase عبر إجراء الخادم `listMyTickets`،
 * ويعيد القراءة دوريًا حتى تنعكس قرارات الإدارة (قبول/رفض من تليجرام) وصورة
 * التذكرة تلقائيًا بلا تحديث يدوي للصفحة.
 */
export function useServerTickets(customerId?: string): {
  tickets: Ticket[]
  loading: boolean
  reload: () => Promise<void>
} {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)

  /** قراءة التذاكر من الخادم (`silent` = بلا مؤشر تحميل، للاستطلاع الدوري). */
  const load = useCallback(
    async (silent: boolean) => {
      if (!silent) setLoading(true)
      try {
        setTickets(await listMyTickets(customerId))
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
    setLoading(true)
    listMyTickets(customerId)
      .then((rows) => {
        if (!cancelled) setTickets(rows)
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    // استطلاع دوري: يزامن الحالة المحلية مع السيرفر (قرار تليجرام) ويعيد قراءة القائمة.
    const timer = window.setInterval(() => {
      if (cancelled) return
      void syncTicketStatusesFromServer()
      void load(true)
    }, POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [customerId, load])

  return { tickets, loading, reload }
}

