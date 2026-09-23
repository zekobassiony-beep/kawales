import type { Ticket, TicketStatus } from "@/lib/tickets"
import { getTicketFromDb, updateTicketStatusInDb, upsertTicketInDb } from "@/lib/supabase/tickets"

/**
 * سجل التذاكر على الخادم — الآن مبني على جدول `tickets` في **Supabase** (Postgres).
 *
 * - الكتابة/القراءة الأساسية تذهب مباشرة إلى Supabase عبر `lib/supabase/tickets`.
 * - يُحتفظ بذاكرة محلية صغيرة كـ **fallback فقط** عندما لا تكون Supabase مهيأة
 *   (مثل اختبارات الوحدة أو التشغيل بدون متغيّرات البيئة) أو عند فشل الاتصال،
 *   حتى لا ينهار الويب هوك أو مسار الاستطلاع.
 */

export type ServerTicketRecord = {
  ticketId: string
  /** حمولة رمز QR (نفس ما يُعرض على الموقع). */
  qrPayload: string
  showTitle: string
  seatsLabel: string
  customerName: string
  senderPhone: string
  totalCents: number
  status: TicketStatus
  updatedAt: string
}

export type TicketDecision = "approved" | "rejected"

export type TicketDecisionResult = {
  ok: boolean
  alreadyDecided: boolean
  status: TicketStatus
  message: string
  record: ServerTicketRecord
}

export type RegisterTicketRecordInput = Omit<ServerTicketRecord, "status" | "updatedAt"> & {
  status?: TicketStatus
}

/* ---------- Fallback في الذاكرة (عند غياب Supabase) ---------- */

const fallback = new Map<string, ServerTicketRecord>()

function normalize(id: string): string {
  return id.trim().toUpperCase()
}

function now(): string {
  return new Date().toISOString()
}

function recordFromTicket(ticket: Ticket): ServerTicketRecord {
  return {
    ticketId: ticket.id,
    qrPayload: ticket.qrCode,
    showTitle: ticket.showTitle,
    seatsLabel: ticket.seats.join("، "),
    customerName: ticket.customerName,
    senderPhone: ticket.senderPhone ?? "",
    totalCents: ticket.totalCents,
    status: ticket.status,
    updatedAt: now(),
  }
}

function minimalRecord(ticketId: string, status: TicketStatus, qrPayload?: string): ServerTicketRecord {
  return {
    ticketId,
    qrPayload: qrPayload ?? `kawalees:ticket:${ticketId}`,
    showTitle: "",
    seatsLabel: "",
    customerName: "",
    senderPhone: "",
    totalCents: 0,
    status,
    updatedAt: now(),
  }
}

/** يستخرج معرّف العرض من حمولة QR (`kawalees:ticket:{id}:{showId}`). */
function parseShowId(qrPayload: string): string {
  const parts = qrPayload.split(":")
  return parts.length >= 4 ? parts.slice(3).join(":") : ""
}

/** يبني تذكرة (مناسبة للـ upsert) من مدخلات السجل — بقدر ما توفّره المدخلات. */
function ticketFromInput(input: RegisterTicketRecordInput): Ticket {
  const showId = parseShowId(input.qrPayload)
  return {
    id: input.ticketId,
    showId,
    showTitle: input.showTitle,
    venue: "",
    startsAt: "",
    customerId: "",
    customerName: input.customerName,
    seats: input.seatsLabel ? input.seatsLabel.split("،").map((s) => s.trim()).filter(Boolean) : [],
    tierName: "",
    totalCents: input.totalCents,
    paymentMethod: "vodafone_cash",
    paymentRef: "",
    senderPhone: input.senderPhone || undefined,
    status: input.status ?? "pending",
    qrCode: input.qrPayload,
    createdAt: now(),
  }
}


/* ---------- العمليات العامة (Supabase أولًا + fallback) ---------- */

/** يسجّل تذكرة (تُستدعى عند إنشاء الحجز) — upsert إلى Supabase ثم fallback. */
export async function registerTicketRecord(input: RegisterTicketRecordInput): Promise<void> {
  const ticketId = normalize(input.ticketId)
  const status = input.status ?? "pending"
  const record: ServerTicketRecord = { ...input, ticketId, status, updatedAt: now() }

  const saved = await upsertTicketInDb(ticketFromInput({ ...input, ticketId, status }))
  if (saved) {
    fallback.set(ticketId, recordFromTicket(saved))
    return
  }
  fallback.set(ticketId, record)
}

/** يُحدّث حالة تذكرة على الخادم (ينشئ سجلًا مؤقتًا إن لم توجد). */
export async function registerTicketStatus(id: string, status: TicketStatus = "pending"): Promise<void> {
  const ticketId = normalize(id)
  const updated = await updateTicketStatusInDb(ticketId, status)
  if (updated) {
    fallback.set(ticketId, recordFromTicket(updated))
    return
  }
  const existing = fallback.get(ticketId)
  fallback.set(ticketId, existing ? { ...existing, status, updatedAt: now() } : minimalRecord(ticketId, status))
}

/** يقرأ حالة تذكرة من Supabase (مع fallback). */
export async function getTicketStatus(id: string): Promise<TicketStatus | undefined> {
  const ticketId = normalize(id)
  const fromDb = await getTicketFromDb(ticketId)
  if (fromDb) {
    fallback.set(ticketId, recordFromTicket(fromDb))
    return fromDb.status
  }
  return fallback.get(ticketId)?.status
}

/** السجل الكامل (يُستعمل لإرسال رمز QR عند القبول). */
export async function getTicketRecord(id: string): Promise<ServerTicketRecord | undefined> {
  const ticketId = normalize(id)
  const fromDb = await getTicketFromDb(ticketId)
  if (fromDb) {
    const record = recordFromTicket(fromDb)
    fallback.set(ticketId, record)
    return record
  }
  return fallback.get(ticketId)
}

/**
 * يطبّق قرار الإدارة (قبول/رفض) مباشرة على جدول `tickets` في Supabase:
 * - إن وُجدت التذكرة: تُحدَّث حالتها فورًا.
 * - إن لم توجد (اختلاف نسخ Vercel): يُنشأ سجل مؤقت بالحالة الجديدة دون أي Exception.
 * ثم يحدّث الـ fallback ويُعيد رسالة مناسبة (يدعم تكرار الضغط idempotent).
 */
export async function applyTicketDecision(id: string, decision: TicketDecision): Promise<TicketDecisionResult> {
  const ticketId = normalize(id)
  const existing = await getTicketFromDb(ticketId)

  if (existing) {
    const alreadyDecided = existing.status === decision
    const updated = (await updateTicketStatusInDb(ticketId, decision)) ?? { ...existing, status: decision }
    const record = recordFromTicket(updated)
    fallback.set(ticketId, record)
    return { ok: true, alreadyDecided, status: decision, message: decisionMessage(decision, alreadyDecided), record }
  }

  // التذكرة غير موجودة في Supabase: نُنشئ سجلًا مؤقتًا بالحالة الجديدة (متانة Serverless).
  const fallbackExisting = fallback.get(ticketId)
  const alreadyDecided = fallbackExisting?.status === decision
  const qrPayload = fallbackExisting?.qrPayload ?? `kawalees:ticket:${ticketId}`

  const created = await upsertTicketInDb(minimalTicketForDecision(ticketId, decision, qrPayload))
  const record = created
    ? recordFromTicket(created)
    : { ...(fallbackExisting ?? minimalRecord(ticketId, decision, qrPayload)), status: decision, updatedAt: now() }
  fallback.set(ticketId, record)

  return { ok: true, alreadyDecided, status: decision, message: decisionMessage(decision, alreadyDecided), record }
}

/** يعتمد التذكرة على الخادم — الواجهة المكافئة لـ `verifyTicket` في مخزن العميل. */
export function verifyTicketOnServer(id: string): Promise<TicketDecisionResult> {
  return applyTicketDecision(id, "approved")
}

/** يرفض التذكرة على الخادم. */
export function rejectTicketOnServer(id: string): Promise<TicketDecisionResult> {
  return applyTicketDecision(id, "rejected")
}

/* ---------- مساعدات داخلية ---------- */

function decisionMessage(decision: TicketDecision, alreadyDecided: boolean): string {
  if (alreadyDecided) {
    return decision === "approved" ? "هذه التذكرة معتمدة بالفعل ✅" : "هذه التذكرة مرفوضة بالفعل ❌"
  }
  return decision === "approved" ? "تم قبول الحجز وتأكيد التذكرة ✅" : "تم رفض الحجز ❌"
}

function minimalTicketForDecision(ticketId: string, status: TicketStatus, qrPayload: string): Ticket {
  return {
    id: ticketId,
    showId: parseShowId(qrPayload),
    showTitle: "",
    venue: "",
    startsAt: "",
    customerId: "",
    customerName: "",
    seats: [],
    tierName: "",
    totalCents: 0,
    paymentMethod: "vodafone_cash",
    paymentRef: "",
    status,
    qrCode: qrPayload,
    createdAt: now(),
  }
}
