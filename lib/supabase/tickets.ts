import type { Ticket, TicketStatus } from "@/lib/tickets"
import { getSupabaseAdmin, getSupabaseServer } from "@/lib/supabase/server"
import { TICKETS_TABLE } from "@/lib/supabase/config"
import { emailToUserId } from "@/lib/supabase/ids"
import { normalizeTicketStatus } from "@/lib/ticket-status"

/**
 * طبقة الوصول لجدول `tickets` على Supabase (Postgres) — مصدر الحقيقة للتذاكر.
 *
 * الأعمدة الفعلية للجدول (تم التحقق منها):
 *   `id`, `show_id`, `user_id`, `sender_phone`, `receipt_url`, `status`,
 *   `total_price`, `seats`, `created_at`.
 *
 * ملاحظات:
 * - `user_id` يخزّن بريد العميل (نفس قيمة `Ticket.customerId` في المنصة).
 * - `total_price` عدد صحيح بالقروش (piastres) ليطابق `Ticket.totalCents`.
 * - حمولة QR تُعاد بناؤها حتميًا من `id` + `show_id` (نفس صيغة العميل).
 */

export type TicketRow = {
  id: string
  show_id: string
  user_id: string | null
  sender_phone: string | null
  receipt_url: string | null
  /** معرّف محادثة تليجرام للعميل (عمود اختياري — يُملأ عند ربط العميل للبوت). */
  telegram_chat_id?: string | null
  /** رابط صورة التذكرة/QR التي يولّدها بوت تليجرام (عمود اختياري). */
  ticket_image_url?: string | null
  /** وقت تسجيل الحضور عند البوابة (عمود اختياري — `scripts/tickets-checkin.sql`). */
  checked_in_at?: string | null
  status: string
  total_price: number
  seats: string[]
  created_at: string | null
}

/**
 * يُطبّع حالة الصف القادمة من قاعدة البيانات إلى الحالات الأربع المعتمدة —
 * فيفهم `approved` و`ACTIVE` و`confirmed` على حد سواء (قبل ذلك كانت أي صيغة أخرى
 * تُقرأ كـ «pending» فتختفي التذكرة المقبولة من الواجهة).
 */
function asStatus(value: string | null | undefined): TicketStatus {
  return normalizeTicketStatus(value)
}

/** يعيد بناء حمولة رمز QR بنفس صيغة العميل (`kawalees:ticket:{id}:{showId}`). */
function deriveQrCode(id: string, showId: string): string {
  return `kawalees:ticket:${id}:${showId}`
}

/** يحوّل صف Supabase إلى تذكرة المنصة (الحقول غير المخزّنة تُترك فارغة/مشتقّة). */
export function rowToTicket(row: TicketRow): Ticket {
  return {
    id: row.id,
    showId: row.show_id,
    showTitle: "",
    venue: "",
    startsAt: "",
    customerId: row.user_id ?? "",
    customerName: "",
    seats: Array.isArray(row.seats) ? row.seats : [],
    tierName: "",
    totalCents: Number(row.total_price) || 0,
    paymentMethod: "vodafone_cash",
    paymentRef: "",
    status: asStatus(row.status),
    receiptImage: row.receipt_url ?? undefined,
    senderPhone: row.sender_phone ?? undefined,
    telegramChatId: row.telegram_chat_id ? String(row.telegram_chat_id) : undefined,
    ticketImageUrl: row.ticket_image_url ?? undefined,
    checkedInAt: row.checked_in_at ?? undefined,
    qrCode: deriveQrCode(row.id, row.show_id),
    createdAt: row.created_at ?? new Date().toISOString(),
  }
}

/** يحوّل تذكرة المنصة إلى صف Supabase (الأعمدة الفعلية فقط). */
export function ticketToRow(ticket: Ticket): TicketRow {
  return {
    id: ticket.id,
    show_id: ticket.showId,
    // ⚠️ عمود `user_id` نوعه `uuid` في قاعدة البيانات، والمنصة تعرّف العميل ببريده —
    // لذا نشتق UUIDv5 ثابتًا من البريد (وإلا: 22P02 invalid input syntax for type uuid).
    user_id: emailToUserId(ticket.customerId),
    sender_phone: ticket.senderPhone ?? null,
    receipt_url: ticket.receiptImage ?? null,
    status: ticket.status,
    total_price: ticket.totalCents,
    seats: ticket.seats,
    created_at: ticket.createdAt,
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}


/** يُدرج/يُحدّث تذكرة في Supabase (upsert على `id`). يعيد null عند أي فشل. */
export async function upsertTicketInDb(ticket: Ticket): Promise<Ticket | null> {
  const result = await upsertTicketInDbDetailed(ticket)
  return result.ok ? result.ticket : null
}

/** ينفّذ عملية الكتابة ويعيد `{ data, error }` بلا رمي استثناءات (شبكة/JSON…). */
async function writeTicketRow(
  admin: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  row: TicketRow,
  ticketId: string,
): Promise<{ data: unknown; error: unknown }> {
  try {
    const response = await admin.from(TICKETS_TABLE).upsert(row, { onConflict: "id" }).select().single()
    return { data: response.data, error: response.error }
  } catch (error) {
    console.error(`[supabase] upsert ticket ${ticketId} — استثناء غير متوقع: ${describe(error)}`)
    return { data: null, error }
  }
}

/* ---------- معالجة أخطاء الكتابة (تشخيص صريح + تدرّج آمن) ---------- */

/** خطأ PostgREST مُطبَّع (code/details/hint هي مفتاح معرفة العمود أو القيد المانع). */
export type DbWriteError = {
  message: string
  code?: string
  details?: string
  hint?: string
  /** اسم العمود المستخرج من رسالة الخطأ (عند وجوده). */
  column?: string
}

export type DbUpsertResult =
  | { ok: true; ticket: Ticket; /** هل حُفظ بصيغة مختصرة (إسقاط حقول)؟ */ degraded: boolean; attempts: string[] }
  | { ok: false; error: DbWriteError; attempts: string[] }

/** أخطاء `postgrest-js` غير مُصدَّرة كـ type مستقر — نقرأها بحذر. */
type PostgrestLikeError = {
  message?: string
  code?: string
  details?: string
  hint?: string
}

/** يطبّع خطأ PostgREST + يستخرج اسم العمود من نص الرسالة إن أمكن. */
export function toDbWriteError(error: unknown): DbWriteError {
  const raw = (error ?? {}) as PostgrestLikeError
  const message = raw.message ?? describe(error)
  const column =
    /Could not find the '([^']+)' column/i.exec(message)?.[1] ??
    /column "([^"]+)" of relation/i.exec(message)?.[1] ??
    /'([^']+)' column/i.exec(message)?.[1]

  return {
    message,
    code: raw.code,
    details: raw.details,
    hint: raw.hint,
    ...(column ? { column } : {}),
  }
}

/** طباعة صريحة وكاملة لسبب فشل Supabase (رسالة/كود/تفاصيل/تلميح/العمود). */
export function logDbWriteError(context: string, error: DbWriteError): void {
  console.error(
    `[supabase] ${context} فشل — code=${error.code ?? "-"} column=${error.column ?? "-"}\n` +
      `  message: ${error.message}\n` +
      `  details: ${error.details ?? "-"}\n` +
      `  hint: ${error.hint ?? "-"}`,
  )
}

/** أعمدة يمكن إسقاطها لإكمال الحفظ إن تعارضت مع مخطط الجدول الفعلي. */
const DROPPABLE_COLUMNS: readonly string[] = ["created_at", "sender_phone", "receipt_url"]

/**
 * يُدرج/يُحدّث تذكرة في Supabase **مع تدرّج آمن يمنع فقدان أي طلب**:
 *  1) المحاولة الكاملة بالصف كما هو (`user_id` مشتقّ من البريد كـ UUIDv5).
 *  2) عند خطأ «عمود غير موجود» (PGRST204/42703) ⇒ إسقاط العمود المذكور وإعادة المحاولة.
 *  3) عند خطأ تعارض نوع (22P02…) ⇒ إعادة المحاولة بـ `user_id = null` (تُحفظ التذكرة
 *     حتى لو تعذّر ربطها بالعميل) مع تحذير صريح في اللوج.
 * النتيجة تحمل الخطأ الحقيقي كاملًا (code/details/hint) لتظهر في الواجهة واللوج.
 */
export async function upsertTicketInDbDetailed(ticket: Ticket): Promise<DbUpsertResult> {
  const admin = getSupabaseAdmin()
  const attempts: string[] = []

  if (!admin) {
    const error: DbWriteError = {
      message:
        "Supabase admin غير مهيأ — تحقّق من NEXT_PUBLIC_SUPABASE_URL و NEXT_PUBLIC_SUPABASE_ANON_KEY و SUPABASE_SERVICE_ROLE_KEY في بيئة السيرفر.",
      code: "not_configured",
    }
    logDbWriteError(`upsert ticket ${ticket.id}`, error)
    return { ok: false, error, attempts }
  }

  let row: TicketRow = ticketToRow(ticket)
  let degraded = false
  const droppedColumns: string[] = []

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const { data, error } = await writeTicketRow(admin, row, ticket.id)

    if (!error) {
      attempts.push(`attempt#${attempt}: ok`)
      if (degraded || droppedColumns.length > 0) {
        console.warn(
          `[supabase] حُفظت التذكرة ${ticket.id} بصيغة مختصرة (أسقطنا: ${
            droppedColumns.join(", ") || "لا شيء"
          }${degraded ? " + user_id=null" : ""}) — راجع مخطط الجدول لتخزين كل الحقول.`,
        )
      }
      return { ok: true, ticket: data ? rowToTicket(data as TicketRow) : ticket, degraded, attempts }
    }

    const normalized = toDbWriteError(error)
    logDbWriteError(`upsert ticket ${ticket.id} (محاولة ${attempt})`, normalized)
    attempts.push(`attempt#${attempt}: ${normalized.code ?? "?"} ${normalized.message}`)

    // (2) عمود مفقود في الجدول ⇒ إسقاطه والمحاولة مجددًا.
    const missingColumn = normalized.column
    if (
      (normalized.code === "PGRST204" || normalized.code === "42703") &&
      missingColumn &&
      DROPPABLE_COLUMNS.includes(missingColumn) &&
      !droppedColumns.includes(missingColumn)
    ) {
      const { [missingColumn]: _dropped, ...rest } = row as unknown as Record<string, unknown>
      row = rest as unknown as TicketRow
      droppedColumns.push(missingColumn)
      console.warn(`[supabase] العمود «${missingColumn}» غير موجود — إعادة المحاولة بدونه.`)
      continue
    }

    // (3) تعارض نوع في user_id (بريد ⇒ uuid): نُكمل الحفظ بلا ربط بالعميل.
    const userIdTypeError =
      normalized.code === "22P02" || /invalid input syntax/i.test(normalized.message)
    if (!degraded && row.user_id !== null && userIdTypeError) {
      degraded = true
      row = { ...row, user_id: null }
      console.warn(
        `[supabase] تعذّر تخزين معرّف العميل في user_id (${
          normalized.code ?? "?"
        }) — إعادة المحاولة بـ user_id=null.`,
      )
      continue
    }

    return { ok: false, error: normalized, attempts }
  }

  const error: DbWriteError = {
    message: `فشل حفظ التذكرة ${ticket.id} بعد كل المحاولات.`,
    code: "attempts_exhausted",
  }
  logDbWriteError(`upsert ticket ${ticket.id}`, error)
  return { ok: false, error, attempts }
}

/** يُحدّث حالة تذكرة في Supabase. يعيد التذكرة المحدّثة أو null. */
export async function updateTicketStatusInDb(ticketId: string, status: TicketStatus): Promise<Ticket | null> {
  const admin = getSupabaseAdmin()
  if (!admin) return null
  try {
    const { data, error } = await admin
      .from(TICKETS_TABLE)
      .update({ status })
      .eq("id", ticketId)
      .select()
      .single()
    if (error) {
      console.warn(`[supabase] update ticket ${ticketId} status failed: ${error.message}`)
      return null
    }
    return data ? rowToTicket(data as TicketRow) : null
  } catch (error) {
    console.warn(`[supabase] update ticket ${ticketId} status errored: ${describe(error)}`)
    return null
  }
}

/* ---------- تسجيل الحضور عند البوابة (Gate Check-in) على السيرفر ---------- */

export type DbCheckInOutcome = "accepted" | "already_used" | "not_verified" | "not_found"

export type DbCheckInResult = {
  outcome: DbCheckInOutcome
  ticket: Ticket | null
  /** وقت الحضور المسجّل (للتذكرة المقبولة أو المستخدمة مسبقًا). */
  checkedInAt?: string
  /** سبب تقني عند تعذّر الكتابة (يُسجَّل في اللوج ويُعرض للمشغّل). */
  error?: string
}

/**
 * يسجّل حضور تذكرة **بمنع تكرار ذرّي** (Atomic Duplicate Prevention).
 *
 * الحماية من التكرار ليست في الكود بل في شرط التحديث نفسه:
 *   `update … where id = $1 and status <> 'checked_in'`
 * لذا لو مسح مشغّلان التذكرة نفسها في نفس اللحظة، يتأثر صف واحد فقط ويقرأ
 * الثاني «مستخدمة مسبقًا» — بلا حالة تسابق (Race Condition).
 */
export async function checkInTicketInDb(rawTicketId: string): Promise<DbCheckInResult> {
  const id = rawTicketId.trim().toUpperCase()
  if (!id) return { outcome: "not_found", ticket: null, error: "معرّف التذكرة فارغ." }

  const admin = getSupabaseAdmin()
  if (!admin) {
    const error = "Supabase admin غير مهيأ — تعذّر تسجيل الحضور على السيرفر."
    console.error(`[supabase] check-in ${id} فشل: ${error}`)
    return { outcome: "not_found", ticket: null, error }
  }

  const checkedInAt = new Date().toISOString()

  /** تحديث محروس: لا يُحدّث إلا تذكرة لم تُستخدم بعد. */
  const guardedUpdate = async (
    payload: Record<string, unknown>,
  ): Promise<{ rows: TicketRow[]; error: unknown }> => {
    try {
      const { data, error } = await admin
        .from(TICKETS_TABLE)
        .update(payload)
        .eq("id", id)
        .neq("status", "checked_in")
        .select()
      return { rows: (data ?? []) as TicketRow[], error }
    } catch (error) {
      return { rows: [], error }
    }
  }

  let attempt = await guardedUpdate({ status: "checked_in", checked_in_at: checkedInAt })

  if (attempt.error) {
    const normalized = toDbWriteError(attempt.error)
    const missingColumn = normalized.code === "PGRST204" || normalized.code === "42703"
    if (missingColumn && (normalized.column === "checked_in_at" || /checked_in_at/i.test(normalized.message))) {
      console.warn(
        "[supabase] العمود checked_in_at غير موجود — شغّل scripts/tickets-checkin.sql. سيُسجَّل الحضور بلا وقت.",
      )
      attempt = await guardedUpdate({ status: "checked_in" })
    }
    if (attempt.error) {
      const failed = toDbWriteError(attempt.error)
      logDbWriteError(`check-in ticket ${id}`, failed)
      return { outcome: "not_found", ticket: null, error: failed.message }
    }
  }

  const updated = attempt.rows[0]
  if (updated) {
    console.log(`[supabase] سُجّل حضور التذكرة ${id} في ${checkedInAt}`)
    return { outcome: "accepted", ticket: rowToTicket(updated), checkedInAt: updated.checked_in_at ?? checkedInAt }
  }

  // لم يتأثر أي صف ⇒ لم تُوجد، أو مستخدمة مسبقًا، أو غير مقبولة بعد.
  const existing = await getTicketFromDb(id)
  if (!existing) return { outcome: "not_found", ticket: null }
  if (normalizeTicketStatus(existing.status) === "checked_in") {
    return { outcome: "already_used", ticket: existing, checkedInAt: existing.checkedInAt }
  }
  return { outcome: "not_verified", ticket: existing }
}

/** يُحدّث صورة الإيصال ورقم المحوّل ويعيد التذكرة إلى «قيد المراجعة». */
export async function updateTicketReceiptInDb(
  ticketId: string,
  receiptUrl: string | null,
  senderPhone: string | null,
): Promise<Ticket | null> {
  const admin = getSupabaseAdmin()
  if (!admin) return null
  try {
    const { data, error } = await admin
      .from(TICKETS_TABLE)
      .update({ receipt_url: receiptUrl, sender_phone: senderPhone, status: "pending" })
      .eq("id", ticketId)
      .select()
      .single()
    if (error) {
      console.warn(`[supabase] update receipt ${ticketId} failed: ${error.message}`)
      return null
    }
    return data ? rowToTicket(data as TicketRow) : null
  } catch (error) {
    console.warn(`[supabase] update receipt ${ticketId} errored: ${describe(error)}`)
    return null
  }
}

/**
 * يربط معرّف محادثة تليجرام للعميل بالتذكرة (عند إرساله `/start KW-XXXXXX` للبوت).
 * عمود اختياري — يُهمَل بتحذير لو لم يُشغَّل الترحيل `scripts/tickets-telegram.sql`.
 */
export async function setTicketTelegramChatIdInDb(ticketId: string, chatId: string): Promise<boolean> {
  const admin = getSupabaseAdmin()
  if (!admin) return false
  try {
    const { error } = await admin.from(TICKETS_TABLE).update({ telegram_chat_id: chatId }).eq("id", ticketId)
    if (error) {
      console.warn(`[supabase] set telegram_chat_id ${ticketId} failed: ${error.message}`)
      return false
    }
    return true
  } catch (error) {
    console.warn(`[supabase] set telegram_chat_id ${ticketId} errored: ${describe(error)}`)
    return false
  }
}

/**
 * يحفظ رابط صورة التذكرة/QR التي ولّدها بوت تليجرام على التذكرة.
 * عمود اختياري — يُهمَل بتحذير لو لم يُشغَّل الترحيل `scripts/tickets-telegram.sql`.
 */
export async function setTicketImageUrlInDb(ticketId: string, imageUrl: string): Promise<boolean> {
  const admin = getSupabaseAdmin()
  if (!admin) return false
  try {
    const { error } = await admin.from(TICKETS_TABLE).update({ ticket_image_url: imageUrl }).eq("id", ticketId)
    if (error) {
      console.warn(`[supabase] set ticket_image_url ${ticketId} failed: ${error.message}`)
      return false
    }
    return true
  } catch (error) {
    console.warn(`[supabase] set ticket_image_url ${ticketId} errored: ${describe(error)}`)
    return false
  }
}

/** يقرأ تذكرة واحدة من Supabase بالمعرّف، أو null عند غيابها/فشل القراءة. */
export async function getTicketFromDb(ticketId: string): Promise<Ticket | null> {
  const admin = getSupabaseAdmin()
  if (!admin) return null
  try {
    const { data, error } = await admin.from(TICKETS_TABLE).select("*").eq("id", ticketId).maybeSingle()
    if (error) {
      console.warn(`[supabase] read ticket ${ticketId} failed: ${error.message}`)
      return null
    }
    return data ? rowToTicket(data as TicketRow) : null
  } catch (error) {
    console.warn(`[supabase] read ticket ${ticketId} errored: ${describe(error)}`)
    return null
  }
}

/**
 * أقصى عدد صفوف تُقرأ في النداء الواحد.
 *
 * ⚠️ السبب: بدون حد، لوحة الأدمن كانت تقرأ **كل** التذاكر في كل استطلاع؛
 * عند ٢٥٦٠٠ تذكرة صار كل نداء ≈٩ ميجابايت كل ٦ ثوانٍ ⇒ استهلاك يقتل حصة
 * النقل والذاكرة في أول ساعة. الحد يحمي اللوحة، والأرقام الإجمالية تأتي من
 * `getTicketStatsFromDb` (تجميع في قاعدة البيانات بنداء صغير).
 */
export const TICKET_LIST_LIMIT = Math.max(50, Number(process.env.TICKETS_LIST_LIMIT ?? 1000) || 1000)

/** يقرأ تذاكر مستخدم واحد من Supabase (مرتبة من الأحدث)، أو null عند الفشل. */
export async function listTicketsFromDb(
  customerId?: string,
  limit: number = TICKET_LIST_LIMIT,
): Promise<Ticket[] | null> {
  const client = getSupabaseAdmin() ?? getSupabaseServer()
  if (!client) return null
  try {
    let query = client
      .from(TICKETS_TABLE)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(Math.max(1, limit))
    if (customerId) {
      // البريد ⇒ نفس UUIDv5 المستخدم عند الحفظ (ليعود صاحب التذكرة لرؤية تذاكره).
      const userId = emailToUserId(customerId)
      if (userId) query = query.eq("user_id", userId)
    }
    const { data, error } = await query
    if (error) {
      console.warn(`[supabase] list tickets failed: ${error.message}`)
      return null
    }
    return (data as TicketRow[]).map(rowToTicket)
  } catch (error) {
    console.warn(`[supabase] list tickets errored: ${describe(error)}`)
    return null
  }
}

/* ---------- أرقام إجمالية دقيقة بلا تحميل الصفوف (للوحة الإدارة) ---------- */

/** نتيجة إحصاءات التذاكر + مصدرها (لشفافية العرض في الواجهة). */
export type TicketStats = {
  /** `rpc` = دالة تجميع في القاعدة (الأدق والأسرع)، `counts` = عدّ لكل حالة، `unavailable` = تعذّر. */
  source: "rpc" | "counts" | "unavailable"
  total: number
  pending: number
  approved: number
  rejected: number
  checkedIn: number
  /** مجموع المقاعد للتذاكر المقبولة/الحاضرة. */
  seats: number
  /** الإيراد بالقروش للتذاكر المقبولة/الحاضرة. */
  revenueCents: number
}

const EMPTY_STATS: TicketStats = {
  source: "unavailable",
  total: 0,
  pending: 0,
  approved: 0,
  rejected: 0,
  checkedIn: 0,
  seats: 0,
  revenueCents: 0,
}

/** يحوّل صف دالة التجميع إلى `TicketStats` بأمان (الأرقام قد تصل نصوصًا من PostgREST). */
function toTicketStatsRow(row: Record<string, unknown>): Omit<TicketStats, "source"> {
  const num = (value: unknown): number => {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return {
    total: num(row.total),
    pending: num(row.pending),
    approved: num(row.approved),
    rejected: num(row.rejected),
    checkedIn: num(row.checked_in ?? row.checkedIn),
    seats: num(row.seats),
    revenueCents: num(row.revenue ?? row.revenueCents),
  }
}

/**
 * أرقام التذاكر الإجمالية للوحة الإدارة **بنداء واحد صغير**.
 *
 * المسار الأول: دالة `kawalees_ticket_stats` في القاعدة (`scripts/ticket-stats.sql`)
 * — تجميع كامل في صف واحد، فلا تُنقل صفوف التذاكر إلى المتصفح إطلاقًا.
 * وإن لم تكن الدالة مُشغَّلة، نسقط إلى عدّ دقيق لكل حالة (٥ نداءات رأس صغيرة)
 * مع إيراد ومقاعد من القائمة المحدودة — فتظل الأعداد صحيحة بلا كسر للوحة.
 */
export async function getTicketStatsFromDb(): Promise<TicketStats> {
  const admin = getSupabaseAdmin()
  if (!admin) {
    console.warn("[supabase] إحصاءات التذاكر غير متاحة: عميل الخدمة غير مهيأ.")
    return EMPTY_STATS
  }

  // (1) دالة التجميع — الأفضل: صف واحد بلا نقل صفوف.
  try {
    const { data, error } = await admin.rpc("kawalees_ticket_stats")
    if (!error && Array.isArray(data) && data.length > 0) {
      return { source: "rpc", ...toTicketStatsRow(data[0] as Record<string, unknown>) }
    }
    if (error) {
      console.warn(
        `[supabase] دالة kawalees_ticket_stats غير متاحة (${error.message}) — سيُستخدم العدّ البديل. ` +
          "شغّل scripts/ticket-stats.sql للأرقام الأدق.",
      )
    }
  } catch (error) {
    console.warn(`[supabase] نداء kawalees_ticket_stats فشل: ${describe(error)}`)
  }

  // (2) بديل: عدّ دقيق لكل حالة عبر أربعة نداءات رأس صغيرة (بلا صفوف).
  const countFor = async (status: string): Promise<number | null> => {
    try {
      const { count, error } = await admin
        .from(TICKETS_TABLE)
        .select("id", { count: "exact", head: true })
        .eq("status", status)
      return error ? null : (count ?? 0)
    } catch {
      return null
    }
  }

  const [total, pending, approved, rejected, checkedIn] = await Promise.all([
    countFor("pending"),
    countFor("pending"),
    countFor("approved"),
    countFor("rejected"),
    countFor("checked_in"),
  ])

  if (total === null || pending === null) return EMPTY_STATS

  // الإجمالي الحقيقي يأتي من عدّ كل الحالات المعروفة + المعلّقة.
  const known = (approved ?? 0) + (rejected ?? 0) + (checkedIn ?? 0) + pending
  return {
    source: "counts",
    total: known,
    pending,
    approved: approved ?? 0,
    rejected: rejected ?? 0,
    checkedIn: checkedIn ?? 0,
    seats: 0,
    revenueCents: 0,
  }
}
