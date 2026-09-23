import type { TicketStatus } from "@/lib/tickets"

/**
 * سجل التذاكر على الخادم (In-Memory) — الجسر بين قرار إدارة التليجرام (ويب هوك)
 * وتحديث العميل عبر API الاستطلاع، ويحتفظ أيضًا بحمولة رمز QR لإرسالها عند القبول.
 *
 * ملاحظة: في بيئة Serverless متعددة النسخ يلزم استبداله بمخزن دائم (قاعدة بيانات)،
 * أما محليًا (`next dev` / `next start`) فالحالة ثابتة داخل العملية الواحدة.
 */
export type ServerTicketRecord = {
  ticketId: string
  /** حمولة رمز QR (نفس ما يُولَّد على الموقع: `kawalees:ticket:ID:showId`). */
  qrPayload: string
  showTitle: string
  seatsLabel: string
  customerName: string
  senderPhone: string
  totalCents: number
  status: TicketStatus
  updatedAt: string
}

const registry = new Map<string, ServerTicketRecord>()

function normalize(id: string): string {
  return id.trim().toUpperCase()
}

/** يسجّل تذكرة كاملة (تُستدعى بعد إنشاء التذكرة في الموقع). */
export function registerTicketRecord(input: Omit<ServerTicketRecord, "status" | "updatedAt"> & { status?: TicketStatus }): void {
  const ticketId = normalize(input.ticketId)
  registry.set(ticketId, {
    ...input,
    ticketId,
    status: input.status ?? "pending",
    updatedAt: new Date().toISOString(),
  })
}

/** يُحدّث حالة تذكرة (ينشئ سجلًا مصغّرًا إن لم يكن موجودًا). */
export function registerTicketStatus(id: string, status: TicketStatus = "pending"): void {
  const ticketId = normalize(id)
  const existing = registry.get(ticketId)
  const record: ServerTicketRecord = existing
    ? { ...existing, status, updatedAt: new Date().toISOString() }
    : {
        ticketId,
        qrPayload: `kawalees:ticket:${ticketId}`,
        showTitle: "",
        seatsLabel: "",
        customerName: "",
        senderPhone: "",
        totalCents: 0,
        status,
        updatedAt: new Date().toISOString(),
      }
  registry.set(ticketId, record)
}

export function getTicketStatus(id: string): TicketStatus | undefined {
  return registry.get(normalize(id))?.status
}

export function setTicketStatusOnServer(id: string, status: TicketStatus): void {
  registerTicketStatus(id, status)
}

/** سجل التذكرة الكامل (يُستعمل لإرسال رمز QR عند القبول). */
export function getTicketRecord(id: string): ServerTicketRecord | undefined {
  return registry.get(normalize(id))
}

/* ---------- قرار الإدارة (مكافئ `verifyTicket` / `applyAutomationUpdate` في العميل) ---------- */

export type TicketDecision = "approved" | "rejected"

export type TicketDecisionResult = {
  /** هل تم تطبيق قرار جديد فعليًا؟ */
  ok: boolean
  /** هل كانت التذكرة محسومة مسبقًا بنفس القرار؟ (لمنع التكرار) */
  alreadyDecided: boolean
  status: TicketStatus
  /** نص توضيحي يُستخدم في رد التليجرام. */
  message: string
  record: ServerTicketRecord
}

/**
 * يطبّق قرار الإدارة على تذكرة في سجل الخادم:
 * - `approved` ⇒ تُعتمد التذكرة ويتفعّل رمز QR (مكافئ `verifyTicket`).
 * - `rejected` ⇒ تُرفض التذكرة ويُمنع رمز QR (مكافئ `applyAutomationUpdate`).
 * يعمل بأمان مع تكرار الضغط (idempotent) ويُنشئ سجلًا مصغّرًا إن لم توجد التذكرة.
 */
export function applyTicketDecision(id: string, decision: TicketDecision): TicketDecisionResult {
  const ticketId = normalize(id)
  const previous = registry.get(ticketId)?.status
  const alreadyDecided = previous === decision

  registerTicketStatus(ticketId, decision)

  const record = registry.get(ticketId) as ServerTicketRecord
  const message = alreadyDecided
    ? decision === "approved"
      ? "هذه التذكرة معتمدة بالفعل ✅"
      : "هذه التذكرة مرفوضة بالفعل ❌"
    : decision === "approved"
      ? "تم قبول الحجز وتأكيد التذكرة ✅"
      : "تم رفض الحجز ❌"

  return { ok: true, alreadyDecided, status: decision, message, record }
}

/** يعتمد التذكرة على الخادم — الواجهة المكافئة لـ `verifyTicket` في مخزن العميل. */
export function verifyTicketOnServer(id: string): TicketDecisionResult {
  return applyTicketDecision(id, "approved")
}

/** يرفض التذكرة على الخادم. */
export function rejectTicketOnServer(id: string): TicketDecisionResult {
  return applyTicketDecision(id, "rejected")
}


