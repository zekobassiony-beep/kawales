import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { emailToUserId, isUuid } from "../../lib/supabase/ids"
import { toDbWriteError } from "../../lib/supabase/tickets"

describe("emailToUserId (عمود user_id نوعه uuid)", () => {
  it("يشتق UUIDv5 ثابتًا من البريد (نفس البريد ⇒ نفس المعرّف)", () => {
    const first = emailToUserId("Nour@Example.com ")
    const second = emailToUserId("nour@example.com")
    assert.ok(first)
    assert.equal(first, second)
    assert.equal(isUuid(String(first)), true)
  })

  it("يعطي معرّفات مختلفة لعميلين مختلفين", () => {
    assert.notEqual(emailToUserId("a@example.com"), emailToUserId("b@example.com"))
  })

  it("يمرّر معرّف Supabase الفعلي كما هو", () => {
    const real = "2c3f4a1e-9b7d-4c1a-8f2e-0d5b6a7c8d9e"
    assert.equal(emailToUserId(real), real)
  })

  it("يعيد null للقيم الفارغة (بدل الكتابة الخاطئة في عمود uuid)", () => {
    assert.equal(emailToUserId(""), null)
    assert.equal(emailToUserId(undefined), null)
    assert.equal(emailToUserId("   "), null)
  })
})

describe("toDbWriteError (تشخيص أخطاء Supabase)", () => {
  it("يستخرج الكود والعمود من خطأ PostgREST", () => {
    const error = toDbWriteError({
      message: "Could not find the 'customer_email' column of 'tickets' in the schema cache",
      code: "PGRST204",
      details: "bad column",
      hint: "apply the migration",
    })
    assert.equal(error.code, "PGRST204")
    assert.equal(error.column, "customer_email")
    assert.equal(error.details, "bad column")
    assert.equal(error.hint, "apply the migration")
  })

  it("يقرأ اسم العمود من خطأ Postgres المباشر (42703)", () => {
    const error = toDbWriteError({
      message: 'column "user_id" of relation "tickets" does not exist',
      code: "42703",
    })
    assert.equal(error.column, "user_id")
  })

  it("يتعامل مع أي قيمة غير متوقعة بلا انهيار", () => {
    const error = toDbWriteError(new Error("invalid input syntax for type uuid: \"a@b.c\""))
    assert.match(error.message, /invalid input syntax/)
    assert.equal(error.code, undefined)
  })
})
