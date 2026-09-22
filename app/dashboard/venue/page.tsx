import Link from "next/link"
import { ArrowRight, DoorOpen, ScanLine } from "lucide-react"
import { mockVenueSchedule } from "@/lib/dashboards"
import { getEvents } from "@/lib/queries"
import { SectionTitle } from "@/app/dashboard/ui"
import { VenueStats } from "@/app/dashboard/venue/venue-stats"
import { VenueLayoutBuilder } from "@/components/venue-layout-builder"
import { VenueManualCalendar } from "@/components/venue-manual-calendar"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "لوحة المسرح — كواليس",
  description: "إدارة القاعة والمقاعد وجدول الحفلات وخصومات أيام الركود.",
}

const VENUE_ID = 1
const ROWS = 8
const SEATS_PER_ROW = 12

export default async function VenueDashboardPage() {
  const events = await getEvents()
  const venueEvents = events.filter((event) => event.venue.id === VENUE_ID)
  const venueName = venueEvents[0]?.venue.name ?? "مسرح الهوسابير"
  const venueCity = venueEvents[0]?.venue.city ?? "القاهرة"

  const totalCapacity = ROWS * SEATS_PER_ROW
  const ticketsSold = mockVenueSchedule.reduce((sum, show) => sum + show.seats, 0)

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <Link
        href="/shows"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowRight className="h-4 w-4" />
        العودة إلى العروض
      </Link>

      <header className="mt-4">
        <p className="text-sm font-medium uppercase tracking-widest text-primary">لوحة التحكم</p>
        <h1 className="mt-2 font-serif text-3xl font-bold sm:text-4xl">{venueName}</h1>
        <p className="mt-2 text-muted-foreground">{venueCity}</p>
      </header>

      <section className="mt-8">
        <SectionTitle>إحصائيات المسرح</SectionTitle>
        <div className="mt-4">
          <VenueStats dbCapacity={totalCapacity} dbVenueName={venueName} ticketsSold={ticketsSold} />
        </div>
      </section>

      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-primary/30 bg-primary/5 p-5">
          <div>
            <p className="flex items-center gap-2 font-serif text-lg font-semibold">
              <DoorOpen className="h-5 w-5 text-primary" />
              بوابة المسرح — مسح التذاكر
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              سجّل حضور الجمهور بمسح رمز QR أو بإدخال كود التذكرة يدويًا — وهو الشرط الوحيد لكتابة تقييم موثق على العرض.
            </p>
          </div>
          <Link
            href="/dashboard/venue/checkin"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <ScanLine className="h-4 w-4" />
            افتح البوابة
          </Link>
        </div>
      </section>

      <section className="mt-12">
        <SectionTitle>مُنشئ تخطيط المسرح الهجين</SectionTitle>
        <p className="mt-2 text-sm text-muted-foreground">
          اختر قالبًا هندسيًا جاهزًا، ثم خصص القطاعات والصفوف والمقاعد — واضغط أي كرسي لجعله «معطلًا» (ممر/مكسور) بلا حجز.
        </p>
        <div className="mt-4">
          <VenueLayoutBuilder defaultCapacity={totalCapacity} />
        </div>
      </section>

      <section className="mt-12">
        <SectionTitle>التقويم اليدوي وحجز القاعة</SectionTitle>
        <p className="mt-2 text-sm text-muted-foreground">
          حدّد أيام المسرح المتاحة والمحجوزة يدويًا، وضبط نسب الخصم لكل يوم، وبيانات التواصل
          للمخرجين والفرق لطلب حجز القاعة مباشرة.
        </p>
        <div className="mt-4">
          <VenueManualCalendar />
        </div>
      </section>
    </div>
  )
}