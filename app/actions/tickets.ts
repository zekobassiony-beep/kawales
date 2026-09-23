"use server"

import type { Ticket, TicketStatus } from "@/lib/tickets"
import { checkAdminAccess } from "@/lib/auth"
import { listTicketsFromDb, updateTicketStatusInDb, upsertTicketInDb } from "@/lib/supabase/tickets"

/**
 * إجراءات الخادم للتذاكر على Supabase — مصدر الحقيقة للوحات التحكم.
 *
 * - `persistTicket`: يحفظ تذكرة كاملة عند إنشاء الحجز (status = pending).
 * - `listMyTickets`: يقرأ تذاكر مستخدم واحد حيًا من الجدول.
 * - `setTicketStatusServer`: يحدّث حالة التذكرة (أزرار قبول/رفض من اللوحات إن لزم).
 */

export async function persistTicket(ticket: Ticket): Promise<{ ok: boolean }> {
  try {
    const saved = await upsertTicketInDb(ticket)
    return { ok: saved !== null }
  } catch (error) {
    console.error(`[tickets] persistTicket ${ticket.id} failed: ${error instanceof Error ? error.message : error}`)
    return { ok: false }
  }
}

export async function listMyTickets(customerId?: string): Promise<Ticket[]> {
  // قراءة القائمة الكاملة (بلا معرّف مستخدم) = صلاحية أدمن فقط.
  if (!customerId || customerId.trim().length === 0) {
    const access = await checkAdminAccess()
    if (!access.allowed) return []
  }
  const rows = await listTicketsFromDb(customerId)
  return rows ?? []
}

export async function setTicketStatusServer(ticketId: string, status: TicketStatus): Promise<{ ok: boolean }> {
  try {
    const updated = await updateTicketStatusInDb(ticketId.trim().toUpperCase(), status)
    return { ok: updated !== null }
  } catch (error) {
    console.error(`[tickets] setTicketStatusServer ${ticketId} failed: ${error instanceof Error ? error.message : error}`)
    return { ok: false }
  }
}
