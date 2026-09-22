import { NextRequest, NextResponse } from "next/server"
import { getTicketStatus } from "@/lib/ticket-registry"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * استطلاع قرار الإدارة لحالة تذكرة محددة (`?id=KW-XXXXXX`).
 * يقرأ من سجل الخادم الذي يحدّثه ويب هوك التليجرام.
 */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id")?.trim().toUpperCase() ?? ""
  if (!id) return NextResponse.json({ status: "pending" })
  return NextResponse.json({ status: getTicketStatus(id) ?? "pending" })
}
