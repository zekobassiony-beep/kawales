import { NextRequest, NextResponse } from "next/server"
import { getTicketStatus } from "@/lib/ticket-registry"
import { getTicketFromDb } from "@/lib/supabase/tickets"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * استطلاع حالة تذكرة محددة (`?id=KW-XXXXXX`) + رابط صورة التذكرة/QR التي
 * يولّدها بوت تليجرام (`ticketImageUrl`) — يعرضها الموقع كـ «معرض/عرض» فقط.
 */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id")?.trim().toUpperCase() ?? ""
  if (!id) return NextResponse.json({ status: "pending", imageUrl: null })
  const [status, ticket] = await Promise.all([getTicketStatus(id), getTicketFromDb(id)])
  return NextResponse.json(
    { status: status ?? "pending", imageUrl: ticket?.ticketImageUrl ?? null },
    { headers: { "Cache-Control": "no-store" } },
  )
}
