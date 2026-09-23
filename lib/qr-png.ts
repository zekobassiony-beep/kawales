import { deflateSync } from "node:zlib"
import { QR_QUIET_ZONE, qrMatrix } from "@/lib/qr"

/**
 * توليد صورة PNG عالية الدقة لرمز QR على الخادم (بلا Canvas) —
 * تُستخدم لإرسال نفس رمز الموقع إلى تليجرام عند قبول الحجز.
 *
 * ملف سيرفر فقط (يعتمد على `node:zlib`).
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let index = 0; index < 256; index += 1) {
    let value = index
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    }
    table[index] = value >>> 0
  }
  return table
})()

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const typeBuffer = Buffer.from(type, "ascii")
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0)
  return Buffer.concat([length, typeBuffer, data, crc])
}

/** يبني ملف PNG رمادي 8-بت من مصفوفة رمز QR (مع منطقة هدوء). */
export function qrPngBuffer(payload: string, scale = 12): Buffer {
  const matrix = qrMatrix(payload)
  const total = matrix.length + QR_QUIET_ZONE * 2
  const size = total * scale
  const dark = 0x0b
  const light = 0xff

  // خطوط الصورة: بايت فلتر (0) ثم بكسل لكل وحدة.
  const raw = Buffer.alloc((size + 1) * size)
  for (let y = 0; y < size; y += 1) {
    const rowOffset = y * (size + 1)
    raw[rowOffset] = 0
    for (let x = 0; x < size; x += 1) {
      const moduleRow = Math.floor(y / scale) - QR_QUIET_ZONE
      const moduleCol = Math.floor(x / scale) - QR_QUIET_ZONE
      const inBounds =
        moduleRow >= 0 && moduleCol >= 0 && moduleRow < matrix.length && moduleCol < matrix.length
      const filled = inBounds && matrix[moduleRow][moduleCol]
      raw[rowOffset + 1 + x] = filled ? dark : light
    }
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // عمق البت
  ihdr[9] = 0 // رمادي
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ])
}
