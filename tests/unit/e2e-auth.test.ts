import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  DEFAULT_E2E_EMAIL,
  DEFAULT_E2E_PASSWORD,
  isE2EAccountExistsError,
  isE2EAuthEnabled,
  isE2EFlagOn,
  isE2ETestEmail,
  isSafeE2EPath,
  normalizeE2EEmail,
  parseE2EEmails,
  readE2EConfig,
  resolveE2ERedirect,
  resolveE2ERole,
  verifyE2EToken,
} from "../../lib/e2e-auth"

/** متغيّرات البيئة التي يقرأها وضع الاختبار — تُعزل في كل حالة ليعود الوضع الأصلي. */
const E2E_KEYS = [
  "KAWALEES_E2E_AUTH",
  "KAWALEES_E2E_AUTH_TOKEN",
  "KAWALEES_E2E_AUTH_EMAILS",
  "KAWALEES_E2E_AUTH_EMAIL",
  "KAWALEES_E2E_AUTH_PASSWORD",
  "KAWALEES_E2E_AUTH_ALLOW_PRODUCTION",
  "VERCEL_ENV",
]

/** يشغّل `run` ببيئة نظيفة + القيم المطلوبة، ثم يعيد البيئة كما كانت. */
function withEnv(values: Record<string, string | undefined>, run: () => void) {
  const saved = new Map<string, string | undefined>()
  for (const key of E2E_KEYS) saved.set(key, process.env[key])
  for (const key of E2E_KEYS) delete process.env[key]
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  try {
    run()
  } finally {
    for (const key of E2E_KEYS) {
      const prior = saved.get(key)
      if (prior === undefined) delete process.env[key]
      else process.env[key] = prior
    }
  }
}

describe("parseE2EEmails (قائمة البريدات المسموح لها بتجاوز بوابة الأدمن)", () => {
  it("يفصل بالفواصل والمسافات والفواصل المنقوطة ويُطبّع الحروف", () => {
    assert.deepEqual(parseE2EEmails("A@X.com, b@y.com; c@z.com  D@w.com"), [
      "a@x.com",
      "b@y.com",
      "c@z.com",
      "d@w.com",
    ])
  })

  it("يتجاهل القيم غير البريدية والفارغة ويُزيل التكرار", () => {
    assert.deepEqual(parseE2EEmails(" admin@kawalees.test , ADMIN@kawalees.test ,, not-an-email "), [
      "admin@kawalees.test",
    ])
    assert.deepEqual(parseE2EEmails(""), [])
    assert.deepEqual(parseE2EEmails(undefined), [])
  })

  it("يطبّع البريد الواحد (حروف صغيرة بلا مسافات)", () => {
    assert.equal(normalizeE2EEmail("  Admin@Kawalees.TEST "), "admin@kawalees.test")
    assert.equal(normalizeE2EEmail(undefined), "")
  })
})

describe("isE2EFlagOn", () => {
  it("يقبل 1/true/yes/on بغض النظر عن الحالة والمسافات", () => {
    for (const value of ["1", "true", "TRUE", " yes ", "On"]) {
      assert.equal(isE2EFlagOn(value), true, value)
    }
  })

  it("يرفض أي قيمة أخرى", () => {
    for (const value of ["", "  ", "0", "false", "no", "off", undefined]) {
      assert.equal(isE2EFlagOn(value), false, String(value))
    }
  })
})

describe("verifyE2EToken (سرّ التوثيق الآلي)", () => {
  it("يقبل السرّ المطابق (بعد تقليم المسافات)", () => {
    assert.equal(verifyE2EToken("s3cret", "s3cret"), true)
    assert.equal(verifyE2EToken("  s3cret  ", "s3cret"), true)
  })

  it("يرفض السرّ الخطأ أو الناقص أو الطويل أو الفارغ", () => {
    assert.equal(verifyE2EToken("wrong", "s3cret"), false)
    assert.equal(verifyE2EToken("s3cre", "s3cret"), false)
    assert.equal(verifyE2EToken("s3cret!", "s3cret"), false)
    assert.equal(verifyE2EToken(undefined, "s3cret"), false)
    assert.equal(verifyE2EToken("s3cret", ""), false)
  })

  it("لا يفرّق بين المحارف المتشابهة (مقارنة دقيقة)", () => {
    assert.equal(verifyE2EToken("Secret", "secret"), false)
  })
})

describe("resolveE2ERedirect / resolveE2ERole (وجهة ما بعد الدخول)", () => {
  it("يستخدم next عندما يكون مسارًا نسبيًا آمنًا", () => {
    assert.equal(resolveE2ERedirect("troupe", "/dashboard/producer"), "/dashboard/producer")
    assert.equal(isSafeE2EPath("/dashboard/producer"), true)
  })

  it("يرفض المسارات الخارجة (أمان) ويعود للوحة الفئة", () => {
    assert.equal(isSafeE2EPath("//evil.com"), false)
    assert.equal(isSafeE2EPath("https://evil.com"), false)
    assert.equal(isSafeE2EPath("/a\\b"), false)
    assert.equal(resolveE2ERedirect("troupe", "//evil.com"), "/dashboard/troupe")
    assert.equal(resolveE2ERedirect("venue", "https://evil.com"), "/dashboard/venue")
    assert.equal(resolveE2ERedirect("customer"), "/dashboard/customer")
    assert.equal(resolveE2ERedirect("actor", null), "/dashboard/actor")
  })

  it("يعيد customer عند فئة غير معروفة", () => {
    assert.equal(resolveE2ERole("producer"), "customer")
    assert.equal(resolveE2ERole(undefined), "customer")
    assert.equal(resolveE2ERole("troupe"), "troupe")
    assert.equal(resolveE2ERole("venue"), "venue")
  })
})

describe("isE2EAccountExistsError", () => {
  it("يتعرّف على أكواد Supabase ورسائل البريد المسجَّل", () => {
    assert.equal(isE2EAccountExistsError(undefined, "email_exists"), true)
    assert.equal(isE2EAccountExistsError(undefined, "user_already_exists"), true)
    assert.equal(isE2EAccountExistsError("User already registered", undefined), true)
    assert.equal(isE2EAccountExistsError("A user with this email address has already been registered", undefined), true)
  })

  it("لا يعتبر الأخطاء الأخرى بريدًا مسجَّلًا", () => {
    assert.equal(isE2EAccountExistsError("Invalid password", undefined), false)
    assert.equal(isE2EAccountExistsError(undefined, undefined), false)
  })
})

describe("readE2EConfig (تفعيل الوضع: علامة + سرّ + حظر الإنتاج)", () => {
  it("معطّل افتراضيًا بلا أي متغيّرات بيئة", () => {
    withEnv({}, () => {
      const config = readE2EConfig()
      assert.equal(config.enabled, false)
      assert.equal(isE2EAuthEnabled(), false)
      assert.ok(config.disabledReason.includes("KAWALEES_E2E_AUTH"))
      // القيم الافتراضية الحسّاسة موجودة لكن لا تُفعَّل بلا علامة.
      assert.equal(config.email, DEFAULT_E2E_EMAIL)
      assert.equal(config.password, DEFAULT_E2E_PASSWORD)
    })
  })

  it("العلامة وحدها بلا سرّ لا تُفعّل الوضع", () => {
    withEnv({ KAWALEES_E2E_AUTH: "1" }, () => {
      const config = readE2EConfig()
      assert.equal(config.enabled, false)
      assert.ok(config.disabledReason.includes("TOKEN"))
    })
  })

  it("العلامة + السرّ تُفعّل الوضع وأقلّ ما يُسمح به البريد الافتراضي", () => {
    withEnv({ KAWALEES_E2E_AUTH: "1", KAWALEES_E2E_AUTH_TOKEN: "s3cret" }, () => {
      const config = readE2EConfig()
      assert.equal(config.enabled, true)
      assert.equal(config.disabledReason, "")
      assert.ok(config.emails.includes(DEFAULT_E2E_EMAIL))
      assert.equal(isE2ETestEmail(DEFAULT_E2E_EMAIL), true)
      assert.equal(isE2ETestEmail("ADMIN@Kawalees.test"), true)
    })
  })

  it("يضيف البريد المُهيَّأ وبريدات القائمة الصريحة", () => {
    withEnv(
      {
        KAWALEES_E2E_AUTH: "1",
        KAWALEES_E2E_AUTH_TOKEN: "s3cret",
        KAWALEES_E2E_AUTH_EMAIL: "e2e-owner@kawalees.test",
        KAWALEES_E2E_AUTH_EMAILS: "customer@kawalees.test, troupe@kawalees.test",
      },
      () => {
        const config = readE2EConfig()
        assert.equal(config.email, "e2e-owner@kawalees.test")
        for (const email of [
          "e2e-owner@kawalees.test",
          "customer@kawalees.test",
          "troupe@kawalees.test",
          DEFAULT_E2E_EMAIL,
        ]) {
          assert.ok(config.emails.includes(email), email)
          assert.equal(isE2ETestEmail(email), true, email)
        }
        assert.equal(isE2ETestEmail("stranger@example.com"), false)
      },
    )
  })

  it("يُمنع في إنتاج Vercel إلا بتجاوز صريح", () => {
    withEnv(
      { KAWALEES_E2E_AUTH: "1", KAWALEES_E2E_AUTH_TOKEN: "s3cret", VERCEL_ENV: "production" },
      () => {
        assert.equal(isE2EAuthEnabled(), false)
        assert.equal(isE2ETestEmail(DEFAULT_E2E_EMAIL), false)
      },
    )
    withEnv(
      {
        KAWALEES_E2E_AUTH: "1",
        KAWALEES_E2E_AUTH_TOKEN: "s3cret",
        VERCEL_ENV: "production",
        KAWALEES_E2E_AUTH_ALLOW_PRODUCTION: "1",
      },
      () => {
        assert.equal(isE2EAuthEnabled(), true)
      },
    )
  })

  it("معطّل في بيئة Vercel غير الإنتاجية إلى أن تُضبط العلامة", () => {
    withEnv({ VERCEL_ENV: "preview" }, () => {
      assert.equal(isE2EAuthEnabled(), false)
      assert.equal(isE2ETestEmail(DEFAULT_E2E_EMAIL), false)
    })
  })
})
