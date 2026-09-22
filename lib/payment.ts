// رقم محفظة الدفع (فودافون كاش / إنستاباي).
// يقرأ من البيئة ليسهل تغييره دون تعديل الكود، ويرجع لرقم افتراضي للعرض.
export const PAYMENT_WALLET_NUMBER =
  process.env.NEXT_PUBLIC_PAYMENT_WALLET ?? "01001234567"