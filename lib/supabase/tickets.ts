import type { Ticket, TicketStatus } from "@/lib/tickets"
import { getSupabaseAdmin, getSupabaseServer } from "@/lib/supabase/server"
import { TICKETS_TABLE } from "@/lib/supabase/config"

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
  status: string
  total_price: number
  seats: string[]
  created_at: string | null
}

function asStatus(value: string | null | undefined): TicketStatus {
  if (value === "checked_in" || value === "approved" || value === "rejected") return value
  return "pending"
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
    qrCode: deriveQrCode(row.id, row.show_id),
    createdAt: row.created_at ?? new Date().toISOString(),
  }
}

/** يحوّل تذكرة المنصة إلى صف Supabase (الأعمدة الفعلية فقط). */
export function ticketToRow(ticket: Ticket): TicketRow {
  return {
    id: ticket.id,
    show_id: ticket.showId,
    user_id: ticket.customerId || null,
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
  const admin = getSupabaseAdmin()
  if (!admin) return null
  try {
    const row = ticketToRow(ticket)
    const { data, error } = await admin.from(TICKETS_TABLE).upsert(row, { onConflict: "id" }).select().single()
    if (error) {
      console.warn(`[supabase] upsert ticket ${ticket.id} failed: ${error.message}`)
      return null
    }
    return data ? rowToTicket(data as TicketRow) : ticket
  } catch (error) {
    console.warn(`[supabase] upsert ticket ${ticket.id} errored: ${describe(error)}`)
    return null
  }
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

/** يقرأ تذاكر مستخدم واحد من Supabase (مرتبة من الأحدث)، أو null عند الفشل. */
export async function listTicketsFromDb(customerId?: string): Promise<Ticket[] | null> {
  const client = getSupabaseAdmin() ?? getSupabaseServer()
  if (!client) return null
  try {
    let query = client.from(TICKETS_TABLE).select("*").order("created_at", { ascending: false })
    if (customerId) query = query.eq("user_id", customerId.trim().toLowerCase())
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
