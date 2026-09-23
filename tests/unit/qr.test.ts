import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { QR_FORMAT_INFO_M, QR_QUIET_ZONE, qrMatrix, qrStructure, withQuietZone } from "../../lib/qr"

/* ---------- حسابات GF(256) مستقلة للتحقق من كلمات Reed–Solomon ---------- */

const EXP = new Uint8Array(512)
const LOG = new Uint8Array(256)
{
  let value = 1
  for (let index = 0; index < 255; index += 1) {
    EXP[index] = value
    LOG[value] = index
    value <<= 1
    if (value & 0x100) value ^= 0x11d
  }
  for (let index = 255; index < 512; index += 1) EXP[index] = EXP[index - 255]
}

function mul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0
  return EXP[LOG[a] + LOG[b]]
}

/** مولّد كثير الحدود بدرجة `degree` — بترتيب تنازلي للأسس (المعامل الرئيسي أولًا). */
function generator(degree: number): number[] {
  let poly = [1]
  for (let index = 0; index < degree; index += 1) {
    const next = new Array<number>(poly.length + 1).fill(0)
    for (let term = 0; term < poly.length; term += 1) {
      next[term] ^= mul(poly[term], EXP[index])
      next[term + 1] ^= poly[term]
    }
    poly = next
  }
  return poly.reverse()
}

/**
 * يتحقق أن كثير الحدود الكامل (بيانات + تصحيح) يقبل القسمة على المولّد —
 * خوارزمية تقسيم مستقلة تمامًا عن طريقة الإزاحة المستخدمة في الترميز.
 */
function divisibleByGenerator(codewords: number[], degree: number): boolean {
  const gen = generator(degree)
  const work = [...codewords]

  for (let position = 0; position < work.length - degree; position += 1) {
    const factor = work[position]
    if (factor === 0) continue
    for (let term = 0; term < gen.length; term += 1) {
      work[position + term] ^= mul(gen[term], factor)
    }
  }

  return work.slice(work.length - degree).every((value) => value === 0)
}

/** تقييم كثير الحدود (بترتيب تنازلي) عند α^i — القاعدة الرياضية لكود ريد-سولومون. */
function evaluateAt(codewords: number[], exponent: number): number {
  const x = EXP[exponent]
  let value = 0
  for (const coefficient of codewords) {
    value = mul(value, x) ^ coefficient
  }
  return value
}

/* ---------- بنية الكتل القياسية (مستوى M · نسخ 1..5) ---------- */

const BLOCK_STRUCTURE: Record<number, { blocks: number; dataPerBlock: number; ecPerBlock: number }> = {
  1: { blocks: 1, dataPerBlock: 16, ecPerBlock: 10 },
  2: { blocks: 1, dataPerBlock: 28, ecPerBlock: 16 },
  3: { blocks: 1, dataPerBlock: 44, ecPerBlock: 26 },
  4: { blocks: 2, dataPerBlock: 32, ecPerBlock: 18 },
  5: { blocks: 2, dataPerBlock: 43, ecPerBlock: 24 },
}

/** يستعيد الكتل من الكلمات المتشابكة (كل الكتل بنفس الحجم في النسخ 1..5). */
function deinterleave(codewords: number[], version: number): { data: number[]; ec: number[] }[] {
  const structure = BLOCK_STRUCTURE[version]
  const blocks = Array.from({ length: structure.blocks }, () => ({ data: [] as number[], ec: [] as number[] }))
  const dataLength = structure.blocks * structure.dataPerBlock

  for (let index = 0; index < dataLength; index += 1) {
    blocks[index % structure.blocks].data.push(codewords[index])
  }
  for (let index = dataLength; index < codewords.length; index += 1) {
    blocks[(index - dataLength) % structure.blocks].ec.push(codewords[index])
  }
  return blocks
}

/* ---------- قراءة معلومات الصيغة وأنماط الموقع من المصفوفة ---------- */

function formatBitsFromMatrix(matrix: boolean[][]): string {
  const bits = [
    ...Array.from({ length: 6 }, (_, index) => matrix[8][index]),
    matrix[8][7],
    matrix[8][8],
    matrix[7][8],
    ...Array.from({ length: 6 }, (_, index) => matrix[5 - index][8]),
  ]
  assert.equal(bits.length, 15)
  return bits.map((bit) => (bit ? "1" : "0")).join("")
}

function finderIsValid(matrix: boolean[][], top: number, left: number): boolean {
  for (let row = 0; row < 7; row += 1) {
    for (let col = 0; col < 7; col += 1) {
      const edge = row === 0 || row === 6 || col === 0 || col === 6
      const core = row >= 2 && row <= 4 && col >= 2 && col <= 4
      if (matrix[top + row][left + col] !== (edge || core)) return false
    }
  }
  return true
}


describe("qrMatrix · البنية القياسية", () => {
  it("ينتج نسخة 1 لحمولة قصيرة بمعلمات صحيحة", () => {
    const structure = qrStructure("KW-ABC123")
    assert.equal(structure.version, 1)
    assert.equal(structure.size, 21)
    assert.equal(structure.dataCodewords, 16)
    assert.equal(structure.ecPerBlock, 10)
    assert.equal(structure.codewords.length, 26)
    assert.equal(qrMatrix("KW-ABC123").length, 21)
  })

  it("يختار نسخة أكبر للحمولات الأطول (نسخة 5 لـ 80 حرفًا)", () => {
    const structure = qrStructure("x".repeat(80))
    assert.equal(structure.version, 5)
    assert.equal(structure.size, 37)
    assert.equal(structure.codewords.length, 134)
  })

  it("يرسم أنماط الموقع الثلاثة بدقة", () => {
    const matrix = qrMatrix("kawalees:ticket:KW-ABC123:show-1")
    const size = matrix.length
    assert.equal(finderIsValid(matrix, 0, 0), true)
    assert.equal(finderIsValid(matrix, 0, size - 7), true)
    assert.equal(finderIsValid(matrix, size - 7, 0), true)
  })

  it("يرسم أنماط التوقيت والوحدة الداكنة", () => {
    const matrix = qrMatrix("kawalees:ticket:KW-ABC123:show-1")
    const size = matrix.length
    for (let index = 8; index < size - 8; index += 1) {
      assert.equal(matrix[6][index], index % 2 === 0, `timing row at ${index}`)
      assert.equal(matrix[index][6], index % 2 === 0, `timing column at ${index}`)
    }
    assert.equal(matrix[size - 8][8], true)
  })

  it("يكتب معلومات صيغة قياسية (مستوى M) لأحد الأقنعة الثمانية", () => {
    for (const payload of ["KW-ABC123", "kawalees:ticket:KW-ZZ99:show-42", "x".repeat(80)]) {
      const bits = formatBitsFromMatrix(qrMatrix(payload))
      assert.equal(QR_FORMAT_INFO_M.includes(bits), true, `unexpected format bits ${bits} for ${payload}`)
    }
  })

  it("يكتب نفس معلومات الصيغة في الموضع الثاني", () => {
    const matrix = qrMatrix("kawalees:ticket:KW-ABC123:show-1")
    const size = matrix.length
    const bits = formatBitsFromMatrix(matrix)
    const vertical = Array.from({ length: 15 }, (_, index) =>
      index < 7 ? matrix[size - 1 - index][8] : matrix[8][size - 15 + index],
    )
    assert.equal(vertical.map((bit) => (bit ? "1" : "0")).join(""), bits)
  })
})


describe("qrMatrix · تصحيح الأخطاء Reed–Solomon", () => {
  it("مولّد الدرجة 10 يطابق كثير الحدود القياسي المنشور (α^0, α^251, α^67…)", () => {
    // القيم القياسية لمولّد ريد-سولومون بـ 10 كلمات تصحيح (ترتيب تنازلي).
    assert.deepEqual(generator(10), [1, 216, 194, 159, 111, 199, 94, 95, 113, 157, 193])
  })

  it("كل كتلة تقبل القسمة على كثير حدود المولّد", () => {
    for (const payload of ["KW-ABC123", "kawalees:ticket:KW-1A2B3C:show-9", "x".repeat(80)]) {
      const { version, codewords } = qrStructure(payload)
      const structure = BLOCK_STRUCTURE[version]
      const blocks = deinterleave(codewords, version)
      assert.equal(blocks.length, structure.blocks)
      for (const [index, block] of blocks.entries()) {
        assert.equal(block.data.length, structure.dataPerBlock, `block ${index} data length`)
        assert.equal(block.ec.length, structure.ecPerBlock, `block ${index} ec length`)
        assert.equal(
          divisibleByGenerator([...block.data, ...block.ec], structure.ecPerBlock),
          true,
          `block ${index} of ${payload} is not divisible by the generator`,
        )
      }
    }
  })

  it("الكلمة الكودية تُصفّر المولّد عند كل جذر (α^0 … α^(ec-1))", () => {
    for (const payload of ["KW-ABC123", "kawalees:ticket:KW-1A2B3C:show-9", "x".repeat(80)]) {
      const { version, codewords } = qrStructure(payload)
      const structure = BLOCK_STRUCTURE[version]
      for (const block of deinterleave(codewords, version)) {
        const codeword = [...block.data, ...block.ec]
        for (let exponent = 0; exponent < structure.ecPerBlock; exponent += 1) {
          assert.equal(
            evaluateAt(codeword, exponent),
            0,
            `block of ${payload} does not vanish at α^${exponent}`,
          )
        }
      }
    }
  })
})

describe("qrMatrix · الحتمية والاتساق", () => {
  it("نفس الحمولة تعطي نفس المصفوفة", () => {
    assert.deepEqual(qrMatrix("KW-ABC123"), qrMatrix("KW-ABC123"))
  })

  it("حمولات مختلفة تعطي مصفوفات مختلفة", () => {
    assert.notDeepEqual(qrMatrix("KW-ABC123"), qrMatrix("KW-ABC124"))
  })

  it("لا ينهار مع الحمولات الطويلة جدًا بل يُقلّصها للنسخة القصوى", () => {
    const long = "kawalees:" + "x".repeat(400)
    const matrix = qrMatrix(long)
    assert.equal(matrix.length, 37)
    const arabicLong = qrMatrix("ك".repeat(300))
    assert.equal(arabicLong.length, 37)
  })

  it("يتعامل مع الحمولات الفارغة والعربية", () => {
    assert.equal(qrMatrix("").length, 21)
    const arabic = qrMatrix("كواليس — تذكرة العرض 🎭")
    assert.equal(arabic.length % 4, 1)
    assert.equal(arabic.length >= 21, true)
  })
})

describe("withQuietZone", () => {
  it("يضيف هامشًا أبيض بعرض 4 وحدات مع الحفاظ على الرمز", () => {
    const matrix = qrMatrix("KW-ABC123")
    const padded = withQuietZone(matrix)
    assert.equal(padded.length, matrix.length + QR_QUIET_ZONE * 2)

    for (let index = 0; index < padded.length; index += 1) {
      const isBorder = index < QR_QUIET_ZONE || index >= padded.length - QR_QUIET_ZONE
      if (isBorder) {
        assert.equal(padded[index].every((cell) => cell === false), true)
        assert.equal(padded.every((row) => row[index] === false), true)
      }
    }

    assert.equal(padded[QR_QUIET_ZONE][QR_QUIET_ZONE], matrix[0][0])
    const last = padded.length - QR_QUIET_ZONE - 1
    assert.equal(padded[last][last], matrix[matrix.length - 1][matrix.length - 1])
  })
})

