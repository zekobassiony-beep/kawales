import { NextRequest, NextResponse } from "next/server"
import { getTicketFromDb } from "@/lib/supabase/tickets"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** الحد الأقصى لعدد التذاكر في الطلب الواحد (حماية من إساءة الاستخدام). */
const MAX_IDS = 50
/** صيغة مرجع التذكرة المقبولة (`KW-XXXXXX`). */
const ID_PATTERN = /^KW-[A-Z0-9-]{3,}$/

/**
 * قراءة مجمّعة لحالات عدة تذاكر — تُستخدم في الاستطلاع الحيّ بعد قرار الإدارة على
 * تليجرام (`approve_/reject_`) بنداء واحد بدل طلب لكل تذكرة.
 *
 *   GET /api/tickets/statuses?ids=KW-ABC123,KW-DEF456
 *   → { tickets: [{ id, status, ticketImageUrl }] }
 *
 * المعرّفات غير الصالحة أو غير الموجودة تُهمَل بهدوء (لا نُنشئ حالات وهمية).
 */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("ids") ?? ""
  const ids = Array.from(
    new Set(
      raw
        .split(",")
        .map((value) => value.trim().toUpperCase())
        .filter((value) => ID_PATTERN.test(value)),
    ),
  ).slice(0, MAX_IDS)

  if (ids.length === 0) {
    return NextResponse.json({ tickets: [] }, { headers: { "Cache-Control": "no-store" } })
  }

  const rows = await Promise.all(
    ids.map(async (id) => {
      const ticket = await getTicketFromDb(id)
      if (!ticket) return null
      return {
        id: ticket.id,
        status: ticket.status,
        ticketImageUrl: ticket.ticketImageUrl ?? null,
        checkedInAt: ticket.checkedInAt ?? null,
      }
    }),
  )

  return NextResponse.json(
    { tickets: rows.filter((row) => row !== null) },
    { headers: { "Cache-Control": "no-store" } },
  )
}
