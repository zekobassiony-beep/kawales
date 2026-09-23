"use client"

import { formatCompact, formatEgpFromCents, type HQMetrics } from "@/lib/hq-metrics"
import { HqAreaChart, HqBarChart, HqDonutChart } from "@/app/dashboard/admin/hq/HQChartKit"

/**
 * قسم الرسومات البيانية والتحليلات (Visual Analytics) بنظام Dark Graphite & Gold.
 *
 * Chart 1: نمو المبيعات شهريًا (رسم مساحي) + الإيراد حسب المحافظة (أعمدة).
 * Chart 2: العروض الأكثر مبيعًا (أعمدة) + توزيع نسب إشغال المسارح (دائري).
 */

const compactEgp = (value: number) => formatEgpFromCents(value)
const compactCount = (value: number) => `${formatCompact(value)} تذكرة`

export function HQAnalyticsCharts({ metrics }: { metrics: HQMetrics }) {
  return (
    <div className="space-y-5">
      {/* Chart 1 — نمو المبيعات والإيرادات */}
      <div className="grid gap-5 lg:grid-cols-2">
        <HqAreaChart
          title="نمو المبيعات والإيرادات شهريًا"
          subtitle="إجمالي الإيرادات المعتمدة على مدار آخر ٦ أشهر"
          badge={metrics.trendIsDemo ? "بيانات توضيحية" : "بيانات حقيقية"}
          points={metrics.revenueTrend}
          tone="gold"
          formatValue={compactEgp}
        />
        <HqBarChart
          title="الإيراد حسب المحافظة"
          subtitle="أعلى ٥ محافظات من حيث قيمة المبيعات"
          points={metrics.revenueByCity}
          tone="emerald"
          formatValue={compactEgp}
        />
      </div>

      {/* Chart 2 — الأكثر مبيعًا وإشغال المسارح */}
      <div className="grid gap-5 lg:grid-cols-2">
        <HqBarChart
          title="العروض الأكثر مبيعًا"
          subtitle="عدد التذاكر المباعة لكل عرض مسرحي"
          points={metrics.topShows}
          tone="gold"
          formatValue={compactCount}
        />
        <HqDonutChart
          title="توزيع إشغال المسارح"
          subtitle="نسبة المقاعد المباعة من سعة كل مسرح"
          segments={metrics.occupancy.map((item) => ({
            label: item.label,
            value: item.sold,
            caption: `${Math.round((item.sold / item.capacity) * 100)}% · ${item.sold}/${item.capacity}`,
          }))}
        />
      </div>
    </div>
  )
}
