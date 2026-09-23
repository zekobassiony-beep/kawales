/**
 * مُولّد رمز QR حقيقي (Byte Mode · مستوى تصحيح الأخطاء M · الإصدارات 1..5).
 *
 * تنفيذ كامل بلا اعتماديات: ترميز البيانات، حسابات Reed–Solomon على GF(256)،
 * بناء الأنماط الوظيفية (Finder/Timing/Alignment)، اختيار أفضل قناع (Mask)،
 * وكتابة معلومات الصيغة (Format Info) — ليخرج رمز قابل للمسح فعليًا.
 */

/* ---------- جداول تصحيح الأخطاء (مستوى M) ---------- */

type EcBlocks = { count: number; dataPerBlock: number }[]

type EcInfo = {
  /** إجمالي الكلمات الكودية للنسخة. */
  totalCodewords: number
  /** عدد كلمات التصحيح لكل كتلة. */
  ecPerBlock: number
  /** بنية الكتل (قد تكون مجموعتين بأحجام مختلفة). */
  blocks: EcBlocks
}

/** نسخ 1..5 بمستوى M (القيم القياسية لمواصفة QR). */
const EC_M: Record<number, EcInfo> = {
  1: { totalCodewords: 26, ecPerBlock: 10, blocks: [{ count: 1, dataPerBlock: 16 }] },
  2: { totalCodewords: 44, ecPerBlock: 16, blocks: [{ count: 1, dataPerBlock: 28 }] },
  3: { totalCodewords: 70, ecPerBlock: 26, blocks: [{ count: 1, dataPerBlock: 44 }] },
  4: { totalCodewords: 100, ecPerBlock: 18, blocks: [{ count: 2, dataPerBlock: 32 }] },
  5: { totalCodewords: 134, ecPerBlock: 24, blocks: [{ count: 2, dataPerBlock: 43 }] },
}

/** مراكز أنماط المحاذاة (Alignment Patterns) لكل نسخة. */
const ALIGNMENT_CENTERS: Record<number, number[]> = {
  1: [],
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
}

const MAX_VERSION = 5

export function qrSizeForVersion(version: number): number {
  return version * 4 + 17
}

/* ---------- حساب Reed–Solomon على GF(256) ---------- */

const GF_EXP = new Uint8Array(512)
const GF_LOG = new Uint8Array(256)

;(() => {
  let value = 1
  for (let index = 0; index < 255; index += 1) {
    GF_EXP[index] = value
    GF_LOG[value] = index
    value <<= 1
    if (value & 0x100) value ^= 0x11d // كثير الحدود البدائي
  }
  for (let index = 255; index < 512; index += 1) GF_EXP[index] = GF_EXP[index - 255]
})()

function gfMultiply(a: number, b: number): number {
  if (a === 0 || b === 0) return 0
  return GF_EXP[GF_LOG[a] + GF_LOG[b]]
}

/**
 * كثير حدود المولّد لعدد معيّن من كلمات التصحيح، بترتيب **تنازلي** للأسس
 * (المعامل الرئيسي أولًا) كما تتوقعه خوارزمية التقسيم في `rsRemainder`.
 */
function rsGeneratorPoly(ecLength: number): number[] {
  let poly = [1]
  for (let index = 0; index < ecLength; index += 1) {
    const next = new Array<number>(poly.length + 1).fill(0)
    for (let term = 0; term < poly.length; term += 1) {
      next[term] ^= gfMultiply(poly[term], GF_EXP[index])
      next[term + 1] ^= poly[term]
    }
    poly = next
  }
  // البناء أعلاه ينتج الأسس تصاعديًا (الثابت أولًا) — نعكسها للترتيب القياسي.
  return poly.reverse()
}

/** كلمات التصحيح لكتلة بيانات واحدة. */
function rsRemainder(data: number[], ecLength: number): number[] {
  const generator = rsGeneratorPoly(ecLength)
  const remainder = new Array<number>(ecLength).fill(0)
  for (const byte of data) {
    const factor = byte ^ remainder[0]
    remainder.shift()
    remainder.push(0)
    for (let index = 0; index < ecLength; index += 1) {
      remainder[index] ^= gfMultiply(generator[index + 1], factor)
    }
  }
  return remainder
}

/* ---------- تحويل النص إلى كلمات كودية ---------- */

class BitBuffer {
  private readonly bits: number[] = []

  push(value: number, length: number): void {
    for (let index = length - 1; index >= 0; index -= 1) {
      this.bits.push((value >>> index) & 1)
    }
  }

  get length(): number {
    return this.bits.length
  }

  toBytes(): number[] {
    const bytes: number[] = []
    for (let index = 0; index < this.bits.length; index += 8) {
      let byte = 0
      for (let bit = 0; bit < 8; bit += 1) {
        byte = (byte << 1) | (this.bits[index + bit] ?? 0)
      }
      bytes.push(byte)
    }
    return bytes
  }
}

function utf8Bytes(text: string): number[] {
  const encoded = new TextEncoder().encode(text)
  return Array.from(encoded)
}

/** أقصى عدد بايتات يمكن ترميزه في النسخة 5 (المدعومة). */
const MAX_PAYLOAD_BYTES = (() => {
  const info = EC_M[MAX_VERSION]
  const dataCodewords = info.blocks.reduce((sum, block) => sum + block.count * block.dataPerBlock, 0)
  return Math.floor((dataCodewords * 8 - 12) / 8)
})()

/** يختار أصغر نسخة تكفي البيانات، أو النسخة الأقصى إن تجاوزت (لا يرمي استثناءً). */
function pickVersion(byteLength: number): number {
  for (let version = 1; version <= MAX_VERSION; version += 1) {
    const info = EC_M[version]
    const dataCodewords = info.blocks.reduce((sum, block) => sum + block.count * block.dataPerBlock, 0)
    const capacityBits = dataCodewords * 8
    const headerBits = 4 + (version <= 9 ? 8 : 16)
    if (headerBits + byteLength * 8 <= capacityBits) return version
  }
  return MAX_VERSION
}

/** يُهيّئ الحمولة للترميز: قيمة افتراضية للفراغ، وتقليص آمن للحمولات الطويلة جدًا. */
function fitPayload(raw: string): { text: string; version: number } {
  const text = raw.trim().length > 0 ? raw : "kawalees"
  const byteLength = utf8Bytes(text).length
  if (byteLength <= MAX_PAYLOAD_BYTES) return { text, version: pickVersion(byteLength) }

  // تقليص على حدود الأحرف (لا يقطع حرفًا في منتصفه) حتى يدخل في النسخة الأقصى.
  let truncated = ""
  let size = 0
  for (const char of text) {
    const charSize = utf8Bytes(char).length
    if (size + charSize > MAX_PAYLOAD_BYTES) break
    truncated += char
    size += charSize
  }
  return { text: truncated.length > 0 ? truncated : "kawalees", version: MAX_VERSION }
}

/** يبني الكلمات الكودية النهائية (ترميز + حشو + تصحيح + تشابك). */
function buildCodewords(text: string, version: number): number[] {
  const info = EC_M[version]
  const dataCodewords = info.blocks.reduce((sum, block) => sum + block.count * block.dataPerBlock, 0)
  const bytes = utf8Bytes(text)

  // 1) ترويسة الوضع (0100 = بايت) + عدد البايتات + البيانات.
  const buffer = new BitBuffer()
  buffer.push(0b0100, 4)
  buffer.push(bytes.length, version <= 9 ? 8 : 16)
  for (const byte of bytes) buffer.push(byte, 8)

  // 2) بت الإنهاء + محاذاة للبايت.
  const capacityBits = dataCodewords * 8
  buffer.push(0, Math.min(4, capacityBits - buffer.length))
  while (buffer.length % 8 !== 0) buffer.push(0, 1)

  const data = buffer.toBytes()

  // 3) بايتات الحشو البديلة.
  const padBytes = [0xec, 0x11]
  let padIndex = 0
  while (data.length < dataCodewords) {
    data.push(padBytes[padIndex % 2])
    padIndex += 1
  }

  // 4) تقسيم الكتل + كلمات التصحيح.
  const dataBlocks: number[][] = []
  const ecBlocks: number[][] = []
  let cursor = 0
  for (const group of info.blocks) {
    for (let block = 0; block < group.count; block += 1) {
      const chunk = data.slice(cursor, cursor + group.dataPerBlock)
      cursor += group.dataPerBlock
      dataBlocks.push(chunk)
      ecBlocks.push(rsRemainder(chunk, info.ecPerBlock))
    }
  }

  // 5) تشابك البيانات ثم التشابك التصحيحي.
  const result: number[] = []
  const maxData = Math.max(...dataBlocks.map((block) => block.length))
  for (let index = 0; index < maxData; index += 1) {
    for (const block of dataBlocks) {
      if (index < block.length) result.push(block[index])
    }
  }
  for (let index = 0; index < info.ecPerBlock; index += 1) {
    for (const block of ecBlocks) result.push(block[index])
  }
  return result
}

/* ---------- بناء المصفوفة ---------- */

function emptyGrid(size: number, fill: boolean): boolean[][] {
  return Array.from({ length: size }, () => new Array<boolean>(size).fill(fill))
}

function drawFinder(matrix: boolean[][], reserved: boolean[][], top: number, left: number): void {
  const size = matrix.length
  for (let row = -1; row <= 7; row += 1) {
    for (let col = -1; col <= 7; col += 1) {
      const y = top + row
      const x = left + col
      if (y < 0 || x < 0 || y >= size || x >= size) continue
      const inRing = row >= 0 && row <= 6 && col >= 0 && col <= 6
      const darkRing = inRing && (row === 0 || row === 6 || col === 0 || col === 6)
      const darkCore = row >= 2 && row <= 4 && col >= 2 && col <= 4
      matrix[y][x] = darkRing || darkCore
      reserved[y][x] = true
    }
  }
}

function drawAlignment(matrix: boolean[][], reserved: boolean[][], centerRow: number, centerCol: number): void {
  const size = matrix.length
  for (let row = -2; row <= 2; row += 1) {
    for (let col = -2; col <= 2; col += 1) {
      const y = centerRow + row
      const x = centerCol + col
      if (y < 0 || x < 0 || y >= size || x >= size) continue
      const isEdge = Math.abs(row) === 2 || Math.abs(col) === 2
      const isCore = row === 0 && col === 0
      matrix[y][x] = isEdge || isCore
      reserved[y][x] = true
    }
  }
}

/** يرسم الأنماط الوظيفية ويحجز مواضعها، ويُعيد شبكة الحجز. */
function drawFunctionPatterns(size: number, version: number): { matrix: boolean[][]; reserved: boolean[][] } {
  const matrix = emptyGrid(size, false)
  const reserved = emptyGrid(size, false)

  drawFinder(matrix, reserved, 0, 0)
  drawFinder(matrix, reserved, 0, size - 7)
  drawFinder(matrix, reserved, size - 7, 0)

  // أنماط التوقيت (Timing) في الصف/العمود 6.
  for (let index = 8; index < size - 8; index += 1) {
    const dark = index % 2 === 0
    matrix[6][index] = dark
    reserved[6][index] = true
    matrix[index][6] = dark
    reserved[index][6] = true
  }

  // أنماط المحاذاة (Alignment).
  const centers = ALIGNMENT_CENTERS[version] ?? []
  for (const row of centers) {
    for (const col of centers) {
      const nearFinder = (row <= 8 && col <= 8) || (row <= 8 && col >= size - 9) || (row >= size - 9 && col <= 8)
      if (nearFinder) continue
      drawAlignment(matrix, reserved, row, col)
    }
  }

  // حجز مناطق معلومات الصيغة + الوحدة الداكنة.
  for (let index = 0; index <= 8; index += 1) {
    reserved[8][index] = true
    reserved[index][8] = true
  }
  for (let index = size - 8; index < size; index += 1) {
    reserved[8][index] = true
    reserved[index][8] = true
  }
  matrix[size - 8][8] = true

  return { matrix, reserved }
}

function placeData(matrix: boolean[][], reserved: boolean[][], codewords: number[]): void {
  const size = matrix.length
  let bitIndex = 0
  let upward = true

  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col = 5
    for (let step = 0; step < size; step += 1) {
      const row = upward ? size - 1 - step : step
      for (let offset = 0; offset < 2; offset += 1) {
        const column = col - offset
        if (reserved[row][column]) continue
        const bit = bitIndex < codewords.length * 8 ? (codewords[bitIndex >>> 3] >>> (7 - (bitIndex & 7))) & 1 : 0
        matrix[row][column] = bit === 1
        bitIndex += 1
      }
    }
    upward = !upward
  }
}


function maskFn(mask: number, row: number, col: number): boolean {
  switch (mask) {
    case 0:
      return (row + col) % 2 === 0
    case 1:
      return row % 2 === 0
    case 2:
      return col % 3 === 0
    case 3:
      return (row + col) % 3 === 0
    case 4:
      return (Math.floor(row / 2) + Math.floor(col / 3)) % 2 === 0
    case 5:
      return ((row * col) % 2) + ((row * col) % 3) === 0
    case 6:
      return (((row * col) % 2) + ((row * col) % 3)) % 2 === 0
    default:
      return (((row + col) % 2) + ((row * col) % 3)) % 2 === 0
  }
}

function applyMask(matrix: boolean[][], reserved: boolean[][], mask: number): boolean[][] {
  const size = matrix.length
  const masked = matrix.map((row) => [...row])
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (reserved[row][col]) continue
      if (maskFn(mask, row, col)) masked[row][col] = !masked[row][col]
    }
  }
  return masked
}

/** معلومات الصيغة (15 بت): مستوى M (00) + رقم القناع، مع BCH وXOR. */
function formatBits(mask: number): number {
  const data = (0b00 << 3) | mask
  let value = data << 10
  for (let bit = 14; bit >= 10; bit -= 1) {
    if ((value >>> bit) & 1) value ^= 0x537 << (bit - 10)
  }
  return ((data << 10) | (value & 0x3ff)) ^ 0x5412
}

function writeFormatInfo(matrix: boolean[][], mask: number): void {
  const size = matrix.length
  const bits = formatBits(mask)
  // الترتيب القياسي: البِت 14 (الأكثر أهمية) في أول موضع.
  const get = (position: number) => ((bits >>> (14 - position)) & 1) === 1

  for (let index = 0; index <= 5; index += 1) matrix[8][index] = get(index)
  matrix[8][7] = get(6)
  matrix[8][8] = get(7)
  matrix[7][8] = get(8)
  for (let index = 9; index <= 14; index += 1) matrix[14 - index][8] = get(index)

  for (let index = 0; index <= 6; index += 1) matrix[size - 1 - index][8] = get(index)
  for (let index = 7; index <= 14; index += 1) matrix[8][size - 15 + index] = get(index)

  matrix[size - 8][8] = true
}

/** عقوبة القناع (قواعد 1 و2 و4) لاختيار الأفضل. */
function penaltyScore(matrix: boolean[][]): number {
  const size = matrix.length
  let score = 0

  for (let row = 0; row < size; row += 1) {
    let run = 1
    for (let col = 1; col < size; col += 1) {
      if (matrix[row][col] === matrix[row][col - 1]) run += 1
      else {
        if (run >= 5) score += run - 2
        run = 1
      }
    }
    if (run >= 5) score += run - 2
  }
  for (let col = 0; col < size; col += 1) {
    let run = 1
    for (let row = 1; row < size; row += 1) {
      if (matrix[row][col] === matrix[row - 1][col]) run += 1
      else {
        if (run >= 5) score += run - 2
        run = 1
      }
    }
    if (run >= 5) score += run - 2
  }

  for (let row = 0; row < size - 1; row += 1) {
    for (let col = 0; col < size - 1; col += 1) {
      const value = matrix[row][col]
      if (value === matrix[row][col + 1] && value === matrix[row + 1][col] && value === matrix[row + 1][col + 1]) {
        score += 3
      }
    }
  }

  let dark = 0
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) if (matrix[row][col]) dark += 1
  }
  const ratio = (dark * 100) / (size * size)
  score += Math.floor(Math.abs(ratio - 50) / 5) * 10

  return score
}

/**
 * يُنتج مصفوفة رمز QR حقيقية (بدون منطقة الهدوء — يضيفها العارض).
 * الحجم = `4 × الإصدار + 17`.
 */
export function qrMatrix(payload: string): boolean[][] {
  const { text, version } = fitPayload(payload)
  const size = qrSizeForVersion(version)
  const codewords = buildCodewords(text, version)
  const { matrix, reserved } = drawFunctionPatterns(size, version)
  placeData(matrix, reserved, codewords)

  let best: boolean[][] | null = null
  let bestScore = Number.POSITIVE_INFINITY
  for (let mask = 0; mask < 8; mask += 1) {
    const candidate = applyMask(matrix, reserved, mask)
    writeFormatInfo(candidate, mask)
    const score = penaltyScore(candidate)
    if (score < bestScore) {
      bestScore = score
      best = candidate
    }
  }
  return best ?? matrix
}

/** حِشوة منطقة الهدوء القياسية (4 وحدات). */
export const QR_QUIET_ZONE = 4

/**
 * تفاصيل بنية الرمز (للاختبارات والتحقق): النسخة، الحجم، الكلمات الكودية
 * النهائية، وعدد كلمات البيانات/التصحيح.
 */
export function qrStructure(payload: string): {
  version: number
  size: number
  codewords: number[]
  dataCodewords: number
  ecPerBlock: number
} {
  const { text, version } = fitPayload(payload)
  const info = EC_M[version]
  return {
    version,
    size: qrSizeForVersion(version),
    codewords: buildCodewords(text, version),
    dataCodewords: info.blocks.reduce((sum, block) => sum + block.count * block.dataPerBlock, 0),
    ecPerBlock: info.ecPerBlock,
  }
}

/** جدول معلومات الصيغة القياسي (مستوى M) لكل قناع من الأقنعة الثمانية — للتحقق. */
export const QR_FORMAT_INFO_M: readonly string[] = [
  "101010000010010",
  "101000100100101",
  "101111001111100",
  "101101101001011",
  "100010111111001",
  "100000011001110",
  "100111110010111",
  "100101010100000",
]

/** يوسّع المصفوفة بمنطقة هدوء بيضاء حول الرمز (مطلوبة للمسح الصحيح). */
export function withQuietZone(matrix: boolean[][], quietZone = QR_QUIET_ZONE): boolean[][] {
  const size = matrix.length
  const total = size + quietZone * 2
  const padded = emptyGrid(total, false)
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      padded[row + quietZone][col + quietZone] = matrix[row][col]
    }
  }
  return padded
}

