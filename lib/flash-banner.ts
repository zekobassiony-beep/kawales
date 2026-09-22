"use client"

import { useSyncExternalStore } from "react"

/**
 * نشرة التنبيهات العاجلة (Flash Banner):
 * شريط يظهر أعلى الموقع بالكامل، وتتحكم فيه لوحة التحكم العليا `/hq-kawalees`
 * (إظهار/إخفاء + تعديل النص واللون والرابط).
 */

export type FlashBannerTone = "info" | "warning" | "urgent"

export type FlashBannerState = {
  enabled: boolean
  text: string
  tone: FlashBannerTone
  linkUrl?: string
  linkLabel?: string
  updatedAt: string
}

export const FLASH_BANNER_STORAGE_KEY = "kawalees:flash-banner"
export const FLASH_BANNER_CHANGE_EVENT = "kawalees:flash-banner-change"

export const FLASH_TONES: Record<FlashBannerTone, { label: string; className: string; emoji: string }> = {
  info: { label: "معلومة", className: "bg-sky-600 text-white", emoji: "ℹ️" },
  warning: { label: "تنبيه", className: "bg-amber-500 text-slate-950", emoji: "⚠️" },
  urgent: { label: "عاجل", className: "bg-red-600 text-white", emoji: "🚨" },
}

export const DEFAULT_FLASH_BANNER: FlashBannerState = {
  enabled: false,
  text: "خصم 20% على عروض الماتينيه هذا الأسبوع — الأماكن محدودة!",
  tone: "info",
  linkUrl: "/shows",
  linkLabel: "تصفح العروض",
  updatedAt: "2026-01-01T00:00:00.000Z",
}

function parseBanner(raw: string | null): FlashBannerState {
  if (!raw) return DEFAULT_FLASH_BANNER
  try {
    const parsed = JSON.parse(raw) as Partial<FlashBannerState> | null
    if (!parsed || typeof parsed !== "object") return DEFAULT_FLASH_BANNER
    return {
      enabled: parsed.enabled === true,
      text: typeof parsed.text === "string" && parsed.text.trim().length > 0 ? parsed.text : DEFAULT_FLASH_BANNER.text,
      tone: parsed.tone === "warning" || parsed.tone === "urgent" ? parsed.tone : "info",
      linkUrl: typeof parsed.linkUrl === "string" ? parsed.linkUrl : undefined,
      linkLabel: typeof parsed.linkLabel === "string" ? parsed.linkLabel : undefined,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : DEFAULT_FLASH_BANNER.updatedAt,
    }
  } catch {
    return DEFAULT_FLASH_BANNER
  }
}

let cachedRaw: string | null | undefined
let cachedBanner: FlashBannerState = DEFAULT_FLASH_BANNER

/** حالة شريط التنبيه (وعلى السيرفر: مخفي افتراضيًا). */
export function readFlashBanner(): FlashBannerState {
  if (typeof window === "undefined") return DEFAULT_FLASH_BANNER
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(FLASH_BANNER_STORAGE_KEY)
  } catch {
    raw = null
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw
    cachedBanner = parseBanner(raw)
  }
  return cachedBanner
}

function persistBanner(banner: FlashBannerState): void {
  if (typeof window === "undefined") return
  cachedBanner = banner
  const raw = JSON.stringify(banner)
  try {
    window.localStorage.setItem(FLASH_BANNER_STORAGE_KEY, raw)
  } catch {
    // تخزين معطّل — نكمل بالذاكرة.
  }
  cachedRaw = raw
  window.dispatchEvent(new Event(FLASH_BANNER_CHANGE_EVENT))
}

function subscribe(onStoreChange: () => void): () => void {
  window.addEventListener(FLASH_BANNER_CHANGE_EVENT, onStoreChange)
  window.addEventListener("storage", onStoreChange)
  return () => {
    window.removeEventListener(FLASH_BANNER_CHANGE_EVENT, onStoreChange)
    window.removeEventListener("storage", onStoreChange)
  }
}

const getServerSnapshot = (): FlashBannerState => DEFAULT_FLASH_BANNER

/** حالة الشريط الحيّة — متزامنة بين لوحة العمليات وكل صفحات الموقع. */
export function useFlashBanner(): FlashBannerState {
  return useSyncExternalStore(subscribe, readFlashBanner, getServerSnapshot)
}

/** تعديل جزئي لشريط التنبيه (إظهار/إخفاء، النص، اللون، الرابط). */
export function updateFlashBanner(patch: Partial<Omit<FlashBannerState, "updatedAt">>): void {
  persistBanner({ ...readFlashBanner(), ...patch, updatedAt: new Date().toISOString() })
}

/** زر سريع لإظهار/إخفاء الشريط. */
export function toggleFlashBanner(enabled?: boolean): void {
  const current = readFlashBanner()
  updateFlashBanner({ enabled: enabled ?? !current.enabled })
}

/** إخفاء فوري (يُستعمل من زر الإغلاق في الشريط نفسه). */
export function hideFlashBanner(): void {
  updateFlashBanner({ enabled: false })
}
