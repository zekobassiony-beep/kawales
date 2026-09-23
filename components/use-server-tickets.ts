"use client"

import { useEffect, useState } from "react"
import { listMyTickets } from "@/app/actions/tickets"
import type { Ticket } from "@/lib/tickets"

/**
 * يقرأ تذاكر المستخدم حيًا من Supabase عبر إجراء الخادم `listMyTickets`.
 * يُستخدم في لوحة العميل ولوحة العمليات لعرض الحجوزات الحقيقية من قاعدة البيانات.
 */
export function useServerTickets(customerId?: string): { tickets: Ticket[]; loading: boolean } {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listMyTickets(customerId)
      .then((rows) => {
        if (!cancelled) {
          setTickets(rows)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [customerId])

  return { tickets, loading }
}
