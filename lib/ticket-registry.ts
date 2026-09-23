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

