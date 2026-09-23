"use client"

import { useMemo } from "react"
import { QR_QUIET_ZONE, qrMatrix } from "@/lib/qr"
import { cn } from "@/lib/utils"

/**
 * رمز QR حقيقي عالي الدقة مرسوم كـ SVG:
 *  - منطقة هدوء قياسية (4 وحدات) لضمان سهولة المسح.
 *  - خلايا صحيحة الأبعاد مع `shapeRendering="crispEdges"` (بلا تشوّه).
 *  - إطار سينمائي أبيض صريح بحواف ناعمة لإبراز الرمز.
 */
export function QrCode({
  payload,
  size = 180,
  className,
  onClick,
  title,
}: {
  payload: string
  size?: number
  className?: string
  onClick?: () => void
  title?: string
}) {
  const matrix = useMemo(() => qrMatrix(payload), [payload])
  const modules = matrix.length
  const total = modules + QR_QUIET_ZONE * 2
  // نقرّب الحجم لأقرب مضاعف للوحدات حتى تكون كل خلية محاذية للبكسل تمامًا.
  const scale = Math.max(1, Math.round(size / total))
  const rendered = total * scale

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-2xl bg-white p-3 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)] ring-1 ring-black/10",
        className,
      )}
      title={title ?? "رمز QR للتذكرة"}
    >
      <svg
        role="img"
        aria-label={`رمز QR للتذكرة ${payload}`}
        viewBox={`0 0 ${total} ${total}`}
        width={rendered}
        height={rendered}
        shapeRendering="crispEdges"
        onClick={onClick}
        className={cn("block bg-white", onClick && "cursor-zoom-in")}
      >
        <rect x={0} y={0} width={total} height={total} fill="#ffffff" />
        {matrix.map((row, rowIndex) =>
          row.map((filled, columnIndex) =>
            filled ? (
              <rect
                key={`${rowIndex}-${columnIndex}`}
                x={columnIndex + QR_QUIET_ZONE}
                y={rowIndex + QR_QUIET_ZONE}
                width={1}
                height={1}
                fill="#0b1020"
              />
            ) : null,
          ),
        )}
      </svg>
    </span>
  )
}


