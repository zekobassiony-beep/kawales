/**
 * تجهيز صورة الإيصال في المتصفح قبل إرسالها إلى السيرفر:
 *  - تصغير الأبعاد وإعادة الترميز JPEG لتقليل الحجم من ~5MB إلى أقل من ~400KB،
 *    وهو أكبر مكسب في سرعة تأكيد الدفع على شبكات الموبايل.
 *  - **سقوط آمن**: عند تعذّر فكّ الصورة (مثل HEIC على بعض المتصفحات) نُعيد الملف كما هو
 *    حتى لا يتعطّل الحجز — والسيرفر يعرف كيف يرسل الصيغ غير المدعومة كملف.
 *
 * ملف عميل فقط (يعتمد على Canvas/Image)، بلا أي مكتبات خارجية.
 */

export type CompressOptions = {
  /** أقصى بُعد (الطول أو العرض) للصورة النهائية. */
  maxSide?: number
  /** جودة JPEG الابتدائية (0–1). */
  quality?: number
  /** الحد الأقصى المسموح لحجم الناتج بالبايت. */
  maxBytes?: number
}

export type PreparedReceiptImage = {
  /** data URL جاهز للإرسال كـ `receiptImage`. */
  dataUrl: string
  mimeType: string
  bytes: number
  originalBytes: number
  width: number
  height: number
  /** هل أُعيد ترميز الصورة فعلًا (ضغط/تصغير)؟ */
  compressed: boolean
}

const DEFAULTS: Required<CompressOptions> = {
  maxSide: 1600,
  quality: 0.72,
  maxBytes: 400 * 1024,
}

/** يحسب الأبعاد بعد التصغير مع الحفاظ على النسبة (دالة نقية قابلة للاختبار). */
export function scaledDimensions(
  width: number,
  height: number,
  maxSide: number,
): { width: number; height: number } {
  const longest = Math.max(width, height)
  if (!Number.isFinite(longest) || longest <= 0 || longest <= maxSide) {
    return { width: Math.max(1, Math.round(width) || 1), height: Math.max(1, Math.round(height) || 1) }
  }
  const ratio = maxSide / longest
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  }
}

/** صيغة مقروءة لحجم الملف (تُعرض بجانب الإيصال في نموذج الدفع). */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB"
  const kb = bytes / 1024
  return kb < 1024 ? `${Math.round(kb)} KB` : `${(kb / 1024).toFixed(1)} MB`
}

/** هل يمكن ضغط هذا الملف؟ (صور فقط، ولا نُعيد ترميز GIF لأن الحركة تضيع). */
function isCompressible(file: File): boolean {
  return file.type.startsWith("image/") && file.type !== "image/gif"
}

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error("تعذّر قراءة الملف"))
    reader.readAsDataURL(blob)
  })
}

type Drawable = {
  image: CanvasImageSource
  width: number
  height: number
  release: () => void
}

/** يحمّل الصورة إلى عنصر قابل للرسم على Canvas (بلا رمي أخطاء). */
async function loadDrawable(file: File): Promise<Drawable | null> {
  // (1) المسار الحديث: createImageBitmap (أسرع ولا يحتاج عنصر <img>).
  try {
    if (typeof createImageBitmap === "function") {
      const bitmap = await createImageBitmap(file)
      return { image: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() }
    }
  } catch {
    // نُكمل بالمسار البديل أدناه.
  }

  // (2) المسار البديل: عنصر <img> + Object URL.
  try {
    const url = URL.createObjectURL(file)
    const element = await new Promise<HTMLImageElement | null>((resolve) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => resolve(null)
      image.src = url
    })
    if (!element) {
      URL.revokeObjectURL(url)
      return null
    }
    return {
      image: element,
      width: element.naturalWidth,
      height: element.naturalHeight,
      release: () => URL.revokeObjectURL(url),
    }
  } catch {
    return null
  }
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality))
}

/** يجهّز صورة الإيصال للإرسال (ضغط + تصغير) مع سقوط آمن إلى الملف الأصلي. */
export async function prepareReceiptImage(
  file: File,
  options: CompressOptions = {},
): Promise<PreparedReceiptImage> {
  const { maxSide, quality, maxBytes } = { ...DEFAULTS, ...options }
  const original = await readAsDataUrl(file)
  const fallback: PreparedReceiptImage = {
    dataUrl: original,
    mimeType: file.type || "image/jpeg",
    bytes: file.size,
    originalBytes: file.size,
    width: 0,
    height: 0,
    compressed: false,
  }

  if (!isCompressible(file) || typeof document === "undefined") return fallback

  const drawable = await loadDrawable(file)
  if (!drawable) {
    console.warn("[receipt] تعذّر فكّ الصورة في المتصفح — أُرسلت كما هي (السيرفر يعالج الصيغ غير المدعومة كملف).")
    return fallback
  }

  try {
    const size = scaledDimensions(drawable.width, drawable.height, maxSide)
    const canvas = document.createElement("canvas")
    canvas.width = size.width
    canvas.height = size.height
    const context = canvas.getContext("2d")
    if (!context) return fallback
    context.drawImage(drawable.image, 0, 0, size.width, size.height)

    let attemptQuality = quality
    let blob = await canvasToJpegBlob(canvas, attemptQuality)
    while (blob && blob.size > maxBytes && attemptQuality > 0.45) {
      attemptQuality = Math.max(0.45, attemptQuality - 0.1)
      blob = await canvasToJpegBlob(canvas, attemptQuality)
    }
    if (!blob) return fallback

    // لا نُكبّر الحجم: إن كان الملف الأصلي أصغر وبلا تصغير فعلي نُبقيه كما هو.
    const resized = size.width !== drawable.width || size.height !== drawable.height
    if (!resized && blob.size >= file.size) return fallback

    return {
      dataUrl: await readAsDataUrl(blob),
      mimeType: "image/jpeg",
      bytes: blob.size,
      originalBytes: file.size,
      width: size.width,
      height: size.height,
      compressed: true,
    }
  } catch (error) {
    console.warn(`[receipt] فشل ضغط الصورة: ${error instanceof Error ? error.message : error}`)
    return fallback
  } finally {
    drawable.release()
  }
}
