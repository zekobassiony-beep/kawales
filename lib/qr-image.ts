"use client"

import { QR_QUIET_ZONE, qrMatrix } from "@/lib/qr"

/**
 * توليد صورة رمز QR عالية الدقة (PNG) على المتصفح عبر Canvas
 * بنفس المصفوفة الحقيقية ومنطقة الهدوء — للتنزيل أو الطباعة.
 */
export async function qrPngBlob(payload: string, scale = 12): Promise<Blob | null> {
  const matrix = qrMatrix(payload)
  const total = matrix.length + QR_QUIET_ZONE * 2
  const size = total * scale
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext("2d")
  if (!context) return null

  context.fillStyle = "#ffffff"
  context.fillRect(0, 0, size, size)
  context.fillStyle = "#0b1020"
  matrix.forEach((row, rowIndex) =>
    row.forEach((filled, columnIndex) => {
      if (filled) {
        context.fillRect(
          (columnIndex + QR_QUIET_ZONE) * scale,
          (rowIndex + QR_QUIET_ZONE) * scale,
          scale,
          scale,
        )
      }
    }),
  )

  return new Promise<Blob | null>((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"))
}

/** يُنزّل رمز QR كصورة PNG عالية الدقة. */
export async function downloadQrPng(payload: string, filename: string, scale = 12): Promise<void> {
  const blob = await qrPngBlob(payload, scale)
  if (!blob) return
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
