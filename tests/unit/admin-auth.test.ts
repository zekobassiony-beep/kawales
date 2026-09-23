import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  ADMIN_DASHBOARD_PATH,
  MASTER_ADMIN_EMAIL,
  SESSION_EMAIL_COOKIE,
  isAdminPath,
  isMasterAdminEmail,
  normalizeAdminEmail,
} from "../../lib/auth-constants"

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

  it("ثوابت المسارات والكوكي صحيحة", () => {
    assert.equal(ADMIN_DASHBOARD_PATH, "/dashboard/admin")
    assert.equal(SESSION_EMAIL_COOKIE, "kawalees:email")
    assert.equal(MASTER_ADMIN_EMAIL, "zeko.bassiony@gmail.com")
  })
})
