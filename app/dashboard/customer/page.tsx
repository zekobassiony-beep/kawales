import Link from "next/link"
import Image from "next/image"
import { ArrowRight, CalendarDays, MapPin, Send } from "lucide-react"
import { getEvents } from "@/lib/queries"
import { formatDate, formatPrice } from "@/lib/format"
import { SectionTitle } from "@/app/dashboard/ui"
import { CustomerStrip } from "@/app/dashboard/customer/customer-strip"
import { CustomerTicketStats, MyTickets } from "@/app/dashboard/customer/my-tickets"
import { TELEGRAM_BOT_URL } from "@/lib/roles"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "لوحة العميل — كواليس",
  description: "تذاكرك وحجوزاتك وربط حسابك بتليجرام في كواليس.",
}

/** حجوزات العميل وأرقامه تُقرأ الآن حيًّا من مخزن التذاكر (`lib/tickets`). */

export default async function CustomerDashboardPage() {
  const events = await getEvents()
  const upcoming = events.slice(0, 4)

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <Link
        href="/shows"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowRight className="h-4 w-4" />
        العودة إلى العروض
      </Link>

      <CustomerStrip />

      <section className="mt-10">
        <MyTickets />
      </section>

      <section className="mt-10">
        <SectionTitle>حسابي في أرقام</SectionTitle>
        <div className="mt-4">
          <CustomerTicketStats />
        </div>
      </section>

      <section className="mt-12 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div>
          <SectionTitle>عروض قادمة على كواليس</SectionTitle>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {upcoming.map((event) => (
              <article key={event.id} className="overflow-hidden rounded-xl border border-border/60 bg-card">
                <div className="relative aspect-[16/9] w-full">
                  <Image
                    src={event.heroUrl ?? event.posterUrl ?? "/placeholder.svg"}
                    alt={`مشهد من عرض ${event.title}`}
                    fill
                    sizes="(max-width: 768px) 100vw, 400px"
                    className="object-cover"
                  />
                </div>
                <div className="p-4">
                  <h3 className="font-serif text-lg font-semibold">{event.title}</h3>
                  <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {formatDate(event.startsAt)}
                  </p>
                  <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    {event.venue.name}، {event.venue.city}
                  </p>
                  <p className="mt-2 text-sm">
                    تبدأ من{" "}
                    <span className="font-semibold">
                      {formatPrice(Math.min(...event.priceTiers.map((tier) => tier.priceCents)))}
                    </span>
                  </p>
                  <Link
                    href={`/shows/${event.slug}`}
                    className="mt-3 inline-flex text-sm font-medium text-primary transition-colors hover:underline"
                  >
                    احجز مقعدك
                  </Link>
                </div>
              </article>
            ))}
            {upcoming.length === 0 && (
              <p className="text-sm text-muted-foreground">لا توجد عروض معروضة حاليًا.</p>
            )}
          </div>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-xl border border-border/60 bg-card p-5">
            <SectionTitle>تذكرتك على تليجرام</SectionTitle>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              اربط حسابك ببوت كواليس لتستلم التذكرة الرقمية وتتابع تغييرات المواعيد من محادثة واحدة.
            </p>
            <a
              href={TELEGRAM_BOT_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#229ED9] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              <Send className="h-4 w-4" />
              افتح بوت كواليس
            </a>
          </div>
        </aside>
      </section>
    </div>
  )
}
