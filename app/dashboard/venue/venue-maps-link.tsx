"use client"

import { useState, useTransition } from "react"
import { ExternalLink, Loader2, MapPin, Save } from "lucide-react"
import { updateVenueMapsUrl } from "@/app/actions/venue"
import { mapsUrlFor } from "@/lib/show-detail"

/**
 * رابط الخريطة (Google Maps) لكل مسرح — Dark Graphite & Gold.
 * يُحفظ في قاعدة البيانات (`venues.google_maps_url`) ويظهر كزر «افتح في خريطة»
 * في صفحة العرض. عند تركه فارغًا يُستعمل بحث Google Maps التلقائي.
 */

const FIELD =
  "w-full rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-500 focus:border-amber-500"

export type VenueMapsRow = {
  id: number
  name: string
  city: string
  address: string
  googleMapsUrl: string | null
}

export function VenueMapsLinks({ venues }: { venues: VenueMapsRow[] }) {
  const [values, setValues] = useState<Record<number, string>>(
    Object.fromEntries(venues.map((venue) => [venue.id, venue.googleMapsUrl ?? ""])),
  )
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const save = (venue: VenueMapsRow) => {
    setNotice(null)
    startTransition(async () => {
      const result = await updateVenueMapsUrl(venue.id, values[venue.id] ?? "")
      setNotice(result.ok ? `تم حفظ رابط خريطة «${venue.name}» ✓` : result.error ?? "تعذّر الحفظ.")
    })
  }

  if (venues.length === 0) {
    return (
      <p className="rounded-2xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-xs text-amber-200/90">
        لا توجد مسارح مسجّلة بعد — أضف مسرحًا ليظهر هنا حقل رابط الخريطة.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {notice && (
        <p role="status" className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-300">
          {notice}
        </p>
      )}

      {venues.map((venue) => (
        <div key={venue.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400">
                <MapPin className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-zinc-100">{venue.name}</p>
                <p className="text-[11px] text-zinc-500">
                  {venue.address} — {venue.city}
                </p>
              </div>
            </div>
            <a
              href={mapsUrlFor({ ...venue, googleMapsUrl: values[venue.id] })}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-[11px] font-semibold text-amber-300 transition-colors hover:bg-amber-500/20"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              معاينة الرابط
            </a>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              type="url"
              dir="ltr"
              value={values[venue.id] ?? ""}
              onChange={(event) => setValues((current) => ({ ...current, [venue.id]: event.target.value }))}
              placeholder="https://maps.app.goo.gl/..."
              className={FIELD}
            />
            <button
              type="button"
              disabled={pending}
              onClick={() => save(venue)}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-zinc-950 transition-colors hover:bg-amber-400 disabled:opacity-50"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              حفظ الرابط
            </button>
          </div>
          <p className="mt-2 text-[11px] text-zinc-500">
            اتركه فارغًا ليُستخدم بحث Google Maps التلقائي من اسم المسرح والعنوان.
          </p>
        </div>
      ))}
    </div>
  )
}
