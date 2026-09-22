/**
 * روابط تقويم Google — تُنشئ رابط إضافة حدث جاهزًا بموعد العرض واسمه وعنوان المسرح.
 * ملف بلا اعتماد على المتصفح (يُستعمل من مكونات السيرفر والعميل معًا).
 */

export type CalendarEventInput = {
  title: string
  location?: string
  details?: string
  /** وقت البداية ISO (بتوقيت UTC). */
  startIso: string
  /** وقت النهاية ISO (بتوقيت UTC). */
  endIso: string
}

/** تنسيق Google Calendar للتوقيت: `YYYYMMDDTHHMMSSZ`. */
function toGcal(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")
}

/**
 * رابط «إضافة إلى تقويم جوجل» جاهز للفتح.
 * `durationMinutes` يُستخدم لتقدير وقت الانتهاء عند عدم تمرير `endIso`.
 */
export function googleCalendarUrl(input: {
  title: string
  location?: string
  details?: string
  startIso: string
  endIso?: string
  durationMinutes?: number
}): string {
  const start = new Date(input.startIso)
  const end = input.endIso
    ? new Date(input.endIso)
    : new Date(start.getTime() + (input.durationMinutes ?? 90) * 60_000)

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: input.title,
    dates: `${toGcal(start)}/${toGcal(end)}`,
  })
  if (input.location) params.set("location", input.location)
  if (input.details) params.set("details", input.details)

  return `https://calendar.google.com/calendar/render?${params.toString()}`
}
