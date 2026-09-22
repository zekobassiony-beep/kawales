"use server"

import { db, getConnectionString, pool } from "@/lib/db"
import { events, bookedSeats, venues } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { tierForRow } from "@/lib/format"
import { MAX_SEATS_PER_BOOKING, parseSeatId } from "@/lib/seats"
import { calculateTotals } from "@/lib/pricing"
import { bookingBlockedReason } from "@/lib/booking-rules"
import { sendBookingNotification } from "@/lib/telegram"

export type BookingResult =
  | { ok: true; reference: string; totalCents: number }
  | { ok: false; error: string; takenSeats?: string[] }

function makeReference(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let out = "KW-"
  for (let i = 0; i < 6; i++) {
    out += chars[Math.floor(Math.random() * chars.length)]
  }
  return out
}

/**
 * يحوّل أخطاء المُشغِّل إلى رسالة قصيرة مفهومة للزائر حتى لا يفشل الدفع
 * برسالة غامضة.
 */
function databaseFailureMessage(error: unknown): string {
  const code = (error as { code?: string } | null)?.code
  const reason =
    code === "ECONNREFUSED"
      ? "قاعدة البيانات رفضت الاتصال"
      : code === "ENOTFOUND"
        ? "تعذّر الوصول إلى عنوان قاعدة البيانات"
        : code === "ETIMEDOUT"
          ? "انتهت مهلة الاتصال بقاعدة البيانات"
          : code === "28P01" || code === "28000"
            ? "قاعدة البيانات رفضت بيانات الاعتماد"
            : code === "42P01"
              ? "أحد الجداول المطلوبة غير موجود"
              : code === "3D000"
                ? "قاعدة البيانات غير موجودة"
                : code === "53300"
                  ? "لا توجد اتصالات حرة في قاعدة البيانات"
                  : "قاعدة البيانات غير متاحة"
  return `الحجز متوقف مؤقتًا لأن ${reason}. من فضلك حاول مرة أخرى بعد قليل.`
}

function logFailure(step: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  const code = (error as { code?: string } | null)?.code
  console.error(`[booking] ${step} failed${code ? ` (${code})` : ""}: ${message}`)
}

export async function createBooking(input: {
  eventId: number
  seatIds: string[]
  customerName: string
  customerEmail: string
  customerPhone: string
  receipt?: { filename: string; mimeType: string; dataBase64: string }
}): Promise<BookingResult> {
  // ---- Request shape ----
  if (!input || typeof input !== "object") {
    return { ok: false, error: "طلب الحجز غير صالح." }
  }

  const { eventId, seatIds, customerName, customerEmail } = input
  const customerPhone = typeof input.customerPhone === "string" ? input.customerPhone : ""
  const receipt =
    input.receipt &&
    typeof input.receipt.filename === "string" &&
    typeof input.receipt.mimeType === "string" &&
    typeof input.receipt.dataBase64 === "string"
      ? input.receipt
      : undefined

  // ---- Server-side validation ----
  if (!Array.isArray(seatIds) || seatIds.length === 0) {
    return { ok: false, error: "من فضلك اختر مقعدًا واحدًا على الأقل." }
  }
  if (seatIds.some((seatId) => typeof seatId !== "string")) {
    return { ok: false, error: "اختيار المقاعد غير صالح." }
  }
  const uniqueSeats = Array.from(new Set(seatIds))
  if (uniqueSeats.length !== seatIds.length) {
    return { ok: false, error: "يوجد تكرار في المقاعد المختارة." }
  }
  if (uniqueSeats.length > MAX_SEATS_PER_BOOKING) {
    return { ok: false, error: `يمكنك حجز ${MAX_SEATS_PER_BOOKING} مقاعد كحد أقصى في الطلب الواحد.` }
  }
  if (typeof eventId !== "number" || !Number.isInteger(eventId)) {
    return { ok: false, error: "طلب الحجز غير صالح." }
  }
  if (typeof customerName !== "string" || typeof customerEmail !== "string") {
    return { ok: false, error: "الاسم والبريد الإلكتروني مطلوبان." }
  }
  if (!customerName.trim() || !customerEmail.trim()) {
    return { ok: false, error: "الاسم والبريد الإلكتروني مطلوبان." }
  }
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim())
  if (!emailOk) {
    return { ok: false, error: "من فضلك أدخل بريدًا إلكترونيًا صحيحًا." }
  }
  // رقم الهاتف إجباري: 8–15 رقمًا بعد إزالة المسافات والشرطات، مع + اختيارية.
  const phoneDigits = customerPhone.replace(/[\s-]/g, "")
  if (!/^\+?\d{8,15}$/.test(phoneDigits)) {
    return { ok: false, error: "من فضلك أدخل رقم هاتف صحيحًا (مثال: 0100 000 0000)." }
  }

  // ---- Load the event, the venue and validate the sale window ----
  // The database is the source of truth for prices; the client never sends one.
  const seatRecords: { seatId: string; tierId: string; tierName: string; priceCents: number }[] = []
  let totalCents = 0
  let totals = { subtotalCents: 0, serviceFeeCents: 0, totalCents: 0 }
  let eventTitle = ""
  let venueName = ""
  let venueCity = ""
  let eventStartsAt: Date | null = null
  try {
    if (!getConnectionString()) {
      return {
        ok: false,
        error: "الحجز متوقف مؤقتًا: لا توجد قاعدة بيانات مهيأة (متغير DATABASE_URL مفقود).",
      }
    }

    const eventRows = await db.select().from(events).where(eq(events.id, eventId)).limit(1)
    const event = eventRows[0]
    if (!event) return { ok: false, error: "لم يتم العثور على هذا العرض." }

    const blocked = bookingBlockedReason(event)
    if (blocked) return { ok: false, error: blocked }

    const venueRows = await db
      .select({
        id: venues.id,
        name: venues.name,
        city: venues.city,
        rows: venues.rows,
        seatsPerRow: venues.seatsPerRow,
      })
      .from(venues)
      .where(eq(venues.id, event.venueId))
      .limit(1)
    const venue = venueRows[0]
    if (!venue) {
      return {
        ok: false,
        error: "قاعة هذا العرض غير مسجلة، لذا لا يمكن حجز المقاعد.",
      }
    }

    const tiers = Array.isArray(event.priceTiers) ? event.priceTiers : []
    if (tiers.length === 0) {
      return { ok: false, error: "التسعير غير متاح لهذا العرض." }
    }

    for (const seatId of uniqueSeats) {
      const parsed = parseSeatId(seatId)
      if (!parsed) {
        return { ok: false, error: `مقعد غير صالح: ${seatId}` }
      }
      if (parsed.rowIndex >= venue.rows || parsed.seatNumber > venue.seatsPerRow) {
        return {
          ok: false,
          error: `المقعد ${seatId} غير موجود في ${venue.name} (${venue.rows} صفوف × ${venue.seatsPerRow} مقعدًا).`,
        }
      }
      const tier = tierForRow(tiers, parsed.rowIndex)
      if (!tier) return { ok: false, error: "التسعير غير متاح لهذا العرض." }
      seatRecords.push({ seatId, tierId: tier.id, tierName: tier.name, priceCents: tier.priceCents })
    }

    eventTitle = typeof event.title === "string" ? event.title : ""
    venueName = venue.name
    venueCity = venue.city
    eventStartsAt = event.startsAt instanceof Date ? event.startsAt : new Date(event.startsAt)

    // Service fee (10%, minimum 5) is added on top of the seat subtotal.
    totals = calculateTotals(seatRecords.map((record) => record.priceCents))
    totalCents = totals.totalCents
  } catch (error) {
    logFailure("loading show data", error)
    return { ok: false, error: databaseFailureMessage(error) }
  }

  // ---- Atomic reservation in a transaction ----
  let client
  try {
    client = await pool.connect()
  } catch (error) {
    logFailure("acquiring a database connection", error)
    return { ok: false, error: databaseFailureMessage(error) }
  }

  try {
    await client.query("BEGIN")

    const reference = makeReference()
    const bookingInsert = await client.query(
      `INSERT INTO bookings (reference, event_id, customer_name, customer_email, customer_phone, seats, total_cents, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'confirmed') RETURNING id`,
      [
        reference,
        eventId,
        customerName.trim(),
        customerEmail.trim(),
        customerPhone.trim(),
        JSON.stringify(seatRecords),
        totalCents,
      ],
    )
    const bookingId = bookingInsert.rows[0].id as number

    // Unique constraint on (event_id, seat_id) rejects double-booking atomically.
    for (const seatId of uniqueSeats) {
      await client.query(
        `INSERT INTO booked_seats (event_id, seat_id, booking_id) VALUES ($1,$2,$3)`,
        [eventId, seatId, bookingId],
      )
    }

    await client.query("COMMIT")

    // إشعار تليجرام بعد نجاح الحجز — لا يُفشل الحجز أبدًا (sendBookingNotification لا ترمي).
    if (eventStartsAt) {
      await sendBookingNotification({
        reference,
        eventTitle,
        venueName,
        venueCity,
        startsAt: eventStartsAt,
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim(),
        customerPhone: phoneDigits,
        seats: seatRecords.map((record) => ({
          seatId: record.seatId,
          tierName: record.tierName,
          priceCents: record.priceCents,
        })),
        subtotalCents: totals.subtotalCents,
        serviceFeeCents: totals.serviceFeeCents,
        totalCents,
        receipt,
      })
    }

    return { ok: true, reference, totalCents }
  } catch (error) {
    try {
      await client.query("ROLLBACK")
    } catch (rollbackError) {
      logFailure("rolling back", rollbackError)
    }

    if ((error as { code?: string } | null)?.code === "23505") {
      // unique_violation -> a seat was taken between load and submit
      let taken = uniqueSeats
      try {
        const takenRows = await db
          .select({ seatId: bookedSeats.seatId })
          .from(bookedSeats)
          .where(eq(bookedSeats.eventId, eventId))
        const takenSet = new Set(takenRows.map((row) => row.seatId))
        taken = uniqueSeats.filter((seatId) => takenSet.has(seatId))
      } catch (lookupError) {
        logFailure("re-reading taken seats", lookupError)
      }
      return {
        ok: false,
        error: "عذرًا، أحد المقاعد التي اخترتها حُجز للتو من شخص آخر.",
        takenSeats: taken,
      }
    }

    logFailure("committing the booking", error)
    return { ok: false, error: databaseFailureMessage(error) }
  } finally {
    client.release()
  }
}
