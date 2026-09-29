/**
 * ترجمة رسائل أخطاء المصادقة (Supabase Auth) إلى رسائل عربية واضحة.
 *
 * ملف نقي بلا توجيه عميل/سيرفر — يُستورد من مكوّنات العميل **وإجراءات السيرفر**
 * معًا (لا يمكن استيراد دوال من ملف `"use client"` داخل Server Action).
 */

/** يقصّ الرسالة ويحوّلها لحروف صغيرة للمطابقة. */
function normalize(message: string | undefined): string {
  return (message ?? "").trim().toLowerCase()
}

export function arabicAuthError(message: string | undefined): string {
  const raw = normalize(message)
  if (raw.includes("invalid login credentials")) return "البريد الإلكتروني أو كلمة المرور غير صحيحة."
  if (raw.includes("email not confirmed")) {
    return "لم يتم تأكيد بريدك بعد — أنشئ الحساب من جديد بنفس البريد وسيُفعَّل تلقائيًا."
  }
  if (raw.includes("user already registered") || raw.includes("already been registered") || raw.includes("email_exists")) {
    return "هذا البريد مسجّل بالفعل — استخدم «تسجيل الدخول»."
  }
  if (raw.includes("password should be at least")) return "كلمة المرور يجب أن تكون 6 أحرف على الأقل."
  if (raw.includes("weak password") || raw.includes("password is too weak")) {
    return "كلمة المرور ضعيفة — استخدم 6 أحرف على الأقل مع أرقام أو رموز."
  }
  if (raw.includes("unable to validate email") || raw.includes("invalid email") || raw.includes("invalid format")) {
    return "صيغة البريد الإلكتروني غير صحيحة."
  }
  if (raw.includes("email rate limit") || raw.includes("over_email_send_rate_limit")) {
    return "تم إرسال رسائل كثيرة — انتظر قليلًا ثم أعد المحاولة."
  }
  if (raw.includes("signups not allowed") || raw.includes("signup is disabled")) {
    return "إنشاء الحسابات معطّل حاليًا في إعدادات المشروع."
  }
  if (raw.includes("rate limit")) return "محاولات كثيرة في وقت قصير — انتظر دقيقة ثم أعد المحاولة."
  if (raw.includes("failed to fetch") || raw.includes("network")) {
    return "تعذّر الاتصال بخدمة الحسابات — تحقّق من الإنترنت وأعد المحاولة."
  }
  return message?.trim() ? `تعذّر إتمام العملية: ${message}` : "تعذّر إتمام العملية — حاول مرة أخرى."
}
