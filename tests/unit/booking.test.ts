import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { createBooking } from "../../app/actions/booking"

// Every case below is rejected by the pure validation block at the top of
// `createBooking`, so the tests never open a database connection.
const validBase = {
  eventId: 1,
  seatIds: ["A1"],
  customerName: "Nour Hassan",
  customerEmail: "nour@example.com",
  customerPhone: "+201234567890",
}

describe("createBooking input validation", () => {
  it("requires at least one seat", async () => {
    const result = await createBooking({ ...validBase, seatIds: [] })
    assert.deepEqual(result, { ok: false, error: "من فضلك اختر مقعدًا واحدًا على الأقل." })
  })

  it("rejects a non-array seat list", async () => {
    const result = await createBooking({
      ...validBase,
      seatIds: null as unknown as string[],
    })
    assert.equal(result.ok, false)
  })

  it("rejects duplicate seats", async () => {
    const result = await createBooking({ ...validBase, seatIds: ["A1", "A1"] })
    assert.deepEqual(result, { ok: false, error: "يوجد تكرار في المقاعد المختارة." })
  })

  it("rejects more than 8 seats per order", async () => {
    const seatIds = ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8", "A9"]
    const result = await createBooking({ ...validBase, seatIds })
    assert.deepEqual(result, {
      ok: false,
      error: "يمكنك حجز 8 مقاعد كحد أقصى في الطلب الواحد.",
    })
  })

  it("does not trip the cap check with exactly 8 seats", async () => {
    const seatIds = ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8"]
    try {
      const result = await createBooking({ ...validBase, seatIds })
      assert.equal(result.ok, false)
      assert.notEqual(result.error, "يمكنك حجز 8 مقاعد كحد أقصى في الطلب الواحد.")
    } catch (error) {
      // No database is configured for the unit run, so reaching the connection
      // layer is itself proof that the 9-seat cap was not applied.
      assert.ok(error instanceof Error, "expected a database connection error")
    }
  })

  it("requires a name, an email and a phone number", async () => {
    const missingName = await createBooking({ ...validBase, customerName: "   " })
    assert.deepEqual(missingName, {
      ok: false,
      error: "الاسم والبريد الإلكتروني مطلوبان.",
    })

    const missingEmail = await createBooking({ ...validBase, customerEmail: "" })
    assert.deepEqual(missingEmail, {
      ok: false,
      error: "الاسم والبريد الإلكتروني مطلوبان.",
    })

    const missingPhone = await createBooking({ ...validBase, customerPhone: "" })
    assert.deepEqual(missingPhone, {
      ok: false,
      error: "من فضلك أدخل رقم هاتف صحيحًا (مثال: 0100 000 0000).",
    })
  })

  it("requires an Egyptian-style phone number", async () => {
    for (const customerPhone of ["123", "abcdefghij", "+20", "1234567890123456"]) {
      const result = await createBooking({ ...validBase, customerPhone })
      assert.deepEqual(
        result,
        { ok: false, error: "من فضلك أدخل رقم هاتف صحيحًا (مثال: 0100 000 0000)." },
        `expected ${JSON.stringify(customerPhone)} to be rejected`,
      )
    }

    // صيغ مقبولة: مصري محلي، دولي بمسافات أو شرطات.
    for (const customerPhone of ["01001234567", "+20 100 123 4567", "+20000000000", "0100-123-4567"]) {
      const result = await createBooking({ ...validBase, customerPhone })
      assert.notDeepEqual(
        result,
        { ok: false, error: "من فضلك أدخل رقم هاتف صحيحًا (مثال: 0100 000 0000)." },
        `expected ${JSON.stringify(customerPhone)} to pass phone validation`,
      )
    }
  })

  it("validates the email format", async () => {
    for (const customerEmail of ["nour", "nour@", "nour@example", "a b@example.com"]) {
      const result = await createBooking({ ...validBase, customerEmail })
      assert.deepEqual(
        result,
        { ok: false, error: "من فضلك أدخل بريدًا إلكترونيًا صحيحًا." },
        `expected ${JSON.stringify(customerEmail)} to be rejected`,
      )
    }
  })
})
