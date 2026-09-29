import { NextRequest, NextResponse } from "next/server"
import { appendFile } from "node:fs/promises"
import path from "node:path"
import { locateElementSource } from "@/lib/dev-inspect-locator"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** ملف سجل التأشير في جذر المشروع (يُستثنى من الحفظ في المستودع). */
const LOG_FILE = ".dev-inspect.log"

type InspectBody = {
  page?: string
  tag?: string
  id?: string
  className?: string
  text?: string
  href?: string
  selector?: string
  rect?: { width?: number; height?: number; top?: number; left?: number }
  react?: { components?: string[]; source?: { fileName?: string; lineNumber?: number } | null } | null
}

/** يستقبل تفاصيل العنصر من الصفحة، ويحدّد مصدره، ويكتب سطرًا في السجل. */
export async function POST(req: NextRequest) {
  // الأداة للتطوير فقط — معطّلة تمامًا في النسخة المنشورة.
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "disabled" }, { status: 404 })
  }

  let body: InspectBody = {}
  try {
    body = (await req.json()) as InspectBody
  } catch {
    // جسم غير صالح — نُكمل بقيم افتراضية.
  }

  const result = await locateElementSource(
    {
      page: body.page,
      tag: body.tag,
      id: body.id,
      className: body.className,
      text: body.text,
      href: body.href,
    },
    process.cwd(),
  )

  const entry = {
    at: new Date().toISOString(),
    page: body.page ?? "",
    tag: body.tag ?? "",
    id: body.id ?? "",
    className: body.className ?? "",
    text: (body.text ?? "").slice(0, 200),
    href: body.href ?? "",
    selector: body.selector ?? "",
    react: body.react ?? null,
    tokens: result.tokens,
    scannedFiles: result.scannedFiles,
    best: result.best ? `${result.best.file}:${result.best.line}` : null,
    candidates: result.candidates.map((candidate) => `${candidate.file}:${candidate.line} (${candidate.score})`),
  }

  try {
    await appendFile(path.join(process.cwd(), LOG_FILE), `${JSON.stringify(entry)}\n`, "utf8")
  } catch (error) {
    console.warn(`[dev-inspect] تعذّرت الكتابة في السجل: ${error instanceof Error ? error.message : error}`)
  }

  // سطر مختصر في طرفية التشغيل ليتابع المطوّر التأشير لحظيًا.
  console.log(
    `[dev-inspect] ${entry.best ?? "لم يُحدَّد"} ← ${body.tag ?? ""} ${(body.text ?? "").slice(0, 40)}`,
  )

  return NextResponse.json({
    ok: true,
    best: result.best,
    candidates: result.candidates,
    tokens: result.tokens,
  })
}

/** فحص سريع من المتصفح: يؤكد أن الأداة مثبّتة وتعمل في وضع التطوير. */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "disabled" }, { status: 404 })
  }
  return NextResponse.json({ ok: true, hint: "أرسل تفاصيل العنصر بطريقة POST من أداة التأشير." })
}
