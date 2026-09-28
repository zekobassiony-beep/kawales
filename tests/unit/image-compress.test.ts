import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { formatBytes, scaledDimensions } from "../../lib/image-compress"

describe("scaledDimensions (تصغير صورة الإيصال)", () => {
  it("يصغّر الصور الكبيرة مع الحفاظ على النسبة", () => {
    assert.deepEqual(scaledDimensions(4032, 3024, 1600), { width: 1600, height: 1200 })
    assert.deepEqual(scaledDimensions(3024, 4032, 1600), { width: 1200, height: 1600 })
  })

  it("لا يُكبّر الصور الصغيرة", () => {
    assert.deepEqual(scaledDimensions(800, 600, 1600), { width: 800, height: 600 })
    assert.deepEqual(scaledDimensions(1600, 900, 1600), { width: 1600, height: 900 })
  })

  it("يتعامل مع القيم غير الصالحة بلا أصفار أو NaN", () => {
    assert.deepEqual(scaledDimensions(0, 0, 1600), { width: 1, height: 1 })
    assert.deepEqual(scaledDimensions(Number.NaN, 500, 1600), { width: 1, height: 500 })
  })
})

describe("formatBytes", () => {
  it("يعرض الحجم بصيغة مقروءة", () => {
    assert.equal(formatBytes(400 * 1024), "400 KB")
    assert.equal(formatBytes(2 * 1024 * 1024), "2.0 MB")
    assert.equal(formatBytes(0), "0 KB")
  })
})
