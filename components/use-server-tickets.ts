"use client"

import { useCallback, useEffect, useState } from "react"
import { listMyTickets } from "@/app/actions/tickets"
import type { Ticket } from "@/lib/tickets"

/**
 * يقرأ تذاكر المستخدم حيًا من Supabase عبر إجراء الخادم `listMyTickets`.
 * يُستخدم في لوحة العميل ولوحة العمليات لعرض الحجوزات الحقيقية من قاعدة البيانات.
 */
export function useServerTickets(customerId?: string): {
  tickets: Ticket[]
  loading: boolean
  reload: () => Promise<void>
} {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)

  /** إعادة تحميل الحجوزات يدويًا (زر «تحديث البيانات» في لوحة السوبر أدمن). */
  const reload = useCallback(async () => {
    setLoading(true)
    try {
      setTickets(await listMyTickets(customerId))
    } catch {
      // نتجاهل الفشل ونُبقي آخر قراءة ناجحة.
    } finally {
      setLoading(false)
    }
  }, [customerId])

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
    return () => {
      cancelled = true
    }
  }, [customerId])

  return { tickets, loading, reload }
}
