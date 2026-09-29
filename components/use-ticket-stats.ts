"use client"

import { useCallback, useEffect, useState } from "react"
import { getTicketStatsServer } from "@/app/actions/tickets"
import type { TicketStats } from "@/lib/supabase/tickets"

/**
 * يقرأ الأرقام الإجمالية للتذاكر من قاعدة البيانات **مرة واحدة** (بلا استطلاع).
 *
 * السبب: قوائم التذاكر في الواجهة محدودة بأحدث صفوف لتفادي نقل ميجابايتات في كل
 * نبضة، لكن مؤشرات اللوحة يجب أن تبقى دقيقة عند أي عدد تذاكر ⇒ الأرقام تأتي من
 * تجميع في القاعدة، والقوائم للعرض التفصيلي فقط.
 */
export function useTicketStats(): {
  stats: TicketStats | null
  refresh: () => Promise<void>
} {
  const [stats, setStats] = useState<TicketStats | null>(null)

  const refresh = useCallback(async () => {
    try {
      setStats(await getTicketStatsServer())
    } catch {
      // نبقي آخر قراءة ناجحة (لا نُظهر صفرًا كاذبًا).
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { stats, refresh }
}
