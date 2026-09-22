"use client"

import { useRef, useState } from "react"
import { ImagePlus, Loader2, Trash2, Upload } from "lucide-react"
import { cn } from "@/lib/utils"

const AVATAR_SIZE = 256

/**
 * يصغّر الصورة إلى مربع 256px ويُعيدها كـ data URL.
 * مُصدَّرة لإعادة الاستخدام (معرض الصور الدعائية في لوحة الفرقة مثلًا).
 */
export async function compressImageFile(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement("canvas")
  canvas.width = AVATAR_SIZE
  canvas.height = AVATAR_SIZE
  const context = canvas.getContext("2d")
  if (!context) throw new Error("تعذّر تجهيز الصورة")
  // قصّ مربّع من منتصف الصورة ثم تصغيرها.
  const side = Math.min(bitmap.width, bitmap.height)
  context.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    AVATAR_SIZE,
    AVATAR_SIZE,
  )
  bitmap.close()
  return canvas.toDataURL("image/jpeg", 0.82)
}

/**
 * حقل الصورة/الشعار: يقبل رابطًا مباشرًا أو رفع صورة من الجهاز (تُقصّ وتُصغَّر
 * وتُخزَّن كـ data URL داخل الجلسة المحلية).
 */
export function AvatarPicker({
  id,
  label,
  hint,
  value,
  onChange,
  shape = "circle",
}: {
  id: string
  label: string
  hint?: string
  value: string
  onChange: (value: string) => void
  shape?: "circle" | "square"
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    setError("")
    if (!file.type.startsWith("image/")) {
      setError("الملف المختار ليس صورة.")
      return
    }
    setBusy(true)
    try {
      onChange(await compressImageFile(file))
    } catch {
      setError("تعذّر قراءة الصورة، جرّب صورة أخرى.")
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  return (
    <div className="rounded-xl border border-border/60 bg-background/40 p-4">
      <label htmlFor={id} className="block text-xs text-muted-foreground">
        {label}
      </label>

      <div className="mt-3 flex items-center gap-4">
        <span
          className={cn(
            "flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden border border-border/60 bg-secondary text-muted-foreground",
            shape === "circle" ? "rounded-full" : "rounded-xl",
          )}
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element -- معاينة مباشرة لقيمة قد تكون data URL
            <img src={value} alt={label} className="h-full w-full object-cover" />
          ) : (
            <ImagePlus className="h-5 w-5" />
          )}
        </span>

        <div className="min-w-0 flex-1 space-y-2">
          <input
            id={id}
            name={id}
            dir="ltr"
            value={value.startsWith("data:") ? "" : value}
            onChange={(event) => {
              setError("")
              onChange(event.target.value)
            }}
            placeholder={value.startsWith("data:") ? "صورة مرفوعة من الجهاز" : "https://example.com/photo.jpg"}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-left text-sm outline-none transition-colors focus:border-primary"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-full border border-border/60 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-secondary disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {busy ? "جارٍ المعالجة…" : "رفع صورة"}
            </button>
            {value && (
              <button
                type="button"
                onClick={() => {
                  setError("")
                  onChange("")
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-destructive/40 px-3 py-1.5 text-xs font-medium text-destructive-foreground transition-colors hover:bg-destructive/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
                إزالة
              </button>
            )}
          </div>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />

      {(error || hint) && (
        <p className={cn("mt-2 text-xs", error ? "text-destructive-foreground" : "text-muted-foreground")}>
          {error || hint}
        </p>
      )}
    </div>
  )
}
