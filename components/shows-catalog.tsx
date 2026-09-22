"use client"

import { useMemo, useState } from "react"
import { Search, SlidersHorizontal } from "lucide-react"
import type { EventWithRelations } from "@/lib/queries"
import { ShowCard } from "@/components/show-card"

export function ShowsCatalog({
  events,
  categories,
  cities,
  initialQuery = "",
  initialCategory = "All",
  initialCity = "All",
}: {
  events: EventWithRelations[]
  categories: string[]
  cities: string[]
  /** تعبئة أولية قادمة من روابط القائمة الجانبية (`/shows?q=…&category=…&city=…`). */
  initialQuery?: string
  initialCategory?: string
  initialCity?: string
}) {
  const [query, setQuery] = useState(initialQuery)
  const [category, setCategory] = useState<string>(initialCategory)
  const [city, setCity] = useState<string>(initialCity)
  const [sort, setSort] = useState<"date" | "price">("date")

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = events.filter((e) => {
      const matchesQuery =
        !q ||
        e.title.toLowerCase().includes(q) ||
        e.troupe.name.toLowerCase().includes(q) ||
        e.venue.name.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q)
      const matchesCategory = category === "All" || e.category === category
      const matchesCity = city === "All" || e.venue.city === city
      return matchesQuery && matchesCategory && matchesCity
    })

    list = [...list].sort((a, b) => {
      if (sort === "price") {
        const pa = Math.min(...a.priceTiers.map((t) => t.priceCents))
        const pb = Math.min(...b.priceTiers.map((t) => t.priceCents))
        return pa - pb
      }
      return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
    })

    return list
  }, [events, query, category, city, sort])

  const chip = (active: boolean) =>
    `rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
      active
        ? "bg-primary text-primary-foreground"
        : "bg-secondary text-secondary-foreground hover:bg-secondary/70"
    }`

  return (
    <div>
      {/* Search + sort */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث عن عرض أو فرقة أو مسرح..."
            className="w-full rounded-full border border-border bg-card py-2.5 pl-10 pr-4 text-sm outline-none transition-colors focus:border-primary"
          />
        </div>
        <div className="flex items-center gap-2 text-sm">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as "date" | "price")}
            className="rounded-full border border-border bg-card px-3 py-2 text-sm outline-none transition-colors focus:border-primary"
          >
            <option value="date">الأقرب موعدًا</option>
            <option value="price">الأقل سعرًا</option>
          </select>
        </div>
      </div>

      {/* Category chips */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button className={chip(category === "All")} onClick={() => setCategory("All")}>
          كل الأنواع
        </button>
        {categories.map((c) => (
          <button key={c} className={chip(category === c)} onClick={() => setCategory(c)}>
            {c}
          </button>
        ))}
      </div>

      {/* City chips */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button className={chip(city === "All")} onClick={() => setCity("All")}>
          كل المدن
        </button>
        {cities.map((c) => (
          <button key={c} className={chip(city === c)} onClick={() => setCity(c)}>
            {c}
          </button>
        ))}
      </div>

      <p className="mt-6 text-sm text-muted-foreground">
        {filtered.length === 1 ? "عرض واحد" : `${filtered.length} عرض`}
      </p>

      {filtered.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-border bg-card/40 p-12 text-center">
          <p className="font-serif text-lg">لا توجد عروض مطابقة لبحثك</p>
          <p className="mt-1 text-sm text-muted-foreground">
            جرّب إلغاء أحد الفلاتر أو البحث بكلمة أخرى.
          </p>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
          {filtered.map((event) => (
            <ShowCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  )
}
