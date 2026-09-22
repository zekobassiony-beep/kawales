import { getEvents, getCategories } from "@/lib/queries"
import { ShowsCatalog } from "@/components/shows-catalog"
import { LiveShowsGrid } from "@/components/live-events-panel"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "كل العروض — كواليس",
  description: "تصفح كل العروض المسرحية على كواليس واحجز مقعدك الآن.",
}

export default async function ShowsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [params, events, categories] = await Promise.all([searchParams, getEvents(), getCategories()])
  const cities = Array.from(new Set(events.map((e) => e.venue.city))).sort()

  // روابط القائمة الجانبية تصل هنا بصيغة `/shows?category=…&city=…&q=…`
  const firstParam = (value: string | string[] | undefined) =>
    (Array.isArray(value) ? value[0] : value)?.trim() ?? ""
  const requestedCategory = firstParam(params.category)
  const requestedCity = firstParam(params.city)
  const initialCategory = categories.includes(requestedCategory) ? requestedCategory : "All"
  const initialCity = cities.includes(requestedCity) ? requestedCity : "All"
  const initialQuery = firstParam(params.q).slice(0, 60)

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <header className="max-w-2xl">
        <p className="text-sm font-medium uppercase tracking-widest text-primary">
          الموسم
        </p>
        <h1 className="mt-2 font-serif text-4xl font-bold sm:text-5xl">
          كل العروض
        </h1>
        <p className="mt-3 text-muted-foreground leading-relaxed">
          كل العروض المتاحة للبيع حاليًا. صفِّ حسب النوع أو المدينة، ثم اختر
          مقاعدك على الخريطة التفاعلية.
        </p>
      </header>

      {/* `key` يُعيد تهيئة الفلاتر عند التنقل بين روابط القائمة الجانبية على نفس المسار */}
      <div className="mt-10">
        <ShowsCatalog
          key={`${initialCategory}|${initialCity}|${initialQuery}`}
          events={events}
          categories={categories}
          cities={cities}
          initialQuery={initialQuery}
          initialCategory={initialCategory}
          initialCity={initialCity}
        />
      </div>

      <section className="mt-14">
        <h2 className="font-serif text-2xl font-bold">عروض الفرق الجديدة (قريبًا)</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          عروض تنشرها الفرق مباشرة من لوحاتها — تظهر هنا فور إنشائها وتُكمل تفاصيلها لاحقًا.
        </p>
        <div className="mt-6">
          <LiveShowsGrid />
        </div>
      </section>
    </div>
  )
}
