"use client"

import { useMemo } from "react"
import { Armchair, Building2, TrendingUp } from "lucide-react"
import { layoutCapacity, useVenueLayout } from "@/lib/venue-layout"

/**
 * كروت إحصائيات مدير المسرح: تقرأ المخطط الحقيقي من `lib/venue-layout`
 * لتحسب السعة والإشغال المتوقع لحظيًا مع تعديل التخطيط.
 */
export function VenueStats({
  dbCapacity,
  dbVenueName,
  ticketsSold,
}: {
  dbCapacity: number
  dbVenueName: string
  ticketsSold: number
}) {
  const layout = useVenueLayout()

  const stats = useMemo(() => {
    const capacity = layoutCapacity(layout) || dbCapacity
    const halls = layout.sectors.length || 1
    const occupancy = capacity > 0 ? Math.min(Math.round((ticketsSold / capacity) * 100), 100) : 0
    return { capacity, halls, occupancy }
  }, [layout, dbCapacity, ticketsSold])

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="rounded-xl border border-border/60 bg-card p-5">
        <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
          <Armchair className="h-3.5 w-3.5" />
          إجمالي السعة الاستيعابية
        </p>
        <p className="mt-1 font-serif text-2xl font-bold">{stats.capacity} مقعدًا</p>
        <p className="mt-1 text-xs text-muted-foreground">{dbVenueName}</p>
      </div>
      <div className="rounded-xl border border-border/60 bg-card p-5">
        <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
          <Building2 className="h-3.5 w-3.5" />
          عدد القطاعات / القاعات
        </p>
        <p className="mt-1 font-serif text-2xl font-bold">{stats.halls}</p>
        <p className="mt-1 text-xs text-muted-foreground">حسب التخطيط الحالي</p>
      </div>
      <div className="rounded-xl border border-border/60 bg-card p-5">
        <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
          <TrendingUp className="h-3.5 w-3.5" />
          نسبة الإشغال المتوقعة
        </p>
        <p className="mt-1 font-serif text-2xl font-bold">{stats.occupancy}%</p>
        <p className="mt-1 text-xs text-muted-foreground">{ticketsSold} تذكرة مباعة من {stats.capacity}</p>
      </div>
    </div>
  )
}
