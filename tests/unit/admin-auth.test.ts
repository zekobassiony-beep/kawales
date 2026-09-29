import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  ADMIN_DASHBOARD_PATH,
  MASTER_ADMIN_EMAIL,
  MASTER_ADMIN_EMAILS,
  isAdminPath,
  isMasterAdminEmail,
  normalizeAdminEmail,
  parseMasterEmails,
} from "../../lib/auth-constants"
import * as authConstants from "../../lib/auth-constants"

describe("isAdminPath (حماية مسارات الأدمن)", () => {
  it("يقبل المسارين المحميين ومساراتهما الفرعية", () => {
    assert.equal(isAdminPath("/admin"), true)
    assert.equal(isAdminPath("/dashboard/admin"), true)
    assert.equal(isAdminPath("/admin/settings"), true)
    assert.equal(isAdminPath("/dashboard/admin/admins"), true)
  })

  it("لا يقبل بقية مسارات المنصة", () => {
    for (const path of ["/", "/login", "/shows", "/dashboard/customer", "/dashboard", "/hq-kawalees"]) {
      assert.equal(isAdminPath(path), false, path)
    }
  })

  it("لا يقبل مسارات تشترك في البادئة فقط (أمان)", () => {
    // مهم: "/administrator" يجب ألا تُعدّ مسار أدمن.
    for (const path of ["/administrator", "/administration", "/dashboard/administrator", "/admins"]) {
      assert.equal(isAdminPath(path), false, path)
    }
  })
})

describe("البريد الأساسي للسوبر أدمن", () => {
  it("يطابق البريد بغض النظر عن حالة الأحرف والمسافات", () => {
    assert.equal(isMasterAdminEmail("zeko.bassiony@gmail.com"), true)
    assert.equal(isMasterAdminEmail("  ZEKO.Bassiony@Gmail.com  "), true)
    assert.equal(normalizeAdminEmail("  ZEKO.Bassiony@Gmail.com  "), MASTER_ADMIN_EMAIL)
  })

  it("يرفض أي بريد آخر أو قيمة فارغة", () => {
    for (const email of ["", "  ", null, undefined, "admin@kawalees.test", "zeko.bassiony@gmail.co"]) {
      assert.equal(isMasterAdminEmail(email), false, String(email))
    }
  })

  it("ثوابت المسارات صحيحة، ولا يبقى أي كوكي بريد مكتوب من المتصفح", () => {
    assert.equal(ADMIN_DASHBOARD_PATH, "/dashboard/admin")
    assert.equal(MASTER_ADMIN_EMAIL, "zeko.bassiony@gmail.com")
    // الحماية تعتمد جلسة Supabase الرسمية فقط — أُزيل كوكي `kawalees:email`.
    assert.equal("SESSION_EMAIL_COOKIE" in authConstants, false)
  })
})

describe("اختصارات لوحات التشغيل (producer / gatekeeper)", () => {
  it("تُحمى بنفس بوابة الأدمن", () => {
    assert.equal(isAdminPath("/producer"), true)
    assert.equal(isAdminPath("/gatekeeper"), true)
    assert.equal(isAdminPath("/producer/shows"), true)
    assert.equal(isAdminPath("/gatekeeper/scan"), true)
  })

  it("لا تقبل مسارات تشترك في البادئة فقط (أمان)", () => {
    for (const path of ["/producers", "/gatekeepers", "/producer-other", "/gate"]) {
      assert.equal(isAdminPath(path), false, path)
    }
  })

  it("قائمة بريدات السوبر أدمن تحتوي البريد الافتراضي وتقبل الإضافة من البيئة", () => {
    assert.ok(MASTER_ADMIN_EMAILS.length >= 1)
    assert.ok(MASTER_ADMIN_EMAILS.includes("zeko.bassiony@gmail.com"))
    for (const email of MASTER_ADMIN_EMAILS) {
      assert.equal(normalizeAdminEmail(email), email, "يجب أن تكون البريدات مُطبَّعة بحروف صغيرة")
    }
  })
})

describe("parseMasterEmails (إضافة بريدات سوبر أدمن من البيئة)", () => {
  it("يفصل بالفواصل والمسافات والفواصل المنقوطة ويُطبّع الحروف", () => {
    assert.deepEqual(parseMasterEmails("A@X.com, b@y.com; c@z.com  D@w.com"), [
      "a@x.com",
      "b@y.com",
      "c@z.com",
      "d@w.com",
    ])
  })

  it("يتجاهل القيم الفارغة وغير البريدية ويُزيل التكرار", () => {
    assert.deepEqual(parseMasterEmails(" owner@kawalees.com , owner@kawalees.com , , not-an-email "), [
      "owner@kawalees.com",
    ])
    assert.deepEqual(parseMasterEmails(""), [])
    assert.deepEqual(parseMasterEmails(undefined), [])
    assert.deepEqual(parseMasterEmails("   ;  ,  "), [])
  })
})
