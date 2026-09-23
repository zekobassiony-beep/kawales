/**
 * بيانات الفئات (الأدوار) المشتركة بين بوابة الدخول `/login`، صفحة إكمال
 * البيانات `/onboarding`، الهيدر، ولوحات التحكم.
 *
 * ملف بيانات صرف: بلا اعتماد على السيرفر أو المتصفح، لذا يمكن استيراده من
 * مكونات السيرفر ومكونات العميل معًا.
 */

export type AccountRole = "customer" | "actor" | "troupe" | "venue"

/** ترتيب ظهور الفئات في بوابة الدخول. */
export const ROLE_ORDER: AccountRole[] = ["customer", "actor", "troupe", "venue"]

export const LOGIN_PATH = "/login"
export const ONBOARDING_PATH = "/onboarding"

/** بوت كواليس على تليجرام: ربط الحساب واستلام التذاكر. */
export const TELEGRAM_BOT_URL = "https://t.me/Kawalees_tix_bot"

/** المسار المخفي لغرفة عمليات المنصة (لوحة التحكم العليا). */
export const HQ_PATH = "/hq-kawalees"

/**
 * بريد الأدمن الرئيسي (Superadmin) — مالك المنصة.
 * الجلسة التجريبية الحالية بلا مصادقة حقيقية، لذا يُقفل المسار المخفي
 * على هذه القائمة (يُستبدل بجدول أدوار في قاعدة البيانات لاحقًا).
 */
export const SUPERADMIN_EMAILS = [
  "zeko.bassiony@gmail.com",
  "admin@kawalees.test",
  "hq@kawalees.test",
  "superadmin@kawalees.test",
]

/** هل هذا البريد يملك صلاحية غرفة العمليات؟ */
export function isSuperadmin(email?: string | null): boolean {
  if (!email) return false
  return SUPERADMIN_EMAILS.includes(email.trim().toLowerCase())
}

/** رمز الدعوة التجريبي لمديري المسارح. */
export const DEMO_VENUE_INVITE_CODE = "KAWALEES-2026"

export const ROLE_LABELS: Record<AccountRole, string> = {
  customer: "عميل مسرحي",
  actor: "فنان / ممثل",
  troupe: "مخرج / فرقة",
  venue: "مدير مسرح",
}

/** لوحة التحكم الخاصة بكل فئة. */
export const ROLE_DASHBOARD_PATH: Record<AccountRole, string> = {
  customer: "/dashboard/customer",
  actor: "/dashboard/actor",
  troupe: "/dashboard/troupe",
  venue: "/dashboard/venue",
}

export type RoleMeta = {
  /** إيموجي الفئة كما يظهر في البطاقة. */
  emoji: string
  /** التسمية الإنكليزية الصغيرة داخل البطاقة. */
  code: string
  tagline: string
  /** نقاط ما تحصل عليه الفئة — تُعرض عند توسّع البطاقة. */
  bullets: string[]
  /** لون النيون الخاص بالفئة (يُستخدم في الإضاءة والتوهج). */
  accent: string
  cta: string
}

export const ROLE_META: Record<AccountRole, RoleMeta> = {
  customer: {
    emoji: "🎭",
    code: "Customer",
    tagline: "اكتشف العروض واحجز مقعدك في ثوانٍ",
    bullets: [
      "تذاكر رقمية تصلك على تليجرام",
      "خريطة مقاعد تفاعلية لكل عرض",
      "كل حجوزاتك في مكان واحد",
    ],
    accent: "#f5c451",
    cta: "دخول كعميل",
  },
  actor: {
    emoji: "🌟",
    code: "Actor",
    tagline: "قدّم على الأودشنات وابنِ ملفك الفني",
    bullets: [
      "أودشنات مفتوحة من أفضل الفرق",
      "معرض أعمال ومهارات وورش",
      "حالة طلباتك لحظة بلحظة",
    ],
    accent: "#ff4d94",
    cta: "دخول كفنان",
  },
  troupe: {
    emoji: "🎪",
    code: "Troupe Leader",
    tagline: "أدر فرقتك، انشر عروضك، وتابع أرباحك",
    bullets: [
      "نشر العروض والأودشنات",
      "محفظة وأرباح بعد عمولة المنصة",
      "ماسح تذاكر للبوابة",
    ],
    accent: "#a855f7",
    cta: "دخول كفرقة",
  },
  venue: {
    emoji: "🏛️",
    code: "Venue Manager",
    tagline: "املأ مقاعد مسرحك كل ليلة",
    bullets: [
      "جدول الحفلات وتخطيط المقاعد",
      "خصومات أيام الركود",
      "مؤشرات الإشغال والإيراد",
    ],
    accent: "#22d3ee",
    cta: "دخول كمدير مسرح",
  },
}

export function dashboardPathForRole(role: AccountRole): string {
  return ROLE_DASHBOARD_PATH[role]
}

export function isAccountRole(value: unknown): value is AccountRole {
  return typeof value === "string" && (ROLE_ORDER as string[]).includes(value)
}
