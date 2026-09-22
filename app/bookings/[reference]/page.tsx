import Link from "next/link"
import { notFound } from "next/navigation"
import { CalendarDays, CheckCircle2, Clock, Info, MapPin } from "lucide-react"
import { getBookingByReference, getEventById } from "@/lib/queries"
import { formatDate, formatPrice, formatTime } from "@/lib/format"
import { calculateTotals } from "@/lib/pricing"
import { googleCalendarUrl } from "@/lib/calendar"
import { PrintButton } from "@/components/print-button"

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params
  return {
    title: `تذكرة ${reference.toUpperCase()} — كواليس`,
    description: "تذكرتك الرقمية من كواليس.",
  }
}

export default async function BookingConfirmationPage({
  params,
}: {
  params: Promise<{ reference: string }>
}) {
  const { reference } = await params
  const booking = await getBookingByReference(reference.trim().toUpperCase())
  if (!booking) notFound()

  const event = await getEventById(booking.eventId)
  const seats = Array.isArray(booking.seats) ? booking.seats : []
  const totals = calculateTotals(seats.map((seat) => seat.priceCents))
  const tierById = new Map((event?.priceTiers ?? []).map((tier) => [tier.id, tier]))

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <div className="flex items-center gap-3 text-primary">
        <CheckCircle2 className="h-6 w-6" />
        <p className="text-sm font-medium uppercase tracking-widest">تم تأكيد الحجز</p>
      </div>
      <h1 className="mt-3 font-serif text-3xl font-bold sm:text-4xl">
        مقاعدك محجوزة بالفعل
      </h1>
      <p className="mt-3 text-muted-foreground">
        أُرسل تأكيد إلى <span className="text-foreground">{booking.customerEmail}</span>.
        اعرض هذه التذكرة عند البوابة.
      </p>

      <div className="mt-8 overflow-hidden rounded-2xl border border-border/60 bg-card">
        <div className="grid md:grid-cols-[1fr_240px]">
          {/* Ticket body */}
          <div className="p-6 sm:p-8">
            <p className="text-sm font-medium uppercase tracking-wide text-primary">
              {event?.troupe.name ?? "Kawalees"}
            </p>
            <h2 className="mt-2 font-serif text-2xl font-semibold">
              {event?.title ?? "تفاصيل العرض غير متاحة"}
            </h2>

            <dl className="mt-6 space-y-3 text-sm">
              <Detail icon={CalendarDays} label="التاريخ">
                {event ? formatDate(event.startsAt) : "—"}
              </Detail>
              <Detail icon={Clock} label="الوقت">
                {event ? formatTime(event.startsAt) : "—"}
              </Detail>
              <Detail icon={MapPin} label="المكان">
                {event ? `${event.venue.name}، ${event.venue.city}` : "—"}
              </Detail>
            </dl>

            <div className="mt-6 border-t border-border/60 pt-5">
              <h3 className="text-xs uppercase tracking-wide text-muted-foreground">
                المقاعد ({seats.length})
              </h3>
              <ul className="mt-3 space-y-2 text-sm">
                {seats.map((seat) => {
                  const tier = tierById.get(seat.tierId)
                  return (
                    <li key={seat.seatId} className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2">
                        {tier && (
                          <span
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: tier.color }}
                          />
                        )}
                        <span className="font-medium">{seat.seatId}</span>
                        <span className="text-muted-foreground">
                          {tier?.name ?? seat.tierId}
                        </span>
                      </span>
                      <span className="font-medium">{formatPrice(seat.priceCents)}</span>
                    </li>
                  )
                })}
              </ul>
            </div>

            <div className="mt-6 space-y-2 border-t border-border/60 pt-5 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">المجموع الفرعي</span>
                <span className="font-medium">{formatPrice(totals.subtotalCents)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">رسوم الخدمة</span>
                <span className="font-medium">{formatPrice(totals.serviceFeeCents)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-2">
                <span className="font-medium">الإجمالي المدفوع</span>
                <span className="text-lg font-semibold">{formatPrice(booking.totalCents)}</span>
              </div>
            </div>
          </div>
          <div className="border-t border-dashed border-border/60 bg-background/40 p-6 md:border-l md:border-t-0">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">الرقم المرجعي</p>
            <p className="mt-1 font-mono text-lg font-semibold tracking-wider">
              {booking.reference}
            </p>

            <div className="mt-4 rounded-lg bg-foreground/90 p-3">
              <TicketBarcode value={booking.reference} />
            </div>

            <dl className="mt-5 space-y-2 text-xs">
              <div>
                <dt className="uppercase tracking-wide text-muted-foreground">الاسم</dt>
                <dd className="font-medium">{booking.customerName}</dd>
              </div>
              {booking.customerPhone ? (
                <div>
                  <dt className="uppercase tracking-wide text-muted-foreground">الهاتف</dt>
                  <dd className="font-medium">{booking.customerPhone}</dd>
                </div>
              ) : null}
              <div>
                <dt className="uppercase tracking-wide text-muted-foreground">الحالة</dt>
                <dd className="font-medium capitalize">{booking.status}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {event ? (
          <a
            href={googleCalendarUrl({
              title: `عرض ${event.title} — كواليس`,
              location: `${event.venue.name}، ${event.venue.city}`,
              details: `المرجع: ${booking.reference}\nالمقاعد: ${seats.map((seat) => seat.seatId).join("، ")}`,
              startIso: event.startsAt.toISOString(),
              durationMinutes: event.durationMinutes,
            })}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-border/60 px-6 py-3 text-sm font-semibold transition-colors hover:bg-secondary"
          >
            <CalendarDays className="h-4 w-4" />
            أضف إلى تقويم جوجل 📅
          </a>
        ) : null}
        <PrintButton />
        <Link
          href="/shows"
          className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          تصفح عروضًا أخرى
        </Link>
        {event ? (
          <Link
            href={`/shows/${event.slug}`}
            className="inline-flex items-center justify-center rounded-full border border-border/60 px-6 py-3 text-sm font-medium transition-colors hover:bg-secondary/60"
          >
            تفاصيل العرض
          </Link>
        ) : null}
      </div>

      <p className="mt-6 flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        احفظ المرجع في مكان آمن — كل ما تحتاجه عند البوابة. تُفتح الأبواب عادةً
        قبل العرض بـ 30 دقيقة.
      </p>
    </div>
  )
}

function Detail({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof CalendarDays
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
        <dd className="font-medium">{children}</dd>
      </div>
    </div>
  )
}

/** Dependency-free "scannable" barcode derived from the booking reference. */
function TicketBarcode({ value }: { value: string }) {
  const bars = Array.from(value).flatMap((character) => {
    const code = character.charCodeAt(0)
    return [(code % 3) + 1, (code % 2) + 2, (code % 5) + 1]
  })

  return (
    <div className="flex h-14 items-stretch gap-[2px] overflow-hidden" aria-hidden="true">
      {bars.map((width, index) => (
        <span
          key={`${index}-${width}`}
          className="shrink-0 bg-background"
          style={{ width: `${width}px`, opacity: index % 3 === 0 ? 0.8 : 1 }}
        />
      ))}
    </div>
  )
}