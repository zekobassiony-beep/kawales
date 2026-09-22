"use client"

import { useMemo } from "react"
import { qrMatrix } from "@/lib/tickets"
import { cn } from "@/lib/utils"

/**
 * رمز استجابة سريعة (QR) مرسوم كـ SVG واضح بلا تشوّه:
 * خلايا مربّعة صحيحة الأبعاد على خلفية بيضاء مع `crispEdges` لضمان حدّة الحواف،
 * ونفس المرجع ينتج نفس الرمز دائمًا.
 */
export function QrCode({ payload, size = 160, className }: { payload: string; size?: number; className?: string }) {
  const matrix = useMemo(() => qrMatrix(payload), [payload])
  const modules = matrix.length
  // نقرّب الحجم لأقرب مضاعف للوحدات حتى تظل كل خلية محاذية للبكسل تمامًا.
  const scale = Math.max(1, Math.round(size / modules))
  const rendered = modules * scale

  return (
    <svg
      role="img"
      aria-label={`رمز QR للتذكرة ${payload}`}
      viewBox={`0 0 ${modules} ${modules}`}
      width={rendered}
      height={rendered}
      className={cn("rounded-lg bg-white", className)}
      shapeRendering="crispEdges"
    >
      <rect x={0} y={0} width={modules} height={modules} fill="#ffffff" />
      {matrix.map((row, rowIndex) =>
        row.map((filled, columnIndex) =>
          filled ? (
            <rect
              key={`${rowIndex}-${columnIndex}`}
              x={columnIndex}
              y={rowIndex}
              width={1}
              height={1}
              fill="#0f172a"
            />
          ) : null,
        ),
      )}
    </svg>
  )
}

