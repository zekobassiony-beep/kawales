import assert from "node:assert/strict"
import { afterEach, describe, it } from "node:test"
import { TimeoutError, fetchWithTimeout, withTimeout, withTimeoutFallback } from "../../lib/with-timeout"

describe("withTimeout", () => {
  it("يمرّر النتيجة عند الاكتمال قبل المهلة", async () => {
    const value = await withTimeout(Promise.resolve(42), 200, "test.fast")
    assert.equal(value, 42)
  })

  it("يرمي TimeoutError عند تجاوز المهلة", async () => {
    // وعد لا يُحلّ أبدًا ⇒ الاختبار حتمي ولا يتأثر بحمل تشغيل بقية الاختبارات.
    const never = new Promise<void>(() => undefined)
    await assert.rejects(
      () => withTimeout(never, 5, "test.slow"),
      (error: unknown) => {
        assert.ok(error instanceof TimeoutError)
        assert.match(error.message, /test\.slow/)
        return true
      },
    )
  })

  it("يمرّر أخطاء العملية الأصلية كما هي", async () => {
    await assert.rejects(
      () => withTimeout(Promise.reject(new Error("boom")), 100, "test.error"),
      /boom/,
    )
  })
})

describe("withTimeoutFallback", () => {
  it("يعيد البديل عند انتهاء المهلة بدل إسقاط الطلب", async () => {
    const never = new Promise<string>(() => undefined)
    assert.equal(await withTimeoutFallback(never, 5, "storage.slow", "fallback"), "fallback")
  })

  it("يعيد القيمة الحقيقية عند النجاح", async () => {
    assert.equal(await withTimeoutFallback(Promise.resolve("ok"), 100, "storage.ok", "fallback"), "ok")
  })
})

describe("fetchWithTimeout", () => {
  const originalFetch = globalThis.fetch
  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it("يمرّر الاستجابة عند النجاح", async () => {
    globalThis.fetch = (async () => new Response("hello", { status: 200 })) as typeof fetch
    const response = await fetchWithTimeout("https://example.test/ok", {}, 100, "test.fetch")
    assert.equal(await response.text(), "hello")
  })

  it("يُلغي الطلب ويرمي TimeoutError عند البطء", async () => {
    globalThis.fetch = ((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")))
      })) as typeof fetch

    await assert.rejects(
      () => fetchWithTimeout("https://example.test/slow", {}, 20, "test.fetch.slow"),
      (error: unknown) => error instanceof TimeoutError,
    )
  })
})
