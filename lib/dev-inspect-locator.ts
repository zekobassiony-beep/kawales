/**
 * محرّك «تحديد مصدر العنصر» — يأخذ تفاصيل عنصر من الصفحة (أسماء التنسيقات + النص)
 * ويعيد الملف ورقم السطر المرجّح في كود المشروع.
 *
 * الطريقة: قياس انتشار كل تنسيق على ملفات المشروع، واختيار الأكثر تحديدًا (الأقل
 * انتشارًا) كبصمة، ثم ترتيب الملفات التي تحتوي أكبر عدد من هذه البصمات، مع وزن إضافي
 * لمطابقة نص العنصر.
 *
 * ملف مستقل تمامًا (لا يعتمد على إطار العمل) ليُختبر من الطرفية مباشرة.
 */
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"

/** تفاصيل العنصر كما تُرسل من الصفحة. */
export type LocateInput = {
  /** مسار الصفحة الحالية (كتلميح فقط). */
  page?: string
  /** نوع الوسم مثل: زر، رابط، قسم (للتوثيق). */
  tag?: string
  /** المُعرّف إن وُجد. */
  id?: string
  /** أسماء التنسيقات (أهم بصمة). */
  className?: string
  /** نص العنصر المرئي. */
  text?: string
  /** رابط الوجهة أو مصدر الصورة إن وُجد. */
  href?: string
}

/** مرشّح واحد (ملف + سطر). */
export type LocateCandidate = {
  file: string
  line: number
  score: number
  snippet: string
  /** هل طابق نص العنصر داخل هذا الملف أيضًا؟ (إشارة ثقة إضافية) */
  textHit?: boolean
}

/** نتيجة التحديد. */
export type LocateResult = {
  best: LocateCandidate | null
  candidates: LocateCandidate[]
  /** عدد الملفات التي تم فحصها. */
  scannedFiles: number
  /** التنسيقات المميزة التي استُخدمت كبصمة. */
  tokens: string[]
}

/** مجلدات المصدر التي نبحث فيها (تُستخدم الموجود منها فقط). */
const SOURCE_ROOTS = [
  "app",
  "src/app",
  "components",
  "src/components",
  "lib",
  "src/lib",
  "pages",
  "src/pages",
  "features",
  "src/features",
]

const EXTENSIONS = new Set([".tsx", ".ts", ".jsx", ".js", ".mjs"])
const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  ".vercel",
  ".turbo",
  "dist",
  "build",
  "coverage",
  "out",
  "public",
])
const MAX_FILES = 5000
const MAX_FILE_BYTES = 400_000
const CACHE_MS = 3000
const MAX_CANDIDATES = 3

type CachedFile = {
  /** مسار نسبي من جذر المشروع (يُعرض للمستخدم). */
  rel: string
  lines: string[]
  text: string
  lower: string
}

let cache: { root: string; at: number; files: CachedFile[] } | null = null

/** يمشي على مجلدات المصدر ويجمع الملفات البرمجية (مع تجاهل مجلدات الحِزم والبناء). */
async function collectFiles(root: string): Promise<CachedFile[]> {
  const files: CachedFile[] = []

  async function walk(dir: string): Promise<void> {
    if (files.length >= MAX_FILES) return
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      if (files.length >= MAX_FILES) return
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name) || entry.name.startsWith(".")) continue
        await walk(full)
        continue
      }
      if (!EXTENSIONS.has(path.extname(entry.name))) continue

      try {
        const raw = await readFile(full, "utf8")
        if (raw.length > MAX_FILE_BYTES) continue
        files.push({
          rel: path.relative(root, full).split(path.sep).join("/"),
          lines: raw.split(/\r?\n/),
          text: raw,
          lower: raw.toLowerCase(),
        })
      } catch {
        // ملف غير قابل للقراءة — نتجاهله.
      }
    }
  }

  for (const sourceRoot of SOURCE_ROOTS) {
    await walk(path.join(root, sourceRoot))
  }
  return files
}

/** يقرأ الملفات مع ذاكرة مؤقتة قصيرة (٣ ثوانٍ) لتسريع الضغطات المتتالية. */
async function loadFiles(root: string): Promise<CachedFile[]> {
  const now = Date.now()
  if (cache && cache.root === root && now - cache.at < CACHE_MS) return cache.files
  const files = await collectFiles(root)
  cache = { root, at: now, files }
  return files
}

/** يحوّل قائمة التنسيقات إلى كلمات منفصلة. */
function classNameTokens(className?: string): string[] {
  return String(className ?? "")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
}

/** عدد الملفات التي تحتوي كل تنسيق (لمعرفة الأكثر تحديدًا). */
function countTokenCoverage(files: CachedFile[], tokens: string[]): Map<string, number> {
  const coverage = new Map<string, number>()
  for (const token of tokens) {
    if (coverage.has(token)) continue
    let count = 0
    for (const file of files) {
      if (file.text.includes(token)) count += 1
    }
    coverage.set(token, count)
  }
  return coverage
}

/** يبني بصمة البحث النصية من نص العنصر (أول ٢٤ حرفًا بلا رموز زائدة). */
function textProbe(text?: string): string {
  return String(text ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 24)
}

/** يجد أول سطر يحتوي أي بصمة ويعيد رقمه (يبدأ من ١) والمقطع. */
function firstMatchingLine(file: CachedFile, probes: string[]): { line: number; snippet: string } {
  if (probes.length === 0) return { line: 1, snippet: (file.lines[0] ?? "").trim().slice(0, 160) }
  for (let index = 0; index < file.lines.length; index += 1) {
    const line = file.lines[index] ?? ""
    if (probes.some((probe) => line.includes(probe))) {
      return { line: index + 1, snippet: line.trim().slice(0, 160) }
    }
  }
  return { line: 1, snippet: (file.lines[0] ?? "").trim().slice(0, 160) }
}

/**
 * يحدّد المرشّحين لمصدر العنصر داخل المشروع.
 * يعيد المرشّح الأفضل + قائمة مختصرة، مع عدد الملفات المفحوصة والتنسيقات المستخدمة كبصمة.
 */
export async function locateElementSource(
  input: LocateInput,
  projectRoot: string = process.cwd(),
): Promise<LocateResult> {
  const files = await loadFiles(projectRoot)
  if (files.length === 0) {
    return { best: null, candidates: [], scannedFiles: 0, tokens: [] }
  }

  const tokens = classNameTokens(input.className)
  const coverage = countTokenCoverage(files, tokens)
  const probe = textProbe(input.text)
  const probeLower = probe.toLowerCase()

  // البصمة: التنسيقات الأقل انتشارًا (وأكثر تحديدًا) — نتجاهل المتكرر في أغلب الملفات.
  const ranked = tokens
    .map((token) => ({ token, count: coverage.get(token) ?? 0 }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => a.count - b.count)
  const threshold = Math.max(1, Math.floor(files.length * 0.5))
  const specific = ranked.filter((entry) => entry.count <= threshold).slice(0, 3).map((entry) => entry.token)
  const signatureTokens = specific.length > 0 ? specific : ranked.slice(0, 2).map((entry) => entry.token)
  const otherTokens = tokens.filter((token) => !signatureTokens.includes(token)).slice(0, 12)

  const fullClassName = String(input.className ?? "").replace(/\s+/g, " ").trim()
  const candidates: (LocateCandidate & { textHit?: boolean })[] = []

  for (const file of files) {
    let score = 0
    const hitSignatures: string[] = []

    for (const token of signatureTokens) {
      if (file.text.includes(token)) {
        score += 10
        hitSignatures.push(token)
      }
    }
    for (const token of otherTokens) {
      if (file.text.includes(token)) score += 1
    }

    const textHit = probe.length >= 4 && file.lower.includes(probeLower)
    if (textHit) score += 8
    if (input.href && input.href.length > 3 && file.text.includes(input.href)) score += 3
    // مطابقة قائمة التنسيقات كاملة (إشارة قوية جدًا عند وجودها حرفيًا في الكود).
    const exactHits = fullClassName.length >= 16 && file.text.includes(fullClassName)
    if (exactHits) score += 15
    if (score === 0) continue

    const tokenProbes =
      hitSignatures.length > 0 ? hitSignatures : signatureTokens.length > 0 ? signatureTokens : otherTokens
    const tokenAnchor = tokenProbes.length > 0 ? firstMatchingLine(file, tokenProbes) : null
    const probeAnchor = textHit ? firstMatchingLine(file, [probe]) : null

    // سطر النص أدقّ عادةً (هو سطر العنصر نفسه)؛ ونرجّح سطر التنسيقات إن كان النص بعيدًا عنه.
    let anchor = probeAnchor ?? tokenAnchor ?? { line: 1, snippet: (file.lines[0] ?? "").trim().slice(0, 160) }
    if (probeAnchor && tokenAnchor && Math.abs(probeAnchor.line - tokenAnchor.line) > 40) {
      anchor = tokenAnchor
    }

    candidates.push({ file: file.rel, line: anchor.line, score, snippet: anchor.snippet, textHit })
  }

  candidates.sort(
    (a, b) =>
      b.score - a.score ||
      Number(Boolean(b.textHit)) - Number(Boolean(a.textHit)) ||
      a.file.localeCompare(b.file),
  )

  return {
    best: candidates[0] ?? null,
    candidates: candidates.slice(0, MAX_CANDIDATES),
    scannedFiles: files.length,
    tokens: signatureTokens,
  }
}

