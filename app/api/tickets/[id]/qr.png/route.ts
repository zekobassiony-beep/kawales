import { NextResponse, type NextRequest } from "next/server"
import { getTicketFromDb } from "@/lib/supabase/tickets"
import { buildTicketQrPng } from "@/lib/telegram-ticket-image"
import { normalizeTicketStatus } from "@/lib/ticket-status"
import { parseTicketCode } from "@/lib/ticket-code"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** دقة الوحدة في الصورة (نفس دقة بطاقة تليجرام ⇒ نفس الجودة ونفس قابلية المسح). */
const QR_SCALE = 16

/**
 * صورة رمز QR للتذكرة **مولَّدة على السيرفر عند الطلب**:
 *
 *   GET /api/tickets/KW-XXXXXX/qr.png
 *
 * لماذا هكذا بدل التخزين السحابي:
 *  - صفر تخزين: عند ٢٥٦٠٠ تذكرة كان الرفع يستهلك ≈١.٥ جيجابايت (خارج الحصة المجانية).
 *  - صفر معالج عند الاعتماد: لا نولّد ٢٥٦٠٠ صورة دفعة واحدة، بل عند المشاهدة فقط.
 *  - الرمز يُرسم في **السيرفر** لا في المتصفح (دقة أعلى وقابلية مسح أفضل)، بنفس
 *    الكود المستخدم لبطاقة تليجرام.
 *
 * الصورة ثابتة لكل تذكرة، لذا تُخزَّن مؤقتًا سنة كاملة في المتصفح وحواف الشبكة.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params
  const ticketId = parseTicketCode(decodeURIComponent(id ?? ""))
  if (!ticketId) {
    return new NextResponse("كود التذكرة غير صالح.", { status: 400 })
  }

  const ticket = await getTicketFromDb(ticketId)
  if (!ticket) {
    return new NextResponse("لا توجد تذكرة بهذا الكود.", { status: 404 })
  }

  // نفس منطق السابق: لا تُصدر صورة لتذكرة لم تُعتمد بعد (المعروض قبل القبول = بلا QR).
  const status = normalizeTicketStatus(ticket.status)
  if (status !== "approved" && status !== "checked_in") {
    return new NextResponse("التذكرة لم تُعتمد بعد.", { status: 403 })
  }

  const png = buildTicketQrPng(ticket.qrCode, QR_SCALE)
  return new NextResponse(new Uint8Array(png), {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Content-Length": String(png.length),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  })
}
