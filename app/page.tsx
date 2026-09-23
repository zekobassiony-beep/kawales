import Link from "next/link"
import { Search, Armchair, Ticket, Drama } from "lucide-react"
import { getEvents, getFeaturedEvents, getSoldSeatCounts, getTroupes } from "@/lib/queries"
import { HeroCarousel } from "@/components/hero-carousel"
import { ShowCard } from "@/components/show-card"
import { LiveShowsGrid } from "@/components/live-events-panel"

export const dynamic = "force-dynamic"

export default async function HomePage() {
  const [featured, events, troupes] = await Promise.all([
    getFeaturedEvents(),
    getEvents(),
    getTroupes(),
  ])

  const upcoming = events
    .filter((event) => new Date(event.startsAt).getTime() > Date.now())
    .slice(0, 4)

  // عدد المقاعد المباعة لكل عرض — لتشغيل شريط الإشغال في الكروت.
  const soldCounts = await getSoldSeatCounts(upcoming.map((event) => event.id))

  return (
    <div>
      <HeroCarousel events={featured} />

      {/* Upcoming shows */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-widest text-primary">
              على الجدول
            </p>
            <h2 className="mt-2 font-serif text-3xl font-bold sm:text-4xl">
              العروض القادمة
            </h2>
          </div>
          <Link
            href="/shows"
            className="hidden shrink-0 text-sm font-medium text-primary hover:underline sm:block"
          >
            كل العروض ←
          </Link>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
          {upcoming.map((event) => (
            <ShowCard key={event.id} event={event} sold={soldCounts.get(event.id) ?? 0} />
          ))}
        </div>

        <Link
          href="/shows"
          className="mt-8 block text-center text-sm font-medium text-primary hover:underline sm:hidden"
        >
          كل العروض ←
        </Link>
      </section>

      {/* أحدث عروض الفرق — تُقرأ حيًّا من لوحات الفرقة */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-widest text-primary">مباشر من الفرق</p>
            <h2 className="mt-2 font-serif text-3xl font-bold sm:text-4xl">أحدث العروض</h2>
          </div>
        </div>
        <div className="mt-8">
          <LiveShowsGrid />
        </div>
      </section>

      {/* كيف يعمل */}
      <section id="how-it-works" className="border-y border-border/60 bg-card/30">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-medium uppercase tracking-widest text-primary">
              كيف يعمل
            </p>
            <h2 className="mt-2 font-serif text-3xl font-bold sm:text-4xl text-balance">
              من رفع الستار إلى جيبك في ثلاث خطوات
            </h2>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              {
                icon: Search,
                title: "اكتشف العرض",
                body: "تصفّح أعمال أرقى الفرق المصرية وصفِّ النتائج حسب التاريخ أو المدينة أو النوع.",
              },
              {
                icon: Armchair,
                title: "اختر مقعدك",
                body: "حدد مكانك بالضبط على خريطة مقاعد تفاعلية تُظهر التوافر لحظة بلحظة.",
              },
              {
                icon: Ticket,
                title: "استلم تذكرتك",
                body: "أكمل الحجز بأمان واستلم تذكرة رقمية بكود قابل للمسح، جاهزة عند الباب.",
              },
            ].map((step, i) => (
              <div
                key={step.title}
                className="relative rounded-xl border border-border/60 bg-background p-6"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <step.icon className="h-6 w-6" />
                </span>
                <h3 className="mt-4 font-serif text-xl font-semibold">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {step.body}
                </p>
                <span className="absolute left-5 top-5 font-serif text-2xl text-border">
                  {i + 1}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Troupes */}
      <section id="troupes" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="max-w-2xl">
          <p className="text-sm font-medium uppercase tracking-widest text-primary">
            الفرق
          </p>
          <h2 className="mt-2 font-serif text-3xl font-bold sm:text-4xl">
            تعرّف على الفرق
          </h2>
          <p className="mt-3 text-muted-foreground leading-relaxed">
            كواليس موطن لعائلة نامية من الفرق المسرحية المصرية، لكلٍّ منها صوتها
            وحرفتها وجمهورها.
          </p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {troupes.map((troupe) => (
            <div
              key={troupe.id}
              className="rounded-xl border border-border/60 bg-card p-5"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Drama className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-serif text-lg font-semibold">
                {troupe.name}
              </h3>
              {troupe.city && (
                <p className="text-xs uppercase tracking-wide text-primary">
                  {troupe.city}
                  {troupe.foundedYear ? ` · تأسست عام ${troupe.foundedYear}` : ""}
                </p>
              )}
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground line-clamp-4">
                {troupe.bio}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/15 via-card to-accent/10 px-6 py-14 text-center sm:px-12">
          <h2 className="mx-auto max-w-2xl font-serif text-3xl font-bold sm:text-4xl text-balance">
            أفضل مقعد في الصالة يبعد عنك نقرة واحدة
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-muted-foreground leading-relaxed">
            استكشف موسم المسرح كاملًا واحجز مكانك قبل أن تنطفئ أضواء الصالة.
          </p>
          <Link
            href="/shows"
            className="mt-7 inline-flex rounded-full bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            تصفح كل العروض
          </Link>
        </div>
      </section>
    </div>
  )
}
