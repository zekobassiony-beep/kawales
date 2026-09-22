import type { TicketStatus } from "@/lib/tickets"

/**
 * سجل حالة التذكرة على الخادم (In-Memory) — الجسر بين قرار إدارة التليجرام
 * (ويب هوك) وتحديث العميل عبر API الاستطلاع.
 *
 * ملاحظة: في بيئة Serverless متعددة النسخ يلزم استبداله بمخزن دائم (قاعدة بيانات)،
 * أما محليًا (`next dev` / `next start`) فالحالة ثابتة داخل العملية الواحدة.
 */
const registry = new Map<string, TicketStatus>()

function normalize(id: string): string {
  return id.trim().toUpperCase()
}

export function registerTicketStatus(id: string, status: TicketStatus = "pending"): void {
  registry.set(normalize(id), status)
}

export function getTicketStatus(id: string): TicketStatus | undefined {
  return registry.get(normalize(id))
}

export function setTicketStatusOnServer(id: string, status: TicketStatus): void {
  registry.set(normalize(id), status)
}
